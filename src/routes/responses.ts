import type { FastifyInstance } from "fastify";
import { v4 as uuidv4 } from "uuid";
import type { ResponsesRequest, ResponseObject, ResponseOutputItem } from "../types/responses.js";
import { responsesToProxyParams } from "../adapters/responses.js";
import { proxySync, proxyStream } from "../anthropic/proxy.js";
import { streamResponsesSSE } from "../streaming/responses-sse.js";

function responsesError(reply: import("fastify").FastifyReply, status: number, message: string, type = "api_error") {
  return reply.status(status).send({
    type: "error",
    error: { message, type, code: type },
  });
}

export async function responsesRoutes(app: FastifyInstance) {
  app.post("/v1/responses", async (request, reply) => {
    const body = request.body as ResponsesRequest;

    if (!body.input) {
      return responsesError(reply, 400, "input is required", "invalid_request_error");
    }

    const responseId = `resp_${uuidv4()}`;

    try {
      const params = responsesToProxyParams(body);

      if (body.stream) {
        const stream = proxyStream(params);
        await streamResponsesSSE(
          stream,
          reply,
          body.model,
          responseId,
          body.instructions ?? null,
          body.max_output_tokens ?? null,
        );
        return;
      }

      // Non-streaming
      const message = await proxySync(params);

      let outputText = "";
      const output: ResponseOutputItem[] = [];
      const contentParts: { type: "output_text"; text: string }[] = [];

      for (const block of message.content) {
        if (block.type === "text") {
          outputText += block.text;
          contentParts.push({ type: "output_text", text: block.text });
        } else if (block.type === "tool_use") {
          output.push({
            id: `fc_${uuidv4()}`,
            type: "function_call",
            name: block.name,
            call_id: block.id,
            arguments: JSON.stringify(block.input),
          });
        }
      }

      // Add message item first
      output.unshift({
        id: `msg_${uuidv4()}`,
        type: "message",
        role: "assistant",
        content: contentParts,
      });

      const response: ResponseObject = {
        id: responseId,
        object: "response",
        created_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
        status: "completed",
        error: null,
        incomplete_details: null,
        instructions: body.instructions ?? null,
        max_output_tokens: body.max_output_tokens ?? null,
        model: body.model,
        output,
        output_text: outputText,
        usage: {
          prompt_tokens: message.usage.input_tokens,
          completion_tokens: message.usage.output_tokens,
          total_tokens: message.usage.input_tokens + message.usage.output_tokens,
        },
      };

      return response;
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : "Internal server error";
      const status = (err as { status?: number }).status ?? 500;
      return responsesError(reply, status, errMessage);
    }
  });
}
