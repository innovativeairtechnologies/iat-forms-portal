-- ─────────────────────────────────────────────────────────────────────────────
-- 063_deal_dryware_key.sql — DryWare becomes the source of truth for the pipeline
--
-- The deals table stops being a monday.com spreadsheet mirror and becomes a
-- materialized view of the DryWare "projected sales by project" feed plus the
-- portal's own workflow overlay (stage, ★ focus, follow-ups, notes).
--
-- `dryware_key` is the STABLE identity for a DryWare project —
-- lower(trim(project_customer)) || '|' || lower(trim(project_name)) — because
-- projected_sales is wiped and reloaded on every sync (its bigint id is not
-- stable). On each sync the materializer (lib/dryware-deals.ts) upserts by this
-- key: DryWare-sourced fields (customer, $, confidence, close date, salesperson)
-- are overwritten, portal-workflow fields are preserved, and deals whose key
-- vanished from DryWare are pruned. A NULL dryware_key marks a manually-created
-- deal, which the sync never touches.
--
-- Apply via Supabase CLI (npx supabase db query --linked -f <this file>).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE deals ADD COLUMN IF NOT EXISTS dryware_key text;

CREATE INDEX IF NOT EXISTS deals_dryware_key_idx ON deals (dryware_key);
