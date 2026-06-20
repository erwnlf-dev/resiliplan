import { describe, expect, it } from 'vitest';
import { createBiaSchema, summarizeBiaEntries } from './bia-service.js';

describe('bia-service', () => {
  it('derives tier 1 when 1-hour impact is severe or regulatory impact is critical', () => {
    const bia = createBiaSchema.parse({
      serviceName: 'Payment Gateway',
      processName: 'Payment Authorization',
      owner: 'Finance Ops',
      impact1h: 5,
      impact4h: 4,
      impact24h: 3,
      financialImpact: 4,
      reputationalImpact: 3,
      regulatoryImpact: 5,
      currentRtoMinutes: 60,
      currentRpoMinutes: 15,
    });

    expect(bia.criticalityTier).toBe('tier_1');
    expect(bia.maxImpactScore).toBe(5);
  });

  it('derives tier 2 for high 4-hour or 24-hour impact without tier 1 trigger', () => {
    const bia = createBiaSchema.parse({
      serviceName: 'Reporting Portal',
      processName: 'Monthly Reporting',
      owner: 'BI Team',
      impact1h: 2,
      impact4h: 4,
      impact24h: 5,
      financialImpact: 2,
      reputationalImpact: 3,
      regulatoryImpact: 2,
      currentRtoMinutes: 240,
      currentRpoMinutes: 60,
    });

    expect(bia.criticalityTier).toBe('tier_2');
    expect(bia.maxImpactScore).toBe(5);
  });

  it('summarizes BIA entries for dashboard posture', () => {
    const summary = summarizeBiaEntries([
      { criticalityTier: 'tier_1', currentRtoMinutes: 60, currentRpoMinutes: 15 },
      { criticalityTier: 'tier_2', currentRtoMinutes: 240, currentRpoMinutes: 60 },
      { criticalityTier: 'tier_3', currentRtoMinutes: 1440, currentRpoMinutes: 240 },
    ]);

    expect(summary).toEqual({
      totalBia: 3,
      tier1: 1,
      tier2: 1,
      fastestRtoMinutes: 60,
      fastestRpoMinutes: 15,
    });
  });
});
