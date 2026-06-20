/**
 * ResiliPlan API — Configuration
 * Validated environment variables using Zod.
 */

import { z } from 'zod';
import { config as loadDotenv } from 'dotenv';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env from monorepo root (hardcoded path for reliability)
const MONOREPO_ROOT = resolve(process.cwd(), '..', '..');
const envPath = resolve(MONOREPO_ROOT, '.env');

if (existsSync(envPath)) {
  loadDotenv({ path: envPath });
  console.log(`[config] Loaded .env from: ${envPath}`);
} else {
  console.warn(`[config] .env not found at ${envPath}, using process.env`);
}

const ConfigSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  APP_NAME: z.string().default('ResiliPlan'),
  APP_URL: z.string().url().default('http://localhost:5173'),
  API_URL: z.string().url().default('http://localhost:3001'),
  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default('0.0.0.0'),

  // Security
  API_KEY_ENCRYPTION_KEY: z
    .string()
    .min(32, 'API_KEY_ENCRYPTION_KEY must be at least 32 characters')
    .default('change-me-please-32-chars-minimum-please-change-in-production'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173,http://localhost:4173')
    .transform((s) => s.split(',').map((o) => o.trim())),

  // Rate limiting
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),
  RATE_LIMIT_WINDOW: z.string().default('1 minute'),

  // Database
  DATABASE_URL: z
    .string()
    .url()
    .default('postgresql://resiliplan:***@localhost:5432/resiliplan'),
  DB_POOL_MIN: z.coerce.number().int().nonnegative().default(2),
  DB_POOL_MAX: z.coerce.number().int().positive().default(20),
  DB_STATEMENT_TIMEOUT: z.coerce.number().int().positive().default(30000),

  // Redis
  REDIS_URL: z.string().default('redis://localhost:6379'),
  REDIS_PREFIX: z.string().default('resiliplan:'),

  // Logging
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_PRETTY: z
    .string()
    .default('true')
    .transform((s) => s === 'true'),

  // Optional integrations
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().optional(),

  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().optional(),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_FROM: z.string().optional(),
});

const parsed = ConfigSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = parsed.data;
export type Config = z.infer<typeof ConfigSchema>;
