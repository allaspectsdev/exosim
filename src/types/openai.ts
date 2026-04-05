export interface ChatCompletionMessage {
  role: "system" | "user" | "assistant" | "developer" | "tool" | "function";
  content: string | ContentPart[] | null;
  name?: string;
  tool_calls?: ToolCall[];
  tool_call_id?: string;
  reasoning_content?: string;
}

export interface ContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string; detail?: string };
}

export interface ToolCall {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
}

export interface ToolDefinition {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatCompletionMessage[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  max_tokens?: number;
  stop?: string | string[];
  stream?: boolean;
  tools?: ToolDefinition[];
  tool_choice?: string | { type: string; function?: { name: string } };
  frequency_penalty?: number;
  presence_penalty?: number;
  seed?: number;
  reasoning_effort?: "low" | "medium" | "high";
}

export interface ChatCompletionChoice {
  index: number;
  message: {
    role: "assistant";
    content: string | null;
    tool_calls?: ToolCall[];
    reasoning_content?: string;
  };
  finish_reason: "stop" | "length" | "tool_calls" | "content_filter" | null;
}

export interface ChatCompletionResponse {
  id: string;
  object: "chat.completion";
  created: number;
  model: string;
  choices: ChatCompletionChoice[];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export interface ChatCompletionChunk {
  id: string;
  object: "chat.completion.chunk";
  created: number;
  model: string;
  choices: {
    index: number;
    delta: {
      role?: "assistant";
      content?: string;
      tool_calls?: {
        index?: number;
        id?: string;
        type?: "function";
        function?: { name?: string; arguments?: string };
      }[];
      reasoning_content?: string;
    };
    finish_reason: string | null;
  }[];
}

export interface ModelObject {
  id: string;
  object: "model";
  created: number;
  owned_by: string;
}

export interface ListModelsResponse {
  object: "list";
  data: ModelObject[];
}
