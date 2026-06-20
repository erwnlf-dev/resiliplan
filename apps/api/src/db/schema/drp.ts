import {
  boolean,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { users } from './users.js';
import { tenants } from './tenants.js';

export const planStatus = pgEnum('plan_status', ['draft', 'in_review', 'approved', 'retired']);
export const sectionStatus = pgEnum('section_status', ['draft', 'ready_for_review', 'approved']);
export const approvalDecision = pgEnum('approval_decision', ['submitted', 'approved', 'rejected']);

export const sessions = pgTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: uuid('user_id')
      .references(() => users.id, { onDelete: 'cascade' })
      .notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({ userIdx: index('sessions_user_id_idx').on(table.userId) }),
);

export const drpPlans = pgTable(
  'drp_plans',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    title: text('title').notNull(),
    serviceName: text('service_name').notNull(),
    serviceOwner: text('service_owner').notNull(),
    businessOwner: text('business_owner'),
    description: text('description').default('').notNull(),
    criticality: varchar('criticality', { length: 20 }).default('medium').notNull(),
    rtoMinutes: integer('rto_minutes').default(240).notNull(),
    rpoMinutes: integer('rpo_minutes').default(60).notNull(),
    version: integer('version').default(1).notNull(),
    status: planStatus('status').default('draft').notNull(),
    approvedAt: timestamp('approved_at'),
    approvedBy: uuid('approved_by').references(() => users.id, { onDelete: 'set null' }),
    createdBy: uuid('created_by')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    metadata: jsonb('metadata')
      .$type<{
        recoveryStrategy?: string;
        location?: string;
        tags?: string[];
      }>()
      .default({})
      .notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('drp_plans_tenant_id_idx').on(table.tenantId),
    statusIdx: index('drp_plans_status_idx').on(table.status),
  }),
);

export const drpSections = pgTable(
  'drp_sections',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .references(() => drpPlans.id, { onDelete: 'cascade' })
      .notNull(),
    sectionKey: varchar('section_key', { length: 80 }).notNull(),
    title: text('title').notNull(),
    isoClause: text('iso_clause').notNull(),
    order: integer('display_order').notNull(),
    contentMarkdown: text('content_markdown').notNull(),
    status: sectionStatus('status').default('draft').notNull(),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index('drp_sections_plan_id_idx').on(table.planId),
    planSectionUnique: uniqueIndex('drp_sections_plan_key_unique').on(table.planId, table.sectionKey),
  }),
);

export const planVersions = pgTable(
  'plan_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .references(() => drpPlans.id, { onDelete: 'cascade' })
      .notNull(),
    version: integer('version').notNull(),
    snapshot: jsonb('snapshot').$type<Record<string, unknown>>().notNull(),
    changeSummary: text('change_summary').default('').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index('plan_versions_plan_id_idx').on(table.planId),
    planVersionUnique: uniqueIndex('plan_versions_plan_version_unique').on(table.planId, table.version),
  }),
);

export const approvals = pgTable(
  'approvals',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .references(() => drpPlans.id, { onDelete: 'cascade' })
      .notNull(),
    actorId: uuid('actor_id')
      .references(() => users.id, { onDelete: 'set null' })
      .notNull(),
    decision: approvalDecision('decision').notNull(),
    note: text('note').default('').notNull(),
    signatureText: text('signature_text'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({ planIdx: index('approvals_plan_id_idx').on(table.planId) }),
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    entityType: varchar('entity_type', { length: 80 }).notNull(),
    entityId: text('entity_id').notNull(),
    action: varchar('action', { length: 120 }).notNull(),
    summary: text('summary').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    appendOnly: boolean('append_only').default(true).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('audit_logs_tenant_id_idx').on(table.tenantId),
    entityIdx: index('audit_logs_entity_idx').on(table.entityType, table.entityId),
  }),
);

export type Session = typeof sessions.$inferSelect;
export type DrpPlan = typeof drpPlans.$inferSelect;
export type NewDrpPlan = typeof drpPlans.$inferInsert;
export type DrpSection = typeof drpSections.$inferSelect;
export type PlanVersion = typeof planVersions.$inferSelect;
export type AuditLog = typeof auditLogs.$inferSelect;
