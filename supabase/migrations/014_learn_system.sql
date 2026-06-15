-- ─────────────────────────────────────────────────────────────────────────────
-- 014_learn_system.sql
-- IAT Learn — internal training portal (Phase 1)
--
-- Replaces the company's Trainual database with a self-hosted, step-by-step
-- training system living at /learn inside the forms portal. Content is imported
-- from Trainual PDF exports (one Subject per PDF → one module; each step → one
-- lesson). Lesson bodies are stored as HTML (matches the existing TipTap
-- RichTextEditor, which round-trips HTML).
--
-- Hierarchy:  learn_categories → learn_modules → learn_lessons
-- Progress:   learn_progress (per-user, per-lesson) — schema only in Phase 1;
--             the gamification layer (points/leaderboards/streaks) builds on top
--             of this in Phase 2 without a re-architecture.
--
-- Reads happen server-side via the service role (like /employee resources), so
-- these RLS policies are a defense-in-depth net, not the primary access path.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Categories ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS learn_categories (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT        NOT NULL,
  slug          TEXT        NOT NULL UNIQUE,
  description   TEXT,
  icon          TEXT,                       -- lucide-react icon name (e.g. 'Rocket')
  accent        TEXT,                       -- optional accent hex for the category card
  display_order INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Modules (one per Trainual Subject / PDF) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS learn_modules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id   UUID        NOT NULL REFERENCES learn_categories(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  slug          TEXT        NOT NULL,
  description   TEXT,
  display_order INT         NOT NULL DEFAULT 0,
  is_published  BOOLEAN     NOT NULL DEFAULT TRUE,
  source_file   TEXT,                       -- provenance: original Trainual PDF filename
  import_status TEXT        NOT NULL DEFAULT 'imported'
                            CHECK (import_status IN ('imported', 'pending', 'partial')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (category_id, slug)
);

-- ── Lessons (one per step/page inside a Subject) ─────────────────────────────
CREATE TABLE IF NOT EXISTS learn_lessons (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id         UUID        NOT NULL REFERENCES learn_modules(id) ON DELETE CASCADE,
  title             TEXT        NOT NULL,
  slug              TEXT        NOT NULL,
  content           TEXT,                   -- HTML body (TipTap-compatible)
  display_order     INT         NOT NULL DEFAULT 0,
  is_published      BOOLEAN     NOT NULL DEFAULT TRUE,
  estimated_minutes INT         NOT NULL DEFAULT 3,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (module_id, slug)
);

-- ── Per-user progress (Phase 1: schema only, no UI yet) ──────────────────────
CREATE TABLE IF NOT EXISTS learn_progress (
  id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  lesson_id          UUID        NOT NULL REFERENCES learn_lessons(id) ON DELETE CASCADE,
  completed_at       TIMESTAMPTZ,
  time_spent_seconds INT         NOT NULL DEFAULT 0,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, lesson_id)
);

-- ── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_learn_modules_category ON learn_modules(category_id);
CREATE INDEX IF NOT EXISTS idx_learn_lessons_module   ON learn_lessons(module_id);
CREATE INDEX IF NOT EXISTS idx_learn_progress_user    ON learn_progress(user_id);
CREATE INDEX IF NOT EXISTS idx_learn_progress_lesson  ON learn_progress(lesson_id);

-- ── updated_at maintenance ───────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_learn_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_learn_lessons_touch ON learn_lessons;
CREATE TRIGGER trg_learn_lessons_touch
  BEFORE UPDATE ON learn_lessons
  FOR EACH ROW EXECUTE PROCEDURE touch_learn_updated_at();

DROP TRIGGER IF EXISTS trg_learn_progress_touch ON learn_progress;
CREATE TRIGGER trg_learn_progress_touch
  BEFORE UPDATE ON learn_progress
  FOR EACH ROW EXECUTE PROCEDURE touch_learn_updated_at();

-- ── Row-Level Security ───────────────────────────────────────────────────────
-- Helper: is the current auth user an admin? (mirrors the profiles.role check
-- used in middleware and lib/admin-auth.ts)
CREATE OR REPLACE FUNCTION is_learn_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles p
    WHERE p.id = auth.uid() AND p.role = 'admin'
  );
$$;

ALTER TABLE learn_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_modules    ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_lessons    ENABLE ROW LEVEL SECURITY;
ALTER TABLE learn_progress   ENABLE ROW LEVEL SECURITY;

-- Categories: any authenticated user can read; admins manage.
DROP POLICY IF EXISTS learn_categories_read   ON learn_categories;
DROP POLICY IF EXISTS learn_categories_admin  ON learn_categories;
CREATE POLICY learn_categories_read  ON learn_categories FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY learn_categories_admin ON learn_categories FOR ALL    TO authenticated
  USING (is_learn_admin()) WITH CHECK (is_learn_admin());

-- Modules: authenticated users read published rows; admins read/manage all.
DROP POLICY IF EXISTS learn_modules_read  ON learn_modules;
DROP POLICY IF EXISTS learn_modules_admin ON learn_modules;
CREATE POLICY learn_modules_read  ON learn_modules FOR SELECT TO authenticated
  USING (is_published OR is_learn_admin());
CREATE POLICY learn_modules_admin ON learn_modules FOR ALL TO authenticated
  USING (is_learn_admin()) WITH CHECK (is_learn_admin());

-- Lessons: authenticated users read published rows; admins read/manage all.
DROP POLICY IF EXISTS learn_lessons_read  ON learn_lessons;
DROP POLICY IF EXISTS learn_lessons_admin ON learn_lessons;
CREATE POLICY learn_lessons_read  ON learn_lessons FOR SELECT TO authenticated
  USING (is_published OR is_learn_admin());
CREATE POLICY learn_lessons_admin ON learn_lessons FOR ALL TO authenticated
  USING (is_learn_admin()) WITH CHECK (is_learn_admin());

-- Progress: a user owns their own rows; admins can read all (for Phase 2 reports).
DROP POLICY IF EXISTS learn_progress_own        ON learn_progress;
DROP POLICY IF EXISTS learn_progress_admin_read ON learn_progress;
CREATE POLICY learn_progress_own ON learn_progress FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY learn_progress_admin_read ON learn_progress FOR SELECT TO authenticated
  USING (is_learn_admin());
