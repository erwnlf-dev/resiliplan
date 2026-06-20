CREATE EXTENSION IF NOT EXISTS pgcrypto;

DO $$ BEGIN
  CREATE TYPE user_role AS ENUM ('admin', 'coordinator', 'owner', 'viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE plan_status AS ENUM ('draft', 'in_review', 'approved', 'retired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE section_status AS ENUM ('draft', 'ready_for_review', 'approved');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE approval_decision AS ENUM ('submitted', 'approved', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug varchar(100) NOT NULL UNIQUE,
  settings jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE cascade,
  email varchar(255) NOT NULL UNIQUE,
  password_hash text NOT NULL,
  name text NOT NULL,
  role user_role NOT NULL DEFAULT 'viewer',
  disabled boolean NOT NULL DEFAULT false,
  must_reset_password boolean NOT NULL DEFAULT false,
  reset_token text,
  reset_token_expires_at timestamp,
  last_login_at timestamp,
  last_login_ip text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE cascade,
  expires_at timestamp NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON sessions(user_id);

CREATE TABLE IF NOT EXISTS drp_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE cascade,
  title text NOT NULL,
  service_name text NOT NULL,
  service_owner text NOT NULL,
  business_owner text,
  description text NOT NULL DEFAULT '',
  criticality varchar(20) NOT NULL DEFAULT 'medium',
  rto_minutes integer NOT NULL DEFAULT 240,
  rpo_minutes integer NOT NULL DEFAULT 60,
  version integer NOT NULL DEFAULT 1,
  status plan_status NOT NULL DEFAULT 'draft',
  approved_at timestamp,
  approved_by uuid REFERENCES users(id) ON DELETE set null,
  created_by uuid NOT NULL REFERENCES users(id) ON DELETE set null,
  updated_by uuid REFERENCES users(id) ON DELETE set null,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS drp_plans_tenant_id_idx ON drp_plans(tenant_id);
CREATE INDEX IF NOT EXISTS drp_plans_status_idx ON drp_plans(status);

CREATE TABLE IF NOT EXISTS drp_sections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES drp_plans(id) ON DELETE cascade,
  section_key varchar(80) NOT NULL,
  title text NOT NULL,
  iso_clause text NOT NULL,
  display_order integer NOT NULL,
  content_markdown text NOT NULL,
  status section_status NOT NULL DEFAULT 'draft',
  updated_by uuid REFERENCES users(id) ON DELETE set null,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now(),
  CONSTRAINT drp_sections_plan_key_unique UNIQUE(plan_id, section_key)
);
CREATE INDEX IF NOT EXISTS drp_sections_plan_id_idx ON drp_sections(plan_id);

CREATE TABLE IF NOT EXISTS approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES drp_plans(id) ON DELETE cascade,
  actor_id uuid NOT NULL REFERENCES users(id) ON DELETE set null,
  decision approval_decision NOT NULL,
  note text NOT NULL DEFAULT '',
  signature_text text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS approvals_plan_id_idx ON approvals(plan_id);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE cascade,
  actor_id uuid REFERENCES users(id) ON DELETE set null,
  entity_type varchar(80) NOT NULL,
  entity_id text NOT NULL,
  action varchar(120) NOT NULL,
  summary text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  append_only boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_logs_tenant_id_idx ON audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);
