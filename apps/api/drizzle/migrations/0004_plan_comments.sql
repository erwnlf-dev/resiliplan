DO $$ BEGIN
  CREATE TYPE comment_status AS ENUM ('open', 'resolved');
EXCEPTION WHEN duplicate_object THEN null; END $$;

CREATE TABLE IF NOT EXISTS plan_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id uuid NOT NULL REFERENCES drp_plans(id) ON DELETE CASCADE,
  section_key varchar(80) NOT NULL,
  body text NOT NULL,
  status comment_status NOT NULL DEFAULT 'open',
  created_by uuid REFERENCES users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS plan_comments_plan_id_idx ON plan_comments(plan_id);
CREATE INDEX IF NOT EXISTS plan_comments_section_key_idx ON plan_comments(plan_id, section_key);
CREATE INDEX IF NOT EXISTS plan_comments_status_idx ON plan_comments(status);
