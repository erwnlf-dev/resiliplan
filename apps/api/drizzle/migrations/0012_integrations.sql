-- Phase 2: Open Source Integrations Foundation
-- Adds: integrations, integration_syncs, webhook_outbox
-- Supports: NetBox, Prometheus, Mattermost, Keycloak, GLPI, Zammad, osTicket, Rundeck, n8n, Eramba, BookStack, Cstate, Grafana, generic webhook

-- ==============================================================
-- 1. ENUMS
-- ==============================================================

CREATE TYPE integration_type AS ENUM (
  'netbox',
  'prometheus',
  'zabbix',
  'keycloak',
  'authentik',
  'borg',
  'mattermost',
  'rocketchat',
  'cstate',
  'bookstack',
  'grafana',
  'glpi',
  'zammad',
  'osticket',
  'rundeck',
  'n8n',
  'eramba',
  'webhook'
);

CREATE TYPE integration_direction AS ENUM ('inbound', 'outbound', 'bidirectional');
CREATE TYPE integration_status AS ENUM ('active', 'paused', 'error', 'pending_setup');
CREATE TYPE integration_sync_status AS ENUM ('running', 'success', 'failed', 'partial', 'cancelled');
CREATE TYPE webhook_outbox_status AS ENUM ('queued', 'dispatched', 'failed', 'cancelled');
CREATE TYPE webhook_event_type AS ENUM (
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
  'integration.sync_failed'
);

-- ==============================================================
-- 2. INTEGRATIONS TABLE
-- ==============================================================

CREATE TABLE integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  type integration_type NOT NULL,
  direction integration_direction NOT NULL,
  name VARCHAR(200) NOT NULL,
  description TEXT,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status integration_status NOT NULL DEFAULT 'pending_setup',
  is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_sync_at TIMESTAMP,
  last_error_at TIMESTAMP,
  last_error TEXT,
  consecutive_failures INTEGER NOT NULL DEFAULT 0,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX integrations_tenant_type_idx ON integrations(tenant_id, type);
CREATE INDEX integrations_tenant_status_idx ON integrations(tenant_id, status);

-- ==============================================================
-- 3. INTEGRATION SYNCS TABLE (history)
-- ==============================================================

CREATE TABLE integration_syncs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
  trigger VARCHAR(50) NOT NULL,
  direction integration_direction NOT NULL,
  status integration_sync_status NOT NULL DEFAULT 'running',
  started_at TIMESTAMP NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMP,
  duration_ms INTEGER,
  rows_affected INTEGER NOT NULL DEFAULT 0,
  rows_created INTEGER NOT NULL DEFAULT 0,
  rows_updated INTEGER NOT NULL DEFAULT 0,
  rows_skipped INTEGER NOT NULL DEFAULT 0,
  error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX integration_syncs_integration_idx ON integration_syncs(integration_id, started_at);
CREATE INDEX integration_syncs_tenant_status_idx ON integration_syncs(tenant_id, status);

-- ==============================================================
-- 4. WEBHOOK OUTBOX TABLE
-- ==============================================================

CREATE TABLE webhook_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type webhook_event_type NOT NULL,
  payload JSONB NOT NULL,
  target_integration_ids JSONB,
  status webhook_outbox_status NOT NULL DEFAULT 'queued',
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  last_error TEXT,
  queued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  dispatched_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX webhook_outbox_tenant_status_idx ON webhook_outbox(tenant_id, status);
CREATE INDEX webhook_outbox_event_type_idx ON webhook_outbox(event_type);
