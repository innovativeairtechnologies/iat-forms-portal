-- ─────────────────────────────────────────────────────────────────────────────
-- 020_audit_log.sql  — admin accountability trail
--
-- One immutable row per consequential admin action (role changes, form approvals
-- & deletions, time-off decisions, …). Answers "who did what, when" long after
-- the fact — the live dashboard feed is ephemeral; this is the record of truth.
--
-- Written best-effort from server code via lib/audit.ts (never blocks the action
-- it describes). actor_id is the admin's auth user id; actor_name is denormalized
-- so entries stay readable even if the user is later removed. Internal data: RLS
-- on, NO policies — service-role only, like ticket_notes / equipment. Run by hand
-- in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_log (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id    uuid,                                    -- auth user id of the admin who acted
  actor_name  text,                                    -- denormalized display name (resilient to deletes)
  action      text        NOT NULL,                    -- machine key, e.g. 'role.update', 'form.approve'
  entity_type text,                                    -- 'employee' | 'form' | 'time_off_request' | …
  entity_id   text,                                    -- id of the affected row (text — ids vary by table)
  summary     text        NOT NULL,                    -- human-readable one-liner for the log viewer
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb, -- before/after values, extra context
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_created_idx ON audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx  ON audit_log (action);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx  ON audit_log (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS audit_log_actor_idx   ON audit_log (actor_id);

ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)
