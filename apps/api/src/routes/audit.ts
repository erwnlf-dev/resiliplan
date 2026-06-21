import { and, desc, eq, ilike, or } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth-service.js';
import { db } from '../db/client.js';
import { auditLogs, users } from '../db/schema/index.js';

const auditQuerySchema = z.object({
  q: z.string().trim().optional(),
  entityType: z.string().trim().optional(),
  action: z.string().trim().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export async function auditRoutes(app: FastifyInstance) {
  app.get('/api/v1/audit-trail', async (req) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const query = auditQuerySchema.parse(req.query);
    const filters = [eq(auditLogs.tenantId, user.tenantId)];

    if (query.entityType) filters.push(eq(auditLogs.entityType, query.entityType));
    if (query.action) filters.push(eq(auditLogs.action, query.action));
    if (query.q) {
      const term = `%${query.q}%`;
      filters.push(or(ilike(auditLogs.summary, term), ilike(auditLogs.entityType, term), ilike(auditLogs.action, term), ilike(auditLogs.entityId, term))!);
    }

    const rows = await db
      .select({
        id: auditLogs.id,
        actorId: auditLogs.actorId,
        actorEmail: users.email,
        entityType: auditLogs.entityType,
        entityId: auditLogs.entityId,
        action: auditLogs.action,
        summary: auditLogs.summary,
        metadata: auditLogs.metadata,
        appendOnly: auditLogs.appendOnly,
        createdAt: auditLogs.createdAt,
      })
      .from(auditLogs)
      .leftJoin(users, eq(users.id, auditLogs.actorId))
      .where(and(...filters))
      .orderBy(desc(auditLogs.createdAt))
      .limit(query.limit);

    return { auditLogs: rows };
  });
}
