/**
 * ResiliPlan — Shared types and constants
 * Used by both apps/web and apps/api
 */

// === User & Auth ===
export type UserRole = 'admin' | 'coordinator' | 'owner' | 'viewer';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  disabled: boolean;
}

// === Plan ===
export type PlanStatus = 'draft' | 'in_review' | 'approved' | 'rejected' | 'archived';
export type PlanTier = 'tier_1' | 'tier_2' | 'tier_3' | 'tier_4';
export type RecoveryStrategy =
  | 'hot_standby'
  | 'warm_standby'
  | 'cold_standby'
  | 'backup_restore'
  | 'pilot_light'
  | 'multi_site';

export interface Plan {
  id: string;
  name: string;
  serviceType: string;
  description: string | null;
  tier: PlanTier;
  status: PlanStatus;
  currentVersion: number;
  rtoMinutes: number;
  rpoMinutes: number;
  recoveryStrategy: RecoveryStrategy;
  drSiteLocation: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
}

// === Section (ISO 22301-aligned) ===
export type SectionTemplateKey =
  | 'executive-summary'
  | 'introduction'
  | 'purpose-scope'
  | 'assumptions-constraints'
  | 'concept-operations'
  | 'system-description'
  | 'business-impact-analysis'
  | 'recovery-strategy'
  | 'communication-plan'
  | 'activation-criteria'
  | 'recovery-procedures'
  | 'validation-testing'
  | 'plan-maintenance'
  | 'appendices';

export interface Section {
  id: string;
  planId: string;
  templateKey: SectionTemplateKey;
  order: number;
  title: string;
  content: string;
  contentHtml: string | null;
  aiSuggested: boolean;
  isoClauseRefs: string[];
  nistRefs: string[];
  bciRefs: string[];
  completionPct: number;
  createdAt: string;
  updatedAt: string;
}

// === AI Configuration (BYO) ===
export type AIProvider = 'openai' | 'anthropic' | 'openai-compatible' | 'anthropic-compatible';

export interface AIConfig {
  id: string;
  userId: string;
  name: string;
  provider: AIProvider;
  baseUrl: string | null;
  defaultModel: string;
  isDefault: boolean;
  enabled: boolean;
  lastUsedAt: string | null;
}

// === API Response (RFC 7807 Problem Details) ===
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
}

// === Constants ===
export const SECTION_TEMPLATES: Array<{
  key: SectionTemplateKey;
  order: number;
  title: string;
  isoClauses: string[];
  description: string;
}> = [
  { key: 'executive-summary', order: 1, title: 'Executive Summary', isoClauses: ['4.3', '5.2'], description: 'Ringkasan eksekutif DRP' },
  { key: 'introduction', order: 2, title: 'Introduction', isoClauses: ['4.1'], description: 'Pendahuluan dan konteks organisasi' },
  { key: 'purpose-scope', order: 3, title: 'Purpose & Scope', isoClauses: ['4.3'], description: 'Tujuan dan cakupan DRP' },
  { key: 'assumptions-constraints', order: 4, title: 'Assumptions & Constraints', isoClauses: ['4.4'], description: 'Asumsi dan kendala' },
  { key: 'concept-operations', order: 5, title: 'Concept of Operations', isoClauses: ['5.3', '5.7'], description: 'Konsep operasional' },
  { key: 'system-description', order: 6, title: 'System Description', isoClauses: ['4.4'], description: 'Deskripsi sistem' },
  { key: 'business-impact-analysis', order: 7, title: 'Business Impact Analysis', isoClauses: ['8.2'], description: 'Analisis dampak bisnis (BIA)' },
  { key: 'recovery-strategy', order: 8, title: 'Recovery Strategy', isoClauses: ['8.3', '8.5'], description: 'Strategi pemulihan' },
  { key: 'communication-plan', order: 9, title: 'Communication Plan', isoClauses: ['7.4'], description: 'Rencana komunikasi' },
  { key: 'activation-criteria', order: 10, title: 'Activation Criteria', isoClauses: ['8.5'], description: 'Kriteria aktivasi DRP' },
  { key: 'recovery-procedures', order: 11, title: 'Recovery Procedures', isoClauses: ['8.5'], description: 'Prosedur pemulihan step-by-step' },
  { key: 'validation-testing', order: 12, title: 'Validation & Testing', isoClauses: ['8.6', '9.3'], description: 'Validasi dan pengujian' },
  { key: 'plan-maintenance', order: 13, title: 'Plan Maintenance', isoClauses: ['9.2', '10.1'], description: 'Pemeliharaan plan' },
  { key: 'appendices', order: 14, title: 'Appendices', isoClauses: [], description: 'Lampiran' },
] as const;
