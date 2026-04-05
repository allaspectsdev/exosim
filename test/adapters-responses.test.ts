import { describe, it, expect } from "vitest";
import { responsesToProxyParams } from "../src/adapters/responses.js";
import type { ResponsesRequest } from "../src/types/responses.js";

describe("responsesToProxyParams", () => {
  it("converts a simple string input", () => {
    const req: ResponsesRequest = {
      model: "test",
      input: "Hello",
    };

    const params = responsesToProxyParams(req);
    expect(params.messages).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("passes instructions as system param", () => {
    const req: ResponsesRequest = {
      model: "test",
      input: "Hi",
      instructions: "Be brief.",
    };

    const params = responsesToProxyParams(req);
    expect(params.system).toBe("Be brief.");
  });

  it("handles array input with multiple roles", () => {
    const req: ResponsesRequest = {
      model: "test",
      input: [
        { role: "system", content: "System msg" },
        { role: "user", content: "User msg" },
        { role: "assistant", content: "Assistant msg" },
      ],
    };

    const params = responsesToProxyParams(req);
    expect(params.system).toBe("System msg");
    expect(params.messages).toHaveLength(2);
    expect(params.messages[0]).toEqual({ role: "user", content: "User msg" });
    expect(params.messages[1]).toEqual({ role: "assistant", content: "Assistant msg" });
  });

  it("combines instructions and system messages", () => {
    const req: ResponsesRequest = {
      model: "test",
      input: [
        { role: "system", content: "Extra context" },
        { role: "user", content: "Hi" },
      ],
      instructions: "Be helpful.",
    };

    const params = responsesToProxyParams(req);
    expect(params.system).toBe("Be helpful.\n\nExtra context");
  });

  it("maps developer role to system", () => {
    const req: ResponsesRequest = {
      model: "test",
      input: [
        { role: "developer", content: "Dev instructions" },
        { role: "user", content: "Query" },
      ],
    };

    const params = responsesToProxyParams(req);
    expect(params.system).toBe("Dev instructions");
  });

  it("maps tool results", () => {
    const req: ResponsesRequest = {
      model: "test",
      input: [
        { role: "user", content: "Use tool" },
        { role: "tool", content: "Result data", tool_call_id: "call_123" },
      ],
    };

    const params = responsesToProxyParams(req);
    const toolMsg = params.messages[1];
    expect(toolMsg.role).toBe("user");
    const content = toolMsg.content as Array<{ type: string; tool_use_id: string }>;
    expect(content[0].type).toBe("tool_result");
    expect(content[0].tool_use_id).toBe("call_123");
  });

  it("maps function tools to Anthropic format", () => {
    const req: ResponsesRequest = {
      model: "test",
      input: "Hi",
      tools: [
        {
          type: "function",
          function: {
            name: "search",
            description: "Search the web",
            parameters: { type: "object", properties: { query: { type: "string" } } },
          },
        },
        { type: "web_search" }, // non-function tool should be filtered out
      ],
    };

    const params = responsesToProxyParams(req);
    expect(params.tools).toHaveLength(1);
    expect(params.tools![0].name).toBe("search");
  });

  it("passes max_output_tokens", () => {
    const req: ResponsesRequest = {
      model: "test",
      input: "Hi",
      max_output_tokens: 1000,
    };

    const params = responsesToProxyParams(req);
    expect(params.maxTokens).toBe(1000);
  });

  it("handles content parts array in input", () => {
    const req: ResponsesRequest = {
      model: "test",
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: "Part 1 " },
            { type: "input_text", text: "Part 2" },
          ],
        },
      ],
    };

    const params = responsesToProxyParams(req);
    expect(params.messages[0].content).toBe("Part 1 Part 2");
  });
});
