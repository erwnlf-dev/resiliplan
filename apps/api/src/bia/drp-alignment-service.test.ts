import { describe, expect, it } from 'vitest';
import { evaluateBiaDrpAlignment } from './drp-alignment-service.js';

const now = new Date();

function bia(overrides = {}) {
  return {
    id: 'bia-1', tenantId: 'tenant-1', serviceName: 'Core Banking', processName: 'Settlement', owner: 'Owner', impact1h: 5, impact4h: 5, impact24h: 5, financialImpact: 5, reputationalImpact: 5, regulatoryImpact: 5, maxImpactScore: 5, criticalityTier: 'tier_1' as const, currentRtoMinutes: 60, currentRpoMinutes: 15, dependencyNotes: '', workaround: '', createdBy: null, updatedBy: null, createdAt: now, updatedAt: now, ...overrides,
  };
}

function plan(overrides = {}) {
  return {
    id: 'plan-1', tenantId: 'tenant-1', title: 'Core Banking DRP', serviceName: 'Core Banking', serviceOwner: 'IT', businessOwner: 'Business', description: '', criticality: 'critical', rtoMinutes: 30, rpoMinutes: 10, version: 1, status: 'approved' as const, approvedAt: now, approvedBy: null, createdBy: 'user-1', updatedBy: null, metadata: {}, createdAt: now, updatedAt: now, ...overrides,
  };
}

describe('evaluateBiaDrpAlignment', () => {
  it('marks matching DRP targets as aligned when they meet BIA targets', () => {
    const result = evaluateBiaDrpAlignment({ biaEntries: [bia() as any], drpPlans: [plan() as any] });
    expect(result.summary.aligned).toBe(1);
    expect(result.items[0].status).toBe('aligned');
  });

  it('surfaces missing DRP and weaker RTO/RPO targets', () => {
    const result = evaluateBiaDrpAlignment({
      biaEntries: [bia({ id: 'missing', serviceName: 'Payments' }) as any, bia({ id: 'rto', currentRtoMinutes: 30 }) as any, bia({ id: 'rpo', currentRpoMinutes: 5 }) as any],
      drpPlans: [plan({ rtoMinutes: 60, rpoMinutes: 10 }) as any],
    });
    expect(result.summary.missingDrp).toBe(1);
    expect(result.summary.rtoGaps).toBe(1);
    expect(result.summary.rpoGaps).toBe(1);
    expect(result.items.map((item) => item.status)).toContain('missing_drp');
  });
});
