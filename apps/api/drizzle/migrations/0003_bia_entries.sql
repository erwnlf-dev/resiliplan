DO $$ BEGIN
  CREATE TYPE criticality_tier AS ENUM ('tier_1', 'tier_2', 'tier_3', 'tier_4');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS bia_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  process_name text NOT NULL,
  owner text NOT NULL,
  impact_1h integer NOT NULL CHECK (impact_1h BETWEEN 1 AND 5),
  impact_4h integer NOT NULL CHECK (impact_4h BETWEEN 1 AND 5),
  impact_24h integer NOT NULL CHECK (impact_24h BETWEEN 1 AND 5),
  financial_impact integer NOT NULL CHECK (financial_impact BETWEEN 1 AND 5),
  reputational_impact integer NOT NULL CHECK (reputational_impact BETWEEN 1 AND 5),
  regulatory_impact integer NOT NULL CHECK (regulatory_impact BETWEEN 1 AND 5),
  max_impact_score integer NOT NULL CHECK (max_impact_score BETWEEN 1 AND 5),
  criticality_tier criticality_tier NOT NULL,
  current_rto_minutes integer NOT NULL CHECK (current_rto_minutes > 0),
  current_rpo_minutes integer NOT NULL CHECK (current_rpo_minutes > 0),
  dependency_notes text NOT NULL DEFAULT '',
  workaround text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bia_entries_tenant_id_idx ON bia_entries(tenant_id);
CREATE INDEX IF NOT EXISTS bia_entries_service_name_idx ON bia_entries(service_name);
CREATE INDEX IF NOT EXISTS bia_entries_criticality_tier_idx ON bia_entries(criticality_tier);
