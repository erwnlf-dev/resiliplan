/**
 * Generic Webhook Adapter
 *
 * Posts events to arbitrary HTTPS endpoint with optional HMAC signature.
 */
import { createHmac } from 'node:crypto';
import { logger } from '../../utils/logger.js';

type WebhookConfig = {
  url: string;
  method?: 'POST' | 'PUT';
  headers?: Record<string, string>;
  secret?: string;
};

type WebhookEvent = {
  eventType: string;
  summary: string;
  severity?: 'critical' | 'warning' | 'info' | 'success';
  payload: Record<string, unknown>;
};

export async function dispatchGenericWebhook(
  config: WebhookConfig,
  event: WebhookEvent,
): Promise<{ rowsAffected: number; rowsCreated: number; rowsUpdated: number; rowsSkipped: number; metadata?: Record<string, unknown> }> {
  const body = JSON.stringify({
    eventType: event.eventType,
    summary: event.summary,
    severity: event.severity || 'info',
    payload: event.payload,
    timestamp: new Date().toISOString(),
  });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'ResiliPlan-Webhook/1.0',
    ...(config.headers || {}),
  };

  if (config.secret) {
    const signature = createHmac('sha256', config.secret).update(body).digest('hex');
    headers['X-Webhook-Signature'] = `sha256=${signature}`;
  }

  const resp = await fetch(config.url, {
    method: config.method || 'POST',
    headers,
    body,
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Webhook returned ${resp.status}: ${errText}`);
  }

  logger.info({ eventType: event.eventType, url: config.url, status: resp.status }, 'Generic webhook dispatched');

  return {
    rowsAffected: 1,
    rowsCreated: 1,
    rowsUpdated: 0,
    rowsSkipped: 0,
    metadata: { source: 'webhook', url: config.url, eventType: event.eventType, status: resp.status },
  };
}
