/**
 * ResiliPlan API — Database Client
 * Drizzle ORM + PostgreSQL connection pool.
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import * as schema from './schema/index.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: config.DATABASE_URL,
  min: config.DB_POOL_MIN,
  max: config.DB_POOL_MAX,
  statement_timeout: config.DB_STATEMENT_TIMEOUT,
});

pool.on('error', (err) => {
  logger.error({ err }, 'Unexpected error on idle database client');
});

export const db = drizzle(pool, { schema });

export type Database = typeof db;
