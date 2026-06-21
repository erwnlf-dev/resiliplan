/**
 * Integrations API Routes
 *
 * CRUD for integration configurations, sync trigger, sync history.
 * Plus inbound webhook handler untuk Prometheus Alertmanager.
 */
import { and, desc, eq } from 'drizzle-orm';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth-service.js';
import { db } from '../db/client.js';
import { auditLogs } from '../db/schema/drp.js';
import { integrations, integrationSyncs, webhookOutbox } from '../db/schema/integrations.js';
import { decryptSecret } from '../security/crypto-service.js';
import { IntegrationService, SUPPORTED_INTEGRATIONS } from '../services/integration-service.js';
import { processAlertmanagerPayload } from '../services/adapters/prometheus-adapter.js';
import { enqueueWebhookEvent, processWebhookOutboxBatch } from '../services/webhook-dispatcher.js';
import { logger } from '../utils/logger.js';

const integrationCreateSchema = z.object({
  type: z.string(),
  direction: z.enum(['inbound', 'outbound', 'bidirectional']),
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()).default({}),
  isEnabled: z.boolean().default(true),
});

const integrationUpdateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  config: z.record(z.string(), z.unknown()).optional(),
  isEnabled: z.boolean().optional(),
  status: z.enum(['active', 'paused', 'error', 'pending_setup']).optional(),
});

export async function integrationRoutes(app: FastifyInstance) {
  // ==============================================================
  // PUBLIC CATALOG (no auth required, just static config)
  // ==============================================================

  app.get('/api/v1/integrations/catalog', async () => {
    return { integrations: SUPPORTED_INTEGRATIONS };
  });

  // ==============================================================
  // AUTHENTICATED ROUTES
  // ==============================================================

  app.get('/api/v1/integrations', async (req) => {
    const user = await requireAuth(req);
    return { integrations: await IntegrationService.listByTenant(user.tenantId) };
  });

  app.get('/api/v1/integrations/:id', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const integration = await IntegrationService.getById(user.tenantId, id);
    if (!integration) return reply.code(404).send({ error: 'Integration not found' });
    return { integration };
  });

  app.post('/api/v1/integrations', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const body = integrationCreateSchema.parse(req.body);

    // Validate type
    const typeConfig = SUPPORTED_INTEGRATIONS.find((c) => c.type === body.type);
    if (!typeConfig) return reply.code(400).send({ error: `Unsupported integration type: ${body.type}` });

    const integration = await IntegrationService.create(user.tenantId, user.id, body as any);
    return reply.code(201).send({ integration });
  });

  app.patch('/api/v1/integrations/:id', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = integrationUpdateSchema.parse(req.body);
    const integration = await IntegrationService.update(user.tenantId, user.id, id, body);
    if (!integration) return reply.code(404).send({ error: 'Integration not found' });
    return { integration };
  });

  app.delete('/api/v1/integrations/:id', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const deleted = await IntegrationService.delete(user.tenantId, user.id, id);
    if (!deleted) return reply.code(404).send({ error: 'Integration not found' });
    return { deleted: true };
  });

  // ==============================================================
  // SYNC OPERATIONS
  // ==============================================================

  app.post('/api/v1/integrations/:id/sync', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    try {
      const result = await IntegrationService.triggerSync(user.tenantId, user.id, id, 'manual');
      return result;
    } catch (err) {
      return reply.code(500).send({ error: err instanceof Error ? err.message : String(err) });
    }
  });

  app.get('/api/v1/integrations/:id/syncs', async (req) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const syncs = await IntegrationService.getSyncs(user.tenantId, id);
    return { syncs };
  });

  // ==============================================================
  // WEBHOOK OUTBOX (admin debugging)
  // ==============================================================

  app.get('/api/v1/webhooks/outbox', async (req) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const limit = z.coerce.number().int().min(1).max(200).default(50).parse((req.query as any).limit || 50);
    const rows = await db
      .select()
      .from(webhookOutbox)
      .where(eq(webhookOutbox.tenantId, user.tenantId))
      .orderBy(desc(webhookOutbox.queuedAt))
      .limit(limit);
    return { outbox: rows };
  });

  app.post('/api/v1/webhooks/outbox/process', async (req) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin']);
    const result = await processWebhookOutboxBatch(20);
    await db.insert(auditLogs).values({
      tenantId: user.tenantId,
      actorId: user.id,
      entityType: 'webhook_outbox',
      entityId: 'batch',
      action: 'process',
      summary: `Processed ${result.processed} webhook outbox items (${result.succeeded} ok, ${result.failed} failed)`,
      metadata: result,
    });
    return result;
  });

  // ==============================================================
  // INBOUND WEBHOOKS (no auth, signature-verified)
  // ==============================================================

  app.post('/api/v1/webhooks/in/prometheus', async (req, reply) => {
    // Prometheus Alertmanager sends payload as JSON body
    // Verify signature: HMAC-SHA256(secret, body)
    const signature = req.headers['x-alertmanager-signature'] as string | undefined;
    const rawBody = JSON.stringify(req.body);

    // Find matching tenant integration by webhook secret
    // We need to find the right tenant — convention: first active integration with type=prometheus
    // For multi-tenant, the URL should include tenant slug. For now, use first match.
    const allProm = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.type, 'prometheus'), eq(integrations.isEnabled, true)));

    let matchedIntegration = null;
    for (const integration of allProm) {
      const cfg = integration.config as Record<string, unknown>;
      const prom = (cfg.prometheus as Record<string, unknown>) || {};
      const secret = prom.webhookSecret as string;
      if (!secret) continue;

      const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
      if (signature === `sha256=${expected}`) {
        matchedIntegration = integration;
        break;
      }
    }

    if (!matchedIntegration) {
      return reply.code(401).send({ error: 'Invalid or missing signature, or no matching tenant integration' });
    }

    // Process payload
    const result = processAlertmanagerPayload(
      matchedIntegration.tenantId,
      req.body as any,
      signature || '',
    );

    // Enqueue webhook events for outbound dispatch (to Mattermost, etc)
    for (const event of result.events) {
      await enqueueWebhookEvent({
        tenantId: matchedIntegration.tenantId,
        eventType: event.eventType as any,
        payload: { ...event.payload, summary: event.summary, severity: event.severity },
      });
    }

    await db.insert(auditLogs).values({
      tenantId: matchedIntegration.tenantId,
      actorId: null,
      entityType: 'webhook_in',
      entityId: 'prometheus',
      action: 'received',
      summary: `Prometheus Alertmanager webhook: ${result.received} alerts (${result.firing} firing, ${result.resolved} resolved)`,
      metadata: { ...result, signature: '***' },
    });

    return { ok: true, ...result };
  });

  // Generic inbound webhook (no signature, for trusted internal use)
  app.post('/api/v1/webhooks/in/:integrationId', async (req, reply) => {
    const { integrationId } = z.object({ integrationId: z.string().uuid() }).parse(req.params);
    const [integration] = await db.select().from(integrations).where(eq(integrations.id, integrationId));
    if (!integration) return reply.code(404).send({ error: 'Integration not found' });
    if (!integration.isEnabled) return reply.code(403).send({ error: 'Integration is disabled' });

    // Enqueue for outbound relay if applicable
    const body = req.body as any;
    await enqueueWebhookEvent({
      tenantId: integration.tenantId,
      eventType: body.eventType || 'incident.created',
      payload: body.payload || body || {},
    });

    return { ok: true, queued: true };
  });
}
