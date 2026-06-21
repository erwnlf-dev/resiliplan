CREATE TABLE IF NOT EXISTS plan_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES drp_plans(id) ON DELETE CASCADE,
  section_key varchar(120),
  title text NOT NULL,
  evidence_url text NOT NULL,
  evidence_type varchar(80) NOT NULL DEFAULT 'link',
  notes text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_evidence_plan_id_idx ON plan_evidence(plan_id);
CREATE INDEX IF NOT EXISTS plan_evidence_section_key_idx ON plan_evidence(plan_id, section_key);
