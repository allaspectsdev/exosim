import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import type {
  ChatCompletionRequest,
  ChatCompletionResponse,
  ChatCompletionChoice,
} from "../types/openai.js";
import { openaiToProxyParams } from "../adapters/openai.js";
import { proxySync, proxyStream } from "../anthropic/proxy.js";
import { streamOpenAISSE } from "../streaming/openai-sse.js";
import { isKnownModel } from "../state/models.js";

function openaiError(reply: import("fastify").FastifyReply, status: number, message: string, type = "api_error") {
  return reply.status(status).send({
    error: { message, type, code: type },
  });
}

export async function openaiRoutes(app: FastifyInstance) {
  app.post("/v1/chat/completions", async (request, reply) => {
    const body = request.body as ChatCompletionRequest;

    if (!body.messages?.length) {
      return openaiError(reply, 400, "messages is required and must be non-empty", "invalid_request_error");
    }

    if (!isKnownModel(body.model)) {
      request.log.warn(`Unknown model "${body.model}" — proxying to Claude anyway`);
    }

    try {
      const params = openaiToProxyParams(body);

      if (body.stream) {
        const stream = proxyStream(params);
        await streamOpenAISSE(stream, reply, body.model);
        return;
      }

      // Non-streaming
      const message = await proxySync(params);

      const choices: ChatCompletionChoice[] = [];
      let content: string | null = null;
      const toolCalls: ChatCompletionChoice["message"]["tool_calls"] = [];
      let reasoningContent: string | undefined;

      for (const block of message.content) {
        if (block.type === "text") {
          content = (content ?? "") + block.text;
        } else if (block.type === "tool_use") {
          toolCalls.push({
            id: block.id,
            type: "function",
            function: {
              name: block.name,
              arguments: JSON.stringify(block.input),
            },
          });
        } else if (block.type === "thinking") {
          reasoningContent = (reasoningContent ?? "") + (block as { type: string; thinking: string }).thinking;
        }
      }

      let finishReason: ChatCompletionChoice["finish_reason"] = "stop";
      if (message.stop_reason === "tool_use") finishReason = "tool_calls";
      else if (message.stop_reason === "max_tokens") finishReason = "length";

      const choice: ChatCompletionChoice = {
        index: 0,
        message: {
          role: "assistant",
          content,
        },
        finish_reason: finishReason,
      };

      if (toolCalls.length > 0) choice.message.tool_calls = toolCalls;
      if (reasoningContent) choice.message.reasoning_content = reasoningContent;

      choices.push(choice);

      const response: ChatCompletionResponse = {
        id: `chatcmpl-${uuidv4()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: body.model,
        choices,
        usage: {
          prompt_tokens: message.usage.input_tokens,
          completion_tokens: message.usage.output_tokens,
          total_tokens: message.usage.input_tokens + message.usage.output_tokens,
        },
      };

      return response;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Internal server error";
      const status = (err as { status?: number }).status ?? 500;
      return openaiError(reply, status, message);
    }
  });
}
