import { describe, it, expect, afterAll } from "vitest";
import { clusterState } from "../src/state/cluster.js";

afterAll(() => {
  clusterState.stopDrift();
});

describe("cluster state", () => {
  it("generates the configured number of nodes", () => {
    const nodes = clusterState.getNodes();
    expect(nodes.length).toBeGreaterThanOrEqual(1);
  });

  it("has exactly one master node", () => {
    const nodes = clusterState.getNodes();
    const masters = nodes.filter((n) => n.isMaster);
    expect(masters).toHaveLength(1);
  });

  it("all nodes have valid structure", () => {
    for (const node of clusterState.getNodes()) {
      expect(node.nodeId).toBeTruthy();
      expect(node.name).toBeTruthy();
      expect(node.cpu.cores).toBeGreaterThan(0);
      expect(node.cpu.model).toBeTruthy();
      expect(node.memory.totalGb).toBeGreaterThan(0);
      expect(node.gpu.model).toBeTruthy();
      expect(node.gpu.vramGb).toBeGreaterThan(0);
      expect(node.lastSeen).toBeTruthy();
    }
  });

  it("nodes have ring topology connections", () => {
    const nodes = clusterState.getNodes();
    if (nodes.length > 1) {
      // Every node should be connected to at least one other
      for (const node of nodes) {
        expect(node.connectedTo.length).toBeGreaterThan(0);
      }
    }
  });

  it("getMasterNodeId returns the master's UUID", () => {
    const masterId = clusterState.getMasterNodeId();
    const nodes = clusterState.getNodes();
    const master = nodes.find((n) => n.isMaster);
    expect(masterId).toBe(master!.nodeId);
  });

  it("getTopology returns nodes and edges", () => {
    const topology = clusterState.getTopology();
    expect(topology.nodes).toEqual(clusterState.getNodes());
    expect(topology.edges.length).toBeGreaterThan(0);
    for (const edge of topology.edges) {
      expect(edge.from).toBeTruthy();
      expect(edge.to).toBeTruthy();
      expect(["socket", "rdma"]).toContain(edge.type);
    }
  });

  it("getState returns full cluster state", () => {
    const state = clusterState.getState();
    expect(state.topology).toBeDefined();
    expect(state.masterNodeId).toBeTruthy();
    expect(state.connectedNodes.length).toBe(clusterState.getNodes().length);
    expect(typeof state.instances).toBe("object");
  });
});

describe("instance management", () => {
  it("creates an instance", () => {
    const instance = clusterState.createInstance("llama-3.3-70b");
    expect(instance.instanceId).toBeTruthy();
    expect(instance.modelId).toBe("llama-3.3-70b");
    expect(instance.status).toBe("running");
    expect(instance.shardAssignments.length).toBe(clusterState.getNodes().length);
  });

  it("retrieves a created instance", () => {
    const created = clusterState.createInstance("deepseek-r1");
    const retrieved = clusterState.getInstance(created.instanceId);
    expect(retrieved).toEqual(created);
  });

  it("returns undefined for unknown instance", () => {
    expect(clusterState.getInstance("nonexistent")).toBeUndefined();
  });

  it("deletes an instance", () => {
    const instance = clusterState.createInstance("phi-4");
    expect(clusterState.deleteInstance(instance.instanceId)).toBe(true);
    expect(clusterState.getInstance(instance.instanceId)).toBeUndefined();
  });

  it("returns false for deleting unknown instance", () => {
    expect(clusterState.deleteInstance("nonexistent")).toBe(false);
  });

  it("lists all instances", () => {
    const before = clusterState.getInstances().length;
    clusterState.createInstance("test-model");
    expect(clusterState.getInstances().length).toBe(before + 1);
  });

  it("shard assignments span all nodes", () => {
    const instance = clusterState.createInstance("test-shard");
    const nodes = clusterState.getNodes();
    expect(instance.shardAssignments).toHaveLength(nodes.length);
    for (let i = 0; i < nodes.length; i++) {
      expect(instance.shardAssignments[i].nodeId).toBe(nodes[i].nodeId);
      expect(instance.shardAssignments[i].shardIndex).toBe(i);
      expect(instance.shardAssignments[i].shardTotal).toBe(nodes.length);
    }
  });
});
