import { index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const subscriptionStatus = pgEnum('subscription_status', ['trial', 'active', 'past_due', 'cancelled']);
export const usageEventType = pgEnum('usage_event_type', ['plan_created', 'ai_request', 'export_generated', 'collaboration_session']);

export const subscriptions = pgTable(
  'subscriptions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    planCode: varchar('plan_code', { length: 80 }).notNull().default('internal'),
    status: subscriptionStatus('status').default('trial').notNull(),
    seatsLimit: integer('seats_limit').notNull().default(10),
    plansLimit: integer('plans_limit').notNull().default(25),
    aiRequestsLimit: integer('ai_requests_limit').notNull().default(500),
    currentPeriodStart: timestamp('current_period_start').defaultNow().notNull(),
    currentPeriodEnd: timestamp('current_period_end').notNull(),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({ tenantIdx: index('subscriptions_tenant_id_idx').on(table.tenantId) }),
);

export const usageEvents = pgTable(
  'usage_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    eventType: usageEventType('event_type').notNull(),
    quantity: integer('quantity').notNull().default(1),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({ tenantTypeIdx: index('usage_events_tenant_type_idx').on(table.tenantId, table.eventType) }),
);

export type Subscription = typeof subscriptions.$inferSelect;
export type UsageEvent = typeof usageEvents.$inferSelect;
