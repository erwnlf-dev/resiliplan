/**
 * Webhook Dispatcher
 *
 * Queues events for outbound delivery to all matching integrations.
 * Worker processes the queue and dispatches to configured adapters.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import { createHmac } from 'node:crypto';
import { db } from '../db/client.js';
import { integrations, webhookOutbox, type WebhookOutbox } from '../db/schema/integrations.js';
import { logger } from '../utils/logger.js';
import { dispatchMattermostNotification } from './adapters/mattermost-adapter.js';
import { dispatchGenericWebhook } from './adapters/webhook-adapter.js';
import { decryptSecret } from '../security/crypto-service.js';
import { SUPPORTED_INTEGRATIONS } from './integration-service.js';

export type WebhookEventInput = {
  tenantId: string;
  eventType:
    | 'plan.activated'
    | 'plan.deactivated'
    | 'plan.approval_pending'
    | 'plan.approved'
    | 'bia.review_due'
    | 'exercise.scheduled'
    | 'incident.created'
    | 'incident.updated'
    | 'sla.breach_detected'
    | 'integration.sync_completed'
    | 'integration.sync_failed';
  payload: Record<string, unknown>;
};

/**
 * Enqueue an event for outbound delivery.
 * Resolves target integrations based on event subscriptions.
 */
export async function enqueueWebhookEvent(input: WebhookEventInput): Promise<{ outboxId: string; targetIntegrationIds: string[] }> {
  // Find all enabled integrations subscribed to this event
  const subscribedTypes = SUPPORTED_INTEGRATIONS.filter((c) => c.eventSubscriptions?.includes(input.eventType)).map((c) => c.type) as Array<'netbox' | 'prometheus' | 'zabbix' | 'keycloak' | 'authentik' | 'borg' | 'mattermost' | 'rocketchat' | 'cstate' | 'bookstack' | 'grafana' | 'glpi' | 'zammad' | 'osticket' | 'rundeck' | 'n8n' | 'eramba' | 'webhook'>;

  const targets = await db
    .select({ id: integrations.id })
    .from(integrations)
    .where(and(eq(integrations.tenantId, input.tenantId), eq(integrations.isEnabled, true), eq(integrations.status, 'active'), inArray(integrations.type, subscribedTypes)));

  const [outbox] = await db
    .insert(webhookOutbox)
    .values({
      tenantId: input.tenantId,
      eventType: input.eventType,
      payload: input.payload,
      targetIntegrationIds: targets.map((t) => t.id),
      status: 'queued',
    })
    .returning();

  return { outboxId: outbox.id, targetIntegrationIds: targets.map((t) => t.id) };
}

/**
 * Process the next batch of queued webhook events.
 * Called by worker / cron.
 */
export async function processWebhookOutboxBatch(limit = 20): Promise<{ processed: number; succeeded: number; failed: number }> {
  const batch = await db
    .select()
    .from(webhookOutbox)
    .where(and(eq(webhookOutbox.status, 'queued'), sql`${webhookOutbox.attempts} < ${webhookOutbox.maxAttempts}`))
    .orderBy(webhookOutbox.queuedAt)
    .limit(limit);

  let succeeded = 0;
  let failed = 0;

  for (const item of batch) {
    try {
      await dispatchWebhookOutboxItem(item);
      succeeded++;
    } catch (err) {
      logger.error({ err, outboxId: item.id }, 'webhook outbox dispatch failed');
      failed++;
    }
  }

  return { processed: batch.length, succeeded, failed };
}

async function dispatchWebhookOutboxItem(item: WebhookOutbox) {
  const targetIds = (item.targetIntegrationIds as string[]) || [];
  if (targetIds.length === 0) {
    // No targets, mark as dispatched (no-op)
    await db
      .update(webhookOutbox)
      .set({ status: 'dispatched', dispatchedAt: new Date() })
      .where(eq(webhookOutbox.id, item.id));
    return;
  }

  // Fetch all target integrations
  const targets = await db
    .select()
    .from(integrations)
    .where(inArray(integrations.id, targetIds));

  for (const target of targets) {
    const configDecrypted = decryptIntegrationConfig(target.config as Record<string, unknown>);
    const event = {
      eventType: item.eventType,
      summary: (item.payload as Record<string, unknown>).summary as string || item.eventType,
      severity: (item.payload as Record<string, unknown>).severity as 'critical' | 'warning' | 'info' | 'success' | undefined,
      payload: item.payload as Record<string, unknown>,
    };

    try {
      switch (target.type) {
        case 'mattermost': {
          const mm = (configDecrypted.mattermost as Record<string, unknown>) || {};
          await dispatchMattermostNotification(
            {
              webhookUrl: mm.webhookUrl as string,
              channel: (mm.channel as string) || '#resiliplan',
              username: (mm.username as string) || 'ResiliPlan',
              iconUrl: mm.iconUrl as string | undefined,
            },
            event,
          );
          break;
        }
        case 'webhook': {
          await dispatchGenericWebhook(
            {
              url: (configDecrypted.url as string) || ((configDecrypted.webhook as Record<string, unknown>)?.url as string),
              method: ((configDecrypted.method as string) || (configDecrypted.webhook as Record<string, unknown>)?.method || 'POST') as 'POST' | 'PUT',
              headers: (configDecrypted.headers as Record<string, string>) || ((configDecrypted.webhook as Record<string, unknown>)?.headers as Record<string, string>),
              secret: (configDecrypted.secret as string) || ((configDecrypted.webhook as Record<string, unknown>)?.secret as string),
            },
            event,
          );
          break;
        }
        default:
          logger.warn({ type: target.type }, 'unsupported integration type for webhook dispatch');
      }
    } catch (err) {
      logger.error({ err, outboxId: item.id, integrationId: target.id, type: target.type }, 'webhook dispatch failed for integration');
      // Continue to next target
    }
  }

  await db
    .update(webhookOutbox)
    .set({
      status: 'dispatched',
      dispatchedAt: new Date(),
      attempts: sql`${webhookOutbox.attempts} + 1`,
    })
    .where(eq(webhookOutbox.id, item.id));
}

/**
 * Decrypt all secret fields in integration config (in-place).
 */
function decryptIntegrationConfig(config: Record<string, unknown>): Record<string, unknown> {
  const SECRET_FIELDS: readonly string[] = ['apiKey', 'apiToken', 'webhookSecret', 'clientSecret', 'appToken', 'userToken', 'secret'];
  const result = { ...config };
  for (const k of SECRET_FIELDS) {
    if (result[k] && typeof result[k] === 'string' && (result[k] as string).startsWith('enc:')) {
      try {
        result[k] = decryptSecret(result[k] as string);
      } catch (err) {
        logger.error({ err, k }, 'failed to decrypt secret');
      }
    }
  }
  for (const provider of ['netbox', 'prometheus', 'mattermost', 'keycloak', 'rundeck', 'webhook']) {
    const nested = result[provider] as Record<string, unknown> | undefined;
    if (nested) {
      for (const k of SECRET_FIELDS) {
        if (nested[k] && typeof nested[k] === 'string' && (nested[k] as string).startsWith('enc:')) {
          try {
            nested[k] = decryptSecret(nested[k] as string);
          } catch (err) {
            logger.error({ err, provider, k }, 'failed to decrypt nested secret');
          }
        }
      }
    }
  }
  return result;
}
