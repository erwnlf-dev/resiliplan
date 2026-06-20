import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

export const emailOutboxStatus = pgEnum('email_outbox_status', ['queued', 'sent', 'failed', 'cancelled']);
export const emailOutboxType = pgEnum('email_outbox_type', ['password_reset', 'mention_notification', 'approval_notification', 'system_notice']);

export const emailOutbox = pgTable(
  'email_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    recipientUserId: uuid('recipient_user_id').references(() => users.id, { onDelete: 'set null' }),
    toEmail: varchar('to_email', { length: 255 }).notNull(),
    subject: text('subject').notNull(),
    bodyText: text('body_text').notNull(),
    emailType: emailOutboxType('email_type').notNull(),
    status: emailOutboxStatus('status').default('queued').notNull(),
    lastError: text('last_error'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
    queuedAt: timestamp('queued_at').defaultNow().notNull(),
    sentAt: timestamp('sent_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({ tenantStatusIdx: index('email_outbox_tenant_status_idx').on(table.tenantId, table.status) }),
);

export type EmailOutbox = typeof emailOutbox.$inferSelect;
