import { and, desc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth-service.js';
import { db } from '../db/client.js';
import { auditLogs, emailOutbox } from '../db/schema/index.js';
import { queueEmailSchema } from '../email/email-service.js';
import { buildManualEmailPacket, getEmailProcessingPlan } from '../email/outbox-processing-service.js';

export async function emailRoutes(app: FastifyInstance) {
  app.get('/api/v1/email-outbox', async (req) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const rows = await db.select().from(emailOutbox).where(eq(emailOutbox.tenantId, user.tenantId)).orderBy(desc(emailOutbox.createdAt));
    return { emails: rows, queued: rows.filter((row) => row.status === 'queued').length, processing: getEmailProcessingPlan() };
  });

  app.post('/api/v1/email-outbox', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const body = queueEmailSchema.parse(req.body);
    const [email] = await db.insert(emailOutbox).values({ tenantId: user.tenantId, ...body }).returning();
    await db.insert(auditLogs).values({ tenantId: user.tenantId, actorId: user.id, entityType: 'email_outbox', entityId: email.id, action: 'queue', summary: `Queued ${email.emailType} email to ${email.toEmail}`, metadata: { emailType: email.emailType } });
    return reply.code(201).send(email);
  });

  app.post('/api/v1/email-outbox/process-next', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const [email] = await db.select().from(emailOutbox).where(and(eq(emailOutbox.tenantId, user.tenantId), eq(emailOutbox.status, 'queued'))).orderBy(emailOutbox.queuedAt).limit(1);
    const processing = getEmailProcessingPlan();
    if (!email) return { processed: false, processing, detail: 'No queued email found' };
    await db.insert(auditLogs).values({ tenantId: user.tenantId, actorId: user.id, entityType: 'email_outbox', entityId: email.id, action: 'manual_process_ready', summary: `Prepared manual processing packet for ${email.toEmail}`, metadata: { emailType: email.emailType, mode: processing.mode } });
    return reply.code(202).send({ processed: false, processing, email: buildManualEmailPacket(email), detail: 'Automatic send is approval-gated. Use the packet for manual approved handling, then mark the row sent/cancelled/failed.' });
  });

  app.patch('/api/v1/email-outbox/:id', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ status: z.enum(['queued', 'sent', 'failed', 'cancelled']), lastError: z.string().optional() }).parse(req.body);
    const [email] = await db.update(emailOutbox).set({ status: body.status, lastError: body.lastError ?? null, sentAt: body.status === 'sent' ? new Date() : null, updatedAt: new Date() }).where(and(eq(emailOutbox.id, id), eq(emailOutbox.tenantId, user.tenantId))).returning();
    if (!email) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Email not found', instance: req.id });
    await db.insert(auditLogs).values({ tenantId: user.tenantId, actorId: user.id, entityType: 'email_outbox', entityId: email.id, action: body.status, summary: `Marked email ${email.id} as ${body.status}`, metadata: { toEmail: email.toEmail } });
    return email;
  });
}
