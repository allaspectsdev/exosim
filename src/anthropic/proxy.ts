import type Anthropic from "@anthropic-ai/sdk";
import type { MessageStream } from "@anthropic-ai/sdk/lib/MessageStream.js";
import { anthropic } from "./client.js";
import { config } from "../config.js";

export interface ProxyParams {
  messages: Anthropic.MessageCreateParams["messages"];
  system?: Anthropic.MessageCreateParams["system"];
  maxTokens?: number;
  temperature?: number;
  topP?: number;
  topK?: number;
  stopSequences?: string[];
  tools?: Anthropic.MessageCreateParams["tools"];
  toolChoice?: Anthropic.MessageCreateParams["tool_choice"];
  thinking?: Anthropic.MessageCreateParams["thinking"];
}

function buildParams(
  params: ProxyParams
): Anthropic.MessageCreateParams {
  const base: Anthropic.MessageCreateParams = {
    model: config.ANTHROPIC_MODEL,
    messages: params.messages,
    max_tokens: params.maxTokens ?? config.DEFAULT_MAX_TOKENS,
  };

  if (params.system) base.system = params.system;
  if (params.temperature !== undefined) base.temperature = params.temperature;
  if (params.topP !== undefined) base.top_p = params.topP;
  if (params.topK !== undefined) base.top_k = params.topK;
  if (params.stopSequences?.length) base.stop_sequences = params.stopSequences;
  if (params.tools?.length) base.tools = params.tools;
  if (params.toolChoice) base.tool_choice = params.toolChoice;
  if (params.thinking) base.thinking = params.thinking;

  return base;
}

export async function proxySync(
  params: ProxyParams
): Promise<Anthropic.Message> {
  const apiParams = buildParams(params);
  return anthropic.messages.create(apiParams, {
    timeout: 120_000,
  }) as Promise<Anthropic.Message>;
}

export function proxyStream(params: ProxyParams): MessageStream {
  const apiParams = buildParams(params);
  return anthropic.messages.stream(apiParams, {
    timeout: 300_000,
  });
}
