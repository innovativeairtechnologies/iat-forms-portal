-- ─────────────────────────────────────────────────────────────────────────────
-- 081_learn_sim_attempts.sql — graded simulator runs for the control panel course
--
-- The c.pCO panel course grades a trainee on whether they actually performed a
-- task on the simulated panel (set the BACnet device instance, take the reboot,
-- find the MAC address) — not on a multiple-choice answer. The quiz tables
-- can't express that: learn_quiz_questions has no type column and the publish
-- gate hard-requires exactly one correct option per question. So sim runs get
-- their own attempt table instead of bending the quiz schema.
--
--  • One row per (user, scenario), best attempt kept — mirroring how quiz
--    attempts keep the best score and `passed` stays sticky. scenario_id is a
--    TEXT key into lib/cpco/scenarios.ts, not an FK: scenarios are code, the
--    way SRV sections and badge types are, and gain nothing from a lookup
--    table until non-developers author them.
--
--  • keystrokes / optimal_keystrokes / wrong_screens are FEEDBACK, never a
--    pass condition. A trainee who wanders and gets there has done the job.
--
--  • Lesson completion (and therefore XP, streaks, badges and the assignments
--    compliance report) still flows through learn_progress exactly as it does
--    for a read lesson: the sim-attempt API upserts the attempt, and the
--    client then posts the lesson complete through /api/learn/progress. This
--    table is the evidence trail, not a parallel progress system.
--
-- NO NEW PERMISSION — recording an attempt is open to every signed-in staff
-- role like the rest of /admin/learn, so there is no role_permissions seed
-- here and scripts/check-perm-seed.mjs stays green.
--
-- Apply via Supabase CLI (npx supabase db push) — run `migration repair` first
-- if the CLI claims 059–063 are pending; they are live.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learn_sim_attempts (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Key into lib/cpco/scenarios.ts (e.g. 'bacnet-instance'). Length-capped
  -- because it arrives from the client.
  scenario_id        TEXT        NOT NULL CHECK (char_length(scenario_id) BETWEEN 1 AND 64),
  passed             BOOLEAN     NOT NULL DEFAULT FALSE,
  -- Best (fewest-press) passing run's numbers. Informative only.
  keystrokes         INT         NOT NULL CHECK (keystrokes >= 0),
  optimal_keystrokes INT         NOT NULL CHECK (optimal_keystrokes >= 0),
  -- Screens visited beyond the scenario's shortest path — the "wandering"
  -- number a coach might look at. Never graded.
  wrong_screens      INT         NOT NULL DEFAULT 0 CHECK (wrong_screens >= 0),
  attempts           INT         NOT NULL DEFAULT 1 CHECK (attempts >= 1),
  first_passed_at    TIMESTAMPTZ,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, scenario_id)
);

CREATE INDEX IF NOT EXISTS learn_sim_attempts_user ON learn_sim_attempts (user_id);
CREATE INDEX IF NOT EXISTS learn_sim_attempts_scenario ON learn_sim_attempts (scenario_id);

-- Same defence-in-depth posture as the rest of Learn: the app reads and writes
-- through the service role, RLS protects against a leaked anon key.
ALTER TABLE learn_sim_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learn_sim_attempts_own   ON learn_sim_attempts;
DROP POLICY IF EXISTS learn_sim_attempts_admin ON learn_sim_attempts;
CREATE POLICY learn_sim_attempts_own   ON learn_sim_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY learn_sim_attempts_admin ON learn_sim_attempts FOR ALL TO authenticated
  USING (is_learn_admin()) WITH CHECK (is_learn_admin());

-- ── Verify (run after applying) ──────────────────────────────────────────────
--   SELECT tablename, COUNT(*) FROM pg_policies
--    WHERE tablename = 'learn_sim_attempts' GROUP BY 1;
--     -- expect 2 policies (own read + admin all)
