/**
 * Prometheus Alertmanager Adapter
 *
 * For sync test: verify webhook secret is configured.
 * Real work happens via inbound webhook handler (POST /api/v1/webhooks/in/prometheus).
 */
import { logger } from '../../utils/logger.js';

type PrometheusConfig = {
  apiUrl: string;
  webhookSecret: string;
  receiverName?: string;
};

export async function runPrometheusReceiver(
  tenantId: string,
  config: PrometheusConfig,
): Promise<{ rowsAffected: number; rowsCreated: number; rowsUpdated: number; rowsSkipped: number; metadata?: Record<string, unknown> }> {
  // Verify Alertmanager reachable
  const statusUrl = `${config.apiUrl.replace(/\/$/, '')}-/healthy`;
  try {
    const resp = await fetch(statusUrl, { method: 'GET' });
    const reachable = resp.ok;
    logger.info({ tenantId, reachable, status: resp.status }, 'Prometheus Alertmanager health check');

    return {
      rowsAffected: 0,
      rowsCreated: 0,
      rowsUpdated: 0,
      rowsSkipped: 0,
      metadata: {
        source: 'prometheus',
        alertmanagerReachable: reachable,
        receiverName: config.receiverName || 'resiliplan',
        webhookConfigured: !!config.webhookSecret,
        note: 'Prometheus sync is webhook-driven. Configure Alertmanager to POST to /api/v1/webhooks/in/prometheus with X-Alertmanager-Signature header.',
      },
    };
  } catch (err) {
    throw new Error(`Cannot reach Alertmanager at ${config.apiUrl}: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/**
 * Process incoming Prometheus Alertmanager webhook payload.
 * Called from route handler.
 */
export type AlertmanagerPayload = {
  version: string;
  groupKey: string;
  status: 'firing' | 'resolved';
  receiver: string;
  groupLabels: Record<string, string>;
  commonLabels: Record<string, string>;
  commonAnnotations: Record<string, string>;
  alerts: Array<{
    status: 'firing' | 'resolved';
    labels: Record<string, string>;
    annotations: Record<string, string>;
    startsAt: string;
    endsAt: string;
    generatorURL?: string;
  }>;
};

export function processAlertmanagerPayload(
  tenantId: string,
  payload: AlertmanagerPayload,
  expectedSignature: string,
): {
  received: number;
  firing: number;
  resolved: number;
  events: Array<{ eventType: string; summary: string; severity: 'critical' | 'warning' | 'info'; payload: Record<string, unknown> }>;
} {
  const firing = payload.alerts.filter((a) => a.status === 'firing').length;
  const resolved = payload.alerts.filter((a) => a.status === 'resolved').length;

  // Map each firing alert to a webhook event
  const events = payload.alerts
    .filter((a) => a.status === 'firing')
    .map((alert) => ({
      eventType: 'sla.breach_detected' as const,
      summary: `${alert.labels.alertname || 'Alert'}: ${alert.annotations.summary || alert.annotations.description || 'No description'}`,
      severity: (alert.labels.severity === 'critical' ? 'critical' : 'warning') as 'critical' | 'warning',
      payload: {
        source: 'prometheus',
        alertname: alert.labels.alertname,
        instance: alert.labels.instance,
        severity: alert.labels.severity,
        startsAt: alert.startsAt,
        generatorURL: alert.generatorURL,
        annotations: alert.annotations,
        labels: alert.labels,
        tenantId,
      },
    }));

  return {
    received: payload.alerts.length,
    firing,
    resolved,
    events,
  };
}
