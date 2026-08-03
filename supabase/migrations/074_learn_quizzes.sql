-- ─────────────────────────────────────────────────────────────────────────────
-- 074_learn_quizzes.sql — IAT Learn quizzes, AI-drafted and human-approved
--
-- The one Phase-2 gamification piece never built, and the last thing standing
-- between /admin/learn and the reference design it was rebuilt from (the
-- "Tests Passed / Average Score" tiles become real).
--
--  • learn_quizzes — one quiz per SCOPE. Scope is polymorphic so the same
--    machinery serves both "quiz at the end of this subject" and "capstone quiz
--    at the end of this category":
--        scope_type = 'module'   → scope_id references learn_modules(id)
--        scope_type = 'category' → scope_id references learn_categories(id)
--    There is deliberately NO composite FK (Postgres can't point one column at
--    two tables); referential integrity is enforced by the two triggers below,
--    which also cascade the delete. A partial unique index gives one quiz per
--    scope.
--
--    Status ladder: draft → published. NOTHING Claude writes reaches a learner
--    unpublished — same human-in-the-loop posture as case studies (072) and
--    Jerry's ticket drafts.
--
--    generated_meta records how a draft was produced (model, when, which
--    lessons it read, how many characters it had to work with) so a bad quiz
--    can be traced back to thin source content rather than guessed at.
--
--  • learn_quiz_questions / learn_quiz_options — the questions and their
--    choices. `source_lesson_id` on a question is the lesson the generator
--    claims it came from — the anti-fabrication hook, so a reviewer can jump
--    straight to the text and check the answer key. ON DELETE SET NULL, so
--    deleting a lesson doesn't take a reviewed question with it.
--
--  • learn_quiz_attempts / learn_quiz_answers — one row per sit, plus the
--    chosen option per question so a learner can review what they got wrong.
--    Pass mark is stored ON THE QUIZ (pass_pct, default 80) rather than assumed
--    in code, so changing the bar later doesn't silently re-grade history:
--    attempts keep the `passed` they were graded against.
--
-- GATING: a subject with a PUBLISHED quiz is only complete once that quiz is
-- passed (Jacob's call). Subjects without a published quiz complete on lessons
-- alone, so adding a quiz never strands anyone retroactively — see
-- lib/learn-quiz.ts. Category quizzes are capstones and gate nothing.
--
-- NO NEW PERMISSION. Authoring rides the existing `learn_admin` perm
-- (/admin/learn-content); taking a quiz is open to every staff role, like the
-- rest of /admin/learn. So there is no role_permissions seed here and
-- scripts/check-perm-seed.mjs stays green.
--
-- Apply via Supabase CLI (npx supabase db push).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Quizzes ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learn_quizzes (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type     TEXT        NOT NULL CHECK (scope_type IN ('module', 'category')),
  scope_id       UUID        NOT NULL,
  title          TEXT        NOT NULL,
  description    TEXT,
  -- Percentage needed to pass, 1–100. Stored per-quiz so the bar is data, not
  -- a constant buried in scoring code.
  pass_pct       INT         NOT NULL DEFAULT 80 CHECK (pass_pct BETWEEN 1 AND 100),
  is_published   BOOLEAN     NOT NULL DEFAULT FALSE,
  -- {model, generated_at, lesson_ids[], source_chars, question_count}
  generated_meta JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- One quiz per scope.
CREATE UNIQUE INDEX IF NOT EXISTS learn_quizzes_scope_uniq
  ON learn_quizzes (scope_type, scope_id);

-- ── Questions ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learn_quiz_questions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id          UUID        NOT NULL REFERENCES learn_quizzes(id) ON DELETE CASCADE,
  prompt           TEXT        NOT NULL,
  -- Shown after submitting, so a wrong answer teaches something.
  explanation      TEXT,
  -- Which lesson the generator drew this from. SET NULL (not CASCADE): deleting
  -- a lesson must not silently delete a human-reviewed question.
  source_lesson_id UUID        REFERENCES learn_lessons(id) ON DELETE SET NULL,
  display_order    INT         NOT NULL DEFAULT 0,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learn_quiz_options (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID        NOT NULL REFERENCES learn_quiz_questions(id) ON DELETE CASCADE,
  label         TEXT        NOT NULL,
  is_correct    BOOLEAN     NOT NULL DEFAULT FALSE,
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Attempts ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learn_quiz_attempts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  quiz_id      UUID        NOT NULL REFERENCES learn_quizzes(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  score        INT         NOT NULL CHECK (score >= 0),
  total        INT         NOT NULL CHECK (total > 0),
  -- Graded at submit time against the quiz's pass_pct AS IT WAS THEN. Raising
  -- the bar later must not retroactively fail a past attempt.
  passed       BOOLEAN     NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learn_quiz_answers (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  attempt_id  UUID NOT NULL REFERENCES learn_quiz_attempts(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES learn_quiz_questions(id) ON DELETE CASCADE,
  option_id   UUID          REFERENCES learn_quiz_options(id) ON DELETE SET NULL,
  is_correct  BOOLEAN NOT NULL,
  UNIQUE (attempt_id, question_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS learn_quiz_questions_quiz  ON learn_quiz_questions (quiz_id, display_order);
CREATE INDEX IF NOT EXISTS learn_quiz_options_q       ON learn_quiz_options (question_id, display_order);
CREATE INDEX IF NOT EXISTS learn_quiz_attempts_user   ON learn_quiz_attempts (user_id, quiz_id);
CREATE INDEX IF NOT EXISTS learn_quiz_attempts_quiz   ON learn_quiz_attempts (quiz_id);
CREATE INDEX IF NOT EXISTS learn_quiz_answers_attempt ON learn_quiz_answers (attempt_id);

-- ── Polymorphic scope integrity ──────────────────────────────────────────────
-- A single FK can't target two tables, so validate on write and cascade on
-- delete. Without these, deleting a subject would leave an orphan quiz that
-- still gates nothing but shows up in admin lists.

CREATE OR REPLACE FUNCTION learn_quiz_scope_check()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.scope_type = 'module' THEN
    IF NOT EXISTS (SELECT 1 FROM learn_modules WHERE id = NEW.scope_id) THEN
      RAISE EXCEPTION 'learn_quizzes.scope_id % is not a learn_modules row', NEW.scope_id;
    END IF;
  ELSIF NEW.scope_type = 'category' THEN
    IF NOT EXISTS (SELECT 1 FROM learn_categories WHERE id = NEW.scope_id) THEN
      RAISE EXCEPTION 'learn_quizzes.scope_id % is not a learn_categories row', NEW.scope_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS learn_quiz_scope_check_trg ON learn_quizzes;
CREATE TRIGGER learn_quiz_scope_check_trg
  BEFORE INSERT OR UPDATE OF scope_type, scope_id ON learn_quizzes
  FOR EACH ROW EXECUTE FUNCTION learn_quiz_scope_check();

CREATE OR REPLACE FUNCTION learn_quiz_cascade_module()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM learn_quizzes WHERE scope_type = 'module' AND scope_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS learn_quiz_cascade_module_trg ON learn_modules;
CREATE TRIGGER learn_quiz_cascade_module_trg
  AFTER DELETE ON learn_modules
  FOR EACH ROW EXECUTE FUNCTION learn_quiz_cascade_module();

CREATE OR REPLACE FUNCTION learn_quiz_cascade_category()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM learn_quizzes WHERE scope_type = 'category' AND scope_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS learn_quiz_cascade_category_trg ON learn_categories;
CREATE TRIGGER learn_quiz_cascade_category_trg
  AFTER DELETE ON learn_categories
  FOR EACH ROW EXECUTE FUNCTION learn_quiz_cascade_category();

-- updated_at, same helper 014 installed for the rest of Learn.
DROP TRIGGER IF EXISTS touch_learn_quizzes ON learn_quizzes;
CREATE TRIGGER touch_learn_quizzes
  BEFORE UPDATE ON learn_quizzes
  FOR EACH ROW EXECUTE FUNCTION touch_learn_updated_at();

-- ── Row-Level Security ───────────────────────────────────────────────────────
-- Mirrors 014: authenticated users read, admins manage. Every app read goes
-- through the service role, so this is defence in depth.
--
-- ⚠️ learn_quiz_options is the exception: it holds `is_correct`, i.e. THE ANSWER
-- KEY. It gets NO read policy — service-role only — so the key can never be
-- pulled client-side by an authenticated learner. The take-quiz route strips
-- is_correct before sending questions to the browser and grades server-side.

ALTER TABLE learn_quizzes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_quiz_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_quiz_options   ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_quiz_attempts  ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_quiz_answers   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learn_quizzes_read  ON learn_quizzes;
DROP POLICY IF EXISTS learn_quizzes_admin ON learn_quizzes;
CREATE POLICY learn_quizzes_read  ON learn_quizzes FOR SELECT TO authenticated USING (is_published);
CREATE POLICY learn_quizzes_admin ON learn_quizzes FOR ALL    TO authenticated
  USING (is_learn_admin()) WITH CHECK (is_learn_admin());

DROP POLICY IF EXISTS learn_quiz_questions_read  ON learn_quiz_questions;
DROP POLICY IF EXISTS learn_quiz_questions_admin ON learn_quiz_questions;
CREATE POLICY learn_quiz_questions_read  ON learn_quiz_questions FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM learn_quizzes q WHERE q.id = quiz_id AND q.is_published));
CREATE POLICY learn_quiz_questions_admin ON learn_quiz_questions FOR ALL TO authenticated
  USING (is_learn_admin()) WITH CHECK (is_learn_admin());

-- Answer key: admin-only. No read policy for plain authenticated users.
DROP POLICY IF EXISTS learn_quiz_options_admin ON learn_quiz_options;
CREATE POLICY learn_quiz_options_admin ON learn_quiz_options FOR ALL TO authenticated
  USING (is_learn_admin()) WITH CHECK (is_learn_admin());

-- Attempts: a learner reads their own; admins read all.
DROP POLICY IF EXISTS learn_quiz_attempts_own   ON learn_quiz_attempts;
DROP POLICY IF EXISTS learn_quiz_attempts_admin ON learn_quiz_attempts;
CREATE POLICY learn_quiz_attempts_own   ON learn_quiz_attempts FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY learn_quiz_attempts_admin ON learn_quiz_attempts FOR ALL TO authenticated
  USING (is_learn_admin()) WITH CHECK (is_learn_admin());

DROP POLICY IF EXISTS learn_quiz_answers_own   ON learn_quiz_answers;
DROP POLICY IF EXISTS learn_quiz_answers_admin ON learn_quiz_answers;
CREATE POLICY learn_quiz_answers_own   ON learn_quiz_answers FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM learn_quiz_attempts a WHERE a.id = attempt_id AND a.user_id = auth.uid()));
CREATE POLICY learn_quiz_answers_admin ON learn_quiz_answers FOR ALL TO authenticated
  USING (is_learn_admin()) WITH CHECK (is_learn_admin());

-- ── Verify (run after applying) ──────────────────────────────────────────────
--   SELECT table_name FROM information_schema.tables
--    WHERE table_name LIKE 'learn_quiz%' ORDER BY 1;
--     -- expect 5: learn_quiz_answers, learn_quiz_attempts, learn_quiz_options,
--     --           learn_quiz_questions, learn_quizzes
--   SELECT tablename, COUNT(*) FROM pg_policies
--    WHERE tablename LIKE 'learn_quiz%' GROUP BY 1 ORDER BY 1;
--     -- learn_quiz_options must have exactly 1 (admin) — no learner read.
