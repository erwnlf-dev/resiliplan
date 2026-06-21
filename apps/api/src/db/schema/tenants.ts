import { pgTable, uuid, text, timestamp, jsonb, varchar } from 'drizzle-orm/pg-core';

export const tenants = pgTable('tenants', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name').notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  settings: jsonb('settings')
    .$type<{
      defaultTemplate?: string;
      isoStandards?: string[];
      approvalRequired?: boolean;
      ssoEnabled?: boolean;
      smtp?: {
        mode?: 'outbox_only' | 'smtp';
        host?: string;
        port?: number;
        from?: string;
        configuredFromDashboard?: boolean;
      };
      internalAccess?: {
        mode?: 'ip_port';
        securityGroupRestricted?: boolean;
        adminPolicy?: string;
      };
      backup?: {
        frequency?: 'daily';
        retentionDays?: number;
      };
      sso?: {
        enabled?: boolean;
        provider?: 'oidc' | 'azure_ad';
        issuerUrl?: string;
        clientId?: string;
        redirectUri?: string;
      };
    }>()
    .default({})
    .notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
