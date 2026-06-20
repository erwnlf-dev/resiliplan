import { index, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { drpPlans } from './drp.js';
import { users } from './users.js';

export const commentStatus = pgEnum('comment_status', ['open', 'resolved']);
export const notificationStatus = pgEnum('notification_status', ['unread', 'read']);
export const notificationType = pgEnum('notification_type', ['mention', 'comment_reply', 'approval_request']);

export const planComments = pgTable(
  'plan_comments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    planId: uuid('plan_id')
      .references(() => drpPlans.id, { onDelete: 'cascade' })
      .notNull(),
    parentCommentId: uuid('parent_comment_id'),
    sectionKey: varchar('section_key', { length: 80 }).notNull(),
    body: text('body').notNull(),
    mentionedEmails: jsonb('mentioned_emails').$type<string[]>().default([]).notNull(),
    status: commentStatus('status').default('open').notNull(),
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    updatedBy: uuid('updated_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    planIdx: index('plan_comments_plan_id_idx').on(table.planId),
    parentIdx: index('plan_comments_parent_comment_id_idx').on(table.parentCommentId),
    sectionIdx: index('plan_comments_section_key_idx').on(table.planId, table.sectionKey),
    statusIdx: index('plan_comments_status_idx').on(table.status),
  }),
);

export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
    actorId: uuid('actor_id').references(() => users.id, { onDelete: 'set null' }),
    planId: uuid('plan_id').references(() => drpPlans.id, { onDelete: 'cascade' }),
    commentId: uuid('comment_id').references(() => planComments.id, { onDelete: 'cascade' }),
    type: notificationType('type').notNull(),
    status: notificationStatus('status').default('unread').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    readAt: timestamp('read_at'),
  },
  (table) => ({
    userStatusIdx: index('notifications_user_status_idx').on(table.userId, table.status),
    planIdx: index('notifications_plan_idx').on(table.planId),
  }),
);

export type PlanComment = typeof planComments.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
