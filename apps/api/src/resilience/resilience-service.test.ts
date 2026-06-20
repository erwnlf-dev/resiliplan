import { describe, expect, it } from 'vitest';
import {
  createAssetSchema,
  createDrillSchema,
  createRiskSchema,
  summarizeResilienceRegister,
} from './resilience-service.js';

describe('resilience-service schemas', () => {
  it('normalizes asset dependency payloads with sensible defaults', () => {
    const asset = createAssetSchema.parse({
      serviceName: 'Core Portal',
      assetName: 'postgres-primary',
      assetType: 'database',
      owner: 'DBA Team',
      criticality: 'critical',
    });

    expect(asset).toMatchObject({
      serviceName: 'Core Portal',
      assetName: 'postgres-primary',
      assetType: 'database',
      owner: 'DBA Team',
      criticality: 'critical',
      recoveryPriority: 3,
      dependencies: [],
      notes: '',
    });
  });

  it('rejects invalid risk probability and impact scores', () => {
    expect(() => createRiskSchema.parse({
      serviceName: 'Core Portal',
      riskTitle: 'Replication lag',
      category: 'technology',
      probability: 6,
      impact: 4,
    })).toThrow();
  });

  it('derives risk score and planned drill status', () => {
    const risk = createRiskSchema.parse({
      serviceName: 'Core Portal',
      riskTitle: 'Storage exhaustion',
      category: 'capacity',
      probability: 4,
      impact: 5,
      mitigation: 'Expand pool',
    });
    const drill = createDrillSchema.parse({
      serviceName: 'Core Portal',
      drillTitle: 'Quarterly restore test',
      scheduledAt: '2026-07-01T09:00:00.000Z',
      scope: 'Restore app database to isolated VM',
      owner: 'IT Service Resilience',
    });

    expect(risk.riskScore).toBe(20);
    expect(drill.status).toBe('planned');
  });
});

describe('summarizeResilienceRegister', () => {
  it('returns manager-facing counts for assets, risks, and drills', () => {
    const summary = summarizeResilienceRegister({
      assets: [
        { criticality: 'critical', recoveryPriority: 1 },
        { criticality: 'high', recoveryPriority: 4 },
      ],
      risks: [
        { riskScore: 20, status: 'open' },
        { riskScore: 8, status: 'mitigated' },
      ],
      drills: [
        { status: 'planned' },
        { status: 'completed' },
      ],
    });

    expect(summary).toEqual({
      totalAssets: 2,
      criticalAssets: 1,
      priorityRecoveryAssets: 1,
      openRisks: 1,
      highRisks: 1,
      plannedDrills: 1,
      completedDrills: 1,
    });
  });
});
