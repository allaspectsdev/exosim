import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import type { ChatCompletionRequest } from "../types/openai.js";
import { openaiToProxyParams } from "../adapters/openai.js";
import { proxySync } from "../anthropic/proxy.js";
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

  // Instance management — static routes must precede parametric :instanceId
  app.post("/instance", async (request) => {
    const body = request.body as { instance?: { model_id?: string }; model_id?: string };
    const modelId = body.instance?.model_id ?? body.model_id ?? "llama-3.3-70b";
    return clusterState.createInstance(modelId);
  });

  // Instance placement preview (static — registered before :instanceId)
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

  // Parametric routes after static ones
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

  // Bench summary
  app.get("/bench/", async () => ({
    throughput_tokens_per_sec: 42.5,
    memory_usage_mb: 512,
    active_instances: clusterState.getInstances().length,
  }));

  // Bench chat completions — like /v1/chat/completions but with perf metrics
  app.post("/bench/chat/completions", async (request, reply) => {
    const body = request.body as ChatCompletionRequest;

    if (!body.messages?.length) {
      return reply.status(400).send({
        error: { message: "messages is required", type: "invalid_request_error" },
      });
    }

    try {
      const params = openaiToProxyParams(body);
      const startTime = Date.now();
      const message = await proxySync(params);
      const elapsed = (Date.now() - startTime) / 1000;

      let content: string | null = null;
      for (const block of message.content) {
        if (block.type === "text") {
          content = (content ?? "") + block.text;
        }
      }

      const promptTokens = message.usage.input_tokens;
      const completionTokens = message.usage.output_tokens;
      const promptTps = elapsed > 0 ? promptTokens / elapsed : 0;
      const generationTps = elapsed > 0 ? completionTokens / elapsed : 0;

      return {
        id: `chatcmpl-${uuidv4()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content },
            finish_reason: message.stop_reason === "max_tokens" ? "length" : "stop",
          },
        ],
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
        prompt_tps: parseFloat(promptTps.toFixed(1)),
        generation_tps: parseFloat(generationTps.toFixed(1)),
        prompt_tokens: promptTokens,
        generation_tokens: completionTokens,
        peak_memory_usage: 512 * 1024 * 1024, // simulated 512MB
      };
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "Internal server error";
      const status = (err as { status?: number }).status ?? 500;
      return reply.status(status).send({ error: { message: errMessage, type: "api_error" } });
    }
  });

  // Place instance — dry-run placement planning
  app.post("/place_instance", async (request) => {
    const body = request.body as { instance?: { model_id?: string }; model_id?: string };
    const modelId = body.instance?.model_id ?? body.model_id ?? "llama-3.3-70b";
    const nodes = clusterState.getNodes();
    return {
      model_id: modelId,
      placement: {
        strategy: "tensor_parallel",
        nodes: nodes.map((n, i) => ({
          node_id: n.nodeId,
          node_name: n.name,
          shard_index: i,
          shard_total: nodes.length,
          estimated_vram_usage_gb: n.gpu.vramGb * 0.7,
        })),
      },
      estimated_throughput_tps: 42.5,
      feasible: true,
    };
  });
}
