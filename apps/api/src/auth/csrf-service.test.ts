import { describe, expect, it } from 'vitest';
import { createCsrfToken, readCookieValue, shouldCheckCsrf, verifyCsrfToken } from './csrf-service.js';

describe('csrf-service', () => {
  it('generates a random URL-safe token', () => {
    const first = createCsrfToken();
    const second = createCsrfToken();
    expect(first).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(first.length).toBeGreaterThanOrEqual(32);
    expect(first).not.toEqual(second);
  });

  it('verifies double-submit cookie/header token with timing-safe comparison', () => {
    const token = createCsrfToken();
    expect(verifyCsrfToken(token, token)).toBe(true);
    expect(verifyCsrfToken(token, `${token}x`)).toBe(false);
    expect(verifyCsrfToken(undefined, token)).toBe(false);
    expect(verifyCsrfToken(token, undefined)).toBe(false);
  });

  it('only checks unsafe non-auth state-changing requests', () => {
    expect(shouldCheckCsrf('GET', '/api/v1/plans')).toBe(false);
    expect(shouldCheckCsrf('POST', '/api/v1/auth/login')).toBe(false);
    expect(shouldCheckCsrf('POST', '/api/v1/auth/logout')).toBe(false);
    expect(shouldCheckCsrf('POST', '/api/v1/plans')).toBe(true);
    expect(shouldCheckCsrf('PATCH', '/api/v1/plans/abc')).toBe(true);
    expect(shouldCheckCsrf('DELETE', '/api/v1/plans/abc')).toBe(true);
  });

  it('reads encoded cookie values from a cookie header', () => {
    expect(readCookieValue('foo=bar; resiliplan_csrf=a%2Bb; other=x', 'resiliplan_csrf')).toBe('a+b');
    expect(readCookieValue('foo=bar', 'missing')).toBeUndefined();
  });
});
