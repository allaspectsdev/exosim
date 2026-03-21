import type Anthropic from "@anthropic-ai/sdk";
import type {
  ChatCompletionRequest,
  ChatCompletionMessage,
  ContentPart,
} from "../types/openai.js";
import type { ProxyParams } from "../anthropic/proxy.js";
import { config } from "../config.js";

export function openaiToProxyParams(req: ChatCompletionRequest): ProxyParams {
  const systemMessages: string[] = [];
  const messages: Anthropic.MessageCreateParams["messages"] = [];

  for (const msg of req.messages) {
    if (msg.role === "system" || msg.role === "developer") {
      systemMessages.push(extractTextContent(msg));
      continue;
    }

    if (msg.role === "tool") {
      // Tool results map to user messages with tool_result content blocks
      messages.push({
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: msg.tool_call_id ?? "",
            content: extractTextContent(msg),
          },
        ],
      });
      continue;
    }

    if (msg.role === "assistant") {
      const content: Anthropic.ContentBlockParam[] = [];

      if (msg.reasoning_content) {
        content.push({ type: "thinking", thinking: msg.reasoning_content } as Anthropic.ContentBlockParam);
      }

      const text = extractTextContent(msg);
      if (text) {
        content.push({ type: "text", text });
      }

      if (msg.tool_calls?.length) {
        for (const tc of msg.tool_calls) {
          content.push({
            type: "tool_use",
            id: tc.id,
            name: tc.function.name,
            input: safeParseJSON(tc.function.arguments),
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

    // user or function messages
    messages.push({
      role: "user",
      content: extractTextContent(msg),
    });
  }

  const params: ProxyParams = {
    messages,
    maxTokens: req.max_tokens ?? config.DEFAULT_MAX_TOKENS,
  };

  if (systemMessages.length > 0) {
    params.system = systemMessages.join("\n\n");
  }

  if (req.temperature !== undefined) params.temperature = req.temperature;
  if (req.top_p !== undefined) params.topP = req.top_p;
  if (req.top_k !== undefined) params.topK = req.top_k;

  if (req.stop) {
    params.stopSequences = Array.isArray(req.stop) ? req.stop : [req.stop];
  }

  if (req.tools?.length) {
    params.tools = req.tools.map((t) => ({
      name: t.function.name,
      description: t.function.description ?? "",
      input_schema: (t.function.parameters ?? { type: "object", properties: {} }) as Anthropic.Tool["input_schema"],
    }));
  }

  if (req.tool_choice) {
    if (typeof req.tool_choice === "string") {
      if (req.tool_choice === "auto") params.toolChoice = { type: "auto" };
      else if (req.tool_choice === "none") {
        // "none" means don't call tools — omit tools entirely
        delete params.tools;
      } else if (req.tool_choice === "required") params.toolChoice = { type: "any" };
    } else if (req.tool_choice.function?.name) {
      params.toolChoice = { type: "tool", name: req.tool_choice.function.name };
    }
  }

  if (req.reasoning_effort) {
    const budgets: Record<string, number> = { low: 2000, medium: 5000, high: 10000 };
    params.thinking = {
      type: "enabled",
      budget_tokens: budgets[req.reasoning_effort] ?? 5000,
    };
  }

  return params;
}

function extractTextContent(msg: ChatCompletionMessage): string {
  if (typeof msg.content === "string") return msg.content;
  if (msg.content === null) return "";
  return msg.content
    .filter((p: ContentPart) => p.type === "text")
    .map((p: ContentPart) => p.text ?? "")
    .join("");
}

function safeParseJSON(s: string): Record<string, unknown> {
  try {
    return JSON.parse(s);
  } catch {
    return { raw: s };
  }
}
