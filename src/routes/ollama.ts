import type { FastifyInstance } from "fastify";
import type {
  OllamaChatRequest,
  OllamaGenerateRequest,
  OllamaChatResponse,
  OllamaGenerateResponse,
} from "../types/ollama.js";
import {
  ollamaChatToProxyParams,
  ollamaGenerateToProxyParams,
} from "../adapters/ollama.js";
import { proxySync, proxyStream } from "../anthropic/proxy.js";
import {
  streamOllamaChat,
  streamOllamaGenerate,
} from "../streaming/ollama-ndjson.js";
import { toOllamaTags, findModel, getModelRegistry, parseSize } from "../state/models.js";

function ollamaError(reply: import("fastify").FastifyReply, status: number, message: string) {
  return reply.status(status).send({ error: message });
}

export async function ollamaRoutes(app: FastifyInstance) {
  // Chat endpoint — real Exo serves Ollama at /ollama/api/*
  app.post("/ollama/api/chat", chatHandler);
  app.post("/ollama/api/api/chat", chatHandler);

  async function chatHandler(request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply) {
    const body = request.body as OllamaChatRequest;

    if (!body.messages?.length) {
      return ollamaError(reply, 400, "messages is required and must be non-empty");
    }

    try {
      const shouldStream = body.stream !== false; // Ollama defaults to streaming
      const params = ollamaChatToProxyParams(body);

      if (shouldStream) {
        const stream = proxyStream(params);
        await streamOllamaChat(stream, reply, body.model);
        return;
      }

      const startTime = Date.now();
      const message = await proxySync(params);

      let content = "";
      let thinking = "";
      for (const block of message.content) {
        if (block.type === "text") content += block.text;
        else if (block.type === "thinking") thinking += (block as { type: string; thinking: string }).thinking;
      }

      const totalDuration = (Date.now() - startTime) * 1e6;
      const response: OllamaChatResponse = {
        model: body.model,
        created_at: new Date().toISOString(),
        message: {
          role: "assistant",
          content,
        },
        done: true,
        done_reason: "stop",
        total_duration: totalDuration,
        load_duration: 0,
        prompt_eval_count: message.usage.input_tokens,
        prompt_eval_duration: 0,
        eval_count: message.usage.output_tokens,
        eval_duration: totalDuration,
      };

      if (thinking) response.message.thinking = thinking;

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const status = (err as { status?: number }).status ?? 500;
      return ollamaError(reply, status, message);
    }
  }

  // Generate endpoint
  app.post("/ollama/api/generate", async (request, reply) => {
    const body = request.body as OllamaGenerateRequest;

    if (!body.prompt) {
      return ollamaError(reply, 400, "prompt is required");
    }

    try {
      const shouldStream = body.stream !== false;
      const params = ollamaGenerateToProxyParams(body);

      if (shouldStream) {
        const stream = proxyStream(params);
        await streamOllamaGenerate(stream, reply, body.model);
        return;
      }

      const startTime = Date.now();
      const message = await proxySync(params);

      let content = "";
      for (const block of message.content) {
        if (block.type === "text") content += block.text;
      }

      const totalDuration = (Date.now() - startTime) * 1e6;
      const response: OllamaGenerateResponse = {
        model: body.model,
        created_at: new Date().toISOString(),
        response: content,
        done: true,
        done_reason: "stop",
        total_duration: totalDuration,
        load_duration: 0,
        prompt_eval_count: message.usage.input_tokens,
        eval_count: message.usage.output_tokens,
        eval_duration: totalDuration,
      };

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const status = (err as { status?: number }).status ?? 500;
      return ollamaError(reply, status, message);
    }
  });

  // Tags (list models)
  app.get("/ollama/api/tags", async () => ({
    models: toOllamaTags(),
  }));

  // PS (running models)
  app.get("/ollama/api/ps", async () => ({
    models: toOllamaTags().slice(0, 1).map((m) => ({
      ...m,
      expires_at: new Date(Date.now() + 300000).toISOString(),
      size_vram: m.size,
    })),
  }));

  // Show model details
  app.post("/ollama/api/show", async (request) => {
    const { model } = request.body as { model: string };
    const entry = findModel(model);
    const registry = getModelRegistry();
    const info = entry ?? registry[0];

    return {
      modelfile: `# Modelfile simulated by ExoSim\nFROM ${info.id}`,
      parameters: "temperature 0.7\ntop_p 0.9",
      template: "{{ .System }}\n{{ .Prompt }}",
      details: {
        format: "gguf",
        family: info.family,
        parameter_size: info.parameterSize,
        quantization_level: "Q4_K_M",
      },
      model_info: {
        "general.architecture": info.family,
        "general.parameter_count": parseSize(info.parameterSize) * 1e9,
        "general.context_length": info.contextLength,
      },
    };
  });

  // Version — real Exo identifies itself distinctly from native Ollama
  app.get("/ollama/api/version", async () => ({
    version: "exo v1.0",
  }));

  // HEAD probes used by Open WebUI and other clients
  app.head("/ollama/", async (_request, reply) => {
    reply.status(200).send();
  });
  app.head("/ollama/api/version", async (_request, reply) => {
    reply.status(200).send();
  });

  // Pull — stub for clients that probe this
  app.post("/ollama/api/pull", async (_request, reply) => {
    reply.hijack();
    reply.raw.writeHead(200, {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    reply.raw.write(JSON.stringify({ status: "success" }) + "\n");
    reply.raw.end();
  });

  // Delete — stub
  app.delete("/ollama/api/delete", async () => ({ status: "success" }));

  // Copy — stub
  app.post("/ollama/api/copy", async () => ({ status: "success" }));

  // Embeddings — not supported
  app.post("/ollama/api/embed", async (_request, reply) => {
    reply.status(501).send({ error: "Embeddings not supported by ExoSim" });
  });
  app.post("/ollama/api/embeddings", async (_request, reply) => {
    reply.status(501).send({ error: "Embeddings not supported by ExoSim" });
  });
}
