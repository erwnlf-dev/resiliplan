/**
 * Mattermost ChatOps Adapter
 *
 * Posts notifications to Mattermost channel via incoming webhook.
 * Format: https://docs.mattermost.com/developer/webhooks-incoming.html
 */
import { createHmac } from 'node:crypto';
import { logger } from '../../utils/logger.js';

type MattermostConfig = {
  webhookUrl: string;
  channel?: string;
  username?: string;
  iconUrl?: string;
};

type MattermostEvent = {
  eventType: string;
  summary: string;
  severity?: 'critical' | 'warning' | 'info' | 'success';
  payload: Record<string, unknown>;
};

const SEVERITY_COLOR: Record<NonNullable<MattermostEvent['severity']>, string> = {
  critical: '#dc2626', // red-600
  warning: '#f59e0b', // amber-500
  info: '#0ea5e9', // sky-500
  success: '#10b981', // emerald-500
};

const SEVERITY_EMOJI: Record<NonNullable<MattermostEvent['severity']>, string> = {
  critical: ':rotating_light:',
  warning: ':warning:',
  info: ':information_source:',
  success: ':white_check_mark:',
};

export async function dispatchMattermostNotification(
  config: MattermostConfig,
  event: MattermostEvent,
): Promise<{ rowsAffected: number; rowsCreated: number; rowsUpdated: number; rowsSkipped: number; metadata?: Record<string, unknown> }> {
  const severity = event.severity || 'info';
  const color = SEVERITY_COLOR[severity];
  const emoji = SEVERITY_EMOJI[severity];

  const attachment = {
    color,
    title: `${emoji} ${event.eventType}`,
    text: event.summary,
    fields: Object.entries(event.payload || {})
      .filter(([k]) => k !== 'tenantId')
      .slice(0, 10)
      .map(([k, v]) => ({
        title: k,
        value: typeof v === 'string' ? v : JSON.stringify(v),
        short: String(v).length < 30,
      })),
    footer: 'ResiliPlan',
    ts: Math.floor(Date.now() / 1000),
  };

  const body = {
    channel: config.channel,
    username: config.username || 'ResiliPlan',
    icon_url: config.iconUrl,
    text: `**${event.eventType}** — ${event.summary}`,
    attachments: [attachment],
  };

  const resp = await fetch(config.webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Mattermost webhook returned ${resp.status}: ${errText}`);
  }

  logger.info({ eventType: event.eventType, channel: config.channel }, 'Mattermost notification dispatched');

  return {
    rowsAffected: 1,
    rowsCreated: 1,
    rowsUpdated: 0,
    rowsSkipped: 0,
    metadata: { source: 'mattermost', channel: config.channel, eventType: event.eventType },
  };
}
