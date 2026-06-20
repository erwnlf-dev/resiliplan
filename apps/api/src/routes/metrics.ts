import type { FastifyInstance } from 'fastify';
import { pool } from '../db/client.js';

const startedAt = Date.now();
let requestCount = 0;
let errorCount = 0;

export async function metricsRoutes(app: FastifyInstance) {
  app.addHook('onResponse', async (_req, reply) => {
    requestCount += 1;
    if (reply.statusCode >= 500) errorCount += 1;
  });

  app.get('/metrics', async (_req, reply) => {
    const total = pool.totalCount;
    const idle = pool.idleCount;
    const waiting = pool.waitingCount;
    const uptime = Math.floor((Date.now() - startedAt) / 1000);
    reply.type('text/plain; version=0.0.4');
    return [
      '# HELP resiliplan_uptime_seconds API process uptime in seconds',
      '# TYPE resiliplan_uptime_seconds gauge',
      `resiliplan_uptime_seconds ${uptime}`,
      '# HELP resiliplan_http_requests_total Total HTTP responses observed',
      '# TYPE resiliplan_http_requests_total counter',
      `resiliplan_http_requests_total ${requestCount}`,
      '# HELP resiliplan_http_errors_total Total HTTP 5xx responses observed',
      '# TYPE resiliplan_http_errors_total counter',
      `resiliplan_http_errors_total ${errorCount}`,
      '# HELP resiliplan_db_pool_connections Current PostgreSQL pool connections',
      '# TYPE resiliplan_db_pool_connections gauge',
      `resiliplan_db_pool_connections{state="total"} ${total}`,
      `resiliplan_db_pool_connections{state="idle"} ${idle}`,
      `resiliplan_db_pool_connections{state="waiting"} ${waiting}`,
      '',
    ].join('\n');
  });
}
