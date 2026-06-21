import { describe, expect, it } from 'vitest';
import { evaluateDrpQuality } from './quality-service.js';

const now = new Date();

function section(overrides = {}) {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    planId: '00000000-0000-0000-0000-000000000010',
    sectionKey: 'context',
    title: 'Context',
    isoClause: 'ISO 22301:2019 Clause 4',
    order: 1,
    contentMarkdown: 'This section contains detailed recovery scope, dependencies, activation criteria, roles, escalation paths, communication requirements, and evidence references for operational use.',
    status: 'approved' as const,
    updatedBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

const basePlan = {
  id: '00000000-0000-0000-0000-000000000010',
  tenantId: '00000000-0000-0000-0000-000000000020',
  title: 'Core DRP',
  serviceName: 'Core Service',
  serviceOwner: 'IT Owner',
  businessOwner: 'Business Owner',
  description: 'Recovery scope and assumptions.',
  criticality: 'high',
  rtoMinutes: 240,
  rpoMinutes: 60,
  version: 1,
  status: 'approved' as const,
  approvedAt: now,
  approvedBy: null,
  createdBy: '00000000-0000-0000-0000-000000000030',
  updatedBy: null,
  metadata: { recoveryStrategy: 'Warm standby' },
  createdAt: now,
  updatedAt: now,
};

describe('evaluateDrpQuality', () => {
  it('scores approved DRP with content and evidence as ready', () => {
    const quality = evaluateDrpQuality({ ...basePlan, sections: Array.from({ length: 14 }, (_, index) => section({ id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`, order: index + 1 })), evidence: [{ id: 'e1', planId: basePlan.id, sectionKey: 'context', title: 'Evidence', evidenceUrl: 'https://example.local/evidence', evidenceType: 'link', notes: '', createdBy: null, createdAt: now }] });
    expect(quality.score).toBe(100);
    expect(quality.status).toBe('ready');
  });

  it('surfaces gaps for draft plans with template-like content', () => {
    const quality = evaluateDrpQuality({ ...basePlan, status: 'draft', businessOwner: null, sections: [section({ contentMarkdown: 'TBD', status: 'draft' })], evidence: [] });
    expect(quality.score).toBeLessThan(50);
    expect(quality.gaps.length).toBeGreaterThan(3);
  });
});
