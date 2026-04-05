import type { FastifyInstance } from "fastify";
import { toOpenAIModels, searchModels, getModelRegistry } from "../state/models.js";
import type { ListModelsResponse } from "../types/openai.js";

export async function modelsRoutes(app: FastifyInstance) {
  // OpenAI format model listing
  app.get("/v1/models", async (): Promise<ListModelsResponse> => ({
    object: "list",
    data: toOpenAIModels(),
  }));

  // Exo's own model listing (same format)
  app.get("/models", async (): Promise<ListModelsResponse> => ({
    object: "list",
    data: toOpenAIModels(),
  }));

  // Model search — real Exo uses `query` param, not `q`
  app.get("/models/search", async (request) => {
    const { query } = request.query as { query?: string };
    if (!query) return { models: getModelRegistry() };
    return { models: searchModels(query) };
  });
}
