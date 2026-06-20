# ResiliPlan — Data Model (Drizzle Schema Detail)

> **Schema reference** untuk ResiliPlan. Detailed Drizzle ORM schema definitions.
> **Last updated:** 2026-06-20
> **Status:** Schema design final, migrations di-setup di Phase 0b

---

## 1. Schema Overview

```
tenants (1) ─→ (n) users
            (n) plans ─→ (n) plan_versions ─→ (n) sections
                                  └→ (n) section_comments
                                  └→ (n) approvals
            (n) assets ─→ (n) asset_dependencies
            (n) bia_entries ─→ (n) bia_dependencies
            (n) risks
            (n) drills ─→ (n) drill_steps
            (n) audit_log (append-only)
            (n) ai_configs (per user, encrypted)
            (n) ai_usage_log

users (1) ─→ (n) sessions
        (n) login_attempts
        (n) ai_configs
        (n) audit_log
```

---

## 2. Schema Definitions (Drizzle ORM)

### 2.1 `tenants` table

Single-tenant Phase 0-1, but schema supports future multi-tenant.

```typescript
// apps/api/src/db/schema/tenants.ts
import { pgTable, uuid, text, timestamp, jsonb, varchar } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  settings: jsonb('settings').$type<{
    defaultTemplate?: string;
    isoStandards?: string[];        // ['iso-22301', 'nist-800-34', 'bci-gpg']
    approvalRequired?: boolean;
    ssoEnabled?: boolean;
  }>().default({}).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_tenants_slug` (UNIQUE) on `slug`

---

### 2.2 `users` table

```typescript
// apps/api/src/db/schema/users.ts
import { pgTable, uuid, text, timestamp, boolean, varchar, pgEnum } from 'drizzle-orm/pg-core';
import { tenants } from './tenants';

export const userRole = pgEnum('user_role', ['admin', 'coordinator', 'owner', 'viewer']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),       // bcrypt(10)
  name: text('name').notNull(),
  role: userRole('role').default('viewer').notNull(),
  disabled: boolean('disabled').default(false).notNull(),
  mustResetPassword: boolean('must_reset_password').default(false).notNull(),
  resetToken: text('reset_token'),
  resetTokenExpiresAt: timestamp('reset_token_expires_at'),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip'),
  metadata: jsonb('metadata').$type<{
    department?: string;
    jobTitle?: string;
    phone?: string;
  }>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_users_email` (UNIQUE) on `email`
- `idx_users_tenant_role` on `(tenant_id, role)`

**RBAC matrix:**

| Role | Plan CRUD | Section Edit | Approval | AI Config | User Mgmt |
|---|---|---|---|---|---|
| **admin** | ✅ all | ✅ all | ✅ all | ✅ all | ✅ all |
| **coordinator** | ✅ all | ✅ all | ✅ all | ✅ all (no delete) | ❌ |
| **owner** | ✅ own | ✅ own | ❌ | ✅ own | ❌ |
| **viewer** | ❌ (read) | ❌ (read) | ❌ | ❌ | ❌ |

---

### 2.3 `sessions` table

Lucia Auth session storage.

```typescript
// apps/api/src/db/schema/sessions.ts
import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { users } from './users';

export const sessions = pgTable('sessions', {
  id: text('id').primaryKey(),                   // SHA256 of session token
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  expiresAt: timestamp('expires_at').notNull(),
  ipAddress: text('ip_address'),
  userAgent: text('user_agent'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_sessions_user` on `user_id`
- `idx_sessions_expires` on `expires_at`

---

### 2.4 `plans` table

```typescript
// apps/api/src/db/schema/plans.ts
import { pgTable, uuid, text, integer, timestamp, pgEnum, jsonb, varchar } from 'drizzle-orm/pg-core';
import { tenants, users } from './index';

export const planStatus = pgEnum('plan_status', [
  'draft', 'in_review', 'approved', 'rejected', 'archived'
]);

export const planTier = pgEnum('plan_tier', ['tier_1', 'tier_2', 'tier_3', 'tier_4']);

export const recoveryStrategy = pgEnum('recovery_strategy', [
  'hot_standby', 'warm_standby', 'cold_standby', 'backup_restore', 'pilot_light', 'multi_site'
]);

export const plans = pgTable('plans', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  serviceType: varchar('service_type', { length: 100 }).notNull(),  // 'database', 'web_app', 'api', 'batch', etc
  description: text('description'),
  tier: planTier('tier').default('tier_3').notNull(),
  status: planStatus('status').default('draft').notNull(),
  currentVersion: integer('current_version').default(1).notNull(),

  // Recovery targets
  rtoMinutes: integer('rto_minutes').notNull(),                    // Recovery Time Objective
  rpoMinutes: integer('rpo_minutes').notNull(),                    // Recovery Point Objective

  // Strategy
  recoveryStrategy: recoveryStrategy('recovery_strategy').notNull(),
  drSiteLocation: text('dr_site_location'),                         // 'Singapore', 'Surabaya', etc
  drProvider: text('dr_provider'),                                 // AWS, GCP, etc

  // ISO 22301 compliance
  isoComplianceRefs: jsonb('iso_compliance_refs').$type<{
    primaryStandard?: string;           // 'iso-22301'
    mappedClauses?: string[];           // ['4.3', '8.2', '8.3', '8.5', ...]
    nistRefs?: string[];
    bciRefs?: string[];
  }>().default({}),

  // Metadata
  ownerId: uuid('owner_id').references(() => users.id).notNull(),
  tags: jsonb('tags').$type<string[]>().default([]),
  metadata: jsonb('metadata').$type<{
    assetId?: string;
    businessUnit?: string;
    criticalityRationale?: string;
  }>().default({}),

  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  approvedBy: uuid('approved_by').references(() => users.id),
  approvedAt: timestamp('approved_at'),
});
```

**Indexes:**
- `idx_plans_tenant_status` on `(tenant_id, status)`
- `idx_plans_owner` on `owner_id`
- `idx_plans_tier` on `tier`
- `idx_plans_service_type` on `service_type`

---

### 2.5 `plan_versions` table

Immutable version history.

```typescript
// apps/api/src/db/schema/plan-versions.ts
import { pgTable, uuid, integer, text, jsonb, timestamp } from 'drizzle-orm/pg-core';
import { plans, users } from './index';

export const planVersions = pgTable('plan_versions', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  versionNumber: integer('version_number').notNull(),
  contentSnapshot: jsonb('content_snapshot').notNull(),  // Full snapshot of all sections
  changeSummary: text('change_summary'),
  changeType: varchar('change_type', { length: 50 }),     // 'minor', 'major', 'critical'
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  unqPlanVersion: uniqueIndex('unq_plan_version').on(t.planId, t.versionNumber),
}));
```

**Indexes:**
- `unq_plan_version` (UNIQUE) on `(plan_id, version_number)`
- `idx_plan_versions_created` on `created_at`

---

### 2.6 `sections` table

14 section per plan (ISO 22301-aligned).

```typescript
// apps/api/src/db/schema/sections.ts
import { pgTable, uuid, text, integer, timestamp, boolean, jsonb } from 'drizzle-orm/pg-core';
import { plans, users } from './index';

export const sections = pgTable('sections', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  templateKey: varchar('template_key', { length: 50 }).notNull(),  // 'executive-summary', 'scope', etc
  order: integer('order').notNull(),                               // 1-14
  title: text('title').notNull(),
  content: text('content').default('').notNull(),                  // Markdown
  contentHtml: text('content_html'),                                // Rendered HTML
  aiSuggested: boolean('ai_suggested').default(false).notNull(),
  aiGeneratedAt: timestamp('ai_generated_at'),
  aiModelUsed: varchar('ai_model_used', { length: 100 }),

  // ISO compliance
  isoClauseRefs: jsonb('iso_clause_refs').$type<string[]>().default([]),
  nistRefs: jsonb('nist_refs').$type<string[]>().default([]),
  bciRefs: jsonb('bci_refs').$type<string[]>().default([]),

  // Completion tracking
  completionPct: integer('completion_pct').default(0).notNull(),    // 0-100
  lastReviewedAt: timestamp('last_reviewed_at'),
  lastReviewedBy: uuid('last_reviewed_by').references(() => users.id),

  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  unqPlanSection: uniqueIndex('unq_plan_section').on(t.planId, t.templateKey),
}));
```

**Indexes:**
- `unq_plan_section` (UNIQUE) on `(plan_id, template_key)`
- `idx_sections_plan_order` on `(plan_id, order)`

**Section template keys (ISO 22301-aligned):**

1. `executive-summary`
2. `introduction`
3. `purpose-scope`
4. `assumptions-constraints`
5. `concept-operations`
6. `system-description`
7. `business-impact-analysis`
8. `recovery-strategy`
9. `communication-plan`
10. `activation-criteria`
11. `recovery-procedures`
12. `validation-testing`
13. `plan-maintenance`
14. `appendices`

---

### 2.7 `section_comments` table

```typescript
// apps/api/src/db/schema/section-comments.ts
import { pgTable, uuid, text, timestamp, boolean } from 'drizzle-orm/pg-core';
import { sections, users } from './index';

export const sectionComments = pgTable('section_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id).notNull(),
  body: text('body').notNull(),
  parentId: uuid('parent_id'),  // Self-referencing for threads
  resolved: boolean('resolved').default(false).notNull(),
  resolvedBy: uuid('resolved_by').references(() => users.id),
  resolvedAt: timestamp('resolved_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_comments_section` on `section_id`
- `idx_comments_user` on `user_id`
- `idx_comments_parent` on `parent_id`

---

### 2.8 `approvals` table

```typescript
// apps/api/src/db/schema/approvals.ts
import { pgTable, uuid, text, timestamp, pgEnum, varchar } from 'drizzle-orm/pg-core';
import { plans, users, planVersions } from './index';

export const approvalStage = pgEnum('approval_stage', [
  'reviewer', 'approver', 'final_signer'
]);

export const approvalStatus = pgEnum('approval_status', [
  'pending', 'approved', 'rejected', 'withdrawn'
]);

export const approvals = pgTable('approvals', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  planVersionId: uuid('plan_version_id').references(() => planVersions.id).notNull(),
  stage: approvalStage('stage').notNull(),
  approverId: uuid('approver_id').references(() => users.id).notNull(),
  status: approvalStatus('status').default('pending').notNull(),
  comment: text('comment'),
  // E-signature (for compliance)
  signatureHash: varchar('signature_hash', { length: 128 }),  // SHA256 of content + user + timestamp
  signedAt: timestamp('signed_at'),
  ipAddress: text('ip_address'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_approvals_plan_version` on `(plan_id, plan_version_id)`
- `idx_approvals_approver_status` on `(approver_id, status)`

---

### 2.9 `assets` table

CMDB-like asset registry.

```typescript
// apps/api/src/db/schema/assets.ts
import { pgTable, uuid, text, varchar, jsonb, timestamp, pgEnum } from 'drizzle-orm/pg-core';
import { tenants, users } from './index';

export const assetType = pgEnum('asset_type', [
  'server', 'vm', 'container', 'database', 'application', 'service', 'network', 'storage'
]);

export const assetCriticality = pgEnum('asset_criticality', [
  'critical', 'high', 'medium', 'low'
]);

export const assets = pgTable('assets', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  type: assetType('type').notNull(),
  environment: varchar('environment', { length: 50 }),     // 'production', 'staging', 'dev'
  platform: varchar('platform', { length: 100 }),          // 'aws', 'gcp', 'on-prem', 'vmware'
  techStack: jsonb('tech_stack').$type<string[]>().default([]),  // ['postgres', 'redis', 'nginx']
  ipAddresses: jsonb('ip_addresses').$type<string[]>().default([]),
  hostname: varchar('hostname', { length: 200 }),
  location: varchar('location', { length: 100 }),          // 'jakarta', 'singapore', etc
  owner: uuid('owner').references(() => users.id),
  criticality: assetCriticality('criticality').default('medium').notNull(),
  lastSyncedAt: timestamp('last_synced_at'),
  metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_assets_tenant_type` on `(tenant_id, type)`
- `idx_assets_criticality` on `criticality`
- `idx_assets_hostname` on `hostname`

---

### 2.10 `asset_dependencies` table

```typescript
// apps/api/src/db/schema/asset-dependencies.ts
import { pgTable, uuid, varchar, timestamp, text } from 'drizzle-orm/pg-core';
import { assets } from './index';

export const dependencyType = pgEnum('dependency_type', [
  'hard', 'soft', 'data', 'network', 'auth'
]);

export const assetDependencies = pgTable('asset_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  assetId: uuid('asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),
  dependsOnAssetId: uuid('depends_on_asset_id').references(() => assets.id, { onDelete: 'cascade' }).notNull(),
  dependencyType: dependencyType('dependency_type').notNull(),
  criticality: varchar('criticality', { length: 20 }).default('medium').notNull(),
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  unqAssetDep: uniqueIndex('unq_asset_dep').on(t.assetId, t.dependsOnAssetId),
}));
```

**Indexes:**
- `unq_asset_dep` (UNIQUE) on `(asset_id, depends_on_asset_id)`

---

### 2.11 `bia_entries` table

Business Impact Analysis per plan.

```typescript
// apps/api/src/db/schema/bia-entries.ts
import { pgTable, uuid, integer, text, jsonb, timestamp, pgEnum, varchar } from 'drizzle-orm/pg-core';
import { plans, users } from './index';

export const impactLevel = pgEnum('impact_level', ['none', 'low', 'medium', 'high', 'critical']);

export const biaEntries = pgTable('bia_entries', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }.notNull(),
  scenario: varchar('scenario', { length: 200 }).notNull(),  // 'database_down', 'network_outage', etc

  // Impact over time
  impact1h: impactLevel('impact_1h').notNull(),
  impact4h: impactLevel('impact_4h').notNull(),
  impact24h: impactLevel('impact_24h').notNull(),
  impact72h: impactLevel('impact_72h'),

  // Quantified impact
  financialImpactUsd: integer('financial_impact_usd'),     // Estimated $/hour
  reputationalImpact: impactLevel('reputational_impact').default('none'),
  regulatoryImpact: impactLevel('regulatory_impact').default('none'),
  operationalImpact: text('operational_impact'),            // Free text

  // Computed
  criticalityTier: varchar('criticality_tier', { length: 20 }).notNull(),  // 'tier_1' to 'tier_4'
  recommendedRtoMinutes: integer('recommended_rto_minutes'),
  recommendedRpoMinutes: integer('recommended_rpo_minutes'),

  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedBy: uuid('updated_by').references(() => users.id),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_bia_plan` on `plan_id`
- `idx_bia_scenario` on `scenario`

---

### 2.12 `bia_dependencies` table

```typescript
// apps/api/src/db/schema/bia-dependencies.ts
import { pgTable, uuid, varchar, text, timestamp } from 'drizzle-orm/pg-core';
import { biaEntries, assets } from './index';

export const biaDependencies = pgTable('bia_dependencies', {
  id: uuid('id').primaryKey().defaultRandom(),
  biaId: uuid('bia_id').references(() => biaEntries.id, { onDelete: 'cascade' }).notNull(),
  dependsOnAssetId: uuid('depends_on_asset_id').references(() => assets.id).notNull(),
  dependencyType: varchar('dependency_type', { length: 50 }).notNull(),
  criticality: varchar('criticality', { length: 20 }).default('medium').notNull(),
  notes: text('notes'),
});
```

---

### 2.13 `risks` table

```typescript
// apps/api/src/db/schema/risks.ts
import { pgTable, uuid, text, integer, timestamp, pgEnum, varchar } from 'drizzle-orm/pg-core';
import { plans, users, sections } from './index';

export const riskStatus = pgEnum('risk_status', [
  'identified', 'analyzing', 'mitigating', 'accepted', 'closed'
]);

export const risks = pgTable('risks', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description').notNull(),

  // Risk score (likelihood × impact, 1-5 each)
  likelihood: integer('likelihood').notNull(),                // 1-5
  impact: integer('impact').notNull(),                        // 1-5
  score: integer('score').notNull(),                          // likelihood × impact (1-25)
  riskLevel: varchar('risk_level', { length: 20 }).notNull(), // 'low', 'medium', 'high', 'critical'

  // Mitigation
  mitigationSectionId: uuid('mitigation_section_id').references(() => sections.id),
  mitigationNotes: text('mitigation_notes'),
  residualRisk: integer('residual_risk'),                     // Post-mitigation score
  status: riskStatus('status').default('identified').notNull(),

  owner: uuid('owner').references(() => users.id),
  dueDate: timestamp('due_date'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_risks_plan_status` on `(plan_id, status)`
- `idx_risks_score` on `score` (descending)
- `idx_risks_owner` on `owner`

---

### 2.14 `drills` table (Phase 4)

```typescript
// apps/api/src/db/schema/drills.ts
import { pgTable, uuid, text, timestamp, pgEnum, integer, jsonb, varchar } from 'drizzle-orm/pg-core';
import { plans, users } from './index';

export const drillStatus = pgEnum('drill_status', [
  'scheduled', 'in_progress', 'completed', 'cancelled', 'failed'
]);

export const drillType = pgEnum('drill_type', [
  'tabletop', 'walkthrough', 'simulation', 'parallel', 'full_interruption'
]);

export const drills = pgTable('drills', {
  id: uuid('id').primaryKey().defaultRandom(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 200 }).notNull(),
  drillType: drillType('drill_type').notNull(),
  status: drillStatus('status').default('scheduled').notNull(),

  scheduledAt: timestamp('scheduled_at').notNull(),
  completedAt: timestamp('completed_at'),
  participants: jsonb('participants').$type<string[]>().default([]),  // user IDs

  // Results
  actualRtoMinutes: integer('actual_rto_minutes'),
  actualRpoMinutes: integer('actual_rpo_minutes'),
  targetRtoMinutes: integer('target_rto_minutes'),
  targetRpoMinutes: integer('target_rpo_minutes'),
  metRto: boolean('met_rto'),
  metRpo: boolean('met_rpo'),
  issues: jsonb('issues').$type<Array<{
    stepId: string;
    severity: 'low' | 'medium' | 'high';
    description: string;
  }>>().default([]),

  // AI-generated post-drill report
  aiSummary: text('ai_summary'),
  aiGapsAnalysis: jsonb('ai_gaps_analysis').$type<Array<{
    sectionId: string;
    gap: string;
    recommendation: string;
  }>>().default([]),

  notes: text('notes'),
  createdBy: uuid('created_by').references(() => users.id).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_drills_plan_scheduled` on `(plan_id, scheduled_at)`
- `idx_drills_status` on `status`

---

### 2.15 `audit_log` table

**Append-only** (enforced via database trigger).

```typescript
// apps/api/src/db/schema/audit-log.ts
import { pgTable, uuid, text, jsonb, timestamp, varchar, pgEnum } from 'drizzle-orm/pg-core';
import { tenants, users } from './index';

export const auditAction = pgEnum('audit_action', [
  'create', 'update', 'delete', 'login', 'logout', 'login_failed',
  'password_reset', 'ai_generate', 'ai_config_create', 'ai_config_update', 'ai_config_delete',
  'approval_request', 'approval_grant', 'approval_reject',
  'export_pdf', 'export_docx', 'export_markdown',
  'drill_create', 'drill_complete',
  'permission_change', 'role_change'
]);

export const auditLog = pgTable('audit_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
  userId: uuid('user_id').references(() => users.id),
  action: auditAction('action').notNull(),
  resourceType: varchar('resource_type', { length: 50 }).notNull(),   // 'plan', 'section', 'user', etc
  resourceId: uuid('resource_id'),
  before: jsonb('before'),       // State before change (for update/delete)
  after: jsonb('after'),         // State after change
  metadata: jsonb('metadata').$type<{
    userAgent?: string;
    requestId?: string;
    additionalInfo?: Record<string, unknown>;
  }>().default({}),
  ipAddress: varchar('ip_address', { length: 45 }),  // IPv4 or IPv6
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => {
  return {
    // Append-only: enforce via trigger (no UPDATE/DELETE allowed)
  };
});
```

**Append-only trigger (in migration):**

```sql
CREATE OR REPLACE FUNCTION prevent_audit_log_modification()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'audit_log is append-only, modification not allowed';
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER audit_log_no_update
BEFORE UPDATE ON audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();

CREATE TRIGGER audit_log_no_delete
BEFORE DELETE ON audit_log
FOR EACH ROW EXECUTE FUNCTION prevent_audit_log_modification();
```

**Indexes:**
- `idx_audit_log_tenant_created` on `(tenant_id, created_at DESC)`
- `idx_audit_log_user_created` on `(user_id, created_at DESC)`
- `idx_audit_log_resource` on `(resource_type, resource_id)`

**Retention:** 7 years (compliance default)

---

### 2.16 `ai_configs` table (per-user BYO)

```typescript
// apps/api/src/db/schema/ai-configs.ts
import { pgTable, uuid, text, timestamp, boolean, varchar, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { users } from './index';

export const aiProvider = pgEnum('ai_provider', [
  'openai', 'anthropic', 'openai-compatible', 'anthropic-compatible'
]);

export const aiConfigs = pgTable('ai_configs', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  name: varchar('name', { length: 100 }).notNull(),                    // "OpenAI Personal", "Local Ollama"
  provider: aiProvider('provider').notNull(),
  baseUrl: text('base_url'),                                            // For custom providers
  apiKeyEncrypted: text('api_key_encrypted').notNull(),                 // AES-256-GCM
  defaultModel: varchar('default_model', { length: 100 }).notNull(),    // 'gpt-4o', 'claude-sonnet-4-5'
  organization: text('organization'),                                    // OpenAI org
  defaultHeaders: jsonb('default_headers').$type<Record<string, string>>().default({}),
  settings: jsonb('settings').$type<{
    temperature?: number;        // Default 0.3
    maxTokens?: number;
    topP?: number;
  }>().default({ temperature: 0.3 }),
  isDefault: boolean('is_default').default(false).notNull(),
  enabled: boolean('enabled').default(true).notNull(),
  lastUsedAt: timestamp('last_used_at'),
  lastError: text('last_error'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_ai_configs_user` on `user_id`
- `idx_ai_configs_user_default` on `(user_id, is_default)` (partial WHERE is_default = true)

**Encryption:** API keys encrypted with `API_KEY_ENCRYPTION_KEY` (env var, 32 bytes random).
Format: `iv:authTag:ciphertext` (base64).

---

### 2.17 `ai_usage_log` table

```typescript
// apps/api/src/db/schema/ai-usage-log.ts
import { pgTable, uuid, integer, timestamp, varchar, text } from 'drizzle-orm/pg-core';
import { users, plans, sections, aiConfigs } from './index';

export const aiUsageLog = pgTable('ai_usage_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  planId: uuid('plan_id').references(() => plans.id, { onDelete: 'set null' }),
  sectionId: uuid('section_id').references(() => sections.id, { onDelete: 'set null' }),
  aiConfigId: uuid('ai_config_id').references(() => aiConfigs.id, { onDelete: 'set null' }),

  provider: varchar('provider', { length: 50 }).notNull(),
  model: varchar('model', { length: 100 }).notNull(),
  promptTokens: integer('prompt_tokens').notNull(),
  completionTokens: integer('completion_tokens').notNull(),
  totalTokens: integer('total_tokens').notNull(),
  durationMs: integer('duration_ms'),
  success: boolean('success').notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_ai_usage_user_created` on `(user_id, created_at DESC)`
- `idx_ai_usage_plan` on `plan_id`

**Retention:** 90 days (for cost awareness), then aggregated monthly

---

### 2.18 `login_attempts` table

```typescript
// apps/api/src/db/schema/login-attempts.ts
import { pgTable, text, timestamp, boolean, varchar } from 'drizzle-orm/pg-core';

export const loginAttempts = pgTable('login_attempts', {
  id: text('id').primaryKey(),  // UUID as text
  email: varchar('email', { length: 255 }).notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),
  success: boolean('success').notNull(),
  failureReason: varchar('failure_reason', { length: 100 }),  // 'invalid_password', 'user_not_found', 'account_locked', 'mfa_required'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});
```

**Indexes:**
- `idx_login_attempts_email_created` on `(email, created_at DESC)`
- `idx_login_attempts_ip_created` on `(ip_address, created_at DESC)`

**Retention:** 30 days (then auto-purged)

---

## 3. Drizzle Setup (apps/api/drizzle.config.ts)

```typescript
import type { Config } from 'drizzle-kit';

export default {
  schema: './src/db/schema/index.ts',
  out: './drizzle/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
  verbose: true,
  strict: true,
  // For production:
  // schemaFilter: ['public'],
  // tablesFilter: ['resiliplan_*'],
} satisfies Config;
```

---

## 4. Migration Strategy

**Drizzle Kit commands:**

```bash
# Generate migration from schema changes
npx drizzle-kit generate

# Apply migrations
npx drizzle-kit migrate

# Push schema directly (dev only, no migration file)
npx drizzle-kit push

# Studio (DB GUI)
npx drizzle-kit studio
```

**Migration workflow:**

1. Dev changes schema → `drizzle-kit generate` creates migration file
2. Migration file reviewed in PR
3. CI runs migration on test DB (smoke test)
4. After merge → deploy job runs `drizzle-kit migrate` on production
5. Migration is idempotent + reversible (down migration if needed)

**Pre-commit check:**

```bash
# Check for uncommitted schema changes
npx drizzle-kit check
```

---

## 5. Seed Data

For development and demo:

```typescript
// apps/api/src/db/seed.ts
import { db } from './client';
import { tenants, users, plans, sections } from './schema';

async function seed() {
  // 1. Create default tenant
  const [tenant] = await db.insert(tenants).values({
    name: 'PT Datacomm Diangraha',
    slug: 'datacomm',
  }).returning();

  // 2. Create admin user
  const [admin] = await db.insert(users).values({
    tenantId: tenant.id,
    email: '[email protected]',
    passwordHash: await bcrypt.hash('changeme', 10),
    name: 'Admin User',
    role: 'admin',
  }).returning();

  // 3. Create sample DRP
  const [plan] = await db.insert(plans).values({
    tenantId: tenant.id,
    name: 'Sample Database DRP',
    serviceType: 'database',
    tier: 'tier_2',
    rtoMinutes: 60,
    rpoMinutes: 15,
    recoveryStrategy: 'warm_standby',
    ownerId: admin.id,
    createdBy: admin.id,
  }).returning();

  // 4. Create 14 sections (ISO 22301)
  const sectionTemplates = [
    { key: 'executive-summary', order: 1, title: 'Executive Summary' },
    { key: 'introduction', order: 2, title: 'Introduction' },
    // ... 12 more
  ];

  await db.insert(sections).values(
    sectionTemplates.map(t => ({
      planId: plan.id,
      templateKey: t.key,
      order: t.order,
      title: t.title,
      createdBy: admin.id,
    }))
  );

  console.log('✅ Seed complete');
  console.log('Admin login: [email protected] / changeme');
}
```

---

## 6. Schema Change Workflow

1. **Update schema file** (`apps/api/src/db/schema/<table>.ts`)
2. **Generate migration** (`npm run db:generate`)
3. **Review migration** (check `apps/api/drizzle/migrations/<timestamp>_<name>.sql`)
4. **Test migration** (run on local dev DB, verify schema + sample data)
5. **Commit** (schema file + migration file together)
6. **PR review** (DBA reviews if critical change)
7. **Merge** → CI auto-runs migration on staging
8. **Deploy** → production migration runs as part of deploy

**Rollback:**

- Migrations are reversible (Drizzle generates `down` SQL)
- `drizzle-kit migrate --down` to revert
- For data migrations: manual SQL script

---

## 7. Performance Considerations

**Indexes (composite):**
- `(tenant_id, status)` — for filter by status per tenant
- `(plan_id, order)` — for sections ordered list
- `(user_id, created_at DESC)` — for recent activity per user
- `(tenant_id, created_at DESC)` — for audit log per tenant

**Query optimization:**
- Use `select()` to specify columns (avoid SELECT *)
- Use `limit()` for pagination
- Use `eq()` and indexed columns in WHERE clauses
- Avoid N+1: use `with()` for relations

**Connection pooling:**
- pg pool max 20 connections (configured in Drizzle client)
- Acquire timeout: 5s
- Idle timeout: 30s

---

## 8. Related Documents

- [`docs/architecture.md`](./architecture.md) — Tech stack and deployment
- [`docs/ai-integration.md`](./ai-integration.md) — AI layer design
- [`PRD.md`](../PRD.md) — Product requirements (Section 8 has high-level data model)
