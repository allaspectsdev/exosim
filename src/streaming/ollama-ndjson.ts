import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream.js";
import type { FastifyReply } from "fastify";
import type { OllamaChatResponse, OllamaGenerateResponse } from "../types/ollama.js";

export async function streamOllamaChat(
  stream: MessageStream,
  reply: FastifyReply,
  requestedModel: string
): Promise<void> {
  reply.raw.writeHead(200, {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const startTime = Date.now();
  let evalCount = 0;
  let thinkingContent = "";

  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        evalCount++;
        const chunk: OllamaChatResponse = {
          model: requestedModel,
          created_at: new Date().toISOString(),
          message: {
            role: "assistant",
            content: event.delta.text,
          },
          done: false,
        };
        if (thinkingContent) {
          chunk.message.thinking = thinkingContent;
          thinkingContent = "";
        }
        reply.raw.write(JSON.stringify(chunk) + "\n");
      } else if (event.delta.type === "thinking_delta") {
        thinkingContent += (event.delta as { type: string; thinking: string }).thinking;
      }
    }
  }

  const totalDuration = (Date.now() - startTime) * 1e6; // nanoseconds
  const finalChunk: OllamaChatResponse = {
    model: requestedModel,
    created_at: new Date().toISOString(),
    message: { role: "assistant", content: "" },
    done: true,
    done_reason: "stop",
    total_duration: totalDuration,
    load_duration: 0,
    prompt_eval_count: 0,
    prompt_eval_duration: 0,
    eval_count: evalCount,
    eval_duration: totalDuration,
  };
  reply.raw.write(JSON.stringify(finalChunk) + "\n");
  reply.raw.end();
}

export async function streamOllamaGenerate(
  stream: MessageStream,
  reply: FastifyReply,
  requestedModel: string
): Promise<void> {
  reply.raw.writeHead(200, {
    "Content-Type": "application/x-ndjson",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const startTime = Date.now();
  let evalCount = 0;

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      evalCount++;
      const chunk: OllamaGenerateResponse = {
        model: requestedModel,
        created_at: new Date().toISOString(),
        response: event.delta.text,
        done: false,
      };
      reply.raw.write(JSON.stringify(chunk) + "\n");
    }
  }

  const totalDuration = (Date.now() - startTime) * 1e6;
  const finalChunk: OllamaGenerateResponse = {
    model: requestedModel,
    created_at: new Date().toISOString(),
    response: "",
    done: true,
    done_reason: "stop",
    total_duration: totalDuration,
    load_duration: 0,
    prompt_eval_count: 0,
    eval_count: evalCount,
    eval_duration: totalDuration,
  };
  reply.raw.write(JSON.stringify(finalChunk) + "\n");
  reply.raw.end();
}
