import { pgTable, uuid, text, timestamp, boolean, varchar, pgEnum, jsonb } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';

export const userRole = pgEnum('user_role', ['admin', 'coordinator', 'owner', 'viewer']);

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  tenantId: uuid('tenant_id')
    .references(() => tenants.id, { onDelete: 'cascade' })
    .notNull(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  role: userRole('role').default('viewer').notNull(),
  disabled: boolean('disabled').default(false).notNull(),
  mustResetPassword: boolean('must_reset_password').default(false).notNull(),
  mfaEnabled: boolean('mfa_enabled').default(false).notNull(),
  mfaSecret: text('mfa_secret'),
  resetToken: text('reset_token'),
  resetTokenExpiresAt: timestamp('reset_token_expires_at'),
  lastLoginAt: timestamp('last_login_at'),
  lastLoginIp: text('last_login_ip'),
  metadata: jsonb('metadata')
    .$type<{
      department?: string;
      jobTitle?: string;
      phone?: string;
    }>()
    .default({}),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
