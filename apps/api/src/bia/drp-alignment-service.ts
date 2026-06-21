import type { BiaEntry, DrpPlan } from '../db/schema/index.js';

export type BiaDrpAlignmentItem = {
  biaId: string;
  serviceName: string;
  processName: string;
  biaRtoMinutes: number;
  biaRpoMinutes: number;
  drpPlanId: string | null;
  drpTitle: string | null;
  drpRtoMinutes: number | null;
  drpRpoMinutes: number | null;
  status: 'missing_drp' | 'rto_gap' | 'rpo_gap' | 'aligned';
  detail: string;
};

function normalizeServiceName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function evaluateBiaDrpAlignment(input: { biaEntries: BiaEntry[]; drpPlans: DrpPlan[] }): { summary: { total: number; aligned: number; missingDrp: number; rtoGaps: number; rpoGaps: number }; items: BiaDrpAlignmentItem[] } {
  const plansByService = new Map<string, DrpPlan[]>();
  for (const plan of input.drpPlans) {
    const key = normalizeServiceName(plan.serviceName);
    const existing = plansByService.get(key) ?? [];
    existing.push(plan);
    plansByService.set(key, existing);
  }

  const items = input.biaEntries.map((bia): BiaDrpAlignmentItem => {
    const candidates = plansByService.get(normalizeServiceName(bia.serviceName)) ?? [];
    const plan = candidates.find((item) => item.status === 'approved') ?? candidates[0];
    if (!plan) {
      return { biaId: bia.id, serviceName: bia.serviceName, processName: bia.processName, biaRtoMinutes: bia.currentRtoMinutes, biaRpoMinutes: bia.currentRpoMinutes, drpPlanId: null, drpTitle: null, drpRtoMinutes: null, drpRpoMinutes: null, status: 'missing_drp', detail: 'No DRP plan with matching service name' };
    }
    if (plan.rtoMinutes > bia.currentRtoMinutes) {
      return { biaId: bia.id, serviceName: bia.serviceName, processName: bia.processName, biaRtoMinutes: bia.currentRtoMinutes, biaRpoMinutes: bia.currentRpoMinutes, drpPlanId: plan.id, drpTitle: plan.title, drpRtoMinutes: plan.rtoMinutes, drpRpoMinutes: plan.rpoMinutes, status: 'rto_gap', detail: `DRP RTO ${plan.rtoMinutes}m is weaker than BIA target ${bia.currentRtoMinutes}m` };
    }
    if (plan.rpoMinutes > bia.currentRpoMinutes) {
      return { biaId: bia.id, serviceName: bia.serviceName, processName: bia.processName, biaRtoMinutes: bia.currentRtoMinutes, biaRpoMinutes: bia.currentRpoMinutes, drpPlanId: plan.id, drpTitle: plan.title, drpRtoMinutes: plan.rtoMinutes, drpRpoMinutes: plan.rpoMinutes, status: 'rpo_gap', detail: `DRP RPO ${plan.rpoMinutes}m is weaker than BIA target ${bia.currentRpoMinutes}m` };
    }
    return { biaId: bia.id, serviceName: bia.serviceName, processName: bia.processName, biaRtoMinutes: bia.currentRtoMinutes, biaRpoMinutes: bia.currentRpoMinutes, drpPlanId: plan.id, drpTitle: plan.title, drpRtoMinutes: plan.rtoMinutes, drpRpoMinutes: plan.rpoMinutes, status: 'aligned', detail: 'DRP targets meet or beat BIA targets' };
  });

  return {
    summary: {
      total: items.length,
      aligned: items.filter((item) => item.status === 'aligned').length,
      missingDrp: items.filter((item) => item.status === 'missing_drp').length,
      rtoGaps: items.filter((item) => item.status === 'rto_gap').length,
      rpoGaps: items.filter((item) => item.status === 'rpo_gap').length,
    },
    items,
  };
}
