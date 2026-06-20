import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import {
  createSession,
  deleteSession,
  getAuthUser,
  readCookie,
  requireAuth,
  sessionCookieName,
  verifyPassword,
} from '../auth/auth-service.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

function cookieHeader(name: string, value: string, expires: Date) {
  return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Expires=${expires.toUTCString()}`;
}

export async function authRoutes(app: FastifyInstance) {
  app.post('/api/v1/auth/login', async (req, reply) => {
    const body = loginSchema.parse(req.body);
    const [user] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
    if (!user || user.disabled || !(await verifyPassword(body.password, user.passwordHash))) {
      return reply.code(401).send({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Invalid email or password', instance: req.id });
    }
    const session = await createSession(user.id);
    await db.update(users).set({ lastLoginAt: new Date(), lastLoginIp: req.ip }).where(eq(users.id, user.id));
    reply.header('Set-Cookie', cookieHeader(sessionCookieName(), session.id, session.expiresAt));
    return { user: { id: user.id, tenantId: user.tenantId, email: user.email, name: user.name, role: user.role } };
  });

  app.post('/api/v1/auth/logout', async (req, reply) => {
    const sessionId = readCookie(req, sessionCookieName());
    if (sessionId) await deleteSession(sessionId);
    reply.header('Set-Cookie', `${sessionCookieName()}=; HttpOnly; SameSite=Lax; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT`);
    return { ok: true };
  });

  app.get('/api/v1/auth/me', async (req, reply) => {
    const user = await getAuthUser(req);
    if (!user) return reply.code(401).send({ type: 'about:blank', title: 'Unauthorized', status: 401, detail: 'Authentication required', instance: req.id });
    return { user };
  });

  app.post('/api/v1/auth/change-password', async (req) => {
    const user = await requireAuth(req);
    const body = z.object({ currentPassword: z.string(), newPassword: z.string().min(12) }).parse(req.body);
    const [record] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!record || !(await verifyPassword(body.currentPassword, record.passwordHash))) {
      const err = new Error('Current password is invalid') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    const { hashPassword, validatePasswordPolicy } = await import('../auth/auth-service.js');
    const issues = validatePasswordPolicy(body.newPassword);
    if (issues.length) {
      const err = new Error(issues.join(' ')) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    await db.update(users).set({ passwordHash: await hashPassword(body.newPassword), updatedAt: new Date() }).where(eq(users.id, user.id));
    return { ok: true };
  });
}
