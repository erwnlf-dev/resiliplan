import { index, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { drpPlans } from './drp.js';
import { users } from './users.js';

export const commentStatus = pgEnum('comment_status', ['open', 'resolved']);

export const planComments = pgTable(
  'plan_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .references(() => drpPlans.id, { onDelete: 'cascade' })
      .notNull(),
    sectionKey: varchar('section_key', { length: 80 }).notNull(),
    body: text('body').notNull(),
    status: commentStatus('status').default('open').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index('plan_comments_plan_id_idx').on(table.planId),
    sectionIdx: index('plan_comments_section_key_idx').on(table.planId, table.sectionKey),
    statusIdx: index('plan_comments_status_idx').on(table.status),
  }),
);

export type PlanComment = typeof planComments.$inferSelect;
