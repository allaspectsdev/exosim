export interface ResponseInput {
  role: "user" | "assistant" | "system" | "developer" | "tool";
  content: string | ResponseInputContentPart[];
  tool_call_id?: string;
}

export interface ResponseInputContentPart {
  type: "input_text" | "input_image" | "input_audio";
  text?: string;
  image_url?: string;
}

export interface ResponsesRequest {
  model: string;
  input: string | ResponseInput[];
  instructions?: string;
  tools?: ResponseTool[];
  stream?: boolean;
  temperature?: number;
  top_p?: number;
  max_output_tokens?: number;
  stop?: string[];
  previous_response_id?: string;
  truncation?: "auto" | "disabled";
}

export interface ResponseTool {
  type: "function" | "web_search" | "file_search" | "code_interpreter";
  function?: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
}

export interface ResponseOutputItem {
  id: string;
  type: "message" | "function_call";
  role?: "assistant";
  content?: ResponseOutputContentPart[];
  name?: string;
  call_id?: string;
  arguments?: string;
}

export interface ResponseOutputContentPart {
  type: "output_text";
  text: string;
}

export interface ResponseObject {
  id: string;
  object: "response";
  created_at: string;
  completed_at: string | null;
  status: "completed" | "failed" | "in_progress" | "cancelled" | "incomplete";
  error: { message: string; type: string } | null;
  incomplete_details: null;
  instructions: string | null;
  max_output_tokens: number | null;
  model: string;
  output: ResponseOutputItem[];
  output_text: string;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  } | null;
}
