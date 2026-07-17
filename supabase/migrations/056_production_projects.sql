-- ─────────────────────────────────────────────────────────────────────────────
-- 056_production_projects.sql — first-class projects under each department
--
-- Extends the production board (055). Until now "project" was a free-text label
-- on each task, grouped at render time. This makes a project a real thing a
-- department CONTAINS: named, typed, with connected people and its own,
-- separately-tracked copy of the task list — so two builds ("Acme Unit A",
-- "Beta Unit B") that share a checklist can run side by side on one board
-- without their progress bleeding together.
--
--   • production_projects — one row per project under a department. `people` is
--     a display-only text[] of roster names ("who's on this build"); it does NOT
--     gate the assignee picker (that stays the whole department roster, by
--     product decision). `type` is free text (unit model, customer, 'R&D' …).
--
--   • production_tasks gains project_id + phase:
--       - project_id NULL  → a department-wide STANDING duty (unchanged meaning;
--         `isStanding` now keys off project_id, not the old `project` text).
--       - project_id set   → the task belongs to that project.
--       - phase → optional sub-heading inside a project ("Day 1", "Framing").
--         Blank = a flat list. Duplicating a project copies phases, so a 6-day
--         build sequence carries over intact.
--
-- The old production_tasks.project TEXT column is now DEPRECATED — kept so any
-- pre-056 row still renders under the old code path during a rollout, but new
-- code reads project_id + phase and never writes `project`.
--
-- SECURITY: production_projects is RLS-on / NO policies — service-role only,
-- exactly like every 055 table. The public board reads it server-side scoped by
-- the department the URL token resolves to; anon never touches it directly.
--
-- Idempotent. Run by hand in the Supabase SQL editor BEFORE deploying the 056
-- code (the board and /admin/production both query production_projects and will
-- 500 without it). No data migration here — the demo is re-seeded by
-- scripts/seed-production-board-demo.mjs into the new model.
-- ─────────────────────────────────────────────────────────────────────────────


CREATE TABLE IF NOT EXISTS production_projects (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid        NOT NULL REFERENCES production_departments(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  -- Free text on purpose (unit model / customer / 'warranty rebuild' / 'R&D').
  -- Hardening into a fixed dropdown later is a code change, not a migration.
  type          text,
  detail        text,
  -- Display-only: names shown on the board as "who's on this build". Chosen from
  -- the department roster but stored as text (snapshot) so a roster edit never
  -- silently rewrites a project's crew. Deliberately NOT an assignee gate —
  -- the task assignee picker stays the full roster (product decision).
  people        text[]      NOT NULL DEFAULT '{}',
  status        text        NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'complete')),
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Soft delete: archived projects (and their tasks) drop off every board but
  -- keep their check-off trail. Same posture as production_tasks.archived_at.
  archived_at   timestamptz
);

-- The board's per-department project query: active projects, in display order.
CREATE INDEX IF NOT EXISTS production_projects_dept_idx
  ON production_projects (department_id, archived_at, sort_order);


ALTER TABLE production_tasks
  -- ON DELETE CASCADE: a hard-deleted project takes its tasks (and, via 055's
  -- own cascade, their events) with it. Day-to-day we soft-delete (archived_at),
  -- so this only fires on a true purge.
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES production_projects(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS phase      text;

COMMENT ON COLUMN production_tasks.project IS
  'DEPRECATED since 056 — replaced by project_id (+ phase). Kept for pre-056 rows; new code never writes it.';

-- The board reads a project's tasks by (project_id, not archived, in order).
CREATE INDEX IF NOT EXISTS production_tasks_project_idx
  ON production_tasks (project_id, archived_at, sort_order);


-- ── Lockdown ─────────────────────────────────────────────────────────────────
ALTER TABLE production_projects ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies — service-role only, same as every 055 table. A read
-- policy here would expose project rows (and, joined, the department tokens they
-- hang off) over PostgREST to the anon key. Public page ≠ public table.


-- ── Verify (run after applying) ──────────────────────────────────────────────
--
-- 1. New table + columns exist:
--      SELECT column_name FROM information_schema.columns
--       WHERE table_name = 'production_tasks' AND column_name IN ('project_id','phase');
--      -- expect 2 rows
--      SELECT count(*) FROM production_projects;  -- expect 0 before the seed
--
-- 2. A task can hang off a project and cascade correctly:
--      -- create a throwaway project, attach a task, delete the project, confirm
--      -- the task went with it:
--      WITH d AS (SELECT id FROM production_departments ORDER BY sort_order LIMIT 1),
--           p AS (INSERT INTO production_projects (department_id, name)
--                 SELECT id, 'ZZ verify proj' FROM d RETURNING id)
--      INSERT INTO production_tasks (department_id, project_id, title)
--      SELECT (SELECT id FROM d), (SELECT id FROM p), 'ZZ verify task';
--      DELETE FROM production_projects WHERE name = 'ZZ verify proj';
--      SELECT count(*) FROM production_tasks WHERE title = 'ZZ verify task';  -- expect 0 (cascaded)
--
-- 3. anon cannot reach the new table directly (the whole security model):
--      SET ROLE anon; SELECT count(*) FROM production_projects; RESET ROLE;
--      -- expect permission denied / 0 rows
--
-- 4. Re-running this whole file changes nothing (idempotency):
--      SELECT count(*) FROM production_projects;  -- unchanged
