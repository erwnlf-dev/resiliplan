import { and, asc, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth-service.js';
import { db } from '../db/client.js';
import { auditLogs, recoveryDrills, serviceAssets, serviceRisks } from '../db/schema/index.js';
import { createAssetSchema, createDrillSchema, createRiskSchema, summarizeResilienceRegister } from '../resilience/resilience-service.js';

const idParam = z.object({ id: z.string().uuid() });

async function audit(tenantId: string, actorId: string, entityType: string, entityId: string, action: string, summary: string, metadata: Record<string, unknown> = {}) {
  await db.insert(auditLogs).values({ tenantId, actorId, entityType, entityId, action, summary, metadata });
}

export async function resilienceRoutes(app: FastifyInstance) {
  app.get('/api/v1/resilience/summary', async (req) => {
    const user = await requireAuth(req);
    const [assets, risks, drills] = await Promise.all([
      db.select().from(serviceAssets).where(eq(serviceAssets.tenantId, user.tenantId)).orderBy(asc(serviceAssets.serviceName)),
      db.select().from(serviceRisks).where(eq(serviceRisks.tenantId, user.tenantId)).orderBy(desc(serviceRisks.riskScore)),
      db.select().from(recoveryDrills).where(eq(recoveryDrills.tenantId, user.tenantId)).orderBy(asc(recoveryDrills.scheduledAt)),
    ]);
    return { summary: summarizeResilienceRegister({ assets, risks, drills }) };
  });

  app.get('/api/v1/assets', async (req) => {
    const user = await requireAuth(req);
    const assets = await db.select().from(serviceAssets).where(eq(serviceAssets.tenantId, user.tenantId)).orderBy(asc(serviceAssets.serviceName), asc(serviceAssets.recoveryPriority));
    return { assets };
  });

  app.post('/api/v1/assets', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const body = createAssetSchema.parse(req.body);
    const [asset] = await db.insert(serviceAssets).values({ tenantId: user.tenantId, createdBy: user.id, updatedBy: user.id, ...body }).returning();
    await audit(user.tenantId, user.id, 'service_asset', asset.id, 'create', `Added asset ${asset.assetName}`, { serviceName: asset.serviceName });
    return reply.code(201).send(asset);
  });

  app.patch('/api/v1/assets/:id', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id } = idParam.parse(req.params);
    const body = createAssetSchema.partial().parse(req.body);
    const [asset] = await db.update(serviceAssets).set({ ...body, updatedBy: user.id, updatedAt: new Date() }).where(and(eq(serviceAssets.id, id), eq(serviceAssets.tenantId, user.tenantId))).returning();
    if (!asset) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Asset not found', instance: req.id });
    await audit(user.tenantId, user.id, 'service_asset', id, 'update', `Updated asset ${asset.assetName}`);
    return asset;
  });

  app.get('/api/v1/risks', async (req) => {
    const user = await requireAuth(req);
    const risks = await db.select().from(serviceRisks).where(eq(serviceRisks.tenantId, user.tenantId)).orderBy(desc(serviceRisks.riskScore), asc(serviceRisks.serviceName));
    return { risks };
  });

  app.post('/api/v1/risks', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const body = createRiskSchema.parse(req.body);
    const [risk] = await db.insert(serviceRisks).values({ tenantId: user.tenantId, createdBy: user.id, updatedBy: user.id, ...body }).returning();
    await audit(user.tenantId, user.id, 'service_risk', risk.id, 'create', `Added risk ${risk.riskTitle}`, { riskScore: risk.riskScore });
    return reply.code(201).send(risk);
  });

  app.patch('/api/v1/risks/:id', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id } = idParam.parse(req.params);
    const body = z
      .object({
        serviceName: z.string().min(2).optional(),
        riskTitle: z.string().min(3).optional(),
        category: z.string().min(2).optional(),
        probability: z.number().int().min(1).max(5).optional(),
        impact: z.number().int().min(1).max(5).optional(),
        mitigation: z.string().optional(),
        owner: z.string().optional(),
        status: z.enum(['open', 'mitigating', 'mitigated', 'accepted']).optional(),
      })
      .parse(req.body);
    const existing = await db.select().from(serviceRisks).where(and(eq(serviceRisks.id, id), eq(serviceRisks.tenantId, user.tenantId))).limit(1);
    if (!existing[0]) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Risk not found', instance: req.id });
    const probability = body.probability ?? existing[0].probability;
    const impact = body.impact ?? existing[0].impact;
    const [risk] = await db.update(serviceRisks).set({ ...body, riskScore: probability * impact, updatedBy: user.id, updatedAt: new Date() }).where(and(eq(serviceRisks.id, id), eq(serviceRisks.tenantId, user.tenantId))).returning();
    await audit(user.tenantId, user.id, 'service_risk', id, 'update', `Updated risk ${risk.riskTitle}`, { riskScore: risk.riskScore });
    return risk;
  });

  app.get('/api/v1/drills', async (req) => {
    const user = await requireAuth(req);
    const drills = await db.select().from(recoveryDrills).where(eq(recoveryDrills.tenantId, user.tenantId)).orderBy(asc(recoveryDrills.scheduledAt));
    return { drills };
  });

  app.post('/api/v1/drills', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const body = createDrillSchema.parse(req.body);
    const [drill] = await db.insert(recoveryDrills).values({ tenantId: user.tenantId, createdBy: user.id, updatedBy: user.id, ...body, scheduledAt: new Date(body.scheduledAt) }).returning();
    await audit(user.tenantId, user.id, 'recovery_drill', drill.id, 'create', `Scheduled drill ${drill.drillTitle}`, { serviceName: drill.serviceName });
    return reply.code(201).send(drill);
  });

  app.patch('/api/v1/drills/:id', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id } = idParam.parse(req.params);
    const body = createDrillSchema.partial().parse(req.body);
    const values = { ...body, scheduledAt: body.scheduledAt ? new Date(body.scheduledAt) : undefined, updatedBy: user.id, updatedAt: new Date() };
    const [drill] = await db.update(recoveryDrills).set(values).where(and(eq(recoveryDrills.id, id), eq(recoveryDrills.tenantId, user.tenantId))).returning();
    if (!drill) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Drill not found', instance: req.id });
    await audit(user.tenantId, user.id, 'recovery_drill', id, 'update', `Updated drill ${drill.drillTitle}`);
    return drill;
  });
}
