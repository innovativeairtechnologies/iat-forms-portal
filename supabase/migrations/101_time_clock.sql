-- ─── Time clock: punches, job segments and a site geofence ───────────────────
--
-- Hourly staff clock in from their phone at the office. The whole interaction has
-- to fit in the walk from the door to the bench, so the model is built around ONE
-- open shift and ONE open segment per person — every button is a single write and
-- the UI never has to ask "which of these did you mean?".
--
-- ⚠️ THE JOB IS NOT ON THE PUNCH. It was tempting to put job_number on the shift,
-- but somebody who touches four jobs before lunch would then be recorded against
-- whichever one they happened to name at 6:58am. Job time is a SEGMENT that tiles
-- the shift instead: switching jobs closes the open segment and opens the next,
-- without clocking anybody out. Time nobody attributed is a segment with a null
-- job_number — visible as "unallocated" rather than silently folded into the last
-- job named.

-- ── Employee fields the clock needs ──────────────────────────────────────────
-- employee_number is what QuickBooks keys on; is_hourly is who the clock is FOR.
-- Both nullable/defaulted so no existing row breaks.
ALTER TABLE employees ADD COLUMN IF NOT EXISTS employee_number text;
ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_hourly boolean NOT NULL DEFAULT false;

-- Partial, so the twelve rows with no number yet do not collide on NULL.
CREATE UNIQUE INDEX IF NOT EXISTS employees_employee_number_key
  ON employees (employee_number) WHERE employee_number IS NOT NULL;

-- ── The site, and how strict the fence is ────────────────────────────────────
-- One row, admin-editable, so tightening the radius never needs a deploy.
--
-- ⚠️ THE SEEDED COORDINATE IS A GEOCODE, NOT A SURVEY. 33.6352081,-83.8343350 is
-- OpenStreetMap's exact street-address match for 16200 Georgia Peach Ave (the
-- address in lib/company.ts), captured 2026-09-04. It puts the pin on the
-- building, but a 300m radius is deliberately generous because phone GPS indoors
-- and beside metal is poor. /admin/time-clock has "Set from where I'm standing" —
-- do that once from the shop floor and the radius can come down.
CREATE TABLE IF NOT EXISTS time_clock_settings (
  id                boolean PRIMARY KEY DEFAULT true CHECK (id),
  site_label        text NOT NULL DEFAULT 'IAT — Covington',
  lat               double precision NOT NULL,
  lng               double precision NOT NULL,
  radius_m          integer NOT NULL DEFAULT 300,
  -- A fix worse than this is not evidence of anything, so it is refused rather
  -- than being quietly treated as "inside". Indoors on a warehouse floor, 100m
  -- accuracy is common; 250 leaves room without accepting a city-block guess.
  max_accuracy_m    integer NOT NULL DEFAULT 250,
  enforce_geofence  boolean NOT NULL DEFAULT true,
  updated_at        timestamptz NOT NULL DEFAULT now(),
  updated_by        uuid
);

INSERT INTO time_clock_settings (id, site_label, lat, lng, radius_m, max_accuracy_m, enforce_geofence)
VALUES (true, 'IAT — Covington', 33.6352081, -83.8343350, 300, 250, true)
ON CONFLICT (id) DO NOTHING;

-- ── Shifts: one clock-in → clock-out ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS time_shifts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id       uuid NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  started_at        timestamptz NOT NULL DEFAULT now(),
  ended_at          timestamptz,
  -- Where they were standing, kept for both ends. distance_m is computed on the
  -- SERVER from the settings row; the browser never gets to assert "I'm inside".
  start_lat         double precision,
  start_lng         double precision,
  start_accuracy_m  double precision,
  start_distance_m  double precision,
  end_lat           double precision,
  end_lng           double precision,
  end_accuracy_m    double precision,
  end_distance_m    double precision,
  source            text NOT NULL DEFAULT 'web' CHECK (source IN ('web', 'qr', 'admin')),
  -- An admin correction is never silently indistinguishable from a real punch.
  edited_by         uuid,
  edit_note         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

-- 🔴 ONE OPEN SHIFT PER PERSON, enforced by the database rather than by a check
-- in the route. Two phones, or a double-tap on a slow connection, would otherwise
-- open two shifts and every hour after that would be counted twice.
CREATE UNIQUE INDEX IF NOT EXISTS time_shifts_one_open_per_employee
  ON time_shifts (employee_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS time_shifts_employee_started_idx
  ON time_shifts (employee_id, started_at DESC);

-- ── Segments: what the shift was SPENT on ────────────────────────────────────
-- work | lunch | break. Lunch is unpaid and is excluded from job totals; it is a
-- segment rather than a pair of columns so a second lunch, or a split lunch, does
-- not need a schema change.
CREATE TABLE IF NOT EXISTS time_segments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id     uuid NOT NULL REFERENCES time_shifts(id) ON DELETE CASCADE,
  kind         text NOT NULL DEFAULT 'work' CHECK (kind IN ('work', 'lunch', 'break')),
  -- Free text on purpose: job numbers come from outside this system and a foreign
  -- key to a table we do not own would reject the very numbers we need to record.
  job_number   text,
  started_at   timestamptz NOT NULL DEFAULT now(),
  ended_at     timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS time_segments_one_open_per_shift
  ON time_segments (shift_id) WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS time_segments_shift_idx ON time_segments (shift_id, started_at);
CREATE INDEX IF NOT EXISTS time_segments_job_idx   ON time_segments (job_number) WHERE job_number IS NOT NULL;

-- ── Refused attempts ─────────────────────────────────────────────────────────
-- 🔴 A geofence that silently refuses is indistinguishable from a broken app, and
-- the person it refuses is standing at work unable to get paid. Every refusal is
-- recorded with its distance so /admin/time-clock can show "3 people refused at
-- 340m" — which is how a badly-placed pin gets found instead of endured.
CREATE TABLE IF NOT EXISTS time_clock_denials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  employee_id   uuid REFERENCES employees(id) ON DELETE SET NULL,
  attempted_at  timestamptz NOT NULL DEFAULT now(),
  action        text NOT NULL,
  lat           double precision,
  lng           double precision,
  accuracy_m    double precision,
  distance_m    double precision,
  reason        text NOT NULL
);

CREATE INDEX IF NOT EXISTS time_clock_denials_recent_idx ON time_clock_denials (attempted_at DESC);

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Enabled with NO policies: every read and write goes through server routes on
-- the service role, the same shape as the rest of the portal's staff tables. An
-- anon or authenticated client gets nothing directly.
ALTER TABLE time_clock_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_shifts         ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_segments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE time_clock_denials  ENABLE ROW LEVEL SECURITY;
