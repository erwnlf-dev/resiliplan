import { index, integer, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const criticalityTier = pgEnum('criticality_tier', ['tier_1', 'tier_2', 'tier_3', 'tier_4']);

export const biaEntries = pgTable(
  'bia_entries',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .references(() => tenants.id, { onDelete: 'cascade' })
      .notNull(),
    serviceName: text('service_name').notNull(),
    processName: text('process_name').notNull(),
    owner: text('owner').notNull(),
    impact1h: integer('impact_1h').notNull(),
    impact4h: integer('impact_4h').notNull(),
    impact24h: integer('impact_24h').notNull(),
    financialImpact: integer('financial_impact').notNull(),
    reputationalImpact: integer('reputational_impact').notNull(),
    regulatoryImpact: integer('regulatory_impact').notNull(),
    maxImpactScore: integer('max_impact_score').notNull(),
    criticalityTier: criticalityTier('criticality_tier').notNull(),
    currentRtoMinutes: integer('current_rto_minutes').notNull(),
    currentRpoMinutes: integer('current_rpo_minutes').notNull(),
    dependencyNotes: text('dependency_notes').default('').notNull(),
    workaround: text('workaround').default('').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantIdx: index('bia_entries_tenant_id_idx').on(table.tenantId),
    serviceIdx: index('bia_entries_service_name_idx').on(table.serviceName),
    tierIdx: index('bia_entries_criticality_tier_idx').on(table.criticalityTier),
  }),
);

export type BiaEntry = typeof biaEntries.$inferSelect;
