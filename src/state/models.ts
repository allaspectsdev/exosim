import type { ModelObject } from "../types/openai.js";
import type { OllamaModelTag } from "../types/ollama.js";

export interface ModelEntry {
  id: string;
  name: string;
  family: string;
  parameterSize: string;
  contextLength: number;
}

const MODEL_REGISTRY: ModelEntry[] = [
  { id: "llama-3.2-1b", name: "Llama 3.2 1B", family: "llama", parameterSize: "1B", contextLength: 131072 },
  { id: "llama-3.2-3b", name: "Llama 3.2 3B", family: "llama", parameterSize: "3B", contextLength: 131072 },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", family: "llama", parameterSize: "70B", contextLength: 131072 },
  { id: "deepseek-r1", name: "DeepSeek R1", family: "deepseek", parameterSize: "671B", contextLength: 131072 },
  { id: "deepseek-r1-0528", name: "DeepSeek R1 0528", family: "deepseek", parameterSize: "671B", contextLength: 131072 },
  { id: "qwen2.5-72b", name: "Qwen 2.5 72B", family: "qwen", parameterSize: "72B", contextLength: 131072 },
  { id: "qwen3-235b", name: "Qwen 3 235B", family: "qwen", parameterSize: "235B", contextLength: 131072 },
  { id: "mistral-nemo", name: "Mistral Nemo", family: "mistral", parameterSize: "12B", contextLength: 131072 },
  { id: "mistral-small-3.1", name: "Mistral Small 3.1", family: "mistral", parameterSize: "24B", contextLength: 131072 },
  { id: "gemma-2-27b", name: "Gemma 2 27B", family: "gemma", parameterSize: "27B", contextLength: 8192 },
  { id: "phi-4", name: "Phi 4", family: "phi", parameterSize: "14B", contextLength: 16384 },
];

const CREATED_TIMESTAMP = Math.floor(Date.now() / 1000);

export function getModelRegistry(): ModelEntry[] {
  return MODEL_REGISTRY;
}

export function findModel(modelId: string): ModelEntry | undefined {
  const needle = modelId.toLowerCase();
  return MODEL_REGISTRY.find((m) => m.id.toLowerCase() === needle);
}

export function isKnownModel(modelId: string): boolean {
  return findModel(modelId) !== undefined;
}

export function toOpenAIModels(): ModelObject[] {
  return MODEL_REGISTRY.map((m) => ({
    id: m.id,
    object: "model" as const,
    created: CREATED_TIMESTAMP,
    owned_by: "exo",
  }));
}

export function toOllamaTags(): OllamaModelTag[] {
  return MODEL_REGISTRY.map((m) => ({
    name: m.id,
    modified_at: new Date().toISOString(),
    size: parseSize(m.parameterSize) * 1e9 * 2, // rough bytes estimate
    digest: `sha256:${Buffer.from(m.id).toString("hex").padEnd(64, "0")}`,
    details: {
      format: "gguf",
      family: m.family,
      parameter_size: m.parameterSize,
      quantization_level: "Q4_K_M",
    },
  }));
}

function parseSize(s: string): number {
  const num = parseFloat(s);
  return isNaN(num) ? 1 : num;
}

export function searchModels(query: string): ModelEntry[] {
  const q = query.toLowerCase();
  return MODEL_REGISTRY.filter(
    (m) =>
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.family.toLowerCase().includes(q)
  );
}
