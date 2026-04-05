import type { FastifyInstance } from "fastify";
import {
  toOpenAIModels,
  searchModels,
  getModelRegistry,
  filterByStatus,
  addCustomModel,
  removeCustomModel,
} from "../state/models.js";
import type { ListModelsResponse } from "../types/openai.js";

export async function modelsRoutes(app: FastifyInstance) {
  // OpenAI format model listing
  app.get("/v1/models", async (): Promise<ListModelsResponse> => ({
    object: "list",
    data: toOpenAIModels(),
  }));

  // Exo's own model listing with optional status filter and is_custom field
  app.get("/models", async (request) => {
    const { status } = request.query as { status?: string };
    const models = status ? filterByStatus(status) : getModelRegistry();
    return {
      object: "list",
      data: models.map((m) => ({
        id: m.id,
        name: m.name,
        family: m.family,
        parameter_size: m.parameterSize,
        context_length: m.contextLength,
        status: m.status,
        is_custom: m.isCustom,
      })),
    };
  });

  // Model search — real Exo uses `query` param
  app.get("/models/search", async (request) => {
    const { query, limit } = request.query as { query?: string; limit?: string };
    const maxResults = limit ? parseInt(limit, 10) : 20;
    if (!query) return { models: getModelRegistry().slice(0, maxResults) };
    return { models: searchModels(query).slice(0, maxResults) };
  });

  // Add custom model (HuggingFace)
  app.post("/models/add", async (request) => {
    const { model_id } = request.body as { model_id: string };
    if (!model_id) {
      return { error: "model_id is required" };
    }
    const entry = addCustomModel(model_id);
    return { model: entry, status: "added" };
  });

  // Remove custom model
  app.delete("/models/custom/:modelId", async (request, reply) => {
    const { modelId } = request.params as { modelId: string };
    const removed = removeCustomModel(modelId);
    if (!removed) {
      return reply.status(404).send({ error: "Custom model not found" });
    }
    return { deleted: true };
  });
}
