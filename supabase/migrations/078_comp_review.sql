-- ─────────────────────────────────────────────────────────────────────────────
-- 078_comp_review.sql — Annual compensation review (/admin/comp-review)
--
-- The merit-increase model, ported from the "Sample Annual Review Spreadsheet"
-- workbook that has run the annual review off Crystal's desktop. The spreadsheet's
-- math is kept exactly (see lib/comp-review.ts, where every formula quotes its
-- workbook original), and the parts Excel could not do become the reason this
-- lives in the portal: one shared copy behind a permission, a real audit trail
-- via updated_at, cycles kept year over year instead of a file copied and
-- renamed, and totals that span every row rather than the 15 the workbook's
-- `I40 =SUM(I3:I17)` actually summed.
--
-- ── Two tables ───────────────────────────────────────────────────────────────
--  • comp_cycles       — one review year, plus the four constants its math uses.
--  • comp_review_lines — one person in that year: the four typed inputs, a score,
--                        and notes.
--
-- The computed columns (the workbook's G, H, I, J, N, O) are deliberately NOT
-- stored. They are pure functions of the inputs plus the cycle constants and live
-- in lib/comp-review.ts, so changing the model is one edit there rather than a
-- backfill of every historical row — the rep_scorecards precedent (075).
--
-- ── Why the constants are columns, not literals ──────────────────────────────
-- The workbook hardcodes 4.1, 48, 40 and 52. Two of those are contested — the
-- 4.1 pool contradicts its own column header ("% of 3.4% Raise"), and the /48
-- divisor makes every raise ~2.08x what the pool figure implies (an average
-- performer lands on 8.54%, not 4.1%). Jacob reviewed both and chose to ship the
-- workbook's behaviour unchanged, so the DEFAULTS below reproduce it exactly.
-- Keeping them as columns means settling either question later is a row update
-- rather than a deploy, and a past cycle always recomputes with ITS constants —
-- tuning next year never rewrites last year's record.
--
-- ── The one intentional divergence ───────────────────────────────────────────
-- The workbook's relative-score denominator was a hardcoded 3.5 (its own header
-- reads "% of Avg score ()", parens left empty) with a one-row override at N7
-- (=F7/2.47). Here it is the live mean of every score recorded in the cycle. That
-- makes each row depend on all the others, which is right while a cycle is being
-- worked and wrong once it is signed off — hence `status` and `avg_score_final`:
-- finalizing snapshots the average so a closed year stops moving.
--
-- ── Access ───────────────────────────────────────────────────────────────────
-- This is the most sensitive table in the portal — it is everyone's pay. RLS on,
-- NO policies: service-role only, same posture as 062/068/075. The app gates it
-- with requireCompReviewAuth on the NEW `compensation` perm, and the route is
-- mapped in ADMIN_PATH_PERMS. That mapping is mandatory, not cosmetic: an
-- unmapped /admin/* path falls back to the `dashboard` perm, which five scoped
-- roles hold, so omitting it would OPEN this page rather than fail closed.
--
-- Apply via Supabase CLI (npx supabase db push).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── comp_cycles ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comp_cycles (
  id     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- One cycle per year — the workbook's D1 ("2026"). UNIQUE so /admin/comp-review
  -- can address a cycle by ?year= without an ambiguity check.
  year   integer NOT NULL UNIQUE CHECK (year BETWEEN 2000 AND 2100),
  label  text,

  -- 'draft' while scores are being entered, 'final' once signed off. Text with a
  -- CHECK rather than an enum, matching the house style for small closed sets.
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'final')),

  -- ── The workbook's four constants ──────────────────────────────────────────
  -- Defaults ARE the workbook's literals. Changing one changes every unfinalized
  -- number on the page, which is the point.
  raise_pool     numeric(6,3) NOT NULL DEFAULT 4.1 CHECK (raise_pool >= 0),   -- O: =N3*4.1
  divisor        numeric(8,3) NOT NULL DEFAULT 48  CHECK (divisor > 0),       -- H: =C3*(G3/48)
  hours_per_week numeric(6,2) NOT NULL DEFAULT 40  CHECK (hours_per_week > 0),-- I: =J3*40*52
  weeks_per_year numeric(6,2) NOT NULL DEFAULT 52  CHECK (weeks_per_year > 0),

  -- Set ONLY when status flips to 'final' — the frozen denominator. Null while
  -- draft, when the average is computed live from the lines.
  avg_score_final numeric(8,4) CHECK (avg_score_final > 0),

  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  -- A finalized cycle must carry the average it was finalized with, or the model
  -- silently falls back to a live one and the "frozen" promise is a lie.
  CONSTRAINT comp_cycles_final_has_avg
    CHECK (status <> 'final' OR avg_score_final IS NOT NULL)
);

-- ── comp_review_lines ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comp_review_lines (
  id       uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES comp_cycles(id) ON DELETE CASCADE,

  -- NULLABLE on purpose: employees.id is FK'd to auth.users(id), so a row there
  -- requires a portal login. The review roster includes people who may not have
  -- one (the workbook lists two by first name only). A line without a link is
  -- still a valid line; person_name always carries the name.
  employee_id uuid REFERENCES employees(id) ON DELETE SET NULL,

  -- Stored even when employee_id is set: this is the name AS REVIEWED, and a
  -- later rename in the employees table must not silently rewrite a past cycle.
  person_name text NOT NULL CHECK (length(trim(person_name)) > 0),

  -- Workbook column B, which was inconsistent free text ("6 m", "7 y", "11y")
  -- and blank on several rows. Normally derived from employees.hire_date; this
  -- is the override for people with no hire date on file.
  tenure_override text,

  -- ── The four typed inputs (workbook C, D, E, F) ────────────────────────────
  -- per_hour and gross_annual are BOTH optional and both nullable: employees are
  -- one or the other, and the UI must not force a fake hourly rate onto salaried
  -- staff. numeric(*) arrives from PostgREST as a STRING — lib/comp-review.ts
  -- coerces at the edge with num(). Dollars stay exact rather than riding float.
  per_hour     numeric(10,4) CHECK (per_hour >= 0),      -- C
  gross_annual numeric(14,2) CHECK (gross_annual >= 0),  -- D
  bonus        numeric(14,2) CHECK (bonus >= 0),         -- E

  -- Workbook F — the score that drives everything. NULLABLE because "not yet
  -- reviewed" and "scored zero" are different facts, and lib/comp-review.ts
  -- excludes unscored lines from the average rather than counting them as 0.
  --
  -- NO UPPER BOUND, deliberately. Because the denominator is the mean of this
  -- same column, the model is scale-agnostic: 1–5, 1–10 and 0–100 all yield
  -- identical relative scores. Pinning a ceiling here would break a reviewer who
  -- scores out of 100 for no gain.
  score        numeric(8,3) CHECK (score >= 0),          -- F

  notes text,                                            -- L

  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One line per person per cycle. PARTIAL — employee_id is nullable, and NULLs
-- are distinct in a plain unique index, so unlinked lines would be free to
-- duplicate silently while linked ones were constrained.
CREATE UNIQUE INDEX IF NOT EXISTS comp_review_lines_cycle_employee_uniq
  ON comp_review_lines (cycle_id, employee_id)
  WHERE employee_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS comp_review_lines_cycle_idx ON comp_review_lines (cycle_id);

-- keep updated_at fresh on edits (per-table function, matching 062/068/075)
CREATE OR REPLACE FUNCTION set_comp_review_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS comp_cycles_set_updated_at ON comp_cycles;
CREATE TRIGGER comp_cycles_set_updated_at
  BEFORE UPDATE ON comp_cycles
  FOR EACH ROW EXECUTE FUNCTION set_comp_review_updated_at();

DROP TRIGGER IF EXISTS comp_review_lines_set_updated_at ON comp_review_lines;
CREATE TRIGGER comp_review_lines_set_updated_at
  BEFORE UPDATE ON comp_review_lines
  FOR EACH ROW EXECUTE FUNCTION set_comp_review_updated_at();

ALTER TABLE comp_cycles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE comp_review_lines ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)


-- ── Grant the perm. DO NOT SKIP — adding it to lib/roles.ts does NOTHING. ────
--
-- Once role_permissions has ANY rows, the code-side DEFAULT_ROLE_PERMS is dead:
-- lib/permissions.getPermMatrix() seeds every scoped role to [] and then fills
-- from the DB, so matrix[role] is always a non-null array and hasPermission()'s
-- `matrix?.[role] ?? DEFAULT_ROLE_PERMS[role]` never falls through. The code list
-- is only the fallback for an ERRORED or empty table. scripts/check-perm-seed.mjs
-- runs on prebuild and fails the build if this row and lib/roles.ts disagree.
--
-- HR only. Admin needs no row — hasPermission() short-circuits on role='admin'.
-- No other scoped role is granted: this is payroll.
INSERT INTO role_permissions (role, perm) VALUES
  ('hr', 'compensation')
ON CONFLICT (role, perm) DO NOTHING;


-- ── Verify (run after applying) ──────────────────────────────────────────────
--
-- 1. The perm actually landed. This is the one that fails silently — a missing
--    row means HR gets a 302 to /admin with no error anywhere:
--      SELECT role, array_agg(perm ORDER BY perm) FROM role_permissions GROUP BY role;
--      -- hr MUST include compensation, and NO other role may.
--
-- 2. Nobody but service_role can read pay. Both halves matter:
--      SELECT relname, relrowsecurity FROM pg_class
--        WHERE relname IN ('comp_cycles','comp_review_lines');   -- both true
--      SELECT count(*) FROM pg_policies
--        WHERE tablename IN ('comp_cycles','comp_review_lines'); -- must be 0
--
-- 3. The finalize guard holds:
--      UPDATE comp_cycles SET status='final' WHERE year=2026;    -- must ERROR
--      -- (avg_score_final has to be written in the same statement)
