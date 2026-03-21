import type { FastifyInstance } from "fastify";
import type { ClaudeMessagesRequest } from "../types/claude.js";
import { claudeToProxyParams } from "../adapters/claude.js";
import { proxySync, proxyStream } from "../anthropic/proxy.js";
import { streamClaudeSSE } from "../streaming/claude-sse.js";

function claudeError(reply: import("fastify").FastifyReply, status: number, message: string, type = "api_error") {
  return reply.status(status).send({
    type: "error",
    error: { type, message },
  });
}

export async function claudeRoutes(app: FastifyInstance) {
  app.post("/v1/messages", async (request, reply) => {
    const body = request.body as ClaudeMessagesRequest;

    if (!body.messages?.length) {
      return claudeError(reply, 400, "messages is required and must be non-empty", "invalid_request_error");
    }

    try {
      const params = claudeToProxyParams(body);

      if (body.stream) {
        const stream = proxyStream(params);
        await streamClaudeSSE(stream, reply);
        return;
      }

      const message = await proxySync(params);
      return message;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const status = (err as { status?: number }).status ?? 500;
      return claudeError(reply, status, message);
    }
  });
}
