import type Anthropic from "@anthropic-ai/sdk";
import type { OllamaChatRequest, OllamaGenerateRequest } from "../types/ollama.js";
import type { ProxyParams } from "../anthropic/proxy.js";
import { config } from "../config.js";

export function ollamaChatToProxyParams(req: OllamaChatRequest): ProxyParams {
  const systemMessages: string[] = [];
  const messages: Anthropic.MessageCreateParams["messages"] = [];

  for (const msg of req.messages) {
    if (msg.role === "system") {
      systemMessages.push(msg.content);
      continue;
    }

    if (msg.role === "tool") {
      // Map tool results to user messages
      messages.push({ role: "user", content: msg.content });
      continue;
    }

    if (msg.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];
      if (msg.thinking) {
        content.push({ type: "thinking", thinking: msg.thinking } as Anthropic.ContentBlockParam);
      }
      if (msg.content) {
        content.push({ type: "text", text: msg.content });
      }
      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          content.push({
            type: "tool_use",
            id: `call_${Date.now()}`,
            name: tc.function.name,
            input: tc.function.arguments,
          });
        }
      }
      messages.push({
        role: "assistant",
        content: content.length === 1 && content[0].type === "text"
          ? (content[0] as Anthropic.TextBlockParam).text
          : content,
      });
      continue;
    }

    // user
    messages.push({ role: "user", content: msg.content });
  }

  const params: ProxyParams = {
    messages,
    maxTokens: req.options?.num_predict ?? config.DEFAULT_MAX_TOKENS,
  };

  if (systemMessages.length > 0) {
    params.system = systemMessages.join("\n\n");
  }

  if (req.options?.temperature !== undefined)
    params.temperature = req.options.temperature;
  if (req.options?.top_p !== undefined) params.topP = req.options.top_p;
  if (req.options?.top_k !== undefined) params.topK = req.options.top_k;
  if (req.options?.stop?.length) params.stopSequences = req.options.stop;

  if (req.tools?.length) {
    params.tools = req.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description ?? "",
      input_schema: (t.function.parameters ?? { type: "object", properties: {} }) as Anthropic.Tool["input_schema"],
    }));
  }

  if (req.think) {
    params.thinking = { type: "enabled", budget_tokens: 5000 };
  }

  return params;
}

export function ollamaGenerateToProxyParams(
  req: OllamaGenerateRequest
): ProxyParams {
  const params: ProxyParams = {
    messages: [{ role: "user", content: req.prompt }],
    maxTokens: req.options?.num_predict ?? config.DEFAULT_MAX_TOKENS,
  };

  if (req.system) params.system = req.system;
  if (req.options?.temperature !== undefined)
    params.temperature = req.options.temperature;
  if (req.options?.top_p !== undefined) params.topP = req.options.top_p;
  if (req.options?.top_k !== undefined) params.topK = req.options.top_k;
  if (req.options?.stop?.length) params.stopSequences = req.options.stop;

  if (req.think) {
    params.thinking = { type: "enabled", budget_tokens: 5000 };
  }

  return params;
}
