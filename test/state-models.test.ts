import { describe, it, expect } from "vitest";
import {
  getModelRegistry,
  findModel,
  isKnownModel,
  searchModels,
  toOpenAIModels,
  toOllamaTags,
  addCustomModel,
  removeCustomModel,
  filterByStatus,
} from "../src/state/models.js";

describe("model registry", () => {
  it("returns all built-in models", () => {
    const models = getModelRegistry();
    expect(models.length).toBeGreaterThanOrEqual(11);
    expect(models.every((m) => m.id && m.name && m.family)).toBe(true);
  });

  it("all built-in models have status=downloaded and isCustom=false", () => {
    const models = getModelRegistry().filter((m) => !m.isCustom);
    expect(models.every((m) => m.status === "downloaded")).toBe(true);
    expect(models.every((m) => m.isCustom === false)).toBe(true);
  });
});

describe("findModel", () => {
  it("finds by exact id", () => {
    const model = findModel("llama-3.3-70b");
    expect(model).toBeDefined();
    expect(model!.id).toBe("llama-3.3-70b");
  });

  it("is case-insensitive", () => {
    const model = findModel("LLAMA-3.3-70B");
    expect(model).toBeDefined();
    expect(model!.id).toBe("llama-3.3-70b");
  });

  it("returns undefined for unknown models", () => {
    expect(findModel("nonexistent-model")).toBeUndefined();
  });
});

describe("isKnownModel", () => {
  it("returns true for known models", () => {
    expect(isKnownModel("deepseek-r1")).toBe(true);
  });

  it("returns false for unknown models", () => {
    expect(isKnownModel("gpt-4o")).toBe(false);
  });
});

describe("searchModels", () => {
  it("searches by id", () => {
    const results = searchModels("llama");
    expect(results.length).toBeGreaterThanOrEqual(3);
    expect(results.every((m) => m.id.includes("llama") || m.family === "llama")).toBe(true);
  });

  it("searches by family", () => {
    const results = searchModels("mistral");
    expect(results.length).toBeGreaterThanOrEqual(2);
  });

  it("returns empty for no match", () => {
    expect(searchModels("zzzzz")).toEqual([]);
  });
});

describe("toOpenAIModels", () => {
  it("returns OpenAI model format", () => {
    const models = toOpenAIModels();
    expect(models.length).toBeGreaterThan(0);
    expect(models[0]).toMatchObject({
      object: "model",
      owned_by: "exo",
    });
    expect(typeof models[0].id).toBe("string");
    expect(typeof models[0].created).toBe("number");
  });
});

describe("toOllamaTags", () => {
  it("returns Ollama tag format", () => {
    const tags = toOllamaTags();
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0]).toMatchObject({
      details: {
        format: "gguf",
        quantization_level: "Q4_K_M",
      },
    });
    expect(typeof tags[0].name).toBe("string");
    expect(typeof tags[0].size).toBe("number");
    expect(typeof tags[0].digest).toBe("string");
  });
});

describe("filterByStatus", () => {
  it("filters by downloaded status", () => {
    const downloaded = filterByStatus("downloaded");
    expect(downloaded.length).toBeGreaterThan(0);
    expect(downloaded.every((m) => m.status === "downloaded")).toBe(true);
  });

  it("returns empty for non-matching status", () => {
    expect(filterByStatus("downloading")).toEqual([]);
  });
});

describe("custom models", () => {
  it("adds a custom model", () => {
    const model = addCustomModel("mlx-community/test-model-7b");
    expect(model.id).toBe("mlx-community/test-model-7b");
    expect(model.isCustom).toBe(true);
    expect(model.status).toBe("downloaded");
    expect(model.name).toBe("test-model-7b");
    // Should be findable
    expect(findModel("mlx-community/test-model-7b")).toBeDefined();
  });

  it("returns existing model if already exists", () => {
    const first = addCustomModel("mlx-community/dupe-test");
    const second = addCustomModel("mlx-community/dupe-test");
    expect(first).toBe(second);
  });

  it("removes a custom model", () => {
    addCustomModel("mlx-community/to-remove");
    expect(removeCustomModel("mlx-community/to-remove")).toBe(true);
    expect(findModel("mlx-community/to-remove")).toBeUndefined();
  });

  it("cannot remove built-in models", () => {
    expect(removeCustomModel("llama-3.3-70b")).toBe(false);
  });

  it("returns false for unknown model removal", () => {
    expect(removeCustomModel("nonexistent")).toBe(false);
  });
});
