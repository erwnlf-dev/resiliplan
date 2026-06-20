/**
 * AI Provider schema — BYO multi-provider support for Phase 2.
 */

import { boolean, integer, pgEnum, pgTable, real, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const aiProviderEnum = pgEnum('ai_provider_type', [
  'openai',
  'anthropic',
  'google',
]);

export const aiProviders = pgTable('ai_providers', {
  id: uuid('id').primaryKey(),
  tenantId: uuid('tenant_id').notNull(),
  provider: aiProviderEnum('provider').notNull(),
  apiKey: text('api_key').notNull(), // Encrypted at rest
  model: text('model').notNull().default('gpt-4o-mini'),
  maxTokens: integer('max_tokens').notNull().default(2048),
  temperature: real('temperature').notNull().default(0.7),
  enabled: boolean('enabled').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});
