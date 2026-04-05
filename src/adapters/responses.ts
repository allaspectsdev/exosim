import type Anthropic from "@anthropic-ai/sdk";
import type { ResponsesRequest, ResponseInput } from "../types/responses.js";
import type { ProxyParams } from "../anthropic/proxy.js";
import { config } from "../config.js";

export function responsesToProxyParams(req: ResponsesRequest): ProxyParams {
  const messages: Anthropic.MessageCreateParams["messages"] = [];
  let system: string | undefined;

  if (req.instructions) {
    system = req.instructions;
  }

  if (typeof req.input === "string") {
    messages.push({ role: "user", content: req.input });
  } else {
    for (const msg of req.input) {
      if (msg.role === "system" || msg.role === "developer") {
        const text = extractText(msg);
        system = system ? `${system}\n\n${text}` : text;
        continue;
      }

      if (msg.role === "tool") {
        messages.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.tool_call_id ?? "",
              content: extractText(msg),
            },
          ],
        });
        continue;
      }

      const role = msg.role === "assistant" ? "assistant" : "user";
      messages.push({ role, content: extractText(msg) });
    }
  }

  const params: ProxyParams = {
    messages,
    maxTokens: req.max_output_tokens ?? config.DEFAULT_MAX_TOKENS,
  };

  if (system) params.system = system;
  if (req.temperature !== undefined) params.temperature = req.temperature;
  if (req.top_p !== undefined) params.topP = req.top_p;
  if (req.stop?.length) params.stopSequences = req.stop;

  if (req.tools?.length) {
    const functionTools = req.tools.filter((t) => t.type === "function" && t.function);
    if (functionTools.length > 0) {
      params.tools = functionTools.map((t) => ({
        name: t.function!.name,
        description: t.function!.description ?? "",
        input_schema: (t.function!.parameters ?? { type: "object", properties: {} }) as Anthropic.Tool["input_schema"],
      }));
    }
  }

  return params;
}

function extractText(msg: ResponseInput): string {
  if (typeof msg.content === "string") return msg.content;
  return msg.content
    .filter((p) => p.type === "input_text")
    .map((p) => p.text ?? "")
    .join("");
}
