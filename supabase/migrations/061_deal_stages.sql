-- ─────────────────────────────────────────────────────────────────────────────
-- 061_deal_stages.sql — Real pipeline stages + stage history (CRM Phase 1)
--
-- The board graduates from "Won/Lost/null + a 5-step checklist" to named
-- pipeline stages driving a kanban view:
--
--   lead → quoted → follow_up → verbal → won / lost
--
--  • deals.stage — the pipeline column. `status` stays for compatibility
--    (every existing analytic reads it); the API keeps the two in sync:
--    stage won/lost ⇒ status Won/Lost, any open stage ⇒ status NULL.
--  • deals.stage_changed_at — powers deal-rot ("21d in Quoted") badges.
--  • deals.expected_close — a REAL close date, superseding the free-text
--    `projected` column (kept read-only; backfilled by script where parseable).
--  • deals.closed_reason — win/loss reason, captured when a deal is dragged
--    to Won/Lost (value list lives in code: lib/deals.ts CLOSED_REASONS).
--  • deals.next_step / next_step_due — "what's the next move" discipline;
--    surfaced on board cards, never enforced as a hard gate.
--  • deal_stage_history — one row per transition, for funnel conversion and
--    days-in-stage analytics. Seeded with each deal's backfilled stage so the
--    funnel math has a floor.
--
-- Backfill maps status + checklist into stages (Won→won, Lost→lost,
-- award→verbal, follow1/2→follow_up, quote-or-dated→quoted, else lead) and is
-- guarded by "history table is empty" so re-running this file never clobbers
-- stages the team has since corrected by hand.
--
-- Internal data: RLS on, NO policies — service-role only, same posture as
-- deals (043) / deal_activity (047). Access gated in the app via
-- requireDealsAuth.
--
-- Apply via Supabase CLI (npx supabase db push --linked).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage text NOT NULL DEFAULT 'lead'
  CHECK (stage IN ('lead', 'quoted', 'follow_up', 'verbal', 'won', 'lost'));
ALTER TABLE deals ADD COLUMN IF NOT EXISTS stage_changed_at timestamptz NOT NULL DEFAULT now();
ALTER TABLE deals ADD COLUMN IF NOT EXISTS expected_close date;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS closed_reason text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS next_step text;
ALTER TABLE deals ADD COLUMN IF NOT EXISTS next_step_due date;

CREATE INDEX IF NOT EXISTS deals_stage_idx ON deals (stage);

CREATE TABLE IF NOT EXISTS deal_stage_history (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  deal_id    uuid        NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  from_stage text,                    -- NULL = seed row (deal's first known stage)
  to_stage   text        NOT NULL,
  actor      text,
  note       text,                    -- carries closed_reason on won/lost moves
  changed_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS deal_stage_history_deal_idx ON deal_stage_history (deal_id, changed_at DESC);

ALTER TABLE deal_stage_history ENABLE ROW LEVEL SECURITY;

-- ── Backfill (idempotent: only while no stage history exists) ────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM deal_stage_history) THEN
    UPDATE deals SET
      stage = CASE
        WHEN status = 'Won'  THEN 'won'
        WHEN status = 'Lost' THEN 'lost'
        WHEN (checklist->>'award')   = 'true' THEN 'verbal'
        WHEN (checklist->>'follow1') = 'true'
          OR (checklist->>'follow2') = 'true' THEN 'follow_up'
        WHEN (checklist->>'quote')   = 'true'
          OR date_quoted IS NOT NULL          THEN 'quoted'
        ELSE 'lead'
      END,
      stage_changed_at = updated_at;

    INSERT INTO deal_stage_history (deal_id, from_stage, to_stage, actor, changed_at)
      SELECT id, NULL, stage, 'migration-061', updated_at FROM deals;
  END IF;
END $$;
