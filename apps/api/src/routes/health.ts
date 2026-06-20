/**
 * Health check routes
 * - GET /api/health — deep health check (DB, Redis, version)
 * - GET /api/health/live — liveness probe (just returns 200)
 * - GET /api/health/ready — readiness probe (verifies dependencies)
 */

import type { FastifyInstance } from 'fastify';
import { count, eq } from 'drizzle-orm';
import { config } from '../config/index.js';
import { db, pool } from '../db/client.js';
import { drpPlans, notifications, recoveryDrills, serviceRisks, users } from '../db/schema/index.js';
import { requireAuth } from '../auth/auth-service.js';
import { evaluateProductionReadiness } from '../readiness/readiness-service.js';

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

  app.get('/api/v1/monitoring/summary', async (req) => {
    const user = await requireAuth(req);
    const [plansTotal] = await db.select({ value: count() }).from(drpPlans).where(eq(drpPlans.tenantId, user.tenantId));
    const [usersTotal] = await db.select({ value: count() }).from(users).where(eq(users.tenantId, user.tenantId));
    const [risksTotal] = await db.select({ value: count() }).from(serviceRisks).where(eq(serviceRisks.tenantId, user.tenantId));
    const [drillsTotal] = await db.select({ value: count() }).from(recoveryDrills).where(eq(recoveryDrills.tenantId, user.tenantId));
    const [unreadNotifications] = await db.select({ value: count() }).from(notifications).where(eq(notifications.userId, user.id));
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      counters: {
        plans: plansTotal.value,
        users: usersTotal.value,
        risks: risksTotal.value,
        drills: drillsTotal.value,
        notifications: unreadNotifications.value,
      },
      system: {
        uptimeSeconds: Math.floor(process.uptime()),
        memoryUsageMB: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      },
    };
  });

  app.get('/api/v1/readiness', async (req) => {
    await requireAuth(req);
    const migrationResult = await pool.query('SELECT count(*)::int AS count FROM _resiliplan_migrations');
    const smtpConfigured = Boolean(config.SMTP_HOST && config.SMTP_PORT && config.SMTP_FROM);
    return evaluateProductionReadiness({
      nodeEnv: config.NODE_ENV,
      appUrl: config.APP_URL,
      apiUrl: config.API_URL,
      encryptionKey: config.API_KEY_ENCRYPTION_KEY,
      corsOrigins: config.CORS_ORIGINS,
      smtpConfigured,
      migrationsApplied: migrationResult.rows[0]?.count ?? 0,
    });
  });
}
