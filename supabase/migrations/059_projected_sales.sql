-- ─────────────────────────────────────────────────────────────────────────────
-- 059_projected_sales.sql — Projected sales by project, mirrored from Dryware
--
-- Read-only snapshot of the external Dryware reporting API (a first-party IAT
-- system): GET dryware.dehumidifiers.com/api/Reporting/
-- getProjectedSalesByProjectForExternalSystem. Sales opens /admin/projected-sales
-- and clicks "Sync now"; the route fetches, de-duplicates, and reloads this table.
--
-- The source has NO stable per-row id and currently returns every project TWICE
-- (a JOIN fan-out on the Dryware side). The sync route collapses byte-identical
-- rows before writing, so this table holds each project once; `id` is ours.
--
-- Access is gated in the app layer on the existing `deals` permission (Sales +
-- admin) — no new permission key, so no role_permissions seed / check-perm-seed
-- change is needed. Internal data: RLS on, NO policies — service-role only, like
-- deals (043) / gantt_charts (040) / presentations (039).
--
-- Applied via the Supabase CLI (npx supabase … --linked), not the SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS projected_sales (
  id                     bigint      GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_name              text,       -- salesperson ("user" upstream)
  company                text,
  project_customer       text,
  project_name           text,
  date_created           date,       -- parsed from upstream "M/D/YYYY"
  contact                text,
  project_types          text,
  confidence_level       integer,    -- percent (0–100); upstream currently 0–50
  estimated_closing_date date,
  units                  jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- [{unitName,modelNumber,quoteTotal}]
  unit_count             integer     NOT NULL DEFAULT 0,            -- derived: units length
  quote_total            numeric     NOT NULL DEFAULT 0,            -- derived: sum(units[].quoteTotal)
  weighted_total         numeric     NOT NULL DEFAULT 0,            -- derived: quote_total * confidence/100
  synced_at              timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS projected_sales_company_idx ON projected_sales (company);
CREATE INDEX IF NOT EXISTS projected_sales_user_idx    ON projected_sales (user_name);

ALTER TABLE projected_sales ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)

-- One-row sync log: freshness + health for the page header and audit trail. The
-- singleton is enforced by a fixed boolean primary key (id is always TRUE).
CREATE TABLE IF NOT EXISTS projected_sales_sync (
  id             boolean     PRIMARY KEY DEFAULT TRUE CHECK (id),
  last_synced_at timestamptz,            -- set on SUCCESS only (last good data time)
  source_count   integer,               -- rows Dryware returned (incl. duplicates)
  unique_count   integer,               -- rows kept after de-duplication
  total_quote    numeric,
  weighted_total numeric,
  duration_ms    integer,               -- how long the Dryware call took
  status         text,                  -- 'ok' | 'error' (of the last attempt)
  error          text,                  -- message from the last failed attempt
  synced_by      text                   -- display name of whoever clicked Sync
);

ALTER TABLE projected_sales_sync ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only

-- Atomic replace: wipe + reload + update the sync log in ONE transaction, so a
-- concurrent reader never sees a half-empty table. Called only on a SUCCESSFUL
-- fetch; a failed sync updates projected_sales_sync directly and leaves the data
-- untouched (last-good survives).
--   p_rows: JSON array of de-duplicated, derived project rows.
--   p_meta: JSON object of the sync-log fields (status 'ok', counts, timing, …).
CREATE OR REPLACE FUNCTION replace_projected_sales(p_rows jsonb, p_meta jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Full wipe before reload. Supabase blocks an unqualified DELETE (pg_safeupdate:
  -- "DELETE requires a WHERE clause"), so filter on the always-present identity PK
  -- — it matches every row and can't be folded away by the planner (the same trick
  -- the deals import uses). TRUNCATE is avoided: it needs a separate privilege the
  -- service role may lack, whereas DELETE is already permitted here.
  DELETE FROM projected_sales WHERE id IS NOT NULL;

  INSERT INTO projected_sales (
    user_name, company, project_customer, project_name, date_created,
    contact, project_types, confidence_level, estimated_closing_date,
    units, unit_count, quote_total, weighted_total, synced_at
  )
  SELECT
    r->>'user_name',
    r->>'company',
    r->>'project_customer',
    r->>'project_name',
    NULLIF(r->>'date_created', '')::date,
    r->>'contact',
    r->>'project_types',
    NULLIF(r->>'confidence_level', '')::int,
    NULLIF(r->>'estimated_closing_date', '')::date,
    COALESCE(r->'units', '[]'::jsonb),
    COALESCE(NULLIF(r->>'unit_count', '')::int, 0),
    COALESCE(NULLIF(r->>'quote_total', '')::numeric, 0),
    COALESCE(NULLIF(r->>'weighted_total', '')::numeric, 0),
    now()
  FROM jsonb_array_elements(p_rows) AS r;

  INSERT INTO projected_sales_sync (
    id, last_synced_at, source_count, unique_count, total_quote,
    weighted_total, duration_ms, status, error, synced_by
  )
  VALUES (
    TRUE,
    now(),
    NULLIF(p_meta->>'source_count', '')::int,
    NULLIF(p_meta->>'unique_count', '')::int,
    NULLIF(p_meta->>'total_quote', '')::numeric,
    NULLIF(p_meta->>'weighted_total', '')::numeric,
    NULLIF(p_meta->>'duration_ms', '')::int,
    p_meta->>'status',
    p_meta->>'error',
    p_meta->>'synced_by'
  )
  ON CONFLICT (id) DO UPDATE SET
    last_synced_at = EXCLUDED.last_synced_at,
    source_count   = EXCLUDED.source_count,
    unique_count   = EXCLUDED.unique_count,
    total_quote    = EXCLUDED.total_quote,
    weighted_total = EXCLUDED.weighted_total,
    duration_ms    = EXCLUDED.duration_ms,
    status         = EXCLUDED.status,
    error          = EXCLUDED.error,
    synced_by      = EXCLUDED.synced_by;
END;
$$;
