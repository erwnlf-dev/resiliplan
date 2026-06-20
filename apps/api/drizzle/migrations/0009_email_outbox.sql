-- Phase 6 internal production readiness: governed email outbox
CREATE TYPE email_outbox_status AS ENUM ('queued', 'sent', 'failed', 'cancelled');
CREATE TYPE email_outbox_type AS ENUM ('password_reset', 'mention_notification', 'approval_notification', 'system_notice');

CREATE TABLE email_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  to_email VARCHAR(255) NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  email_type email_outbox_type NOT NULL,
  status email_outbox_status NOT NULL DEFAULT 'queued',
  last_error TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  queued_at TIMESTAMP NOT NULL DEFAULT NOW(),
  sent_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX email_outbox_tenant_status_idx ON email_outbox(tenant_id, status);
