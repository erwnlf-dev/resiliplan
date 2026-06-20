import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { approvals, auditLogs, drpPlans, drpSections } from '../db/schema/index.js';
import { ISO_22301_SECTIONS, defaultSectionContent } from '../drp/iso-template.js';
import { renderDocxPayload, renderMarkdownPayload, renderPdfPayload } from '../drp/export-service.js';
import { requireAuth, requireRole } from '../auth/auth-service.js';

const createPlanSchema = z.object({
  title: z.string().min(3),
  serviceName: z.string().min(2),
  serviceOwner: z.string().min(2),
  businessOwner: z.string().optional(),
  description: z.string().optional(),
  criticality: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
  rtoMinutes: z.number().int().positive().default(240),
  rpoMinutes: z.number().int().positive().default(60),
  recoveryStrategy: z.string().optional(),
  location: z.string().optional(),
  tags: z.array(z.string()).optional(),
});

const updatePlanSchema = createPlanSchema.partial();

async function audit(tenantId: string, actorId: string, entityType: string, entityId: string, action: string, summary: string, metadata: Record<string, unknown> = {}) {
  await db.insert(auditLogs).values({ tenantId, actorId, entityType, entityId, action, summary, metadata });
}

async function getPlanWithSections(planId: string, tenantId: string) {
  const [plan] = await db.select().from(drpPlans).where(and(eq(drpPlans.id, planId), eq(drpPlans.tenantId, tenantId))).limit(1);
  if (!plan) return null;
  const sections = await db.select().from(drpSections).where(eq(drpSections.planId, planId)).orderBy(asc(drpSections.order));
  return { ...plan, sections };
}

export async function planRoutes(app: FastifyInstance) {
  app.get('/api/v1/templates/iso-22301', async () => ({ sections: ISO_22301_SECTIONS }));

  app.get('/api/v1/plans', async (req) => {
    const user = await requireAuth(req);
    const plans = await db.select().from(drpPlans).where(eq(drpPlans.tenantId, user.tenantId)).orderBy(asc(drpPlans.createdAt));
    return { plans };
  });

  app.post('/api/v1/plans', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const body = createPlanSchema.parse(req.body);
    const [plan] = await db
      .insert(drpPlans)
      .values({
        tenantId: user.tenantId,
        title: body.title,
        serviceName: body.serviceName,
        serviceOwner: body.serviceOwner,
        businessOwner: body.businessOwner,
        description: body.description ?? '',
        criticality: body.criticality,
        rtoMinutes: body.rtoMinutes,
        rpoMinutes: body.rpoMinutes,
        createdBy: user.id,
        updatedBy: user.id,
        metadata: { recoveryStrategy: body.recoveryStrategy, location: body.location, tags: body.tags ?? [] },
      })
      .returning();
    await db.insert(drpSections).values(
      ISO_22301_SECTIONS.map((section) => ({
        planId: plan.id,
        sectionKey: section.key,
        title: section.title,
        isoClause: section.isoClause,
        order: section.order,
        contentMarkdown: defaultSectionContent(section),
        updatedBy: user.id,
      })),
    );
    await audit(user.tenantId, user.id, 'drp_plan', plan.id, 'create', `Created DRP for ${plan.serviceName}`);
    return reply.code(201).send(await getPlanWithSections(plan.id, user.tenantId));
  });

  app.get('/api/v1/plans/:id', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    return plan;
  });

  app.patch('/api/v1/plans/:id', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = updatePlanSchema.parse(req.body);
    const [updated] = await db
      .update(drpPlans)
      .set({
        ...body,
        metadata: { recoveryStrategy: body.recoveryStrategy, location: body.location, tags: body.tags ?? [] },
        updatedBy: user.id,
        updatedAt: new Date(),
      })
      .where(and(eq(drpPlans.id, id), eq(drpPlans.tenantId, user.tenantId)))
      .returning();
    if (!updated) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    await audit(user.tenantId, user.id, 'drp_plan', id, 'update', `Updated DRP ${updated.title}`);
    return getPlanWithSections(id, user.tenantId);
  });

  app.patch('/api/v1/plans/:id/sections/:sectionKey', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id, sectionKey } = z.object({ id: z.string().uuid(), sectionKey: z.string() }).parse(req.params);
    const body = z.object({ contentMarkdown: z.string().min(1), status: z.enum(['draft', 'ready_for_review', 'approved']).optional() }).parse(req.body);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const [section] = await db
      .update(drpSections)
      .set({ contentMarkdown: body.contentMarkdown, status: body.status ?? 'draft', updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(drpSections.planId, id), eq(drpSections.sectionKey, sectionKey)))
      .returning();
    if (!section) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Section not found', instance: req.id });
    await audit(user.tenantId, user.id, 'drp_section', section.id, 'update', `Updated section ${section.title}`, { planId: id, sectionKey });
    return section;
  });

  app.post('/api/v1/plans/:id/submit', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const [plan] = await db.update(drpPlans).set({ status: 'in_review', updatedBy: user.id, updatedAt: new Date() }).where(and(eq(drpPlans.id, id), eq(drpPlans.tenantId, user.tenantId))).returning();
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    await db.insert(approvals).values({ planId: id, actorId: user.id, decision: 'submitted', note: 'Submitted for approval' });
    await audit(user.tenantId, user.id, 'drp_plan', id, 'submit', `Submitted ${plan.title} for approval`);
    return getPlanWithSections(id, user.tenantId);
  });

  app.post('/api/v1/plans/:id/approve', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ signatureText: z.string().min(3), note: z.string().optional() }).parse(req.body);
    const [plan] = await db
      .update(drpPlans)
      .set({ status: 'approved', approvedAt: new Date(), approvedBy: user.id, updatedBy: user.id, updatedAt: new Date() })
      .where(and(eq(drpPlans.id, id), eq(drpPlans.tenantId, user.tenantId)))
      .returning();
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    await db.insert(approvals).values({ planId: id, actorId: user.id, decision: 'approved', signatureText: body.signatureText, note: body.note ?? '' });
    await audit(user.tenantId, user.id, 'drp_plan', id, 'approve', `Approved ${plan.title}`, { signatureText: body.signatureText });
    return getPlanWithSections(id, user.tenantId);
  });

  app.get('/api/v1/plans/:id/audit.csv', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const rows = await db.select().from(auditLogs).where(and(eq(auditLogs.tenantId, user.tenantId), eq(auditLogs.entityId, id))).orderBy(asc(auditLogs.createdAt));
    const csv = ['created_at,actor_id,entity_type,entity_id,action,summary', ...rows.map((r) => [r.createdAt.toISOString(), r.actorId ?? '', r.entityType, r.entityId, r.action, `"${r.summary.replace(/"/g, '""')}"`].join(','))].join('\n');
    reply.type('text/csv').header('Content-Disposition', `attachment; filename="${plan.serviceName}-audit.csv"`);
    return csv;
  });

  app.get('/api/v1/plans/:id/export/markdown', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const payload = renderMarkdownPayload(plan);
    reply.type(payload.contentType).header('Content-Disposition', `attachment; filename="${payload.filename}"`);
    return payload.body;
  });

  app.get('/api/v1/plans/:id/export/pdf', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const payload = renderPdfPayload(plan);
    reply.type(payload.contentType).header('Content-Disposition', `attachment; filename="${payload.filename}"`);
    return payload.body;
  });

  app.get('/api/v1/plans/:id/export/docx', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const payload = renderDocxPayload(plan);
    reply.type(payload.contentType).header('Content-Disposition', `attachment; filename="${payload.filename}"`);
    return payload.body;
  });
}
