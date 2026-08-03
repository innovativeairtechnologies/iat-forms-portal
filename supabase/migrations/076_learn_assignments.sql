-- ─────────────────────────────────────────────────────────────────────────────
-- 075_learn_assignments.sql — required training + completion reporting
--
-- The last item on the IAT Learn roadmap, and the real Trainual-parity feature:
-- assign a subject or a category to people with a due date, and see who has
-- actually done it.
--
--  • learn_assignments — ONE row per assignment. Two polymorphic axes:
--
--      WHAT   scope_type = 'module' | 'category'   (same pattern as 074)
--      WHO    audience_type = 'user' | 'role' | 'department' | 'everyone'
--             audience_value = user id / role / department name / NULL
--
--    The audience is DELIBERATELY NOT MATERIALISED into per-person rows. It is
--    resolved on read, so a new hire automatically inherits every 'role',
--    'department' and 'everyone' assignment the day their account is created —
--    which is the whole point of assigning by group. The cost is that reporting
--    resolves the audience each time; with 9 staff that is free.
--
--    Likewise there is no per-person "completed" column: completion is DERIVED
--    from learn_progress (+ a passed quiz where one is published), exactly as
--    the library pages compute it. One definition, in subjectIsComplete(), so
--    reporting can never drift from what the learner sees.
--
--    ⚠️ audience_type 'department' resolves against employees.department, which
--    is FREE TEXT and blank for 5 of 9 current staff. Such an assignment simply
--    reaches nobody. The admin UI shows the resolved head-count BEFORE saving so
--    that can't happen silently — do not remove that affordance.
--
--    due_on is nullable: "do this, no deadline" is a real thing to want.
--
-- Integrity: as in 074, Postgres can't FK one column at two tables, so a trigger
-- validates the scope and delete-triggers on learn_modules / learn_categories
-- cascade the assignment away with the thing it pointed at. A user-scoped
-- audience is cleaned up by a trigger on auth.users deletion.
--
-- NO NEW PERMISSION. Assigning and reporting live under /admin/learn-content,
-- already gated by `learn_admin` (admin-only, non-delegatable). Learners read
-- their own assignments through the service role. So no role_permissions seed
-- and scripts/check-perm-seed.mjs stays green.
--
-- Apply via Supabase CLI (npx supabase db push).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS learn_assignments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type     TEXT        NOT NULL CHECK (scope_type IN ('module', 'category')),
  scope_id       UUID        NOT NULL,
  audience_type  TEXT        NOT NULL CHECK (audience_type IN ('user', 'role', 'department', 'everyone')),
  -- NULL only for 'everyone'; enforced by the CHECK below.
  audience_value TEXT,
  due_on         DATE,
  note           TEXT,
  created_by     UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT learn_assignments_audience_value_ck CHECK (
    (audience_type = 'everyone' AND audience_value IS NULL)
    OR (audience_type <> 'everyone' AND audience_value IS NOT NULL AND length(trim(audience_value)) > 0)
  )
);

-- One assignment per (what, who). Two partial indexes because NULL never equals
-- NULL in a unique index — without the second, 'everyone' could be assigned to
-- the same scope any number of times.
CREATE UNIQUE INDEX IF NOT EXISTS learn_assignments_uniq
  ON learn_assignments (scope_type, scope_id, audience_type, audience_value)
  WHERE audience_value IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS learn_assignments_uniq_everyone
  ON learn_assignments (scope_type, scope_id)
  WHERE audience_type = 'everyone';

CREATE INDEX IF NOT EXISTS learn_assignments_scope    ON learn_assignments (scope_type, scope_id);
CREATE INDEX IF NOT EXISTS learn_assignments_audience ON learn_assignments (audience_type, audience_value);
CREATE INDEX IF NOT EXISTS learn_assignments_due      ON learn_assignments (due_on);

-- ── Scope integrity + cascade (mirrors 074) ──────────────────────────────────
CREATE OR REPLACE FUNCTION learn_assignment_scope_check()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.scope_type = 'module' THEN
    IF NOT EXISTS (SELECT 1 FROM learn_modules WHERE id = NEW.scope_id) THEN
      RAISE EXCEPTION 'learn_assignments.scope_id % is not a learn_modules row', NEW.scope_id;
    END IF;
  ELSIF NEW.scope_type = 'category' THEN
    IF NOT EXISTS (SELECT 1 FROM learn_categories WHERE id = NEW.scope_id) THEN
      RAISE EXCEPTION 'learn_assignments.scope_id % is not a learn_categories row', NEW.scope_id;
    END IF;
  END IF;

  -- A 'user' audience must point at a real account, or the assignment is a
  -- ghost that shows in reporting and reaches nobody.
  IF NEW.audience_type = 'user' THEN
    IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = NEW.audience_value::uuid) THEN
      RAISE EXCEPTION 'learn_assignments.audience_value % is not a profiles row', NEW.audience_value;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS learn_assignment_scope_check_trg ON learn_assignments;
CREATE TRIGGER learn_assignment_scope_check_trg
  BEFORE INSERT OR UPDATE OF scope_type, scope_id, audience_type, audience_value ON learn_assignments
  FOR EACH ROW EXECUTE FUNCTION learn_assignment_scope_check();

CREATE OR REPLACE FUNCTION learn_assignment_cascade_module()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM learn_assignments WHERE scope_type = 'module' AND scope_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS learn_assignment_cascade_module_trg ON learn_modules;
CREATE TRIGGER learn_assignment_cascade_module_trg
  AFTER DELETE ON learn_modules
  FOR EACH ROW EXECUTE FUNCTION learn_assignment_cascade_module();

CREATE OR REPLACE FUNCTION learn_assignment_cascade_category()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM learn_assignments WHERE scope_type = 'category' AND scope_id = OLD.id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS learn_assignment_cascade_category_trg ON learn_categories;
CREATE TRIGGER learn_assignment_cascade_category_trg
  AFTER DELETE ON learn_categories
  FOR EACH ROW EXECUTE FUNCTION learn_assignment_cascade_category();

-- A deleted account leaves its personal assignments behind otherwise: the FK
-- can't exist because audience_value is TEXT serving four audience kinds.
CREATE OR REPLACE FUNCTION learn_assignment_cascade_user()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  DELETE FROM learn_assignments WHERE audience_type = 'user' AND audience_value = OLD.id::text;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS learn_assignment_cascade_user_trg ON profiles;
CREATE TRIGGER learn_assignment_cascade_user_trg
  AFTER DELETE ON profiles
  FOR EACH ROW EXECUTE FUNCTION learn_assignment_cascade_user();

DROP TRIGGER IF EXISTS touch_learn_assignments ON learn_assignments;
CREATE TRIGGER touch_learn_assignments
  BEFORE UPDATE ON learn_assignments
  FOR EACH ROW EXECUTE FUNCTION touch_learn_updated_at();

-- ── Row-Level Security ───────────────────────────────────────────────────────
-- Authenticated users may read assignments (they need to see what is required
-- of them, and the row names a subject, not anything sensitive). Only admins
-- write. Every app read still goes through the service role.
ALTER TABLE learn_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS learn_assignments_read  ON learn_assignments;
DROP POLICY IF EXISTS learn_assignments_admin ON learn_assignments;
CREATE POLICY learn_assignments_read  ON learn_assignments FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY learn_assignments_admin ON learn_assignments FOR ALL    TO authenticated
  USING (is_learn_admin()) WITH CHECK (is_learn_admin());

-- ── Verify (run after applying) ──────────────────────────────────────────────
--   INSERT INTO learn_assignments (scope_type, scope_id, audience_type)
--     VALUES ('module', '00000000-0000-0000-0000-000000000000', 'everyone');
--     -- expect: ERROR ... is not a learn_modules row
--   INSERT INTO learn_assignments (scope_type, scope_id, audience_type, audience_value)
--     SELECT 'module', id, 'everyone', 'x' FROM learn_modules LIMIT 1;
--     -- expect: ERROR ... learn_assignments_audience_value_ck
