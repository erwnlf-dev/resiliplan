import { z } from 'zod';

export const criticalitySchema = z.enum(['low', 'medium', 'high', 'critical']);
export const riskStatusSchema = z.enum(['open', 'mitigating', 'mitigated', 'accepted']);
export const drillStatusSchema = z.enum(['planned', 'in_progress', 'completed', 'cancelled']);

export const createAssetSchema = z.object({
  serviceName: z.string().min(2),
  assetName: z.string().min(2),
  assetType: z.string().min(2),
  owner: z.string().min(2),
  criticality: criticalitySchema.default('medium'),
  recoveryPriority: z.number().int().min(1).max(5).default(3),
  dependencies: z.array(z.string().min(1)).default([]),
  notes: z.string().default(''),
});

export const createRiskSchema = z
  .object({
    serviceName: z.string().min(2),
    riskTitle: z.string().min(3),
    category: z.string().min(2),
    probability: z.number().int().min(1).max(5),
    impact: z.number().int().min(1).max(5),
    mitigation: z.string().default(''),
    owner: z.string().default(''),
    status: riskStatusSchema.default('open'),
  })
  .transform((risk) => ({ ...risk, riskScore: risk.probability * risk.impact }));

export const createDrillSchema = z.object({
  serviceName: z.string().min(2),
  drillTitle: z.string().min(3),
  scheduledAt: z.string().datetime(),
  scope: z.string().min(5),
  owner: z.string().min(2),
  status: drillStatusSchema.default('planned'),
  resultSummary: z.string().default(''),
});

export const updateAssetSchema = createAssetSchema.partial();
export const updateRiskSchema = createRiskSchema.pipe(z.object({}).passthrough()).optional();
export const updateDrillSchema = createDrillSchema.partial();

export type AssetSummaryInput = { criticality: string; recoveryPriority: number };
export type RiskSummaryInput = { riskScore: number; status: string };
export type DrillSummaryInput = { status: string };

export function summarizeResilienceRegister(input: {
  assets: AssetSummaryInput[];
  risks: RiskSummaryInput[];
  drills: DrillSummaryInput[];
}) {
  return {
    totalAssets: input.assets.length,
    criticalAssets: input.assets.filter((asset) => asset.criticality === 'critical').length,
    priorityRecoveryAssets: input.assets.filter((asset) => asset.recoveryPriority <= 2).length,
    openRisks: input.risks.filter((risk) => risk.status === 'open' || risk.status === 'mitigating').length,
    highRisks: input.risks.filter((risk) => risk.riskScore >= 15 && risk.status !== 'mitigated').length,
    plannedDrills: input.drills.filter((drill) => drill.status === 'planned').length,
    completedDrills: input.drills.filter((drill) => drill.status === 'completed').length,
  };
}
