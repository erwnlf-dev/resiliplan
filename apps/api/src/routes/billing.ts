import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { requireAuth, requireRole } from '../auth/auth-service.js';
import { db } from '../db/client.js';
import { subscriptions, usageEvents } from '../db/schema/index.js';

async function ensureSubscription(tenantId: string) {
  const [existing] = await db.select().from(subscriptions).where(eq(subscriptions.tenantId, tenantId)).limit(1);
  if (existing) return existing;
  const [created] = await db.insert(subscriptions).values({
    tenantId,
    planCode: 'internal',
    status: 'active',
    currentPeriodEnd: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    metadata: { source: 'system-default' },
  }).returning();
  return created;
}

export async function billingRoutes(app: FastifyInstance) {
  app.get('/api/v1/billing/summary', async (req) => {
    const user = await requireAuth(req);
    const subscription = await ensureSubscription(user.tenantId);
    const events = await db.select().from(usageEvents).where(eq(usageEvents.tenantId, user.tenantId));
    const usage = events.reduce<Record<string, number>>((acc, event) => {
      acc[event.eventType] = (acc[event.eventType] ?? 0) + event.quantity;
      return acc;
    }, {});
    return { subscription, usage };
  });

  app.post('/api/v1/billing/usage', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const body = (req.body ?? {}) as { eventType?: 'plan_created' | 'ai_request' | 'export_generated' | 'collaboration_session'; quantity?: number; metadata?: Record<string, unknown> };
    if (!body.eventType) return reply.code(400).send({ error: 'eventType required' });
    const [event] = await db.insert(usageEvents).values({ tenantId: user.tenantId, eventType: body.eventType, quantity: body.quantity ?? 1, metadata: body.metadata ?? {} }).returning();
    return reply.code(201).send(event);
  });
}
