import type { ClaudeMessagesRequest } from "../types/claude.js";
import type { ProxyParams } from "../anthropic/proxy.js";
import type Anthropic from "@anthropic-ai/sdk";

export function claudeToProxyParams(req: ClaudeMessagesRequest): ProxyParams {
  const params: ProxyParams = {
    messages: req.messages as Anthropic.MessageCreateParams["messages"],
    maxTokens: req.max_tokens,
  };

  if (req.system) {
    params.system = req.system as Anthropic.MessageCreateParams["system"];
  }
  if (req.temperature !== undefined) params.temperature = req.temperature;
  if (req.top_p !== undefined) params.topP = req.top_p;
  if (req.top_k !== undefined) params.topK = req.top_k;
  if (req.stop_sequences?.length) params.stopSequences = req.stop_sequences;
  if (req.tools?.length) {
    params.tools = req.tools as Anthropic.MessageCreateParams["tools"];
  }
  if (req.tool_choice) {
    params.toolChoice = req.tool_choice as Anthropic.MessageCreateParams["tool_choice"];
  }
  if (req.thinking) {
    params.thinking = req.thinking as Anthropic.MessageCreateParams["thinking"];
  }

  return params;
}
