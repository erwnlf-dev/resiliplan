# Integrations

ResiliPlan dirancang untuk **integrate, not replace**. Semua 14+ supported integrations adalah **open source** (MIT, Apache 2, GPL, AGPL) — tidak ada vendor lock-in.

## Architecture

```
┌─────────────────┐         ┌──────────────────┐         ┌─────────────────┐
│  External       │ ──────► │  ResiliPlan      │ ──────► │  External       │
│  System         │ Source  │  Ingestion       │ Sink    │  System         │
│  (CMDB/Mon/ITSM)│ Adapter │  (BullMQ job)    │ Adapter │  (Slack/Status) │
└─────────────────┘         │                  │         └─────────────────┘
                            │ • Schedule       │
                            │ • Webhook        │
                            │ • OAuth/API key  │
                            │ • Mapping config │
                            └──────────────────┘
```

**Foundation components:**
- `integrations` table — per-tenant config (type, direction, encrypted secrets, status)
- `integration_syncs` table — sync history (success/failure, rows affected, duration)
- `webhook_outbox` table — outbound event queue with retry logic
- `crypto-service` — AES-256-GCM encryption for secrets at rest
- Inbound webhook handler — signature-verified, no auth required

## Supported Integrations (Open Source Only)

### Source (pull INTO ResiliPlan)

| Integration | Type | Use Case | Auth |
|-------------|------|----------|------|
| **NetBox** | CMDB | Auto-populate BIA dari devices, IPAM, circuits | API token |
| **Acronis Cyber Protect** | Backup | Auto-populate BIA + RPO verification (Datacomm Cloud Backup) | OAuth2 via worker proxy |
| **Prometheus Alertmanager** | Monitoring | SLA breach detection via webhook | HMAC-SHA256 |
| **Keycloak** | SSO (OIDC) | Enterprise auth | OIDC client credentials |
| **Authentik** | SSO (OIDC) | Enterprise auth | OIDC client credentials |
| **BorgBackup / restic** | Backup | Verify backup status | SSH key |
| **Zabbix** | Monitoring | SLA monitoring (planned) | API token |

### Sink (push FROM ResiliPlan)

| Integration | Type | Use Case | Auth |
|-------------|------|----------|------|
| **Mattermost** | ChatOps | Notifikasi ke channel | Incoming webhook |
| **Rocket.Chat** | ChatOps | Notifikasi ke channel | Incoming webhook |
| **Cstate** | Status Page | Auto-update saat plan activated | API key |
| **BookStack** | Wiki | Publish plan section | API token |
| **Grafana** | Dashboards | Annotations | API key |

### Bidirectional

| Integration | Type | Use Case | Auth |
|-------------|------|----------|------|
| **GLPI** | ITSM | Incident ↔ plan sync | App + User token |
| **Zammad** | Helpdesk | Ticket ↔ plan sync | API token |
| **osTicket** | Helpdesk | Ticket ↔ plan sync | API key |
| **Rundeck** | Runbook | Trigger job dari plan | API token |
| **n8n** | Workflow | Multi-step orchestrator | API key |
| **Eramba** | GRC | Push control evidence | API key |

### Generic

| Integration | Type | Use Case | Auth |
|-------------|------|----------|------|
| **Webhook** | Custom | Kirim event ke HTTPS endpoint | Optional HMAC-SHA256 |

## Setup

### Via UI (recommended)

1. Login sebagai admin
2. Buka **Settings → Integrations**
3. Pilih integration type → isi config (URL, token, dll)
4. **Save** → secrets otomatis ter-encrypt (AES-256-GCM)
5. Klik **Test Sync** untuk verify connectivity
6. Enable integration (toggle `is_enabled`)

### Via API

```bash
# List supported integration types
curl http://localhost:3001/api/v1/integrations/catalog

# Create integration
curl -X POST http://localhost:3001/api/v1/integrations \
  -H "Content-Type: application/json" \
  -H "X-CSRF-Token: ..." \
  -d '{
    "type": "netbox",
    "direction": "inbound",
    "name": "Production NetBox",
    "config": {
      "apiUrl": "https://netbox.example.com",
      "apiToken": "abc123...",
      "tagPrefix": "resiliplan",
      "syncIntervalMinutes": 60
    }
  }'

# Trigger sync
curl -X POST http://localhost:3001/api/v1/integrations/{id}/sync \
  -H "X-CSRF-Token: ..."

# View sync history
curl http://localhost:3001/api/v1/integrations/{id}/syncs
```

## Event Subscriptions

Tiap outbound integration subscribe ke event types. Saat event terjadi, ResiliPlan enqueue ke `webhook_outbox`, worker process dan dispatch.

| Event Type | Trigger |
|------------|---------|
| `plan.activated` | Plan execution started |
| `plan.deactivated` | Plan execution completed |
| `plan.approval_pending` | Plan submitted for review |
| `plan.approved` | Plan approved by reviewer |
| `bia.review_due` | BIA review date approaching |
| `exercise.scheduled` | DR exercise scheduled |
| `incident.created` | New incident from ITSM |
| `incident.updated` | Incident status change |
| `sla.breach_detected` | SLA breach dari monitoring |
| `integration.sync_completed` | Integration sync OK |
| `integration.sync_failed` | Integration sync failed |

**Customize subscription**: Edit `eventSubscriptions` array di integration config.

## Inbound Webhooks (Signature-Verified)

### Prometheus Alertmanager

**Setup Alertmanager config**:
```yaml
receivers:
  - name: resiliplan
    webhook_configs:
      - url: https://resiliplan.example.com/api/v1/webhooks/in/prometheus
        secret: "your-shared-secret-here"
        send_resolved: true
```

**Payload format** (standard Alertmanager webhook v4):
```json
{
  "version": "4",
  "status": "firing",
  "alerts": [{
    "status": "firing",
    "labels": { "alertname": "HighErrorRate", "severity": "critical" },
    "annotations": { "summary": "...", "description": "..." },
    "startsAt": "2026-06-21T11:00:00Z"
  }]
}
```

ResiliPlan auto-maps:
- `status=firing` → `sla.breach_detected` event (enqueue to Mattermost/etc)
- `status=resolved` → log only (no event)

### Generic Webhook (per-integration)

```
POST /api/v1/webhooks/in/{integrationId}
Content-Type: application/json

{
  "eventType": "incident.created",
  "payload": { ... arbitrary ... }
}
```

Enqueue event for outbound relay ke semua enabled integrations subscribed to event type.

## Security

- **Secrets at rest**: AES-256-GCM encryption (key dari `API_KEY_ENCRYPTION_KEY`)
- **Inbound webhooks**: HMAC-SHA256 signature verification (`X-Alertmanager-Signature` / `X-Webhook-Signature` headers)
- **CSRF exempt**: All `/api/v1/webhooks/in/*` paths (signature-verified instead)
- **Audit log**: All integration create/update/delete + sync events recorded
- **Secret masking**: API responses mask all secret fields dengan `***`
- **Rate limiting**: Standard per-IP, per-endpoint limits apply

## Sync Engine

- **Manual trigger**: `POST /api/v1/integrations/{id}/sync` (admin/coordinator only)
- **Scheduled trigger**: Future — BullMQ cron job based on `syncIntervalMinutes`
- **Webhook trigger**: Inbound webhook auto-resolves tenant by signature match

**Status tracking**:
- `pending_setup` — just created, never tested
- `active` — last sync succeeded
- `paused` — user-disabled (is_enabled = false)
- `error` — last sync failed, check `last_error`

**Failure handling**:
- `consecutiveFailures` counter
- Exponential backoff via webhook_outbox (`maxAttempts = 3`)
- Alert ke admin when integration stuck in `error` for 24h (future)

## Roadmap

- [ ] Scheduled sync via BullMQ (per-integration cron)
- [ ] Per-integration web UI (config form auto-generated dari `configSchema`)
- [ ] Slack adapter (closed-source for now, MIT-compatible)
- [ ] Microsoft Teams adapter (closed-source)
- [ ] LDAP / Active Directory source
- [ ] ServiceNow (proprietary, high demand)
- [ ] Jira Service Management (proprietary)
- [ ] PagerDuty / Opsgenie adapter

## Contributing

Untuk menambah integration baru:
1. Tambah enum value di `db/schema/integrations.ts`
2. Tambah entry di `SUPPORTED_INTEGRATIONS` di `services/integration-service.ts`
3. Buat adapter di `services/adapters/{type}-adapter.ts`
4. Register sync handler di `IntegrationService.triggerSync`
5. Tambah event subscriptions
6. Update docs

Pastikan integration target open source + license compatible.
