import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream.js";
import type { FastifyReply } from "fastify";
import type { OllamaChatResponse, OllamaGenerateResponse } from "../types/ollama.js";

function write(reply: FastifyReply, data: string): boolean {
  if (reply.raw.destroyed) return false;
  reply.raw.write(data);
  return true;
}

export async function streamOllamaChat(
  stream: MessageStream,
  reply: FastifyReply,
  requestedModel: string
): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const startTime = Date.now();
  let promptEvalCount = 0;
  let evalCount = 0;
  let thinkingContent = "";

  try {
    for await (const event of stream) {
      if (reply.raw.destroyed) break;

      if (event.type === "message_start") {
        // Capture input token count from the initial message event
        const msg = (event as { type: string; message: { usage?: { input_tokens?: number } } }).message;
        if (msg.usage?.input_tokens) {
          promptEvalCount = msg.usage.input_tokens;
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          const chunk: OllamaChatResponse = {
            model: requestedModel,
            created_at: new Date().toISOString(),
            message: {
              role: "assistant",
              content: event.delta.text,
            },
            done: false,
          };
          write(reply, JSON.stringify(chunk) + "\n");
        } else if (event.delta.type === "thinking_delta") {
          thinkingContent += (event.delta as { type: string; thinking: string }).thinking;
        }
      } else if (event.type === "message_delta") {
        // Capture output token count from the final message delta
        const delta = (event as { type: string; usage?: { output_tokens?: number } });
        if (delta.usage?.output_tokens) {
          evalCount = delta.usage.output_tokens;
        }
      }
    }

    const totalDuration = (Date.now() - startTime) * 1e6; // nanoseconds
    if (!reply.raw.destroyed) {
      const finalChunk: OllamaChatResponse = {
        model: requestedModel,
        created_at: new Date().toISOString(),
        message: { role: "assistant", content: "" },
        done: true,
        done_reason: "stop",
        total_duration: totalDuration,
        load_duration: 0,
        prompt_eval_count: promptEvalCount,
        prompt_eval_duration: 0,
        eval_count: evalCount,
        eval_duration: totalDuration,
      };
      if (thinkingContent) {
        finalChunk.message.thinking = thinkingContent;
      }
      write(reply, JSON.stringify(finalChunk) + "\n");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (!reply.raw.destroyed) {
      write(reply, JSON.stringify({ error: message, done: true }) + "\n");
    }
  } finally {
    if (!reply.raw.destroyed) {
      reply.raw.end();
    }
  }
}

export async function streamOllamaGenerate(
  stream: MessageStream,
  reply: FastifyReply,
  requestedModel: string
): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const startTime = Date.now();
  let promptEvalCount = 0;
  let evalCount = 0;

  try {
    for await (const event of stream) {
      if (reply.raw.destroyed) break;

      if (event.type === "message_start") {
        const msg = (event as { type: string; message: { usage?: { input_tokens?: number } } }).message;
        if (msg.usage?.input_tokens) {
          promptEvalCount = msg.usage.input_tokens;
        }
      } else if (
        event.type === "content_block_delta" &&
        event.delta.type === "text_delta"
      ) {
        const chunk: OllamaGenerateResponse = {
          model: requestedModel,
          created_at: new Date().toISOString(),
          response: event.delta.text,
          done: false,
        };
        write(reply, JSON.stringify(chunk) + "\n");
      } else if (event.type === "message_delta") {
        const delta = (event as { type: string; usage?: { output_tokens?: number } });
        if (delta.usage?.output_tokens) {
          evalCount = delta.usage.output_tokens;
        }
      }
    }

    const totalDuration = (Date.now() - startTime) * 1e6;
    if (!reply.raw.destroyed) {
      const finalChunk: OllamaGenerateResponse = {
        model: requestedModel,
        created_at: new Date().toISOString(),
        response: "",
        done: true,
        done_reason: "stop",
        total_duration: totalDuration,
        load_duration: 0,
        prompt_eval_count: promptEvalCount,
        eval_count: evalCount,
        eval_duration: totalDuration,
      };
      write(reply, JSON.stringify(finalChunk) + "\n");
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (!reply.raw.destroyed) {
      write(reply, JSON.stringify({ error: message, done: true }) + "\n");
    }
  } finally {
    if (!reply.raw.destroyed) {
      reply.raw.end();
    }
  }
}
