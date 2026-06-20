import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const assetCriticality = pgEnum('asset_criticality', ['low', 'medium', 'high', 'critical']);
export const riskStatus = pgEnum('risk_status', ['open', 'mitigating', 'mitigated', 'accepted']);
export const drillStatus = pgEnum('drill_status', ['planned', 'in_progress', 'completed', 'cancelled']);

export const serviceAssets = pgTable(
  'service_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    serviceName: text('service_name').notNull(),
    assetName: text('asset_name').notNull(),
    assetType: varchar('asset_type', { length: 80 }).notNull(),
    owner: text('owner').notNull(),
    criticality: assetCriticality('criticality').default('medium').notNull(),
    recoveryPriority: integer('recovery_priority').default(3).notNull(),
    dependencies: jsonb('dependencies').$type<string[]>().default([]).notNull(),
    notes: text('notes').default('').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('service_assets_tenant_id_idx').on(table.tenantId),
    serviceIdx: index('service_assets_service_name_idx').on(table.serviceName),
  }),
);

export const serviceRisks = pgTable(
  'service_risks',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    serviceName: text('service_name').notNull(),
    riskTitle: text('risk_title').notNull(),
    category: varchar('category', { length: 80 }).notNull(),
    probability: integer('probability').notNull(),
    impact: integer('impact').notNull(),
    riskScore: integer('risk_score').notNull(),
    mitigation: text('mitigation').default('').notNull(),
    owner: text('owner').default('').notNull(),
    status: riskStatus('status').default('open').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('service_risks_tenant_id_idx').on(table.tenantId),
    serviceIdx: index('service_risks_service_name_idx').on(table.serviceName),
    scoreIdx: index('service_risks_score_idx').on(table.riskScore),
  }),
);

export const recoveryDrills = pgTable(
  'recovery_drills',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    serviceName: text('service_name').notNull(),
    drillTitle: text('drill_title').notNull(),
    scheduledAt: timestamp('scheduled_at').notNull(),
    scope: text('scope').notNull(),
    owner: text('owner').notNull(),
    status: drillStatus('status').default('planned').notNull(),
    resultSummary: text('result_summary').default('').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('recovery_drills_tenant_id_idx').on(table.tenantId),
    serviceIdx: index('recovery_drills_service_name_idx').on(table.serviceName),
    scheduleIdx: index('recovery_drills_scheduled_at_idx').on(table.scheduledAt),
  }),
);

export type ServiceAsset = typeof serviceAssets.$inferSelect;
export type ServiceRisk = typeof serviceRisks.$inferSelect;
export type RecoveryDrill = typeof recoveryDrills.$inferSelect;
