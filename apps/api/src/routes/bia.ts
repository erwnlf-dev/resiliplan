import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth-service.js';
import { createBiaSchema, deriveBiaFields, patchBiaSchema, summarizeBiaEntries } from '../bia/bia-service.js';
import { evaluateBiaDrpAlignment } from '../bia/drp-alignment-service.js';
import { db } from '../db/client.js';
import { auditLogs, biaEntries, drpPlans } from '../db/schema/index.js';

const idParam = z.object({ id: z.string().uuid() });

async function audit(tenantId: string, actorId: string, entityId: string, action: string, summary: string, metadata: Record<string, unknown> = {}) {
  await db.insert(auditLogs).values({ tenantId, actorId, entityType: 'bia_entry', entityId, action, summary, metadata });
}

export async function biaRoutes(app: FastifyInstance) {
  app.get('/api/v1/bia', async (req) => {
    const user = await requireAuth(req);
    const entries = await db.select().from(biaEntries).where(eq(biaEntries.tenantId, user.tenantId)).orderBy(asc(biaEntries.serviceName), asc(biaEntries.processName));
    return { entries, summary: summarizeBiaEntries(entries) };
  });

  app.get('/api/v1/bia/drp-alignment', async (req) => {
    const user = await requireAuth(req);
    const entries = await db.select().from(biaEntries).where(eq(biaEntries.tenantId, user.tenantId)).orderBy(asc(biaEntries.serviceName), asc(biaEntries.processName));
    const plans = await db.select().from(drpPlans).where(eq(drpPlans.tenantId, user.tenantId)).orderBy(asc(drpPlans.serviceName), asc(drpPlans.title));
    return evaluateBiaDrpAlignment({ biaEntries: entries, drpPlans: plans });
  });

  app.post('/api/v1/bia', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const body = createBiaSchema.parse(req.body);
    const [entry] = await db.insert(biaEntries).values({ tenantId: user.tenantId, createdBy: user.id, updatedBy: user.id, ...body }).returning();
    await audit(user.tenantId, user.id, entry.id, 'create', `Created BIA for ${entry.serviceName}`, { criticalityTier: entry.criticalityTier });
    return reply.code(201).send(entry);
  });

  app.patch('/api/v1/bia/:id', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id } = idParam.parse(req.params);
    const body = patchBiaSchema.parse(req.body);
    const [existing] = await db.select().from(biaEntries).where(and(eq(biaEntries.id, id), eq(biaEntries.tenantId, user.tenantId))).limit(1);
    if (!existing) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'BIA entry not found', instance: req.id });
    const derived = deriveBiaFields({
      impact1h: body.impact1h ?? existing.impact1h,
      impact4h: body.impact4h ?? existing.impact4h,
      impact24h: body.impact24h ?? existing.impact24h,
      financialImpact: body.financialImpact ?? existing.financialImpact,
      reputationalImpact: body.reputationalImpact ?? existing.reputationalImpact,
      regulatoryImpact: body.regulatoryImpact ?? existing.regulatoryImpact,
    });
    const [entry] = await db.update(biaEntries).set({ ...body, ...derived, updatedBy: user.id, updatedAt: new Date() }).where(and(eq(biaEntries.id, id), eq(biaEntries.tenantId, user.tenantId))).returning();
    await audit(user.tenantId, user.id, id, 'update', `Updated BIA for ${entry.serviceName}`, { criticalityTier: entry.criticalityTier });
    return entry;
  });
}
