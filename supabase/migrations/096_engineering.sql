-- ─────────────────────────────────────────────────────────────────────────────
-- 096_engineering.sql — the Engineering section.
--
-- Replaces two monday.com boards (Submittals, LLI) and the "Engineering
-- Lead-Times" workbook with one place engineering works out of and leadership
-- reports on. Shape comes from three sources that agree with each other:
--
--   • the 2026-08-25 engineering meeting — five buckets (Submittals, Long-Lead
--     Items, BOM, Production/Design, Electrical Production), each broken into
--     sub-tasks, each sub-task carrying job number, assignee, due date and an
--     ahead/behind indicator with a day count.
--   • the whiteboard — the "Status Box" layout, and the progress-bar mechanic:
--     ticking a sub-task off advances a percentage, and the percentage is what
--     says whether the job is trending late.
--   • Engineering Lead-Times.xlsx — the target hours and cycle times per task,
--     and (on the Elec sheet) the completion PERCENTAGES that make the progress
--     bar real rather than decorative.
--
-- ── Two tables, not five ────────────────────────────────────────────────────
-- eng_jobs is the thing with a job number. eng_tasks is every unit of work,
-- whatever bucket it belongs to. The bucket is a COLUMN (`stream`), not a table,
-- because every question leadership asked in that meeting — who is behind, what
-- is unassigned, where did the week go — is a query ACROSS buckets. Five tables
-- would have made each of those a five-way union.
--
-- ── Why job_id is nullable ──────────────────────────────────────────────────
-- The workbook's biggest lesson is not on the highlighted rows. It is the rows
-- underneath: Sales Support, Training, R&D, Testing Support, Production
-- Cross-Check — the 20% of Monday-through-Wednesday that is not a production
-- package. "Worked 60 hours and accomplished little" is only answerable if that
-- work is IN the system. A task with no job_id is that work.
--
-- ── Hours that we do not know are NULL ──────────────────────────────────────
-- target_hours is null wherever the workbook says "TBD", "-", "See Master" or
-- "Must be scheduled". The UI prints "Not set". A plausible-looking invented
-- number would become the baseline every future variance is measured against,
-- and nobody would ever know it was made up. See lib/eng-playbook.ts.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Jobs ─────────────────────────────────────────────────────────────────────
-- job_number is the shop number the whole company already says out loud ("4153").
-- It is the identity here, so it is UNIQUE and it is what every screen leads with.
--
-- customer_name / model_number are SNAPSHOTS, not joins — same reasoning as
-- proposals(079) and soo(084). deal_id and customer_id are optional links for
-- when the job did come from a portal record; a job entered by hand on the day a
-- PO lands (which is the normal case) has neither and must still work completely.
CREATE TABLE IF NOT EXISTS eng_jobs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_number      text NOT NULL UNIQUE,
  customer_name   text NOT NULL DEFAULT '',
  project_name    text NOT NULL DEFAULT '',
  model_number    text,

  -- The monday Submittals board's Complexity column, which is what actually
  -- drives how long a submittal takes. Kept as its own field rather than folded
  -- into the playbook so the SAME playbook can produce a light or heavy plan.
  complexity      text NOT NULL DEFAULT 'std_minor'
                    CHECK (complexity IN ('new', 'std_major', 'std_minor')),

  -- ── The anchor ────────────────────────────────────────────────────────────
  -- Every generated due date is this date plus the playbook's cycle days. The
  -- meeting's example rule ("submittal due two weeks after PO") is exactly this
  -- and nothing else. NULL anchor ⇒ tasks generate with NO due dates rather than
  -- dates counted from today, because a job back-entered a month late would
  -- otherwise arrive with a fortnight of fake runway.
  po_date         date,
  ship_date       date,

  status          text NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'on_hold', 'complete', 'cancelled')),

  deal_id         uuid REFERENCES deals(id) ON DELETE SET NULL,
  customer_id     uuid REFERENCES customers(id) ON DELETE SET NULL,
  notes           text,

  created_by      uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS eng_jobs_status_idx   ON eng_jobs (status);
CREATE INDEX IF NOT EXISTS eng_jobs_po_idx       ON eng_jobs (po_date DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS eng_jobs_updated_idx  ON eng_jobs (updated_at DESC);

-- ── Tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS eng_tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),

  -- NULL = standing / support work with no job behind it. See the header.
  job_id          uuid REFERENCES eng_jobs(id) ON DELETE CASCADE,

  stream          text NOT NULL
                    CHECK (stream IN ('submittal', 'long_lead', 'bom', 'production', 'electrical', 'support')),
  -- The playbook step this came from, e.g. 'package_creation'. Free text (not a
  -- FK) because the playbook is editable content: renaming a step must not
  -- orphan the eight months of history keyed to it.
  step            text NOT NULL DEFAULT 'custom',
  -- Snapshotted from the playbook at generation time so editing the playbook
  -- never rewrites what a finished task said it was.
  title           text NOT NULL,

  assignee_id     uuid REFERENCES employees(id) ON DELETE SET NULL,

  status          text NOT NULL DEFAULT 'not_started'
                    CHECK (status IN ('not_started', 'in_progress', 'blocked', 'done', 'skipped')),

  -- ── The progress bar ──────────────────────────────────────────────────────
  -- 0–100. This is the whiteboard's mechanic and the Elec sheet's percentages:
  -- finishing the drawings puts a job at 30%, the BOM at 60%, programming at
  -- 99%, upload at 100%. It is ALSO the only input to the late projection (see
  -- lib/engineering.ts projectTask) — at 0 the projection is refused rather than
  -- guessed, which is why "in progress at 0%" and "not started" stay distinct.
  progress        smallint NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  -- Where this step lands the STREAM's overall bar when it completes. Null for
  -- streams the workbook gives no percentages for — the stream bar then falls
  -- back to an even split. Never invented per-step. See lib/eng-playbook.ts.
  progress_band   smallint CHECK (progress_band BETWEEN 0 AND 100),

  -- Target = the workbook's "Average Lead-Time" (hands-on hours the task SHOULD
  -- take). Actual = what it did take. The gap between them is the only honest
  -- answer to "are we getting faster", which is what the Submittals training
  -- board's milestones ("lead-times less than 4 hours", "less than 2 hours")
  -- are already asking for. NULL target = the workbook says TBD; do not fill in.
  target_hours    numeric(6,2),
  actual_hours    numeric(6,2),

  due_date        date,
  -- Set when the task first moves off not_started. Needed by the projection:
  -- without a real start, "40% done" cannot be turned into a finish date.
  started_at      timestamptz,
  completed_at    timestamptz,

  -- 1 = Production Packages … 5 = Sales Support, straight off the workbook's
  -- Priority column. 0 is reserved for its "Immediate" rows.
  priority        smallint NOT NULL DEFAULT 3 CHECK (priority BETWEEN 0 AND 9),
  sort_order      integer NOT NULL DEFAULT 0,

  blocked_reason  text,
  notes           text,

  -- Reminder stamps, same idiom as rfq_requests (088): a sweep that already
  -- chased this today must be a no-op on its second run. NOT proof of delivery —
  -- see lib/resend-engineering.ts.
  nudged_at       timestamptz,
  escalated_at    timestamptz,

  created_by      uuid REFERENCES employees(id) ON DELETE SET NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One row per (job, stream, step): regenerating a job's plan must be idempotent,
-- not additive. Partial, because job_id is nullable and standing support tasks
-- legitimately repeat ('support', 'sales_support', every week).
CREATE UNIQUE INDEX IF NOT EXISTS eng_tasks_job_step_uniq
  ON eng_tasks (job_id, stream, step) WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS eng_tasks_job_idx      ON eng_tasks (job_id);
CREATE INDEX IF NOT EXISTS eng_tasks_assignee_idx ON eng_tasks (assignee_id);
CREATE INDEX IF NOT EXISTS eng_tasks_stream_idx   ON eng_tasks (stream, status);
CREATE INDEX IF NOT EXISTS eng_tasks_due_idx      ON eng_tasks (due_date) WHERE status NOT IN ('done', 'skipped');
CREATE INDEX IF NOT EXISTS eng_tasks_updated_idx  ON eng_tasks (updated_at DESC);

-- ── The playbook ─────────────────────────────────────────────────────────────
-- Single row, id = 1, whole-blob JSON — the srv_config(046) / soo_library(084)
-- idiom. lib/eng-playbook.ts falls back to ENG_PLAYBOOK_DEFAULT in code when the
-- row is missing or unreadable, so job generation can never fail on a DB hiccup.
--
-- NOT versioned like soo_library. An SOO is a contract handed to a controls
-- contractor and re-read a year later; this is a schedule template whose whole
-- point is that James edits it as the department learns. Tasks snapshot their
-- title, hours and dates at generation, so editing the playbook never rewrites
-- history — which is what versioning would have been for.
CREATE TABLE IF NOT EXISTS eng_playbook (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  playbook    jsonb NOT NULL,
  updated_by  uuid REFERENCES employees(id) ON DELETE SET NULL,
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- ── updated_at triggers ──────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_eng_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eng_jobs_set_updated_at ON eng_jobs;
CREATE TRIGGER eng_jobs_set_updated_at
  BEFORE UPDATE ON eng_jobs FOR EACH ROW EXECUTE FUNCTION set_eng_updated_at();

DROP TRIGGER IF EXISTS eng_tasks_set_updated_at ON eng_tasks;
CREATE TRIGGER eng_tasks_set_updated_at
  BEFORE UPDATE ON eng_tasks FOR EACH ROW EXECUTE FUNCTION set_eng_updated_at();

DROP TRIGGER IF EXISTS eng_playbook_set_updated_at ON eng_playbook;
CREATE TRIGGER eng_playbook_set_updated_at
  BEFORE UPDATE ON eng_playbook FOR EACH ROW EXECUTE FUNCTION set_eng_updated_at();

-- ── started_at / completed_at are SERVER-set ────────────────────────────────
-- A trigger, not application code, because the honesty of every lead-time number
-- on the leadership report rests on these two timestamps, and there are already
-- four write paths into eng_tasks (detail form, board drag, bulk bar, job
-- regeneration). One of them forgetting to stamp a start would not error — it
-- would quietly produce a task that can never be projected, and a median that
-- silently excludes it.
CREATE OR REPLACE FUNCTION eng_task_stamp() RETURNS trigger AS $$
BEGIN
  -- First move off not_started sets the clock, and nothing resets it: a task
  -- bounced back from done still started when it started.
  IF NEW.status <> 'not_started' AND NEW.started_at IS NULL THEN
    NEW.started_at = now();
  END IF;

  IF NEW.status = 'done' THEN
    IF NEW.completed_at IS NULL THEN NEW.completed_at = now(); END IF;
    NEW.progress = 100;
  ELSIF TG_OP = 'UPDATE' AND OLD.status = 'done' AND NEW.status <> 'done' THEN
    -- Reopened. Clear the completion, and drop progress off 100 so the row does
    -- not read as finished-but-open. 99 rather than 0: the work was done once.
    NEW.completed_at = NULL;
    IF NEW.progress = 100 THEN NEW.progress = 99; END IF;
  END IF;

  IF NEW.status = 'not_started' THEN NEW.progress = 0; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS eng_tasks_stamp ON eng_tasks;
CREATE TRIGGER eng_tasks_stamp
  BEFORE INSERT OR UPDATE ON eng_tasks FOR EACH ROW EXECUTE FUNCTION eng_task_stamp();

-- ── RLS ──────────────────────────────────────────────────────────────────────
-- Service-role only, no policies — the posture every admin-surface table in this
-- app takes (deals 043, case_studies 072, proposals 079, soo 084). Access is
-- gated in-app by requireEngineeringAuth + ADMIN_PATH_PERMS.
ALTER TABLE eng_jobs     ENABLE ROW LEVEL SECURITY;
ALTER TABLE eng_tasks    ENABLE ROW LEVEL SECURITY;
ALTER TABLE eng_playbook ENABLE ROW LEVEL SECURITY;

-- ── Permission seed ──────────────────────────────────────────────────────────
-- `engineering_jobs`, NOT `engineering`. `engineering` is already a StaffRole,
-- and a perm sharing that name reads as "the engineering role's permission" —
-- the same collision production_board, tool_crib and marketing_calendar are all
-- named around.
--
-- Seeded for engineering (whose section this is) and production_manager. The
-- second is deliberate and was asked for in the meeting: "the system could alert
-- the ordering department as soon as a Bill of Materials is released." Ordering
-- is not a role; production_manager is who sits closest to it and already holds
-- scheduling and the production board.
--
-- Sales is NOT seeded. Sales asks engineering for things (the workbook's "Sales
-- Support" row is 20% of a mechanical engineer's Monday-to-Wednesday), and a
-- queue that the people generating the work can also re-prioritise is not an
-- accountability tool. Grant it per-person from /admin/permissions if wanted.
--
-- MUST mirror DEFAULT_ROLE_PERMS in lib/roles.ts — scripts/check-perm-seed.mjs
-- asserts the two agree, and once role_permissions has rows the code defaults
-- are dead at runtime, so this INSERT is what actually grants access.
INSERT INTO role_permissions (role, perm) VALUES
  ('engineering', 'engineering_jobs'),
  ('production_manager', 'engineering_jobs')
ON CONFLICT (role, perm) DO NOTHING;

-- ── Verify (run after applying) ──────────────────────────────────────────────
-- SELECT count(*) FROM eng_jobs;
-- SELECT stream, status, count(*) FROM eng_tasks GROUP BY 1, 2 ORDER BY 1, 2;
-- SELECT id, updated_at FROM eng_playbook;
-- SELECT role, perm FROM role_permissions WHERE perm = 'engineering_jobs';
