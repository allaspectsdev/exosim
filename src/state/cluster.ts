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

  // Build ring topology (skip for single node to avoid self-loop)
  if (count > 1) {
    for (let i = 0; i < count; i++) {
      const next = (i + 1) % count;
      nodes[i].connectedTo.push(nodes[next].nodeId);
      nodes[next].connectedTo.push(nodes[i].nodeId);
    }
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

function drift(current: number, min: number, max: number, maxStep: number): number {
  const delta = (Math.random() - 0.5) * 2 * maxStep;
  const next = current + delta;
  return parseFloat(Math.max(min, Math.min(max, next)).toFixed(1));
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
  private driftInterval: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.nodes = generateNodes(config.SIMULATED_NODE_COUNT);
    this.edges = buildEdges(this.nodes);
    this.startStatsDrift();
  }

  private startStatsDrift(): void {
    // Drift stats every 10 seconds to simulate real hardware fluctuations
    this.driftInterval = setInterval(() => {
      const hasActiveWork = this.instances.size > 0;
      for (const node of this.nodes) {
        // CPU usage drifts within a band depending on activity
        const cpuBase = hasActiveWork ? 25 : 5;
        const cpuRange = hasActiveWork ? 40 : 15;
        node.cpu.usagePercent = drift(node.cpu.usagePercent, cpuBase, cpuBase + cpuRange, 5);

        // Memory usage drifts slowly
        const memMin = node.memory.totalGb * 0.15;
        const memMax = node.memory.totalGb * (hasActiveWork ? 0.7 : 0.45);
        node.memory.usedGb = drift(node.memory.usedGb, memMin, memMax, 0.5);

        // GPU usage spikes during inference
        const gpuBase = hasActiveWork ? 30 : 0;
        const gpuRange = hasActiveWork ? 60 : 10;
        node.gpu.usagePercent = drift(node.gpu.usagePercent, gpuBase, gpuBase + gpuRange, 8);

        // Update lastSeen
        node.lastSeen = new Date().toISOString();
      }
    }, 10000);
  }

  stopDrift(): void {
    if (this.driftInterval) {
      clearInterval(this.driftInterval);
      this.driftInterval = null;
    }
  }

  getNodes(): SimulatedNode[] {
    return this.nodes;
  }

  getMasterNodeId(): string {
    const master = this.nodes.find((n) => n.isMaster);
    if (!master) throw new Error("No master node in cluster");
    return master.nodeId;
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
