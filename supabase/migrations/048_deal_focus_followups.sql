-- ─────────────────────────────────────────────────────────────────────────────
-- 048_deal_focus_followups.sql — Manual Focused flag, project type, follow-ups
--
-- Three additions to the deals CRM:
--
--  • deals.focused — a hand-picked "Focused" list. The Focused tab was a
--    DERIVED list (confidence≥60 OR projected OR notes); it's now an explicit
--    flag toggled by the ★ in the Pipeline view. Defaulting false means the
--    old derived list clears itself the moment the code switches over — reps
--    star what actually matters.
--
--  • deals.project_type — free-text industry/vertical (values in code:
--    lib/deals.ts PROJECT_TYPES; the New Deal form offers them as a dropdown).
--    Nullable — imported deals and pre-existing rows simply have none.
--
--  • deal_follow_ups — reminders on a calendar. The New Deal form auto-creates
--    one 2 weeks out (auto_generated=true), mirroring the Monday automation;
--    the deal modal's "Schedule Follow-up" button adds dated ones. Bulk imports
--    do NOT auto-generate (would spawn one per imported row). ON DELETE CASCADE,
--    and the importer's replace mode snapshots + re-attaches them by
--    customer+job+group so a re-import doesn't wipe scheduled reminders.
--
-- Internal data: RLS on, NO policies — service-role only, same posture as
-- deals (043) / deal_activity (047). Access gated in the app via
-- requireDealsAuth.
--
-- Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE deals ADD COLUMN IF NOT EXISTS focused      boolean NOT NULL DEFAULT false;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS project_type text;

CREATE TABLE IF NOT EXISTS deal_follow_ups (
  id             uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id        uuid        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  due_date       date        NOT NULL,
  note           text,
  done           boolean     NOT NULL DEFAULT false,
  auto_generated boolean     NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_follow_ups_due_idx  ON deal_follow_ups (due_date);
CREATE INDEX IF NOT EXISTS deal_follow_ups_deal_idx ON deal_follow_ups (deal_id);

ALTER TABLE deal_follow_ups ENABLE ROW LEVEL SECURITY;
