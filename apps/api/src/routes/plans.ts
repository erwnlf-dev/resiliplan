import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { config } from '../config/index.js';
import { db } from '../db/client.js';
import { approvals, auditLogs, drpPlans, drpSections, emailOutbox, notifications, planComments, planEvidence, planVersions, users } from '../db/schema/index.js';
import { ISO_22301_SECTIONS, defaultSectionContent } from '../drp/iso-template.js';
import { renderDocxPayload, renderMarkdownPayload, renderPdfPayload } from '../drp/export-service.js';
import { evaluateDrpQuality } from '../drp/quality-service.js';
import { requireAuth, requireRole } from '../auth/auth-service.js';
import { createCommentSchema, extractMentionedEmails, summarizeComments, updateCommentSchema } from '../comments/comment-service.js';
import { buildMentionEmail } from '../email/email-service.js';

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

const createEvidenceSchema = z.object({
  sectionKey: z.string().optional(),
  title: z.string().min(3),
  evidenceUrl: z.string().min(3),
  evidenceType: z.string().default('link'),
  notes: z.string().optional(),
});

async function audit(tenantId: string, actorId: string, entityType: string, entityId: string, action: string, summary: string, metadata: Record<string, unknown> = {}) {
  await db.insert(auditLogs).values({ tenantId, actorId, entityType, entityId, action, summary, metadata });
}

async function createCommentNotifications(input: {
  tenantId: string;
  actorId: string;
  planId: string;
  commentId: string;
  sectionKey: string;
  body: string;
  mentionedEmails: string[];
  parentCommentId?: string;
}) {
  const rows: Array<typeof notifications.$inferInsert> = [];
  const emailRows: Array<typeof emailOutbox.$inferInsert> = [];
  if (input.mentionedEmails.length > 0) {
    const mentionedUsers = await db.select({ id: users.id, email: users.email }).from(users).where(inArray(users.email, input.mentionedEmails));
    for (const mentioned of mentionedUsers) {
      if (mentioned.id === input.actorId) continue;
      rows.push({
        userId: mentioned.id,
        actorId: input.actorId,
        planId: input.planId,
        commentId: input.commentId,
        type: 'mention',
        title: `Mentioned in ${input.sectionKey}`,
        body: input.body.slice(0, 240),
      });
      const email = buildMentionEmail({ appUrl: config.APP_URL, planId: input.planId, sectionKey: input.sectionKey, commentBody: input.body });
      emailRows.push({ tenantId: input.tenantId, recipientUserId: mentioned.id, toEmail: mentioned.email, subject: email.subject, bodyText: email.bodyText, emailType: 'mention_notification', metadata: { planId: input.planId, commentId: input.commentId, sectionKey: input.sectionKey, planUrl: email.planUrl } });
    }
  }
  if (input.parentCommentId) {
    const [parent] = await db.select().from(planComments).where(eq(planComments.id, input.parentCommentId)).limit(1);
    if (parent?.createdBy && parent.createdBy !== input.actorId) {
      rows.push({
        userId: parent.createdBy,
        actorId: input.actorId,
        planId: input.planId,
        commentId: input.commentId,
        type: 'comment_reply',
        title: `Reply in ${input.sectionKey}`,
        body: input.body.slice(0, 240),
      });
    }
  }
  if (rows.length > 0) await db.insert(notifications).values(rows);
  if (emailRows.length > 0) await db.insert(emailOutbox).values(emailRows);
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

  app.get('/api/v1/plans/:id/quality', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const evidence = await db.select().from(planEvidence).where(eq(planEvidence.planId, id)).orderBy(asc(planEvidence.createdAt));
    return evaluateDrpQuality({ ...plan, evidence });
  });

  app.get('/api/v1/plans/:id/evidence', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const rows = await db.select().from(planEvidence).where(eq(planEvidence.planId, id)).orderBy(desc(planEvidence.createdAt));
    return { evidence: rows };
  });

  app.post('/api/v1/plans/:id/evidence', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = createEvidenceSchema.parse(req.body);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const [created] = await db.insert(planEvidence).values({ planId: id, sectionKey: body.sectionKey, title: body.title, evidenceUrl: body.evidenceUrl, evidenceType: body.evidenceType, notes: body.notes ?? '', createdBy: user.id }).returning();
    await audit(user.tenantId, user.id, 'plan_evidence', created.id, 'create', `Added evidence ${created.title}`, { planId: id, sectionKey: created.sectionKey });
    return reply.code(201).send(created);
  });

  app.get('/api/v1/plans/:id/versions', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const versions = await db.select().from(planVersions).where(eq(planVersions.planId, id)).orderBy(desc(planVersions.version));
    return { versions };
  });

  app.post('/api/v1/plans/:id/versions', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ changeSummary: z.string().optional() }).parse(req.body ?? {});
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const nextVersion = plan.version + 1;
    const [version] = await db.insert(planVersions).values({ planId: id, version: nextVersion, snapshot: plan, changeSummary: body.changeSummary ?? `Snapshot version ${nextVersion}`, createdBy: user.id }).returning();
    await db.update(drpPlans).set({ version: nextVersion, updatedBy: user.id, updatedAt: new Date() }).where(and(eq(drpPlans.id, id), eq(drpPlans.tenantId, user.tenantId)));
    await audit(user.tenantId, user.id, 'plan_version', version.id, 'create', `Created version ${nextVersion} for ${plan.title}`, { planId: id });
    return reply.code(201).send(version);
  });

  app.post('/api/v1/plans/:id/versions/:versionId/rollback', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const { id, versionId } = z.object({ id: z.string().uuid(), versionId: z.string().uuid() }).parse(req.params);
    const current = await getPlanWithSections(id, user.tenantId);
    if (!current) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const [version] = await db.select().from(planVersions).where(and(eq(planVersions.id, versionId), eq(planVersions.planId, id))).limit(1);
    if (!version) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Version not found', instance: req.id });
    const snapshot = version.snapshot as { title?: string; serviceName?: string; serviceOwner?: string; businessOwner?: string | null; description?: string; criticality?: string; rtoMinutes?: number; rpoMinutes?: number; metadata?: Record<string, unknown>; sections?: Array<{ sectionKey: string; contentMarkdown: string; status?: 'draft' | 'ready_for_review' | 'approved' }> };
    await db.update(drpPlans).set({ title: snapshot.title ?? current.title, serviceName: snapshot.serviceName ?? current.serviceName, serviceOwner: snapshot.serviceOwner ?? current.serviceOwner, businessOwner: snapshot.businessOwner ?? current.businessOwner, description: snapshot.description ?? current.description, criticality: snapshot.criticality ?? current.criticality, rtoMinutes: snapshot.rtoMinutes ?? current.rtoMinutes, rpoMinutes: snapshot.rpoMinutes ?? current.rpoMinutes, metadata: snapshot.metadata ?? current.metadata, updatedBy: user.id, updatedAt: new Date() }).where(and(eq(drpPlans.id, id), eq(drpPlans.tenantId, user.tenantId)));
    for (const section of snapshot.sections ?? []) {
      await db.update(drpSections).set({ contentMarkdown: section.contentMarkdown, status: section.status ?? 'draft', updatedBy: user.id, updatedAt: new Date() }).where(and(eq(drpSections.planId, id), eq(drpSections.sectionKey, section.sectionKey)));
    }
    await audit(user.tenantId, user.id, 'plan_version', version.id, 'rollback', `Rolled back ${current.title} to version ${version.version}`, { planId: id, version: version.version });
    return getPlanWithSections(id, user.tenantId);
  });

  app.get('/api/v1/plans/:id/comments', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const comments = await db.select().from(planComments).where(eq(planComments.planId, id)).orderBy(asc(planComments.createdAt));
    return { comments, summary: summarizeComments(comments) };
  });

  app.post('/api/v1/plans/:id/comments', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = createCommentSchema.parse(req.body);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const mentionedEmails = extractMentionedEmails(body.body);
    const [comment] = await db.insert(planComments).values({ planId: id, createdBy: user.id, updatedBy: user.id, ...body, mentionedEmails }).returning();
    await createCommentNotifications({ tenantId: user.tenantId, actorId: user.id, planId: id, commentId: comment.id, sectionKey: body.sectionKey, body: body.body, mentionedEmails, parentCommentId: body.parentCommentId });
    await audit(user.tenantId, user.id, 'plan_comment', comment.id, 'create', `Added comment on ${body.sectionKey}`, { planId: id, sectionKey: body.sectionKey, mentionedEmails, parentCommentId: body.parentCommentId });
    return reply.code(201).send(comment);
  });

  app.patch('/api/v1/plans/:id/comments/:commentId', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator', 'owner']);
    const { id, commentId } = z.object({ id: z.string().uuid(), commentId: z.string().uuid() }).parse(req.params);
    const body = updateCommentSchema.parse(req.body);
    const plan = await getPlanWithSections(id, user.tenantId);
    if (!plan) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Plan not found', instance: req.id });
    const [comment] = await db.update(planComments).set({ ...body, updatedBy: user.id, updatedAt: new Date() }).where(and(eq(planComments.id, commentId), eq(planComments.planId, id))).returning();
    if (!comment) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Comment not found', instance: req.id });
    await audit(user.tenantId, user.id, 'plan_comment', comment.id, 'update', `Updated comment ${comment.id}`, { planId: id, status: comment.status });
    return comment;
  });

  app.get('/api/v1/notifications', async (req) => {
    const user = await requireAuth(req);
    const rows = await db.select().from(notifications).where(eq(notifications.userId, user.id)).orderBy(desc(notifications.createdAt));
    return { notifications: rows, unread: rows.filter((item) => item.status === 'unread').length };
  });

  app.patch('/api/v1/notifications/:id', async (req, reply) => {
    const user = await requireAuth(req);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ status: z.enum(['unread', 'read']) }).parse(req.body);
    const [notification] = await db
      .update(notifications)
      .set({ status: body.status, readAt: body.status === 'read' ? new Date() : null })
      .where(and(eq(notifications.id, id), eq(notifications.userId, user.id)))
      .returning();
    if (!notification) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Notification not found', instance: req.id });
    return notification;
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
