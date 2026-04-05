import Fastify from "fastify";
import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
import { config } from "./config.js";
import { openaiRoutes } from "./routes/openai.js";
import { claudeRoutes } from "./routes/claude.js";
import { ollamaRoutes } from "./routes/ollama.js";
import { responsesRoutes } from "./routes/responses.js";
import { modelsRoutes } from "./routes/models.js";
import { clusterRoutes } from "./routes/cluster.js";

export async function buildServer() {
  const app = Fastify({
    logger: {
      level: config.LOG_LEVEL,
    },
    bodyLimit: 8 * 1024 * 1024, // 8 MB — accommodates large base64 images in requests
  });

  // Raise keepAliveTimeout to match proxySync's 120s timeout
  app.server.keepAliveTimeout = 130_000;

  const corsOrigin = config.CORS_ORIGIN === "*" ? true : config.CORS_ORIGIN.split(",");
  await app.register(cors, { origin: corsOrigin });

  // Rate limiting — only enabled when RATE_LIMIT_MAX > 0
  if (config.RATE_LIMIT_MAX > 0) {
    await app.register(rateLimit, {
      max: config.RATE_LIMIT_MAX,
      timeWindow: "1 minute",
    });
  }

  // API routes
  await app.register(openaiRoutes);
  await app.register(claudeRoutes);
  await app.register(ollamaRoutes);
  await app.register(responsesRoutes);
  await app.register(modelsRoutes);
  await app.register(clusterRoutes);

  // Health check
  app.get("/", async () => ({
    name: "ExoSim",
    version: "0.1.0",
    status: "running",
    description: "Exo cluster simulator proxying to Claude Opus 4.6",
  }));

  // 501 for unsupported image generation
  app.post("/v1/images/generations", async (_req, reply) => {
    reply.status(501).send({
      error: {
        message: "Image generation is not supported by ExoSim",
        type: "not_implemented",
        code: "not_implemented",
      },
    });
  });

  app.post("/v1/images/edits", async (_req, reply) => {
    reply.status(501).send({
      error: {
        message: "Image editing is not supported by ExoSim",
        type: "not_implemented",
        code: "not_implemented",
      },
    });
  });

  return app;
}
