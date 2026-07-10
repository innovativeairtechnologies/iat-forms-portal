-- ─────────────────────────────────────────────────────────────────────────────
-- 047_deal_workflow.sql — Deal follow-up checklist + activity log
--
-- Powers the workflow layer of the deal detail modal (matching the sales
-- team's expected deal card): a fixed 5-step follow-up checklist per deal and
-- a portal-native activity log fed by the Quick Actions (Log Call / Send
-- Email / Schedule Meeting / Send Proposal) and checklist toggles.
--
--  • deals.checklist — jsonb map of step key → boolean. Step KEYS live in
--    code (lib/deals.ts CHECKLIST_STEPS: submittal, quote, follow1, follow2,
--    award) so relabeling steps never needs a migration; unknown keys are
--    rejected by the API layer (app/api/admin/deals/validate.ts).
--  • deal_activity — one row per logged interaction. ON DELETE CASCADE: the
--    Excel importer's replace mode snapshots + remaps these onto the new rows
--    (by customer+job+group) before they'd be lost — see
--    app/api/admin/deals/import/route.ts.
--
-- Internal data: RLS on, NO policies — service-role only, exactly like deals
-- (043). Access gated in the app layer via requireDealsAuth.
--
-- Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE deals ADD COLUMN IF NOT EXISTS checklist jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS deal_activity (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  kind       text        NOT NULL CHECK (kind IN ('call', 'email', 'meeting', 'proposal', 'checklist', 'note')),
  summary    text        NOT NULL,
  actor      text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_activity_deal_idx ON deal_activity (deal_id, created_at DESC);

ALTER TABLE deal_activity ENABLE ROW LEVEL SECURITY;
