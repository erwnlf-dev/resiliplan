import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireAuth, requireRole } from '../auth/auth-service.js';
import { db } from '../db/client.js';
import { auditLogs, tenants } from '../db/schema/index.js';

const settingsSchema = z.object({
  smtp: z.object({
    mode: z.enum(['outbox_only', 'smtp']).default('outbox_only'),
    host: z.string().optional(),
    port: z.number().int().positive().optional(),
    from: z.string().optional(),
    configuredFromDashboard: z.boolean().default(true),
  }).default({ mode: 'outbox_only', configuredFromDashboard: true }),
  internalAccess: z.object({
    mode: z.literal('ip_port').default('ip_port'),
    securityGroupRestricted: z.boolean().default(true),
    adminPolicy: z.string().default('single_admin_erwin_only'),
  }).default({ mode: 'ip_port', securityGroupRestricted: true, adminPolicy: 'single_admin_erwin_only' }),
  backup: z.object({
    frequency: z.literal('daily').default('daily'),
    retentionDays: z.number().int().positive().default(14),
  }).default({ frequency: 'daily', retentionDays: 14 }),
  sso: z.object({
    enabled: z.boolean().default(false),
    provider: z.enum(['oidc', 'azure_ad']).default('oidc'),
    issuerUrl: z.string().optional(),
    clientId: z.string().optional(),
    redirectUri: z.string().optional(),
  }).default({ enabled: false, provider: 'oidc' }),
});

export async function settingsRoutes(app: FastifyInstance) {
  app.get('/api/v1/settings', async (req, reply) => {
    const user = await requireAuth(req);
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
    if (!tenant) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Tenant not found', instance: req.id });
    const parsed = settingsSchema.parse(tenant.settings ?? {});
    return { settings: parsed };
  });

  app.patch('/api/v1/settings', async (req, reply) => {
    const user = await requireAuth(req);
    requireRole(user, ['admin']);
    const body = settingsSchema.partial().parse(req.body ?? {});
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, user.tenantId)).limit(1);
    if (!tenant) return reply.code(404).send({ type: 'about:blank', title: 'Not Found', status: 404, detail: 'Tenant not found', instance: req.id });
    const nextSettings = { ...(tenant.settings ?? {}), ...body };
    const [updated] = await db.update(tenants).set({ settings: nextSettings, updatedAt: new Date() }).where(eq(tenants.id, user.tenantId)).returning();
    await db.insert(auditLogs).values({ tenantId: user.tenantId, actorId: user.id, entityType: 'tenant_settings', entityId: user.tenantId, action: 'update', summary: 'Updated internal production settings', metadata: body });
    return { settings: settingsSchema.parse(updated.settings ?? {}) };
  });
}
