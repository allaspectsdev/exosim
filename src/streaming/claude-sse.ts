import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream.js";
import type { FastifyReply } from "fastify";

function write(reply: FastifyReply, data: string): boolean {
  if (reply.raw.destroyed) return false;
  reply.raw.write(data);
  return true;
}

export async function streamClaudeSSE(
  stream: MessageStream,
  reply: FastifyReply
): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  try {
    for await (const event of stream) {
      if (reply.raw.destroyed) break;
      write(reply, `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (!reply.raw.destroyed) {
      write(reply, `event: error\ndata: ${JSON.stringify({
        type: "error",
        error: { type: "api_error", message },
      })}\n\n`);
    }
  } finally {
    if (!reply.raw.destroyed) {
      reply.raw.end();
    }
  }
}
