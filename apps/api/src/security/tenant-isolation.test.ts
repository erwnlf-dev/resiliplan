import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const src = (...parts: string[]) => readFileSync(resolve(process.cwd(), 'src', ...parts), 'utf8');

describe('tenant isolation regression guards', () => {
  it('keeps user management scoped to the authenticated tenant', () => {
    const route = src('routes', 'users.ts');
    expect(route).toContain('eq(users.tenantId, user.tenantId)');
    expect(route).toContain('eq(users.tenantId, actor.tenantId)');
  });

  it('keeps plan APIs scoped to the authenticated tenant', () => {
    const route = src('routes', 'plans.ts');
    expect(route).toContain('eq(drpPlans.tenantId, user.tenantId)');
  });

  it('keeps audit trail and settings APIs scoped to the authenticated tenant', () => {
    const auditRoute = src('routes', 'audit.ts');
    const settingsRoute = src('routes', 'settings.ts');
    expect(auditRoute).toContain('eq(auditLogs.tenantId, user.tenantId)');
    expect(settingsRoute).toContain('eq(tenants.id, user.tenantId)');
  });

  it('does not expose audit trail to low-privilege users', () => {
    const auditRoute = src('routes', 'audit.ts');
    expect(auditRoute).toContain("requireRole(user, ['admin', 'coordinator'])");
  });
});
