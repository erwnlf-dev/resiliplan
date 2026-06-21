/**
 * Integration Service
 *
 * Manages per-tenant external system integrations.
 * Handles CRUD, secret encryption/decryption, and sync orchestration.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { integrations, integrationSyncs } from '../db/schema/integrations.js';
import { auditLogs } from '../db/schema/drp.js';
import { encryptSecret, decryptSecret, isEncrypted, maskSecrets } from '../security/crypto-service.js';
import { logger } from '../utils/logger.js';
import type { Integration, NewIntegration, IntegrationSync } from '../db/schema/integrations.js';
import { runNetBoxSync } from './adapters/netbox-adapter.js';
import { runPrometheusReceiver } from './adapters/prometheus-adapter.js';
import { runAcronisSync } from './adapters/acronis-adapter.js';
import { dispatchMattermostNotification } from './adapters/mattermost-adapter.js';
import { dispatchGenericWebhook } from './adapters/webhook-adapter.js';

const SECRET_FIELDS: readonly string[] = ['apiKey', 'apiToken', 'webhookSecret', 'clientSecret', 'appToken', 'userToken', 'secret'];

export type IntegrationTypeConfig = {
  type: string;
  direction: 'inbound' | 'outbound' | 'bidirectional';
  displayName: string;
  description: string;
  openSource: boolean;
  homepage: string;
  configSchema: Record<string, unknown>;
  eventSubscriptions?: string[];
};

export const SUPPORTED_INTEGRATIONS: IntegrationTypeConfig[] = [
  {
    type: 'netbox',
    direction: 'inbound',
    displayName: 'NetBox (CMDB)',
    description: 'Source of truth untuk network infrastructure. Auto-populate BIA dari device, IPAM, circuit, service.',
    openSource: true,
    homepage: 'https://github.com/netbox-community/netbox',
    configSchema: {
      apiUrl: { type: 'string', required: true, description: 'Base URL NetBox instance (e.g. https://netbox.example.com)' },
      apiToken: { type: 'string', required: true, secret: true, description: 'NetBox API token (Settings → API Tokens)' },
      verifyTls: { type: 'boolean', default: true, description: 'Verify TLS certificate' },
      tagPrefix: { type: 'string', default: 'resiliplan', description: 'Tag prefix untuk filter devices (e.g. resiliplan:tracked)' },
      syncIntervalMinutes: { type: 'number', default: 60, description: 'Sync interval (minutes)' },
    },
    eventSubscriptions: ['integration.sync_completed'],
  },
  {
    type: 'prometheus',
    direction: 'inbound',
    displayName: 'Prometheus Alertmanager',
    description: 'Terima Alertmanager webhook untuk SLA breach detection. Auto-flag plan saat service degraded.',
    openSource: true,
    homepage: 'https://github.com/prometheus/alertmanager',
    configSchema: {
      apiUrl: { type: 'string', required: true, description: 'Alertmanager URL (e.g. https://alertmanager.example.com)' },
      webhookSecret: { type: 'string', required: true, secret: true, description: 'Shared secret untuk verify webhook signature' },
      receiverName: { type: 'string', default: 'resiliplan', description: 'Receiver name di Alertmanager config' },
    },
    eventSubscriptions: ['sla.breach_detected', 'incident.created'],
  },
  {
    type: 'mattermost',
    direction: 'outbound',
    displayName: 'Mattermost',
    description: 'Kirim notifikasi ke channel Mattermost saat plan di-activate, BIA review due, exercise scheduled, dll.',
    openSource: true,
    homepage: 'https://github.com/mattermost/mattermost',
    configSchema: {
      webhookUrl: { type: 'string', required: true, secret: true, description: 'Incoming webhook URL (Main Menu → Integrations → Incoming Webhooks)' },
      channel: { type: 'string', default: '#resiliplan', description: 'Default channel' },
      username: { type: 'string', default: 'ResiliPlan', description: 'Bot display name' },
      iconUrl: { type: 'string', description: 'Bot icon URL' },
    },
    eventSubscriptions: ['plan.activated', 'plan.deactivated', 'plan.approval_pending', 'bia.review_due', 'exercise.scheduled', 'sla.breach_detected'],
  },
  {
    type: 'rocketchat',
    direction: 'outbound',
    displayName: 'Rocket.Chat',
    description: 'Kirim notifikasi ke channel Rocket.Chat.',
    openSource: true,
    homepage: 'https://github.com/RocketChat/Rocket.Chat',
    configSchema: {
      webhookUrl: { type: 'string', required: true, secret: true, description: 'Incoming webhook URL' },
      channel: { type: 'string', default: '#general', description: 'Default channel' },
      username: { type: 'string', default: 'ResiliPlan', description: 'Bot display name' },
    },
    eventSubscriptions: ['plan.activated', 'plan.deactivated', 'sla.breach_detected'],
  },
  {
    type: 'cstate',
    direction: 'outbound',
    displayName: 'Cstate Status Page',
    description: 'Update status page saat plan activated/deactivated.',
    openSource: true,
    homepage: 'https://github.com/cstate/cstate',
    configSchema: {
      apiUrl: { type: 'string', required: true, description: 'Cstate instance URL' },
      apiKey: { type: 'string', required: true, secret: true, description: 'API key (opsional, jika cstate pakai auth)' },
    },
    eventSubscriptions: ['plan.activated', 'plan.deactivated'],
  },
  {
    type: 'bookstack',
    direction: 'outbound',
    displayName: 'BookStack',
    description: 'Publish plan section ke BookStack wiki page.',
    openSource: true,
    homepage: 'https://github.com/BookStackApp/BookStack',
    configSchema: {
      apiUrl: { type: 'string', required: true, description: 'BookStack base URL' },
      apiToken: { type: 'string', required: true, secret: true, description: 'API token (Edit Profile → API Tokens)' },
    },
    eventSubscriptions: ['plan.approved'],
  },
  {
    type: 'glpi',
    direction: 'bidirectional',
    displayName: 'GLPI ITSM',
    description: 'Pull critical incidents, push activation events ke GLPI ticket.',
    openSource: true,
    homepage: 'https://github.com/glpi-project/glpi',
    configSchema: {
      apiUrl: { type: 'string', required: true, description: 'GLPI API base URL' },
      appToken: { type: 'string', required: true, secret: true, description: 'GLPI app token' },
      userToken: { type: 'string', required: true, secret: true, description: 'GLPI user token' },
    },
    eventSubscriptions: ['plan.activated', 'plan.deactivated', 'incident.created'],
  },
  {
    type: 'zammad',
    direction: 'bidirectional',
    displayName: 'Zammad',
    description: 'Pull tickets, push notifications ke Zammad helpdesk.',
    openSource: true,
    homepage: 'https://github.com/zammad/zammad',
    configSchema: {
      apiUrl: { type: 'string', required: true, description: 'Zammad base URL' },
      apiToken: { type: 'string', required: true, secret: true, description: 'API token (Profile → Token Access)' },
    },
    eventSubscriptions: ['plan.activated', 'plan.deactivated', 'sla.breach_detected'],
  },
  {
    type: 'osticket',
    direction: 'bidirectional',
    displayName: 'osTicket',
    description: 'Integrate dengan osTicket helpdesk system.',
    openSource: true,
    homepage: 'https://github.com/osTicket/osTicket',
    configSchema: {
      apiUrl: { type: 'string', required: true, description: 'osTicket API URL' },
      apiKey: { type: 'string', required: true, secret: true, description: 'API key' },
    },
    eventSubscriptions: ['plan.activated', 'incident.created'],
  },
  {
    type: 'rundeck',
    direction: 'bidirectional',
    displayName: 'Rundeck',
    description: 'Trigger runbook job dari plan steps. Receive job status updates.',
    openSource: true,
    homepage: 'https://github.com/rundeck/rundeck',
    configSchema: {
      baseUrl: { type: 'string', required: true, description: 'Rundeck base URL' },
      apiToken: { type: 'string', required: true, secret: true, description: 'API token (Profile → User API Tokens)' },
    },
    eventSubscriptions: ['plan.activated', 'incident.created'],
  },
  {
    type: 'n8n',
    direction: 'bidirectional',
    displayName: 'n8n',
    description: 'Trigger n8n workflow dari plan events. Use case: orchestrate multi-step recovery.',
    openSource: true,
    homepage: 'https://github.com/n8n-io/n8n',
    configSchema: {
      baseUrl: { type: 'string', required: true, description: 'n8n base URL' },
      apiKey: { type: 'string', required: true, secret: true, description: 'API key' },
    },
    eventSubscriptions: ['plan.activated', 'incident.created', 'sla.breach_detected'],
  },
  {
    type: 'eramba',
    direction: 'bidirectional',
    displayName: 'Eramba GRC',
    description: 'Push ISO 22301 control evidence ke Eramba GRC platform.',
    openSource: true,
    homepage: 'https://github.com/eramba/eramba',
    configSchema: {
      apiUrl: { type: 'string', required: true, description: 'Eramba API URL' },
      apiKey: { type: 'string', required: true, secret: true, description: 'API key' },
    },
    eventSubscriptions: ['plan.approved', 'bia.review_due'],
  },
  {
    type: 'acronis',
    direction: 'inbound',
    displayName: 'Acronis Cyber Protect',
    description: 'Pull protected resources dari Acronis (Datacomm Cloud Backup). Auto-populate BIA + RPO verification.',
    openSource: false, // Acronis is closed-source (PT Datacomm customer product)
    homepage: 'https://developer.acronis.com',
    configSchema: {
      proxyUrl: { type: 'string', required: true, description: 'SaaS worker proxy URL (recommended). Contoh: http://127.0.0.1:4184/api/workers/acronis/query' },
      tenantId: { type: 'string', required: true, description: 'Acronis tenant UUID (unit level, e.g. DCloud Ops = 817a4664-be85-44e8-81ed-8da879c70e6e)' },
      rpoThresholdHours: { type: 'number', default: 24, description: 'RPO breach threshold (hours). Default 24.' },
      tagPrefix: { type: 'string', description: 'Only sync resources dengan tag ini (case-insensitive substring match di name)' },
      excludeNamePatterns: { type: 'array', description: 'Regex patterns untuk exclude dari sync (e.g. "test|demo|temp")' },
      excludeResourceTypes: { type: 'array', description: 'Resource types untuk exclude (default: group, vCenter, cluster, etc.)' },
      syncIntervalMinutes: { type: 'number', default: 60, description: 'Sync interval (minutes)' },
    },
    eventSubscriptions: ['integration.sync_completed', 'integration.sync_failed'],
  },
  {
    type: 'keycloak',
    direction: 'inbound',
    displayName: 'Keycloak SSO',
    description: 'Enterprise SSO via Keycloak OIDC.',
    openSource: true,
    homepage: 'https://github.com/keycloak/keycloak',
    configSchema: {
      issuerUrl: { type: 'string', required: true, description: 'OIDC issuer URL (e.g. https://keycloak.example.com/realms/resiliplan)' },
      clientId: { type: 'string', required: true, description: 'OIDC client ID' },
      clientSecret: { type: 'string', required: true, secret: true, description: 'OIDC client secret' },
      realm: { type: 'string', description: 'Realm name' },
    },
  },
  {
    type: 'webhook',
    direction: 'outbound',
    displayName: 'Generic Webhook',
    description: 'Kirim event ke custom webhook URL. Untuk integrasi custom / homegrown system.',
    openSource: true,
    homepage: 'https://github.com/erwnlf-dev/resiliplan',
    configSchema: {
      url: { type: 'string', required: true, description: 'Webhook URL (HTTPS recommended)' },
      method: { type: 'string', enum: ['POST', 'PUT'], default: 'POST', description: 'HTTP method' },
      headers: { type: 'object', description: 'Custom headers (JSON object)' },
      secret: { type: 'string', secret: true, description: 'HMAC secret untuk sign payload (X-Webhook-Signature header)' },
    },
    eventSubscriptions: ['plan.activated', 'plan.deactivated', 'plan.approved', 'bia.review_due', 'exercise.scheduled', 'sla.breach_detected', 'incident.created'],
  },
];

export class IntegrationService {
  /**
   * List integrations for a tenant (secrets masked).
   */
  static async listByTenant(tenantId: string) {
    const rows = await db
      .select()
      .from(integrations)
      .where(eq(integrations.tenantId, tenantId))
      .orderBy(desc(integrations.createdAt));

    return rows.map((r) => this.maskIntegration(r));
  }

  /**
   * Get integration by ID (secrets masked).
   */
  static async getById(tenantId: string, id: string) {
    const [row] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.id, id)));
    return row ? this.maskIntegration(row) : null;
  }

  /**
   * Create integration. Encrypts secret fields before storing.
   */
  static async create(
    tenantId: string,
    actorId: string,
    input: Omit<NewIntegration, 'tenantId' | 'createdBy' | 'config'> & { config: Record<string, unknown> },
  ) {
    const configEncrypted = this.encryptConfigSecrets(input.config);
    const [row] = await db
      .insert(integrations)
      .values({
        ...input,
        tenantId,
        createdBy: actorId,
        config: configEncrypted,
      })
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      entityType: 'integration',
      entityId: row.id,
      action: 'create',
      summary: `Created integration ${row.name} (${row.type})`,
      metadata: { type: row.type, direction: row.direction },
    });

    return this.maskIntegration(row);
  }

  /**
   * Update integration. Re-encrypts secrets if provided.
   */
  static async update(tenantId: string, actorId: string, id: string, updates: Partial<NewIntegration>) {
    const [existing] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.id, id)));
    if (!existing) return null;

    const updateData: Partial<NewIntegration> = { ...updates };
    if (updates.config) {
      // Merge new config with existing (so partial updates don't wipe secrets)
      const mergedConfig = this.mergeConfigSecrets(existing.config as Record<string, unknown>, updates.config as Record<string, unknown>);
      updateData.config = mergedConfig as any;
    }
    updateData.updatedAt = new Date();

    const [row] = await db
      .update(integrations)
      .set(updateData)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.id, id)))
      .returning();

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      entityType: 'integration',
      entityId: row.id,
      action: 'update',
      summary: `Updated integration ${row.name}`,
      metadata: { changes: Object.keys(updates) },
    });

    return this.maskIntegration(row);
  }

  /**
   * Delete integration (cascade deletes syncs).
   */
  static async delete(tenantId: string, actorId: string, id: string) {
    const [existing] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.id, id)));
    if (!existing) return false;

    await db.delete(integrations).where(and(eq(integrations.tenantId, tenantId), eq(integrations.id, id)));

    await db.insert(auditLogs).values({
      tenantId,
      actorId,
      entityType: 'integration',
      entityId: id,
      action: 'delete',
      summary: `Deleted integration ${existing.name} (${existing.type})`,
      metadata: { type: existing.type },
    });

    return true;
  }

  /**
   * Trigger sync (manual or scheduled).
   */
  static async triggerSync(tenantId: string, actorId: string | null, integrationId: string, trigger: 'manual' | 'scheduled' | 'webhook' = 'manual') {
    const integration = await this.getByIdInternal(tenantId, integrationId);
    if (!integration) throw new Error('Integration not found');

    const [sync] = await db
      .insert(integrationSyncs)
      .values({
        tenantId,
        integrationId,
        trigger,
        direction: integration.direction,
        status: 'running',
        startedAt: new Date(),
      })
      .returning();

    try {
      let result: { rowsAffected: number; rowsCreated: number; rowsUpdated: number; rowsSkipped: number; metadata?: Record<string, unknown> } = {
        rowsAffected: 0,
        rowsCreated: 0,
        rowsUpdated: 0,
        rowsSkipped: 0,
      };

      const configDecrypted = this.decryptConfigSecrets(integration.config as Record<string, unknown>) as any;

      switch (integration.type) {
        case 'netbox':
          result = await runNetBoxSync(tenantId, configDecrypted as any);
          break;
        case 'acronis':
          result = await runAcronisSync(tenantId, configDecrypted as any);
          break;
        case 'prometheus':
          // Prometheus is webhook-driven; sync verifies webhook secret
          result = await runPrometheusReceiver(tenantId, configDecrypted as any);
          break;
        case 'mattermost':
          // Test connection
          result = await dispatchMattermostNotification(configDecrypted as any, {
            eventType: 'integration.sync_completed',
            summary: `ResiliPlan integration test: ${integration.name}`,
            severity: 'info',
            payload: { test: true, integration_id: integrationId },
          });
          break;
        case 'webhook':
          result = await dispatchGenericWebhook(configDecrypted as any, {
            eventType: 'integration.sync_completed',
            summary: `ResiliPlan integration test: ${integration.name}`,
            severity: 'info',
            payload: { test: true, integration_id: integrationId },
          });
          break;
        default:
          result = { rowsAffected: 0, rowsCreated: 0, rowsUpdated: 0, rowsSkipped: 0, metadata: { note: `${integration.type} sync not yet implemented` } };
      }

      const completedAt = new Date();
      await db
        .update(integrationSyncs)
        .set({
          status: 'success',
          completedAt,
          durationMs: completedAt.getTime() - sync.startedAt.getTime(),
          rowsAffected: result.rowsAffected,
          rowsCreated: result.rowsCreated,
          rowsUpdated: result.rowsUpdated,
          rowsSkipped: result.rowsSkipped,
          metadata: result.metadata || {},
        })
        .where(eq(integrationSyncs.id, sync.id));

      // Update integration status
      await db
        .update(integrations)
        .set({
          status: 'active',
          lastSyncAt: completedAt,
          consecutiveFailures: 0,
          lastError: null,
          lastErrorAt: null,
          updatedAt: completedAt,
        })
        .where(eq(integrations.id, integrationId));

      return { syncId: sync.id, status: 'success', ...result };
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      logger.error({ err, integrationId, type: integration.type }, 'integration sync failed');

      await db
        .update(integrationSyncs)
        .set({
          status: 'failed',
          completedAt: new Date(),
          error,
        })
        .where(eq(integrationSyncs.id, sync.id));

      await db
        .update(integrations)
        .set({
          status: 'error',
          lastError: error,
          lastErrorAt: new Date(),
          consecutiveFailures: sql`${integrations.consecutiveFailures} + 1`,
          updatedAt: new Date(),
        })
        .where(eq(integrations.id, integrationId));

      return { syncId: sync.id, status: 'failed', error };
    }
  }

  /**
   * Get sync history for an integration.
   */
  static async getSyncs(tenantId: string, integrationId: string, limit = 50) {
    return db
      .select()
      .from(integrationSyncs)
      .where(and(eq(integrationSyncs.tenantId, tenantId), eq(integrationSyncs.integrationId, integrationId)))
      .orderBy(desc(integrationSyncs.startedAt))
      .limit(limit);
  }

  // ============= Internal helpers =============

  private static maskIntegration(row: Integration): Integration {
    return {
      ...row,
      config: maskSecrets(row.config as Record<string, unknown>) as any,
    } as Integration;
  }

  private static async getByIdInternal(tenantId: string, id: string) {
    const [row] = await db
      .select()
      .from(integrations)
      .where(and(eq(integrations.tenantId, tenantId), eq(integrations.id, id)));
    return row;
  }

  private static encryptConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...config };
    for (const key of SECRET_FIELDS) {
      if (result[key] && typeof result[key] === 'string' && !isEncrypted(result[key] as string)) {
        result[key] = encryptSecret(result[key] as string);
      }
    }
    // Also encrypt nested provider secrets
    for (const provider of ['netbox', 'prometheus', 'mattermost', 'keycloak', 'rundeck', 'webhook']) {
      const nested = result[provider] as Record<string, unknown> | undefined;
      if (nested) {
        for (const key of SECRET_FIELDS) {
          if (nested[key] && typeof nested[key] === 'string' && !isEncrypted(nested[key] as string)) {
            nested[key] = encryptSecret(nested[key] as string);
          }
        }
      }
    }
    return result;
  }

  private static decryptConfigSecrets(config: Record<string, unknown>): Record<string, unknown> {
    const result: Record<string, unknown> = { ...config };
    for (const key of SECRET_FIELDS) {
      if (result[key] && typeof result[key] === 'string' && isEncrypted(result[key] as string)) {
        result[key] = decryptSecret(result[key] as string);
      }
    }
    for (const provider of ['netbox', 'prometheus', 'mattermost', 'keycloak', 'rundeck', 'webhook']) {
      const nested = result[provider] as Record<string, unknown> | undefined;
      if (nested) {
        for (const key of SECRET_FIELDS) {
          if (nested[key] && typeof nested[key] === 'string' && isEncrypted(nested[key] as string)) {
            nested[key] = decryptSecret(nested[key] as string);
          }
        }
      }
    }
    return result;
  }

  private static mergeConfigSecrets(existing: Record<string, unknown>, incoming: Record<string, unknown>): Record<string, unknown> {
    // If incoming has masked values (***), keep existing. Otherwise encrypt.
    const result: Record<string, unknown> = { ...existing };
    for (const [key, value] of Object.entries(incoming)) {
      if (value === '***' || value === undefined) {
        // Keep existing
        continue;
      }
      if (typeof value === 'string' && SECRET_FIELDS.includes(key as any)) {
        result[key] = encryptSecret(value);
      } else if (value && typeof value === 'object' && !Array.isArray(value)) {
        // Recurse for nested provider config
        const existingNested = (existing[key] as Record<string, unknown>) || {};
        result[key] = this.mergeConfigSecrets(existingNested, value as Record<string, unknown>);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}
