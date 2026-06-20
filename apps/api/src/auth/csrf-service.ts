import { randomBytes, timingSafeEqual } from 'node:crypto';

export const CSRF_COOKIE = 'resiliplan_csrf';
export const CSRF_HEADER = 'x-csrf-token';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);
const EXEMPT_PATHS = new Set(['/api/v1/auth/login', '/api/v1/auth/logout']);

export function createCsrfToken(): string {
  return randomBytes(32).toString('base64url');
}

export function readCookieValue(cookieHeader: string | undefined, name: string): string | undefined {
  if (!cookieHeader) return undefined;
  for (const part of cookieHeader.split(';')) {
    const [rawName, ...rest] = part.trim().split('=');
    if (rawName === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function verifyCsrfToken(cookieToken: string | undefined, headerToken: string | undefined): boolean {
  if (!cookieToken || !headerToken) return false;
  const cookie = Buffer.from(cookieToken);
  const header = Buffer.from(headerToken);
  return cookie.length === header.length && timingSafeEqual(cookie, header);
}

export function shouldCheckCsrf(method: string, url: string): boolean {
  if (SAFE_METHODS.has(method.toUpperCase())) return false;
  const path = url.split('?')[0];
  if (EXEMPT_PATHS.has(path)) return false;
  return true;
}

export function csrfCookieHeader(token: string): string {
  return `${CSRF_COOKIE}=${encodeURIComponent(token)}; SameSite=Lax; Path=/`;
}
