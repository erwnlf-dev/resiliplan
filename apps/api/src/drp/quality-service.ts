import type { DrpPlan, DrpSection, PlanEvidence } from '../db/schema/index.js';

type QualityInput = DrpPlan & { sections?: DrpSection[]; evidence?: PlanEvidence[] };

export type DrpQualityScore = {
  score: number;
  status: 'weak' | 'fair' | 'good' | 'ready';
  signals: Array<{ key: string; label: string; passed: boolean; weight: number; detail: string }>;
  gaps: string[];
};

const TEMPLATE_MARKERS = ['TBD', 'Describe', 'List ', 'Identify ', 'Define ', 'Add '];

function hasSubstantiveContent(section: DrpSection): boolean {
  const text = section.contentMarkdown.trim();
  if (text.length < 120) return false;
  const templateHits = TEMPLATE_MARKERS.filter((marker) => text.includes(marker)).length;
  return templateHits <= 2;
}

export function evaluateDrpQuality(plan: QualityInput): DrpQualityScore {
  const sections = plan.sections ?? [];
  const evidence = plan.evidence ?? [];
  const substantiveSections = sections.filter(hasSubstantiveContent).length;
  const approvedSections = sections.filter((section) => section.status === 'approved').length;
  const hasOwners = Boolean(plan.serviceOwner && plan.businessOwner);
  const hasTargets = plan.rtoMinutes > 0 && plan.rpoMinutes > 0 && plan.rtoMinutes >= plan.rpoMinutes;
  const metadata = plan.metadata ?? {};
  const hasRecoveryContext = Boolean(metadata.recoveryStrategy || plan.description);
  const hasEvidence = evidence.length > 0;
  const hasRecentActivity = Date.now() - new Date(plan.updatedAt).getTime() < 1000 * 60 * 60 * 24 * 180;
  const isApproved = plan.status === 'approved';

  const signals = [
    { key: 'sections', label: 'Substantive section content', passed: sections.length > 0 && substantiveSections / sections.length >= 0.75, weight: 25, detail: `${substantiveSections}/${sections.length || 0} sections look substantive` },
    { key: 'approval', label: 'Plan approved', passed: isApproved, weight: 20, detail: isApproved ? 'Plan is approved' : 'Plan is not approved yet' },
    { key: 'section_approval', label: 'Section-level readiness', passed: sections.length > 0 && approvedSections / sections.length >= 0.5, weight: 15, detail: `${approvedSections}/${sections.length || 0} sections approved` },
    { key: 'owners', label: 'Service and business owners', passed: hasOwners, weight: 10, detail: hasOwners ? 'Both owners are filled' : 'Business owner or service owner missing' },
    { key: 'targets', label: 'RTO/RPO targets', passed: hasTargets, weight: 10, detail: hasTargets ? `RTO ${plan.rtoMinutes}m / RPO ${plan.rpoMinutes}m` : 'RTO/RPO invalid or inverted' },
    { key: 'recovery_context', label: 'Recovery strategy/context', passed: hasRecoveryContext, weight: 10, detail: hasRecoveryContext ? 'Recovery context exists' : 'Recovery strategy/description missing' },
    { key: 'evidence', label: 'Audit evidence linked', passed: hasEvidence, weight: 5, detail: `${evidence.length} evidence item(s)` },
    { key: 'freshness', label: 'Recently maintained', passed: hasRecentActivity, weight: 5, detail: hasRecentActivity ? 'Updated within 180 days' : 'No update in 180+ days' },
  ];

  const score = signals.reduce((sum, signal) => sum + (signal.passed ? signal.weight : 0), 0);
  const gaps = signals.filter((signal) => !signal.passed).map((signal) => signal.detail);
  const status = score >= 85 ? 'ready' : score >= 70 ? 'good' : score >= 50 ? 'fair' : 'weak';
  return { score, status, signals, gaps };
}
