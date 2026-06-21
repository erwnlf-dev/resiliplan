import { boolean, index, integer, jsonb, pgEnum, pgTable, text, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { tenants } from './tenants.js';
import { users } from './users.js';

/**
 * ResiliPlan Integration Schema
 *
 * Per-tenant external system integration configuration.
 * Supports open-source-first integrations: NetBox, Prometheus, Mattermost, Keycloak, etc.
 *
 * Phase: Phase 2+ (Proactive BC/DR)
 * Foundation for all external system integrations.
 */

export const integrationType = pgEnum('integration_type', [
  // Source: pull data INTO ResiliPlan
  'netbox',            // NetBox CMDB → auto-BIA
  'prometheus',        // Prometheus Alertmanager → SLA breach detection
  'zabbix',            // Zabbix monitoring (planned)
  'keycloak',          // Keycloak SSO (OIDC)
  'authentik',         // Authentik SSO
  'borg',              // BorgBackup / restic status
  // Sink: push data FROM ResiliPlan
  'mattermost',        // Mattermost ChatOps notifications
  'rocketchat',        // Rocket.Chat notifications
  'cstate',            // Cstate status page
  'bookstack',         // BookStack wiki publish
  'grafana',           // Grafana annotations / annotations API
  // Bidirectional
  'glpi',              // GLPI ITSM
  'zammad',            // Zammad helpdesk
  'osticket',          // osTicket
  'rundeck',           // Rundeck runbook automation
  'n8n',               // n8n workflow automation
  'eramba',            // Eramba GRC
  'webhook',           // Generic webhook (custom integrations)
]);

export const integrationDirection = pgEnum('integration_direction', ['inbound', 'outbound', 'bidirectional']);
export const integrationStatus = pgEnum('integration_status', ['active', 'paused', 'error', 'pending_setup']);

export const integrations = pgTable(
  'integrations',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),

    // Type & direction
    type: integrationType('type').notNull(),
    direction: integrationDirection('direction').notNull(),

    // Display
    name: varchar('name', { length: 200 }).notNull(),
    description: text('description'),

    // Configuration (per-type schema; encrypted secrets)
    config: jsonb('config')
      .$type<{
        // Common
        apiUrl?: string;
        apiKey?: string; // encrypted (CIPHER__ prefix) when set via UI
        // Source: sync
        syncIntervalMinutes?: number;
        // Source: filter / mapping
        filters?: Record<string, unknown>;
        // Sink: target channel/board
        channel?: string;
        // Sink: default event subscriptions
        eventSubscriptions?: string[];
        // Bidirectional: webhook secret
        webhookSecret?: string;
        // Provider-specific
        netbox?: {
          apiToken?: string;
          verifyTls?: boolean;
          tagPrefix?: string;
        };
        prometheus?: {
          alertmanagerUrl?: string;
          receiverName?: string;
        };
        mattermost?: {
          webhookUrl?: string;
          channel?: string;
          username?: string;
          iconUrl?: string;
        };
        keycloak?: {
          issuerUrl?: string;
          clientId?: string;
          clientSecret?: string;
          realm?: string;
        };
        rundeck?: {
          baseUrl?: string;
          apiToken?: string;
        };
        webhook?: {
          url?: string;
          method?: 'POST' | 'PUT';
          headers?: Record<string, string>;
          secret?: string;
        };
        [key: string]: unknown;
      }>()
      .default({})
      .notNull(),

    // Status & health
    status: integrationStatus('status').default('pending_setup').notNull(),
    isEnabled: boolean('is_enabled').default(true).notNull(),
    lastSyncAt: timestamp('last_sync_at'),
    lastErrorAt: timestamp('last_error_at'),
    lastError: text('last_error'),
    consecutiveFailures: integer('consecutive_failures').default(0).notNull(),

    // Audit
    createdBy: uuid('created_by').references(() => users.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantTypeIdx: index('integrations_tenant_type_idx').on(table.tenantId, table.type),
    tenantStatusIdx: index('integrations_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

/**
 * Integration Sync History
 * Records each sync attempt (success/failure) for observability.
 */
export const integrationSyncStatus = pgEnum('integration_sync_status', ['running', 'success', 'failed', 'partial', 'cancelled']);

export const integrationSyncs = pgTable(
  'integration_syncs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),
    integrationId: uuid('integration_id').references(() => integrations.id, { onDelete: 'cascade' }).notNull(),

    trigger: varchar('trigger', { length: 50 }).notNull(), // 'scheduled' | 'manual' | 'webhook'
    direction: integrationDirection('direction').notNull(),

    status: integrationSyncStatus('status').default('running').notNull(),
    startedAt: timestamp('started_at').defaultNow().notNull(),
    completedAt: timestamp('completed_at'),
    durationMs: integer('duration_ms'),

    rowsAffected: integer('rows_affected').default(0).notNull(),
    rowsCreated: integer('rows_created').default(0).notNull(),
    rowsUpdated: integer('rows_updated').default(0).notNull(),
    rowsSkipped: integer('rows_skipped').default(0).notNull(),

    error: text('error'),
    metadata: jsonb('metadata').$type<Record<string, unknown>>().default({}).notNull(),
  },
  (table) => ({
    integrationIdx: index('integration_syncs_integration_idx').on(table.integrationId, table.startedAt),
    tenantStatusIdx: index('integration_syncs_tenant_status_idx').on(table.tenantId, table.status),
  }),
);

/**
 * Webhook Outbox (Outbound)
 * Generic outbound event queue. Worker processes and dispatches to configured webhooks/chatops.
 */
export const webhookOutboxStatus = pgEnum('webhook_outbox_status', ['queued', 'dispatched', 'failed', 'cancelled']);
export const webhookEventType = pgEnum('webhook_event_type', [
  'plan.activated',
  'plan.deactivated',
  'plan.approval_pending',
  'plan.approved',
  'bia.review_due',
  'exercise.scheduled',
  'incident.created',
  'incident.updated',
  'sla.breach_detected',
  'integration.sync_completed',
  'integration.sync_failed',
]);

export const webhookOutbox = pgTable(
  'webhook_outbox',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }).notNull(),

    eventType: webhookEventType('event_type').notNull(),
    payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),

    // Target resolution (set when worker picks up)
    targetIntegrationIds: jsonb('target_integration_ids').$type<string[]>(),

    status: webhookOutboxStatus('status').default('queued').notNull(),
    attempts: integer('attempts').default(0).notNull(),
    maxAttempts: integer('max_attempts').default(3).notNull(),
    lastError: text('last_error'),

    queuedAt: timestamp('queued_at').defaultNow().notNull(),
    dispatchedAt: timestamp('dispatched_at'),
    createdAt: timestamp('created_at').defaultNow().notNull(),
  },
  (table) => ({
    tenantStatusIdx: index('webhook_outbox_tenant_status_idx').on(table.tenantId, table.status),
    eventTypeIdx: index('webhook_outbox_event_type_idx').on(table.eventType),
  }),
);

export type Integration = typeof integrations.$inferSelect;
export type NewIntegration = typeof integrations.$inferInsert;
export type IntegrationSync = typeof integrationSyncs.$inferSelect;
export type WebhookOutbox = typeof webhookOutbox.$inferSelect;
