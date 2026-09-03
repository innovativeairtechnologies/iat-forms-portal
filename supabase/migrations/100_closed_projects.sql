-- ─────────────────────────────────────────────────────────────────────────────
-- 100_closed_projects.sql — Closed (won) projects, mirrored from Dryware
--
-- GET dryware.dehumidifiers.com/api/Reporting/getClosedProjectsForExternalSystem
-- (confirmed LIVE 2026-07-xx — same DRYWARE_AUTH_HEADER as the open-projects feed,
-- see 059_projected_sales.sql). Per Danny Popov (Dryware dev): this endpoint is
-- WON-ONLY — lost projects carry a separate DryWare status and never appear here,
-- so a row's mere presence in this table means the deal was won. No status column
-- needed.
--
-- UNLIKE 059's projected_sales, this table is NEVER wiped and reloaded. Danny's
-- stated plan is to eventually stamp each closed project "exported" on his side
-- once we've picked it up, then only send the not-yet-exported ones — so this
-- feed is headed toward delta-only. A destructive replace here would permanently
-- lose any closed project that had already scrolled out of "unexported" by the
-- time we ran it. Ingestion MUST be additive: upsert_closed_projects() below only
-- INSERTs or UPDATEs by the upstream project_id, never DELETEs.
--
-- `imported_at` is set ONCE on first insert and never touched again — this is
-- exactly what Danny asked us to track ("if something does go wrong and we need
-- to re-export data, it will be easier to determine a cutoff point"): the oldest
-- imported_at we're missing tells him where a re-export needs to start from.
--
-- `closed_total` (not `quote_total`) is the authoritative dollar figure. Per
-- Danny: a unit can have multiple quote revisions, and `quoteTotal` reflects
-- whichever revision was most recently selected system-wide — not necessarily
-- the one actually used for the closed deal. `quote_total` is kept for
-- reference/audit only; anything that needs "what did this actually sell for"
-- must read `closed_total`.
--
-- Applied via the Supabase CLI (npx supabase … --linked), not the SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS closed_projects (
  project_id              bigint      PRIMARY KEY,  -- Dryware's own stable id — NOT ours, not generated
  user_name               text,
  company                 text,
  project_customer        text,
  project_name            text,
  date_created            date,        -- parsed from upstream "M/D/YYYY"
  contact                 text,
  project_types           text,
  confidence_level        integer,     -- carried over from the open feed; not authoritative on a closed deal
  estimated_closing_date  date,        -- nullable — seen absent on some closed projects
  actual_closing_date     date,
  units                   jsonb       NOT NULL DEFAULT '[]'::jsonb,  -- [{unitId,unitName,modelNumber,quoteTotal,closedTotal}]
  unit_count               integer     NOT NULL DEFAULT 0,
  quote_total              numeric     NOT NULL DEFAULT 0,  -- reference only — see note above
  closed_total             numeric     NOT NULL DEFAULT 0,  -- AUTHORITATIVE — use this, not quote_total
  imported_at              timestamptz NOT NULL DEFAULT now()  -- set once on INSERT; preserved on every later upsert
);

CREATE INDEX IF NOT EXISTS closed_projects_customer_idx ON closed_projects (project_customer);
CREATE INDEX IF NOT EXISTS closed_projects_user_idx     ON closed_projects (user_name);
CREATE INDEX IF NOT EXISTS closed_projects_actual_close_idx ON closed_projects (actual_closing_date);

ALTER TABLE closed_projects ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side), like projected_sales

-- One-row sync log, same shape/purpose as projected_sales_sync (059).
CREATE TABLE IF NOT EXISTS closed_projects_sync (
  id             boolean     PRIMARY KEY DEFAULT TRUE CHECK (id),
  last_synced_at timestamptz,
  fetched_count  integer,      -- rows the endpoint returned on the most recent call
  new_count      integer,      -- of those, how many were project_ids we hadn't seen before
  total_closed   numeric,      -- running SUM(closed_total) across the WHOLE table, not just this batch
  duration_ms    integer,
  status         text,         -- 'ok' | 'error' (of the last attempt)
  error          text,
  synced_by      text
);

ALTER TABLE closed_projects_sync ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only

-- Additive upsert: INSERT new project_ids, UPDATE existing ones in place, NEVER
-- delete. imported_at is deliberately absent from the DO UPDATE SET list, so a
-- project re-synced a second time keeps the timestamp of when we first recorded
-- it — that's the whole point (Danny's cutoff-point ask above).
--   p_rows: JSON array of derived closed-project rows (lib/dryware-closed.ts).
--   p_meta: JSON object of the sync-log fields (status 'ok', fetched_count, timing, …).
CREATE OR REPLACE FUNCTION upsert_closed_projects(p_rows jsonb, p_meta jsonb)
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_new_count    integer;
  v_total_closed numeric;
BEGIN
  SELECT count(*) INTO v_new_count
  FROM jsonb_array_elements(p_rows) AS r
  WHERE NOT EXISTS (
    SELECT 1 FROM closed_projects cp WHERE cp.project_id = (r->>'project_id')::bigint
  );

  INSERT INTO closed_projects (
    project_id, user_name, company, project_customer, project_name, date_created,
    contact, project_types, confidence_level, estimated_closing_date, actual_closing_date,
    units, unit_count, quote_total, closed_total
  )
  SELECT
    (r->>'project_id')::bigint,
    r->>'user_name',
    r->>'company',
    r->>'project_customer',
    r->>'project_name',
    NULLIF(r->>'date_created', '')::date,
    r->>'contact',
    r->>'project_types',
    NULLIF(r->>'confidence_level', '')::int,
    NULLIF(r->>'estimated_closing_date', '')::date,
    NULLIF(r->>'actual_closing_date', '')::date,
    COALESCE(r->'units', '[]'::jsonb),
    COALESCE(NULLIF(r->>'unit_count', '')::int, 0),
    COALESCE(NULLIF(r->>'quote_total', '')::numeric, 0),
    COALESCE(NULLIF(r->>'closed_total', '')::numeric, 0)
  FROM jsonb_array_elements(p_rows) AS r
  ON CONFLICT (project_id) DO UPDATE SET
    user_name              = EXCLUDED.user_name,
    company                = EXCLUDED.company,
    project_customer       = EXCLUDED.project_customer,
    project_name           = EXCLUDED.project_name,
    date_created            = EXCLUDED.date_created,
    contact                 = EXCLUDED.contact,
    project_types           = EXCLUDED.project_types,
    confidence_level        = EXCLUDED.confidence_level,
    estimated_closing_date  = EXCLUDED.estimated_closing_date,
    actual_closing_date     = EXCLUDED.actual_closing_date,
    units                   = EXCLUDED.units,
    unit_count              = EXCLUDED.unit_count,
    quote_total             = EXCLUDED.quote_total,
    closed_total            = EXCLUDED.closed_total;
    -- imported_at NOT listed here on purpose — preserved from first insert.

  SELECT sum(closed_total) INTO v_total_closed FROM closed_projects;

  INSERT INTO closed_projects_sync (
    id, last_synced_at, fetched_count, new_count, total_closed,
    duration_ms, status, error, synced_by
  )
  VALUES (
    TRUE,
    now(),
    NULLIF(p_meta->>'fetched_count', '')::int,
    v_new_count,
    v_total_closed,
    NULLIF(p_meta->>'duration_ms', '')::int,
    p_meta->>'status',
    p_meta->>'error',
    p_meta->>'synced_by'
  )
  ON CONFLICT (id) DO UPDATE SET
    last_synced_at = EXCLUDED.last_synced_at,
    fetched_count  = EXCLUDED.fetched_count,
    new_count      = EXCLUDED.new_count,
    total_closed   = EXCLUDED.total_closed,
    duration_ms    = EXCLUDED.duration_ms,
    status         = EXCLUDED.status,
    error          = EXCLUDED.error,
    synced_by      = EXCLUDED.synced_by;
END;
$$;
