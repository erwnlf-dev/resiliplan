import { randomBytes } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { db } from '../db/client.js';
import { users } from '../db/schema/index.js';
import {
  createSession,
  createTotpSecret,
  deleteSession,
  getAuthUser,
  hashPassword,
  readCookie,
  requireAuth,
  sessionCookieName,
  validatePasswordPolicy,
  verifyPassword,
  verifyTotp,
} from '../auth/auth-service.js';

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1), totp: z.string().optional() });

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
    if (user.mfaEnabled) {
      if (!user.mfaSecret || !body.totp || !verifyTotp(user.mfaSecret, body.totp)) {
        return reply.code(401).send({ type: 'about:blank', title: 'MFA Required', status: 401, detail: 'Valid TOTP token required', instance: req.id });
      }
    }
    const session = await createSession(user.id);
    await db.update(users).set({ lastLoginAt: new Date(), lastLoginIp: req.ip }).where(eq(users.id, user.id));
    reply.header('Set-Cookie', cookieHeader(sessionCookieName(), session.id, session.expiresAt));
    return { user: { id: user.id, tenantId: user.tenantId, email: user.email, name: user.name, role: user.role, mfaEnabled: user.mfaEnabled } };
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

  app.post('/api/v1/auth/mfa/setup', async (req) => {
    const user = await requireAuth(req);
    const secret = createTotpSecret();
    await db.update(users).set({ mfaSecret: secret, mfaEnabled: false, updatedAt: new Date() }).where(eq(users.id, user.id));
    return {
      secret,
      otpauthUrl: `otpauth://totp/ResiliPlan:${encodeURIComponent(user.email)}?secret=${encodeURIComponent(secret)}&issuer=ResiliPlan`,
    };
  });

  app.post('/api/v1/auth/mfa/verify', async (req) => {
    const user = await requireAuth(req);
    const body = z.object({ token: z.string().min(6).max(8) }).parse(req.body);
    const [record] = await db.select().from(users).where(eq(users.id, user.id)).limit(1);
    if (!record?.mfaSecret || !verifyTotp(record.mfaSecret, body.token)) {
      const err = new Error('Invalid MFA token') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    await db.update(users).set({ mfaEnabled: true, updatedAt: new Date() }).where(eq(users.id, user.id));
    return { ok: true, mfaEnabled: true };
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
    const issues = validatePasswordPolicy(body.newPassword);
    if (issues.length) {
      const err = new Error(issues.join(' ')) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    await db.update(users).set({ passwordHash: await hashPassword(body.newPassword), updatedAt: new Date() }).where(eq(users.id, user.id));
    return { ok: true };
  });

  app.post('/api/v1/auth/password-reset/request', async (req) => {
    const body = z.object({ email: z.string().email() }).parse(req.body);
    const [record] = await db.select().from(users).where(eq(users.email, body.email.toLowerCase())).limit(1);
    if (!record || record.disabled) return { ok: true };
    const resetToken = randomBytes(32).toString('base64url');
    const resetTokenExpiresAt = new Date(Date.now() + 1000 * 60 * 30);
    await db.update(users).set({ resetToken, resetTokenExpiresAt, updatedAt: new Date() }).where(eq(users.id, record.id));
    return { ok: true, ...(process.env.NODE_ENV === 'production' ? {} : { resetToken }) };
  });

  app.post('/api/v1/auth/password-reset/confirm', async (req) => {
    const body = z.object({ token: z.string().min(20), newPassword: z.string().min(12) }).parse(req.body);
    const issues = validatePasswordPolicy(body.newPassword);
    if (issues.length) {
      const err = new Error(issues.join(' ')) as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    const [record] = await db.select().from(users).where(and(eq(users.resetToken, body.token), gt(users.resetTokenExpiresAt, new Date()))).limit(1);
    if (!record) {
      const err = new Error('Reset token is invalid or expired') as Error & { statusCode: number };
      err.statusCode = 400;
      throw err;
    }
    await db.update(users).set({ passwordHash: await hashPassword(body.newPassword), resetToken: null, resetTokenExpiresAt: null, mustResetPassword: false, updatedAt: new Date() }).where(eq(users.id, record.id));
    return { ok: true };
  });
}
