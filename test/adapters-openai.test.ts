import { describe, it, expect } from "vitest";
import { openaiToProxyParams } from "../src/adapters/openai.js";
import type { ChatCompletionRequest } from "../src/types/openai.js";

describe("openaiToProxyParams", () => {
  it("converts a simple user message", () => {
    const req: ChatCompletionRequest = {
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: "Hello" }],
    };

    const params = openaiToProxyParams(req);
    expect(params.messages).toEqual([{ role: "user", content: "Hello" }]);
    expect(params.system).toBeUndefined();
  });

  it("extracts system messages into system param", () => {
    const req: ChatCompletionRequest = {
      model: "llama-3.3-70b",
      messages: [
        { role: "system", content: "You are helpful." },
        { role: "user", content: "Hi" },
      ],
    };

    const params = openaiToProxyParams(req);
    expect(params.system).toBe("You are helpful.");
    expect(params.messages).toEqual([{ role: "user", content: "Hi" }]);
  });

  it("treats developer role same as system", () => {
    const req: ChatCompletionRequest = {
      model: "test",
      messages: [
        { role: "developer", content: "Instructions here" },
        { role: "user", content: "Query" },
      ],
    };

    const params = openaiToProxyParams(req);
    expect(params.system).toBe("Instructions here");
  });

  it("maps tool messages to tool_result content blocks", () => {
    const req: ChatCompletionRequest = {
      model: "test",
      messages: [
        { role: "user", content: "Use the tool" },
        {
          role: "assistant",
          content: null,
          tool_calls: [
            { id: "call_1", type: "function", function: { name: "get_weather", arguments: '{"city":"SF"}' } },
          ],
        },
        { role: "tool", content: "72°F", tool_call_id: "call_1" },
      ],
    };

    const params = openaiToProxyParams(req);
    // Tool message maps to user with tool_result
    const toolMsg = params.messages[2];
    expect(toolMsg.role).toBe("user");
    expect(Array.isArray(toolMsg.content)).toBe(true);
    const content = toolMsg.content as Array<{ type: string; tool_use_id?: string }>;
    expect(content[0].type).toBe("tool_result");
    expect(content[0].tool_use_id).toBe("call_1");
  });

  it("maps tool definitions to Anthropic format", () => {
    const req: ChatCompletionRequest = {
      model: "test",
      messages: [{ role: "user", content: "Hi" }],
      tools: [
        {
          type: "function",
          function: {
            name: "get_weather",
            description: "Get the weather",
            parameters: { type: "object", properties: { city: { type: "string" } } },
          },
        },
      ],
    };

    const params = openaiToProxyParams(req);
    expect(params.tools).toHaveLength(1);
    expect(params.tools![0].name).toBe("get_weather");
    expect(params.tools![0].description).toBe("Get the weather");
  });

  it("maps tool_choice 'required' to Anthropic 'any'", () => {
    const req: ChatCompletionRequest = {
      model: "test",
      messages: [{ role: "user", content: "Hi" }],
      tools: [{ type: "function", function: { name: "test", parameters: {} } }],
      tool_choice: "required",
    };

    const params = openaiToProxyParams(req);
    expect(params.toolChoice).toEqual({ type: "any" });
  });

  it("maps tool_choice 'none' by removing tools", () => {
    const req: ChatCompletionRequest = {
      model: "test",
      messages: [{ role: "user", content: "Hi" }],
      tools: [{ type: "function", function: { name: "test", parameters: {} } }],
      tool_choice: "none",
    };

    const params = openaiToProxyParams(req);
    expect(params.tools).toBeUndefined();
  });

  it("maps reasoning_effort to thinking budget", () => {
    const req: ChatCompletionRequest = {
      model: "test",
      messages: [{ role: "user", content: "Think hard" }],
      reasoning_effort: "high",
    };

    const params = openaiToProxyParams(req);
    expect(params.thinking).toEqual({ type: "enabled", budget_tokens: 10000 });
  });

  it("handles stop as string", () => {
    const req: ChatCompletionRequest = {
      model: "test",
      messages: [{ role: "user", content: "Hi" }],
      stop: "END",
    };

    const params = openaiToProxyParams(req);
    expect(params.stopSequences).toEqual(["END"]);
  });

  it("handles stop as array", () => {
    const req: ChatCompletionRequest = {
      model: "test",
      messages: [{ role: "user", content: "Hi" }],
      stop: ["END", "STOP"],
    };

    const params = openaiToProxyParams(req);
    expect(params.stopSequences).toEqual(["END", "STOP"]);
  });

  it("extracts text from content parts array", () => {
    const req: ChatCompletionRequest = {
      model: "test",
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: "Hello " },
            { type: "text", text: "world" },
            { type: "image_url", image_url: { url: "http://example.com/img.png" } },
          ],
        },
      ],
    };

    const params = openaiToProxyParams(req);
    expect(params.messages[0].content).toBe("Hello world");
  });
});
