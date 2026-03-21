import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream.js";
import type { FastifyReply } from "fastify";

export async function streamClaudeSSE(
  stream: MessageStream,
  reply: FastifyReply
): Promise<void> {
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  for await (const event of stream) {
    // Re-emit Anthropic events directly — they're already in Claude format
    reply.raw.write(`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`);
  }

  reply.raw.end();
}
