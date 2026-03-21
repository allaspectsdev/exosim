import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream.js";
import type { FastifyReply } from "fastify";
import type { ChatCompletionChunk } from "../types/openai.js";
import { v4 as uuidv4 } from "uuid";

export async function streamOpenAISSE(
  stream: MessageStream,
  reply: FastifyReply,
  requestedModel: string
): Promise<void> {
  const id = `chatcmpl-${uuidv4()}`;
  const created = Math.floor(Date.now() / 1000);

  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  // Initial chunk with role
  const initialChunk: ChatCompletionChunk = {
    id,
    object: "chat.completion.chunk",
    created,
    model: requestedModel,
    choices: [
      {
        index: 0,
        delta: { role: "assistant" },
        finish_reason: null,
      },
    ],
  };
  reply.raw.write(`data: ${JSON.stringify(initialChunk)}\n\n`);

  let finishReason: string | null = null;
  let currentToolCallIndex = -1;

  for await (const event of stream) {
    if (event.type === "content_block_start") {
      if (event.content_block.type === "tool_use") {
        currentToolCallIndex++;
        const chunk: ChatCompletionChunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model: requestedModel,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    id: event.content_block.id,
                    type: "function",
                    function: {
                      name: event.content_block.name,
                      arguments: "",
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } else if (event.type === "content_block_delta") {
      if (event.delta.type === "text_delta") {
        const chunk: ChatCompletionChunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model: requestedModel,
          choices: [
            {
              index: 0,
              delta: { content: event.delta.text },
              finish_reason: null,
            },
          ],
        };
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      } else if (event.delta.type === "thinking_delta") {
        const chunk: ChatCompletionChunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model: requestedModel,
          choices: [
            {
              index: 0,
              delta: { reasoning_content: (event.delta as { type: string; thinking: string }).thinking },
              finish_reason: null,
            },
          ],
        };
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      } else if (event.delta.type === "input_json_delta") {
        const chunk: ChatCompletionChunk = {
          id,
          object: "chat.completion.chunk",
          created,
          model: requestedModel,
          choices: [
            {
              index: 0,
              delta: {
                tool_calls: [
                  {
                    id: undefined as unknown as string,
                    type: "function",
                    function: {
                      name: "",
                      arguments: (event.delta as { type: string; partial_json: string }).partial_json,
                    },
                  },
                ],
              },
              finish_reason: null,
            },
          ],
        };
        reply.raw.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    } else if (event.type === "message_delta") {
      const stopReason = (event as { type: string; delta: { stop_reason?: string } }).delta.stop_reason;
      if (stopReason === "tool_use") {
        finishReason = "tool_calls";
      } else if (stopReason === "max_tokens") {
        finishReason = "length";
      } else {
        finishReason = "stop";
      }
    }
  }

  // Final chunk with finish_reason
  const finalChunk: ChatCompletionChunk = {
    id,
    object: "chat.completion.chunk",
    created,
    model: requestedModel,
    choices: [
      {
        index: 0,
        delta: {},
        finish_reason: finishReason ?? "stop",
      },
    ],
  };
  reply.raw.write(`data: ${JSON.stringify(finalChunk)}\n\n`);
  reply.raw.write("data: [DONE]\n\n");
  reply.raw.end();
}
