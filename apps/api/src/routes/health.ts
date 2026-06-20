/**
 * Health check routes
 * - GET /api/health — deep health check (DB, Redis, version)
 * - GET /api/health/live — liveness probe (just returns 200)
 * - GET /api/health/ready — readiness probe (verifies dependencies)
 */

import type { FastifyInstance } from 'fastify';
import { config } from '../config/index.js';
import { pool } from '../db/client.js';

export async function healthRoutes(app: FastifyInstance) {
  // Liveness — is the process alive?
  app.get('/api/health/live', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  });

  // Readiness — can we serve requests?
  app.get('/api/health/ready', async (req, reply) => {
    const checks: Record<string, { status: 'ok' | 'fail'; message?: string; durationMs: number }> = {};

    // Check DB
    const dbStart = Date.now();
    try {
      await pool.query('SELECT 1');
      checks.database = { status: 'ok', durationMs: Date.now() - dbStart };
    } catch (err) {
      checks.database = {
        status: 'fail',
        message: err instanceof Error ? err.message : 'Unknown error',
        durationMs: Date.now() - dbStart,
      };
    }

    // Check Redis (Phase 0b will add when Redis is wired)
    // checks.redis = ...

    const allOk = Object.values(checks).every((c) => c.status === 'ok');
    const status = allOk ? 200 : 503;

    return reply.code(status).send({
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: config.APP_NAME,
      version: '0.1.0',
      environment: config.NODE_ENV,
      checks,
    });
  });

  // Deep health check (default)
  app.get('/api/health', async (req, reply) => {
    const checks: Record<
      string,
      { status: 'ok' | 'fail'; message?: string; durationMs: number }
    > = {};

    // Check DB
    const dbStart = Date.now();
    try {
      await pool.query('SELECT 1');
      checks.database = { status: 'ok', durationMs: Date.now() - dbStart };
    } catch (err) {
      checks.database = {
        status: 'fail',
        message: err instanceof Error ? err.message : 'Unknown error',
        durationMs: Date.now() - dbStart,
      };
    }

    // System info
    const systemInfo = {
      nodeVersion: process.version,
      platform: process.platform,
      arch: process.arch,
      uptimeSeconds: Math.floor(process.uptime()),
      memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
    };

    const allOk = Object.values(checks).every((c) => c.status === 'ok');
    const status = allOk ? 200 : 503;

    return reply.code(status).send({
      status: allOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      service: config.APP_NAME,
      version: '0.1.0',
      environment: config.NODE_ENV,
      system: systemInfo,
      checks,
    });
  });
}
