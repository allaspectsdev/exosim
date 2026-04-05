import { describe, it, expect } from "vitest";
import { ollamaChatToProxyParams, ollamaGenerateToProxyParams } from "../src/adapters/ollama.js";
import type { OllamaChatRequest, OllamaGenerateRequest } from "../src/types/ollama.js";

describe("ollamaChatToProxyParams", () => {
  it("converts a simple chat request", () => {
    const req: OllamaChatRequest = {
      model: "llama-3.3-70b",
      messages: [{ role: "user", content: "Hello" }],
    };

    const params = ollamaChatToProxyParams(req);
    expect(params.messages).toEqual([{ role: "user", content: "Hello" }]);
  });

  it("extracts system messages", () => {
    const req: OllamaChatRequest = {
      model: "test",
      messages: [
        { role: "system", content: "Be concise." },
        { role: "user", content: "Hi" },
      ],
    };

    const params = ollamaChatToProxyParams(req);
    expect(params.system).toBe("Be concise.");
    expect(params.messages).toHaveLength(1);
  });

  it("joins multiple system messages", () => {
    const req: OllamaChatRequest = {
      model: "test",
      messages: [
        { role: "system", content: "Rule 1" },
        { role: "system", content: "Rule 2" },
        { role: "user", content: "Go" },
      ],
    };

    const params = ollamaChatToProxyParams(req);
    expect(params.system).toBe("Rule 1\n\nRule 2");
  });

  it("maps tool messages to user messages", () => {
    const req: OllamaChatRequest = {
      model: "test",
      messages: [
        { role: "user", content: "Use tool" },
        { role: "tool", content: "tool result" },
      ],
    };

    const params = ollamaChatToProxyParams(req);
    expect(params.messages[1]).toEqual({ role: "user", content: "tool result" });
  });

  it("maps options to proxy params", () => {
    const req: OllamaChatRequest = {
      model: "test",
      messages: [{ role: "user", content: "Hi" }],
      options: {
        temperature: 0.5,
        top_p: 0.9,
        top_k: 40,
        num_predict: 2048,
        stop: ["END"],
      },
    };

    const params = ollamaChatToProxyParams(req);
    expect(params.temperature).toBe(0.5);
    expect(params.topP).toBe(0.9);
    expect(params.topK).toBe(40);
    expect(params.maxTokens).toBe(2048);
    expect(params.stopSequences).toEqual(["END"]);
  });

  it("enables thinking when think=true", () => {
    const req: OllamaChatRequest = {
      model: "test",
      messages: [{ role: "user", content: "Think" }],
      think: true,
    };

    const params = ollamaChatToProxyParams(req);
    expect(params.thinking).toEqual({ type: "enabled", budget_tokens: 5000 });
  });

  it("maps assistant messages with thinking content", () => {
    const req: OllamaChatRequest = {
      model: "test",
      messages: [
        {
          role: "assistant",
          content: "The answer is 42",
          thinking: "Let me think about this...",
        },
      ],
    };

    const params = ollamaChatToProxyParams(req);
    const msg = params.messages[0];
    expect(msg.role).toBe("assistant");
    expect(Array.isArray(msg.content)).toBe(true);
  });

  it("maps tools to Anthropic format", () => {
    const req: OllamaChatRequest = {
      model: "test",
      messages: [{ role: "user", content: "Hi" }],
      tools: [
        {
          type: "function",
          function: {
            name: "calc",
            description: "Calculate",
            parameters: { type: "object", properties: {} },
          },
        },
      ],
    };

    const params = ollamaChatToProxyParams(req);
    expect(params.tools).toHaveLength(1);
    expect(params.tools![0].name).toBe("calc");
  });
});

describe("ollamaGenerateToProxyParams", () => {
  it("converts a simple generate request", () => {
    const req: OllamaGenerateRequest = {
      model: "test",
      prompt: "Tell me a joke",
    };

    const params = ollamaGenerateToProxyParams(req);
    expect(params.messages).toEqual([{ role: "user", content: "Tell me a joke" }]);
  });

  it("passes system prompt", () => {
    const req: OllamaGenerateRequest = {
      model: "test",
      prompt: "Hi",
      system: "You are a comedian",
    };

    const params = ollamaGenerateToProxyParams(req);
    expect(params.system).toBe("You are a comedian");
  });

  it("enables thinking", () => {
    const req: OllamaGenerateRequest = {
      model: "test",
      prompt: "Solve this",
      think: true,
    };

    const params = ollamaGenerateToProxyParams(req);
    expect(params.thinking).toEqual({ type: "enabled", budget_tokens: 5000 });
  });
});
