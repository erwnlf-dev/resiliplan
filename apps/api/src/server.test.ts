import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildServer } from './server.js';

let app: FastifyInstance | undefined;

afterEach(async () => {
  if (app) await app.close();
  app = undefined;
});

describe('server security hooks', () => {
  it('sets a CSRF cookie on safe requests', async () => {
    app = await buildServer();
    const response = await app.inject({ method: 'GET', url: '/' });
    expect(response.statusCode).toBe(200);
    expect(response.headers['set-cookie']).toContain('resiliplan_csrf=');
  });

  it('rejects protected state-changing requests without double-submit token before auth', async () => {
    app = await buildServer();
    const response = await app.inject({ method: 'POST', url: '/api/v1/plans', payload: {} });
    expect(response.statusCode).toBe(403);
    expect(response.json().detail).toContain('CSRF token');
  });

  it('allows auth logout route to bypass CSRF because it only clears local session cookie', async () => {
    app = await buildServer();
    const response = await app.inject({ method: 'POST', url: '/api/v1/auth/logout' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });
});
