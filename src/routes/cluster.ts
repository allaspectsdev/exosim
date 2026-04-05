import type { FastifyInstance } from "fastify";
import { clusterState } from "../state/cluster.js";

export async function clusterRoutes(app: FastifyInstance) {
  // Node ID — real Exo returns JSON object
  app.get("/node_id", async () => ({
    node_id: clusterState.getMasterNodeId(),
  }));

  // Full cluster state
  app.get("/state", async () => clusterState.getState());

  // Onboarding
  app.get("/onboarding", async () => ({ complete: true }));
  app.post("/onboarding", async () => ({ complete: true }));

  // Events SSE stream
  app.get("/events", async (_request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });

    // Emit some initial historical events
    const nodes = clusterState.getNodes();
    for (const node of nodes) {
      const event = {
        type: "topology_edge_created",
        node_id: node.nodeId,
        node_name: node.name,
        timestamp: node.lastSeen,
      };
      reply.raw.write(`data: ${JSON.stringify(event)}\n\n`);
    }

    // Keep alive with heartbeat
    const heartbeat = setInterval(() => {
      reply.raw.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    }, 30000);

    _request.raw.on("close", () => {
      clearInterval(heartbeat);
    });
  });

  // Instance management — real Exo nests model_id inside an `instance` object
  app.post("/instance", async (request) => {
    const body = request.body as { instance?: { model_id?: string }; model_id?: string };
    const modelId = body.instance?.model_id ?? body.model_id ?? "llama-3.3-70b";
    return clusterState.createInstance(modelId);
  });

  app.get("/instance/:instanceId", async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const instance = clusterState.getInstance(instanceId);
    if (!instance) {
      reply.status(404).send({ error: "Instance not found" });
      return;
    }
    return instance;
  });

  app.delete("/instance/:instanceId", async (request, reply) => {
    const { instanceId } = request.params as { instanceId: string };
    const deleted = clusterState.deleteInstance(instanceId);
    if (!deleted) {
      reply.status(404).send({ error: "Instance not found" });
      return;
    }
    return { deleted: true };
  });

  // Instance placement preview
  app.get("/instance/placement", async (request) => {
    const { model_id } = request.query as { model_id?: string };
    const nodes = clusterState.getNodes();
    return {
      model_id: model_id ?? "llama-3.3-70b",
      recommended_nodes: nodes.map((n) => n.nodeId),
      shard_count: nodes.length,
      strategy: "tensor_parallel",
    };
  });

  app.get("/instance/previews", async () => {
    const nodes = clusterState.getNodes();
    return {
      previews: [
        {
          strategy: "tensor_parallel",
          nodes: nodes.map((n) => n.nodeId),
          estimated_throughput: "45 tokens/sec",
        },
        {
          strategy: "pipeline_parallel",
          nodes: nodes.map((n) => n.nodeId),
          estimated_throughput: "38 tokens/sec",
        },
      ],
    };
  });

  // Traces (simulated)
  app.get("/v1/traces", async () => ({ traces: [] }));
  app.get("/v1/traces/:taskId", async () => ({ events: [] }));
  app.get("/v1/traces/:taskId/stats", async () => ({
    tokens_per_second: 42.5,
    total_tokens: 0,
    memory_usage_mb: 512,
  }));
  app.post("/v1/traces/delete", async () => ({ deleted: true }));

  // Cancel (noop)
  app.post("/v1/cancel/:commandId", async () => ({ cancelled: true }));

  // Bench
  app.get("/bench/", async () => ({
    throughput_tokens_per_sec: 42.5,
    memory_usage_mb: 512,
    active_instances: clusterState.getInstances().length,
  }));
}
