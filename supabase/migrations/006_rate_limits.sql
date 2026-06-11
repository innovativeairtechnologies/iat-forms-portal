-- ─────────────────────────────────────────────────────────────────────────────
-- 006_rate_limits.sql
-- Fixed-window rate limiting for the public write endpoints
-- (/api/submit, /api/tickets, /api/tickets/status).
--
-- One row per limiter key ('route:ip'), reused across windows via upsert, so
-- the table stays small (distinct IPs × routes — no unbounded growth). Checked
-- atomically through check_rate_limit() below, called by lib/rate-limit.ts
-- with the service-role key. The app fails OPEN if this function is missing or
-- errors, so deploying code before running this migration cannot break
-- submissions — it just means no limiting until the migration runs.
--
-- RLS is enabled with NO policies: anon/authenticated clients cannot touch
-- this table at all (service role bypasses RLS).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS rate_limits (
  key          TEXT        PRIMARY KEY,   -- e.g. 'tickets:203.0.113.7'
  window_start TIMESTAMPTZ NOT NULL,
  count        INTEGER     NOT NULL
);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only

CREATE OR REPLACE FUNCTION check_rate_limit(p_key TEXT, p_max INTEGER, p_window_seconds INTEGER)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Single upsert = atomic under concurrency. If the stored window has
  -- expired, restart it at 1; otherwise increment.
  INSERT INTO rate_limits AS rl (key, window_start, count)
  VALUES (p_key, NOW(), 1)
  ON CONFLICT (key) DO UPDATE SET
    count = CASE
      WHEN rl.window_start < NOW() - MAKE_INTERVAL(secs => p_window_seconds) THEN 1
      ELSE rl.count + 1
    END,
    window_start = CASE
      WHEN rl.window_start < NOW() - MAKE_INTERVAL(secs => p_window_seconds) THEN NOW()
      ELSE rl.window_start
    END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max;
END;
$$;

-- Belt and braces: only the service role should be able to call this.
REVOKE EXECUTE ON FUNCTION check_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC, anon, authenticated;
