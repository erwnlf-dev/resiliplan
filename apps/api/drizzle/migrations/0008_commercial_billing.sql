-- Phase 5 commercial foundation: subscription and usage metering
CREATE TYPE subscription_status AS ENUM ('trial', 'active', 'past_due', 'cancelled');
CREATE TYPE usage_event_type AS ENUM ('plan_created', 'ai_request', 'export_generated', 'collaboration_session');

CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  plan_code VARCHAR(80) NOT NULL DEFAULT 'internal',
  status subscription_status NOT NULL DEFAULT 'trial',
  seats_limit INTEGER NOT NULL DEFAULT 10,
  plans_limit INTEGER NOT NULL DEFAULT 25,
  ai_requests_limit INTEGER NOT NULL DEFAULT 500,
  current_period_start TIMESTAMP NOT NULL DEFAULT NOW(),
  current_period_end TIMESTAMP NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX subscriptions_tenant_id_idx ON subscriptions(tenant_id);

CREATE TABLE usage_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type usage_event_type NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX usage_events_tenant_type_idx ON usage_events(tenant_id, event_type);
