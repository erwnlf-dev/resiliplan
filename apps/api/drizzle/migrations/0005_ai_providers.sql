-- AI provider configuration (Phase 2: BYO multi-provider)
CREATE TYPE ai_provider_type AS ENUM ('openai', 'anthropic', 'google');

CREATE TABLE ai_providers (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  provider ai_provider_type NOT NULL,
  api_key TEXT NOT NULL,
  model TEXT NOT NULL DEFAULT 'gpt-4o-mini',
  max_tokens INTEGER NOT NULL DEFAULT 2048,
  temperature NUMERIC(3,2) NOT NULL DEFAULT 0.70,
  enabled BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ai_providers_tenant_idx ON ai_providers(tenant_id);
CREATE INDEX ai_providers_enabled_idx ON ai_providers(tenant_id, enabled);
