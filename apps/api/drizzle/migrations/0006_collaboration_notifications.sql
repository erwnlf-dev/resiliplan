-- Collaboration enhancements (Phase 3): threaded comments, mentions, in-app notifications
CREATE TYPE notification_status AS ENUM ('unread', 'read');
CREATE TYPE notification_type AS ENUM ('mention', 'comment_reply', 'approval_request');

ALTER TABLE plan_comments
  ADD COLUMN parent_comment_id UUID REFERENCES plan_comments(id) ON DELETE CASCADE,
  ADD COLUMN mentioned_emails JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX plan_comments_parent_comment_id_idx ON plan_comments(parent_comment_id);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
  plan_id UUID REFERENCES drp_plans(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES plan_comments(id) ON DELETE CASCADE,
  type notification_type NOT NULL,
  status notification_status NOT NULL DEFAULT 'unread',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  read_at TIMESTAMP
);

CREATE INDEX notifications_user_status_idx ON notifications(user_id, status);
CREATE INDEX notifications_plan_idx ON notifications(plan_id);
