import { z } from 'zod';

export const criticalityTierSchema = z.enum(['tier_1', 'tier_2', 'tier_3', 'tier_4']);
const scoreSchema = z.number().int().min(1).max(5);

function deriveCriticalityTier(input: {
  impact1h: number;
  impact4h: number;
  impact24h: number;
  financialImpact: number;
  reputationalImpact: number;
  regulatoryImpact: number;
}): 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4' {
  if (input.impact1h >= 5 || input.financialImpact >= 5 || input.regulatoryImpact >= 5) return 'tier_1';
  if (input.impact4h >= 4 || input.impact24h >= 5 || input.reputationalImpact >= 4) return 'tier_2';
  if (input.impact24h >= 3 || input.financialImpact >= 3 || input.regulatoryImpact >= 3) return 'tier_3';
  return 'tier_4';
}

export const createBiaSchema = z
  .object({
    serviceName: z.string().min(2),
    processName: z.string().min(2),
    owner: z.string().min(2),
    impact1h: scoreSchema,
    impact4h: scoreSchema,
    impact24h: scoreSchema,
    financialImpact: scoreSchema,
    reputationalImpact: scoreSchema,
    regulatoryImpact: scoreSchema,
    currentRtoMinutes: z.number().int().positive(),
    currentRpoMinutes: z.number().int().positive(),
    dependencyNotes: z.string().default(''),
    workaround: z.string().default(''),
  })
  .transform((bia) => ({
    ...bia,
    maxImpactScore: Math.max(bia.impact1h, bia.impact4h, bia.impact24h, bia.financialImpact, bia.reputationalImpact, bia.regulatoryImpact),
    criticalityTier: deriveCriticalityTier(bia),
  }));

export const patchBiaSchema = z.object({
  serviceName: z.string().min(2).optional(),
  processName: z.string().min(2).optional(),
  owner: z.string().min(2).optional(),
  impact1h: scoreSchema.optional(),
  impact4h: scoreSchema.optional(),
  impact24h: scoreSchema.optional(),
  financialImpact: scoreSchema.optional(),
  reputationalImpact: scoreSchema.optional(),
  regulatoryImpact: scoreSchema.optional(),
  currentRtoMinutes: z.number().int().positive().optional(),
  currentRpoMinutes: z.number().int().positive().optional(),
  dependencyNotes: z.string().optional(),
  workaround: z.string().optional(),
});

export function deriveBiaFields(input: {
  impact1h: number;
  impact4h: number;
  impact24h: number;
  financialImpact: number;
  reputationalImpact: number;
  regulatoryImpact: number;
}) {
  return {
    maxImpactScore: Math.max(input.impact1h, input.impact4h, input.impact24h, input.financialImpact, input.reputationalImpact, input.regulatoryImpact),
    criticalityTier: deriveCriticalityTier(input),
  };
}

export function summarizeBiaEntries(entries: Array<{ criticalityTier: string; currentRtoMinutes: number; currentRpoMinutes: number }>) {
  const rtos = entries.map((entry) => entry.currentRtoMinutes).filter((value) => Number.isFinite(value));
  const rpos = entries.map((entry) => entry.currentRpoMinutes).filter((value) => Number.isFinite(value));
  return {
    totalBia: entries.length,
    tier1: entries.filter((entry) => entry.criticalityTier === 'tier_1').length,
    tier2: entries.filter((entry) => entry.criticalityTier === 'tier_2').length,
    fastestRtoMinutes: rtos.length ? Math.min(...rtos) : null,
    fastestRpoMinutes: rpos.length ? Math.min(...rpos) : null,
  };
}
