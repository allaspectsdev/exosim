import dotenv from "dotenv";

dotenv.config();

function requiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export const config = {
  ANTHROPIC_API_KEY: requiredEnv("ANTHROPIC_API_KEY"),
  ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL ?? "claude-opus-4-6",
  PORT: parseInt(process.env.PORT ?? "52415", 10),
  SIMULATED_NODE_COUNT: parseInt(process.env.SIMULATED_NODE_COUNT ?? "3", 10),
  ENABLE_MDNS: process.env.ENABLE_MDNS === "true",
  DEFAULT_MAX_TOKENS: parseInt(process.env.DEFAULT_MAX_TOKENS ?? "4096", 10),
  LOG_LEVEL: process.env.LOG_LEVEL ?? "info",
  CORS_ORIGIN: process.env.CORS_ORIGIN ?? "*",
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX ?? "0", 10), // 0 = disabled
} as const;
