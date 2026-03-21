export interface SimulatedNode {
  nodeId: string;
  name: string;
  isMaster: boolean;
  cpu: {
    cores: number;
    model: string;
    usagePercent: number;
  };
  memory: {
    totalGb: number;
    usedGb: number;
  };
  gpu: {
    model: string;
    vramGb: number;
    usagePercent: number;
  };
  connectedTo: string[];
  lastSeen: string;
}

export interface TopologyEdge {
  from: string;
  to: string;
  type: "socket" | "rdma";
}

export interface Topology {
  nodes: SimulatedNode[];
  edges: TopologyEdge[];
}

export interface Instance {
  instanceId: string;
  modelId: string;
  status: "running" | "loading" | "stopped";
  createdAt: string;
  shardAssignments: {
    nodeId: string;
    shardIndex: number;
    shardTotal: number;
  }[];
}

export interface ClusterState {
  topology: Topology;
  instances: Record<string, Instance>;
  masterNodeId: string;
  connectedNodes: string[];
}
