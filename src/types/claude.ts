export interface ClaudeContentBlock {
  type: "text" | "image" | "tool_use" | "tool_result" | "thinking";
  text?: string;
  thinking?: string;
  id?: string;
  name?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | ClaudeContentBlock[];
  source?: { type: string; media_type: string; data: string };
}

export interface ClaudeMessage {
  role: "user" | "assistant";
  content: string | ClaudeContentBlock[];
}

export interface ClaudeToolDefinition {
  name: string;
  description?: string;
  input_schema: Record<string, unknown>;
}

export interface ClaudeMessagesRequest {
  model: string;
  messages: ClaudeMessage[];
  max_tokens: number;
  system?: string | ClaudeContentBlock[];
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  tools?: ClaudeToolDefinition[];
  tool_choice?: { type: string; name?: string };
  thinking?: { type: "enabled" | "disabled"; budget_tokens?: number };
  metadata?: { user_id?: string };
}