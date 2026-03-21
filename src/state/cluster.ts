import { v4 as uuidv4 } from "uuid";
import { config } from "../config.js";
import type {
  SimulatedNode,
  TopologyEdge,
  Topology,
  ClusterState as ClusterStateType,
} from "../types/cluster.js";

const MAC_GPUS = [
  { model: "Apple M1 Pro", vramGb: 16 },
  { model: "Apple M1 Max", vramGb: 32 },
  { model: "Apple M2 Pro", vramGb: 16 },
  { model: "Apple M2 Max", vramGb: 32 },
  { model: "Apple M2 Ultra", vramGb: 64 },
  { model: "Apple M3 Pro", vramGb: 18 },
  { model: "Apple M3 Max", vramGb: 36 },
  { model: "Apple M4 Pro", vramGb: 24 },
  { model: "Apple M4 Max", vramGb: 48 },
];

const NODE_NAMES = [
  "exosim-alpha",
  "exosim-beta",
  "exosim-gamma",
  "exosim-delta",
  "exosim-epsilon",
  "exosim-zeta",
  "exosim-eta",
  "exosim-theta",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randomFloat(min: number, max: number, decimals = 1): number {
  return parseFloat((Math.random() * (max - min) + min).toFixed(decimals));
}

function generateNodes(count: number): SimulatedNode[] {
  const nodes: SimulatedNode[] = [];

  for (let i = 0; i < count; i++) {
    const gpu = MAC_GPUS[randomInt(0, MAC_GPUS.length - 1)];
    const totalMemory = gpu.vramGb * 2; // unified memory ≈ 2x GPU VRAM for Apple Silicon

    nodes.push({
      nodeId: uuidv4(),
      name: NODE_NAMES[i] ?? `exosim-node-${i}`,
      isMaster: i === 0,
      cpu: {
        cores: randomInt(8, 24),
        model: gpu.model.replace("Apple ", ""),
        usagePercent: randomFloat(5, 35),
      },
      memory: {
        totalGb: totalMemory,
        usedGb: randomFloat(totalMemory * 0.2, totalMemory * 0.6),
      },
      gpu: {
        model: gpu.model,
        vramGb: gpu.vramGb,
        usagePercent: randomFloat(0, 20),
      },
      connectedTo: [],
      lastSeen: new Date().toISOString(),
    });
  }

  // Build ring topology
  for (let i = 0; i < count; i++) {
    const next = (i + 1) % count;
    nodes[i].connectedTo.push(nodes[next].nodeId);
    nodes[next].connectedTo.push(nodes[i].nodeId);
  }

  // Add a random extra edge for realism
  if (count > 2) {
    const a = 0;
    const b = Math.floor(count / 2);
    if (!nodes[a].connectedTo.includes(nodes[b].nodeId)) {
      nodes[a].connectedTo.push(nodes[b].nodeId);
      nodes[b].connectedTo.push(nodes[a].nodeId);
    }
  }

  // Deduplicate connectedTo
  for (const node of nodes) {
    node.connectedTo = [...new Set(node.connectedTo)];
  }

  return nodes;
}

function buildEdges(nodes: SimulatedNode[]): TopologyEdge[] {
  const edges: TopologyEdge[] = [];
  const seen = new Set<string>();

  for (const node of nodes) {
    for (const target of node.connectedTo) {
      const key = [node.nodeId, target].sort().join("-");
      if (!seen.has(key)) {
        seen.add(key);
        edges.push({
          from: node.nodeId,
          to: target,
          type: Math.random() > 0.8 ? "rdma" : "socket",
        });
      }
    }
  }

  return edges;
}

class ClusterStateManager {
  private nodes: SimulatedNode[];
  private edges: TopologyEdge[];
  private instances: Map<string, import("../types/cluster.js").Instance> =
    new Map();

  constructor() {
    this.nodes = generateNodes(config.SIMULATED_NODE_COUNT);
    this.edges = buildEdges(this.nodes);
  }

  getNodes(): SimulatedNode[] {
    return this.nodes;
  }

  getMasterNodeId(): string {
    return this.nodes.find((n) => n.isMaster)!.nodeId;
  }

  getTopology(): Topology {
    return { nodes: this.nodes, edges: this.edges };
  }

  getState(): ClusterStateType {
    return {
      topology: this.getTopology(),
      instances: Object.fromEntries(this.instances),
      masterNodeId: this.getMasterNodeId(),
      connectedNodes: this.nodes.map((n) => n.nodeId),
    };
  }

  createInstance(
    modelId: string
  ): import("../types/cluster.js").Instance {
    const instanceId = uuidv4();
    const shardTotal = this.nodes.length;
    const instance: import("../types/cluster.js").Instance = {
      instanceId,
      modelId,
      status: "running",
      createdAt: new Date().toISOString(),
      shardAssignments: this.nodes.map((node, i) => ({
        nodeId: node.nodeId,
        shardIndex: i,
        shardTotal,
      })),
    };
    this.instances.set(instanceId, instance);
    return instance;
  }

  getInstance(
    instanceId: string
  ): import("../types/cluster.js").Instance | undefined {
    return this.instances.get(instanceId);
  }

  deleteInstance(instanceId: string): boolean {
    return this.instances.delete(instanceId);
  }

  getInstances(): import("../types/cluster.js").Instance[] {
    return [...this.instances.values()];
  }
}

export const clusterState = new ClusterStateManager();
