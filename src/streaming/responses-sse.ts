import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream.js";
import type { FastifyReply } from "fastify";
import type { ResponseObject, ResponseOutputItem, ResponseOutputContentPart } from "../types/responses.js";
import { v4 as uuidv4 } from "uuid";

function write(reply: FastifyReply, data: string): boolean {
  if (reply.raw.destroyed) return false;
  reply.raw.write(data);
  return true;
}

function emit(reply: FastifyReply, eventType: string, data: unknown): boolean {
  return write(reply, `event: ${eventType}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function streamResponsesSSE(
  stream: MessageStream,
  reply: FastifyReply,
  requestedModel: string,
  responseId: string,
  instructions: string | null,
  maxOutputTokens: number | null,
): Promise<void> {
  reply.hijack();
  reply.raw.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const createdAt = new Date().toISOString();
  const messageItemId = `msg_${uuidv4()}`;
  let outputText = "";
  let promptTokens = 0;
  let completionTokens = 0;

  const output: ResponseOutputItem[] = [];
  const toolCalls: ResponseOutputItem[] = [];
  let currentToolCallId = "";
  let currentToolCallName = "";
  let currentToolCallArgs = "";

  // response.created
  const baseResponse: ResponseObject = {
    id: responseId,
    object: "response",
    created_at: createdAt,
    completed_at: null,
    status: "in_progress",
    error: null,
    incomplete_details: null,
    instructions,
    max_output_tokens: maxOutputTokens,
    model: requestedModel,
    output: [],
    output_text: "",
    usage: null,
  };

  emit(reply, "response.created", baseResponse);
  emit(reply, "response.in_progress", baseResponse);

  // Emit output_item.added for the message
  const messageItem: ResponseOutputItem = {
    id: messageItemId,
    type: "message",
    role: "assistant",
    content: [],
  };
  emit(reply, "response.output_item.added", {
    output_index: 0,
    item: messageItem,
  });

  // Emit content_part.added
  const contentPart: ResponseOutputContentPart = { type: "output_text", text: "" };
  emit(reply, "response.content_part.added", {
    item_id: messageItemId,
    output_index: 0,
    content_index: 0,
    part: contentPart,
  });

  let outputIndex = 0;

  try {
    for await (const event of stream) {
      if (reply.raw.destroyed) break;

      if (event.type === "message_start") {
        const msg = (event as { type: string; message: { usage?: { input_tokens?: number } } }).message;
        if (msg.usage?.input_tokens) {
          promptTokens = msg.usage.input_tokens;
        }
      } else if (event.type === "content_block_start") {
        if (event.content_block.type === "tool_use") {
          // Finish the text content part if we have text
          outputIndex++;
          currentToolCallId = event.content_block.id;
          currentToolCallName = event.content_block.name;
          currentToolCallArgs = "";

          const toolItem: ResponseOutputItem = {
            id: `fc_${uuidv4()}`,
            type: "function_call",
            name: currentToolCallName,
            call_id: currentToolCallId,
            arguments: "",
          };
          emit(reply, "response.output_item.added", {
            output_index: outputIndex,
            item: toolItem,
          });
        }
      } else if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          outputText += event.delta.text;
          emit(reply, "response.output_text.delta", {
            item_id: messageItemId,
            output_index: 0,
            content_index: 0,
            delta: event.delta.text,
          });
        } else if (event.delta.type === "input_json_delta") {
          const partialJson = (event.delta as { type: string; partial_json: string }).partial_json;
          currentToolCallArgs += partialJson;
          emit(reply, "response.function_call_arguments.delta", {
            item_id: currentToolCallId,
            output_index: outputIndex,
            delta: partialJson,
          });
        }
      } else if (event.type === "content_block_stop") {
        // If we were building a tool call, finalize it
        if (currentToolCallName && currentToolCallArgs !== undefined) {
          const toolItem: ResponseOutputItem = {
            id: `fc_${uuidv4()}`,
            type: "function_call",
            name: currentToolCallName,
            call_id: currentToolCallId,
            arguments: currentToolCallArgs,
          };
          emit(reply, "response.function_call_arguments.done", {
            item_id: currentToolCallId,
            output_index: outputIndex,
            arguments: currentToolCallArgs,
            name: currentToolCallName,
          });
          emit(reply, "response.output_item.done", {
            output_index: outputIndex,
            item: toolItem,
          });
          toolCalls.push(toolItem);
          currentToolCallName = "";
          currentToolCallArgs = "";
        }
      } else if (event.type === "message_delta") {
        const delta = (event as { type: string; delta: { stop_reason?: string }; usage?: { output_tokens?: number } });
        if (delta.usage?.output_tokens) {
          completionTokens = delta.usage.output_tokens;
        }
      }
    }

    // Finalize text content part
    if (!reply.raw.destroyed) {
      emit(reply, "response.output_text.done", {
        item_id: messageItemId,
        output_index: 0,
        content_index: 0,
        text: outputText,
      });

      emit(reply, "response.content_part.done", {
        item_id: messageItemId,
        output_index: 0,
        content_index: 0,
        part: { type: "output_text", text: outputText },
      });

      // Finalize message item
      const finalMessageItem: ResponseOutputItem = {
        id: messageItemId,
        type: "message",
        role: "assistant",
        content: [{ type: "output_text", text: outputText }],
      };
      emit(reply, "response.output_item.done", {
        output_index: 0,
        item: finalMessageItem,
      });

      // Build final output array
      output.push(finalMessageItem, ...toolCalls);

      // response.completed
      const completedResponse: ResponseObject = {
        ...baseResponse,
        status: "completed",
        completed_at: new Date().toISOString(),
        output,
        output_text: outputText,
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: completionTokens,
          total_tokens: promptTokens + completionTokens,
        },
      };
      emit(reply, "response.completed", completedResponse);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "Internal server error";
    if (!reply.raw.destroyed) {
      emit(reply, "error", {
        type: "error",
        error: { type: "api_error", message },
      });
    }
  } finally {
    if (!reply.raw.destroyed) {
      reply.raw.end();
    }
  }
}
