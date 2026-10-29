import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
}

function num(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && value !== undefined ? parsed : fallback;
}

export const config = {
  env: process.env.NODE_ENV ?? 'development',
  port: num(process.env.PORT, 8787),
  host: process.env.HOST ?? '0.0.0.0',
  rootDir: path.resolve(here, '..', '..'),
  dbPath: process.env.DATABASE_PATH ?? path.resolve(here, '..', '..', 'data', 'nova.db'),
  jwtSecret: process.env.JWT_SECRET ?? 'nova-dev-secret-change-me-in-production',
  jwtTtlSeconds: num(process.env.JWT_TTL_SECONDS, 60 * 60 * 12),
  corsOrigins: (process.env.CORS_ORIGINS ?? '*').split(',').map((origin) => origin.trim()).filter(Boolean),
  trustProxy: bool(process.env.TRUST_PROXY, true),
  ai: {
    /** Optional OpenAI-compatible endpoint. When unset, NOVA's built-in neural-ish engine answers. */
    baseUrl: process.env.AI_BASE_URL ?? '',
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? 'gpt-4o-mini',
    temperature: num(process.env.AI_TEMPERATURE, 0.4),
    maxTokens: num(process.env.AI_MAX_TOKENS, 700),
    requestTimeoutMs: num(process.env.AI_TIMEOUT_MS, 30_000),
  },
  features: {
    demoMode: bool(process.env.DEMO_MODE, true),
    autoTopup: bool(process.env.FEATURE_AUTOTOPUP, true),
  },
  limits: {
    rateWindowMs: 60_000,
    rateMaxRequests: num(process.env.RATE_MAX, 240),
    assistantRateMax: num(process.env.ASSISTANT_RATE_MAX, 40),
  },
} as const;

export const hasExternalLLM = () => Boolean(config.ai.baseUrl && config.ai.apiKey);
