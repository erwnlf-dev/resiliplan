import { and, asc, eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole, hashPassword } from '../auth/auth-service.js';
import { db } from '../db/client.js';
import { auditLogs, users } from '../db/schema/index.js';

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(2),
  role: z.enum(['admin', 'coordinator', 'owner', 'viewer']).default('viewer'),
  password: z.string().min(12),
});

export async function userRoutes(app: FastifyInstance) {
  app.get('/api/v1/users', async (req) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin', 'coordinator']);
    const rows = await db
      .select({ id: users.id, email: users.email, name: users.name, role: users.role, disabled: users.disabled, mfaEnabled: users.mfaEnabled, createdAt: users.createdAt })
      .from(users)
      .where(eq(users.tenantId, user.tenantId))
      .orderBy(asc(users.email));
    return { users: rows };
  });

  app.post('/api/v1/users', async (req, reply) => {
    const actor = await requireAuth(req);
    requireRole(actor, ['admin']);
    const body = createUserSchema.parse(req.body);
    const [created] = await db
      .insert(users)
      .values({
        tenantId: actor.tenantId,
        email: body.email.toLowerCase(),
        name: body.name,
        role: body.role,
        passwordHash: await hashPassword(body.password),
        mustResetPassword: true,
      })
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role, disabled: users.disabled, mfaEnabled: users.mfaEnabled, createdAt: users.createdAt });

    await db.insert(auditLogs).values({
      tenantId: actor.tenantId,
      actorId: actor.id,
      entityType: 'user',
      entityId: created.id,
      action: 'create',
      summary: `Created user ${created.email}`,
      metadata: { role: created.role },
    });

    return reply.code(201).send(created);
  });

  app.patch('/api/v1/users/:id', async (req, reply) => {
    const actor = await requireAuth(req);
    requireRole(actor, ['admin']);
    const { id } = z.object({ id: z.string().uuid() }).parse(req.params);
    const body = z.object({ role: z.enum(['admin', 'coordinator', 'owner', 'viewer']).optional(), disabled: z.boolean().optional() }).parse(req.body);
    const [updated] = await db
      .update(users)
      .set({ ...body, updatedAt: new Date() })
      .where(and(eq(users.id, id), eq(users.tenantId, actor.tenantId)))
      .returning({ id: users.id, email: users.email, name: users.name, role: users.role, disabled: users.disabled, mfaEnabled: users.mfaEnabled, createdAt: users.createdAt });
    if (!updated) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'User not found', instance: req.id });

    await db.insert(auditLogs).values({
      tenantId: actor.tenantId,
      actorId: actor.id,
      entityType: 'user',
      entityId: updated.id,
      action: 'update',
      summary: `Updated user ${updated.email}`,
      metadata: body,
    });

    return updated;
  });
}
