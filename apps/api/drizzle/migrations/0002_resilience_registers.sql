DO $$ BEGIN
  CREATE TYPE asset_criticality AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE risk_status AS ENUM ('open', 'mitigating', 'mitigated', 'accepted');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE drill_status AS ENUM ('planned', 'in_progress', 'completed', 'cancelled');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS service_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  asset_name text NOT NULL,
  asset_type varchar(80) NOT NULL,
  owner text NOT NULL,
  criticality asset_criticality NOT NULL DEFAULT 'medium',
  recovery_priority integer NOT NULL DEFAULT 3 CHECK (recovery_priority BETWEEN 1 AND 5),
  dependencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_assets_tenant_id_idx ON service_assets(tenant_id);
CREATE INDEX IF NOT EXISTS service_assets_service_name_idx ON service_assets(service_name);

CREATE TABLE IF NOT EXISTS service_risks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  risk_title text NOT NULL,
  category varchar(80) NOT NULL,
  probability integer NOT NULL CHECK (probability BETWEEN 1 AND 5),
  impact integer NOT NULL CHECK (impact BETWEEN 1 AND 5),
  risk_score integer NOT NULL CHECK (risk_score BETWEEN 1 AND 25),
  mitigation text NOT NULL DEFAULT '',
  owner text NOT NULL DEFAULT '',
  status risk_status NOT NULL DEFAULT 'open',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS service_risks_tenant_id_idx ON service_risks(tenant_id);
CREATE INDEX IF NOT EXISTS service_risks_service_name_idx ON service_risks(service_name);
CREATE INDEX IF NOT EXISTS service_risks_score_idx ON service_risks(risk_score);

CREATE TABLE IF NOT EXISTS recovery_drills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  drill_title text NOT NULL,
  scheduled_at timestamp NOT NULL,
  scope text NOT NULL,
  owner text NOT NULL,
  status drill_status NOT NULL DEFAULT 'planned',
  result_summary text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS recovery_drills_tenant_id_idx ON recovery_drills(tenant_id);
CREATE INDEX IF NOT EXISTS recovery_drills_service_name_idx ON recovery_drills(service_name);
CREATE INDEX IF NOT EXISTS recovery_drills_scheduled_at_idx ON recovery_drills(scheduled_at);
