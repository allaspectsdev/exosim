import type { FastifyInstance } from "fastify";
import type { ClaudeMessagesRequest } from "../types/claude.js";
import { claudeToProxyParams } from "../adapters/claude.js";
import { proxySync, proxyStream } from "../anthropic/proxy.js";
import { streamClaudeSSE } from "../streaming/claude-sse.js";

export async function claudeRoutes(app: FastifyInstance) {
  app.post("/v1/messages", async (request, reply) => {
    const body = request.body as ClaudeMessagesRequest;
    const params = claudeToProxyParams(body);

    if (body.stream) {
      const stream = proxyStream(params);
      await streamClaudeSSE(stream, reply);
      return;
    }

    const message = await proxySync(params);
    return message;
  });
}
