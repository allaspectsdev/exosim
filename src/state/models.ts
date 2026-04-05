import type { ModelObject } from "../types/openai.js";
import type { OllamaModelTag } from "../types/ollama.js";

export interface ModelEntry {
  id: string;
  name: string;
  family: string;
  parameterSize: string;
  contextLength: number;
  status: "downloaded" | "available" | "downloading";
  isCustom: boolean;
}

const MODEL_REGISTRY: ModelEntry[] = [
  { id: "llama-3.2-1b", name: "Llama 3.2 1B", family: "llama", parameterSize: "1B", contextLength: 131072, status: "downloaded", isCustom: false },
  { id: "llama-3.2-3b", name: "Llama 3.2 3B", family: "llama", parameterSize: "3B", contextLength: 131072, status: "downloaded", isCustom: false },
  { id: "llama-3.3-70b", name: "Llama 3.3 70B", family: "llama", parameterSize: "70B", contextLength: 131072, status: "downloaded", isCustom: false },
  { id: "deepseek-r1", name: "DeepSeek R1", family: "deepseek", parameterSize: "671B", contextLength: 131072, status: "downloaded", isCustom: false },
  { id: "deepseek-r1-0528", name: "DeepSeek R1 0528", family: "deepseek", parameterSize: "671B", contextLength: 131072, status: "downloaded", isCustom: false },
  { id: "qwen2.5-72b", name: "Qwen 2.5 72B", family: "qwen", parameterSize: "72B", contextLength: 131072, status: "downloaded", isCustom: false },
  { id: "qwen3-235b", name: "Qwen 3 235B", family: "qwen", parameterSize: "235B", contextLength: 131072, status: "downloaded", isCustom: false },
  { id: "mistral-nemo", name: "Mistral Nemo", family: "mistral", parameterSize: "12B", contextLength: 131072, status: "downloaded", isCustom: false },
  { id: "mistral-small-3.1", name: "Mistral Small 3.1", family: "mistral", parameterSize: "24B", contextLength: 131072, status: "downloaded", isCustom: false },
  { id: "gemma-2-27b", name: "Gemma 2 27B", family: "gemma", parameterSize: "27B", contextLength: 8192, status: "downloaded", isCustom: false },
  { id: "phi-4", name: "Phi 4", family: "phi", parameterSize: "14B", contextLength: 16384, status: "downloaded", isCustom: false },
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

export function parseSize(s: string): number {
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

export function filterByStatus(status: string): ModelEntry[] {
  return MODEL_REGISTRY.filter((m) => m.status === status);
}

export function addCustomModel(modelId: string): ModelEntry {
  const existing = findModel(modelId);
  if (existing) return existing;

  // Derive a name from the model ID (e.g., "mlx-community/Llama-3-8B" → "Llama-3-8B")
  const namePart = modelId.includes("/") ? modelId.split("/").pop()! : modelId;
  const entry: ModelEntry = {
    id: modelId,
    name: namePart,
    family: "custom",
    parameterSize: "unknown",
    contextLength: 131072,
    status: "downloaded",
    isCustom: true,
  };
  MODEL_REGISTRY.push(entry);
  return entry;
}

export function removeCustomModel(modelId: string): boolean {
  const index = MODEL_REGISTRY.findIndex(
    (m) => m.id.toLowerCase() === modelId.toLowerCase() && m.isCustom
  );
  if (index === -1) return false;
  MODEL_REGISTRY.splice(index, 1);
  return true;
}
