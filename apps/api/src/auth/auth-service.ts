import { randomBytes, timingSafeEqual, createHmac, scryptSync } from 'node:crypto';
import { and, eq, gt } from 'drizzle-orm';
import type { FastifyRequest } from 'fastify';
import { db } from '../db/client.js';
import { sessions, users, type User } from '../db/schema/index.js';

const SESSION_COOKIE = 'resiliplan_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 12;

export type AuthUser = Pick<User, 'id' | 'tenantId' | 'email' | 'name' | 'role'>;

export function sessionCookieName() {
  return SESSION_COOKIE;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(password, salt, 64).toString('base64url');
  return `scrypt$${salt}$${hash}`;
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  if (!passwordHash.startsWith('scrypt$')) return false;
  const [, salt, expectedHash] = passwordHash.split('$');
  if (!salt || !expectedHash) return false;
  const actual = Buffer.from(scryptSync(password, salt, 64).toString('base64url'));
  const expected = Buffer.from(expectedHash);
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function validatePasswordPolicy(password: string): string[] {
  const issues: string[] = [];
  if (password.length < 12) issues.push('Password minimum 12 characters.');
  if (!/[A-Z]/.test(password)) issues.push('Password must include uppercase letter.');
  if (!/[a-z]/.test(password)) issues.push('Password must include lowercase letter.');
  if (!/[0-9]/.test(password)) issues.push('Password must include number.');
  if (!/[^A-Za-z0-9]/.test(password)) issues.push('Password must include symbol.');
  return issues;
}

export async function createSession(userId: string): Promise<{ id: string; expiresAt: Date }> {
  const id = randomBytes(32).toString('base64url');
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  await db.insert(sessions).values({ id, userId, expiresAt });
  return { id, expiresAt };
}

export async function deleteSession(id: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.id, id));
}

export function readCookie(req: FastifyRequest, name: string): string | undefined {
  const header = req.headers.cookie;
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export async function getAuthUser(req: FastifyRequest): Promise<AuthUser | null> {
  const sessionId = readCookie(req, SESSION_COOKIE);
  if (!sessionId) return null;
  const [row] = await db
    .select({
      id: users.id,
      tenantId: users.tenantId,
      email: users.email,
      name: users.name,
      role: users.role,
      disabled: users.disabled,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.id, sessionId), gt(sessions.expiresAt, new Date())))
    .limit(1);
  if (!row || row.disabled) return null;
  return row;
}

export async function requireAuth(req: FastifyRequest): Promise<AuthUser> {
  const user = await getAuthUser(req);
  if (!user) {
    const err = new Error('Authentication required') as Error & { statusCode: number };
    err.statusCode = 401;
    throw err;
  }
  return user;
}

export function requireRole(user: AuthUser, roles: AuthUser['role'][]): void {
  if (!roles.includes(user.role)) {
    const err = new Error('Insufficient permissions') as Error & { statusCode: number };
    err.statusCode = 403;
    throw err;
  }
}

export function generateTotp(secret: string, now = Date.now()): string {
  const counter = Math.floor(now / 1000 / 30);
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const hmac = createHmac('sha1', Buffer.from(secret, 'base64')).update(msg).digest();
  const offset = hmac[hmac.length - 1] & 0xf;
  const code = (hmac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000;
  return code.toString().padStart(6, '0');
}

export function verifyTotp(secret: string, token: string): boolean {
  const normalized = token.trim();
  for (const skew of [-30_000, 0, 30_000]) {
    const expected = generateTotp(secret, Date.now() + skew);
    const a = Buffer.from(expected);
    const b = Buffer.from(normalized.padStart(6, '0'));
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}
