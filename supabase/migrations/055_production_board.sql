-- ─────────────────────────────────────────────────────────────────────────────
-- 055_production_board.sql — the public, per-department production checklist
--
-- What this is: a shop-floor checklist the team opens by scanning a QR code.
-- NO LOGIN. The board lives at /board/<token>, outside the portal's auth gate
-- (middleware.ts's matcher is an allowlist and deliberately does not list it),
-- because the floor has no portal accounts and rolling out logins the week the
-- manager is away is not a plan.
--
-- Four tables:
--
--   • production_departments — Production / Fabrication / Electrical (seeded
--     below, editable at /admin/production — the list is data, not code, so
--     confirming the real department names never needs a deploy).
--
--   • production_people — the floor roster backing the board's "who are you?"
--     picker. DELIBERATELY NOT `employees`: that table is portal accounts (and
--     per lib/staff.ts every customer invite gets a row too), while the floor
--     has no accounts at all. Live data confirms it — of 12 employees rows, 4
--     are customers and 7 have a null department. These are names on a list, not
--     identities; they prove nothing and are not an auth boundary.
--
--   • production_tasks — one row per line on a board. `project` NULL means a
--     standing duty (safety walk); non-NULL means it hangs off a job. That's the
--     whole distinction — no separate table, because a board renders them
--     together and the only difference is a heading.
--
--   • production_task_events — append-only trail of every check-off. actor_name
--     is a SNAPSHOT (typed on the floor, unverified — see the security note).
--
-- Recurring tasks reset WITHOUT a cron: `done_on` stores the shop-local date a
-- task was completed, and a daily task is "done" only while done_on = today in
-- America/New_York (the house timezone — lib/learn-gamification.ts, admin-digest).
-- Nothing to schedule, nothing to fail overnight, and the board is correct the
-- moment it's read. See effectiveDone() in lib/production.ts — the ONE place
-- that rule lives.
--
-- ── SECURITY ────────────────────────────────────────────────────────────────
-- RLS on, NO policies — service-role only, same posture as gantt_charts (040),
-- deals (043) and tool_crib (050). "Public page" must NOT become "public table":
-- an anon SELECT policy here would expose production_departments over PostgREST,
-- so one `GET /rest/v1/production_departments` with the publishable anon key
-- would dump every row INCLUDING every token — a single request enumerating
-- every "unguessable" board. The page renders server-side, resolves the token
-- with supabaseAdmin, and returns only that one department's rows.
--
-- The token IS the credential. Anyone holding the link can read that board and
-- check items off, and the typed name is unverified — this is an honor-system
-- board for a shop floor, not an auth system. So: no customer names, no pricing,
-- nothing you would not pin to the break-room wall. Keep boards to shop work.
--
-- Idempotent. Run by hand in the Supabase SQL editor BEFORE deploying the code
-- (the board page and /admin/production both 500 without these tables).
-- ─────────────────────────────────────────────────────────────────────────────


-- ── Token mint ───────────────────────────────────────────────────────────────
-- Minted by the DB, never the app — same reason as crib_next_tag() (050): a
-- column DEFAULT cannot race and no route can forget to set it or "helpfully"
-- mint a weak one.
--
-- 43 URL-safe chars ([A-Za-z0-9_-]), 244 bits of entropy — unguessable by brute
-- force, which matters because rate limiting cannot protect the page render.
--
-- Built from two gen_random_uuid()s rather than gen_random_bytes(24): the former
-- is CORE Postgres (13+) and CSPRNG-backed, while gen_random_bytes lives in
-- pgcrypto, which Supabase installs into the `extensions` schema. Any function
-- later hardened with `SET search_path = public` (the 029 pattern) would stop
-- resolving it and every department insert would die on "function
-- gen_random_bytes(integer) does not exist". Two UUIDs cost one extra call and
-- delete that whole class of failure.
CREATE OR REPLACE FUNCTION prod_board_token() RETURNS text AS $$
  SELECT rtrim(translate(encode(decode(
           replace(gen_random_uuid()::text, '-', '') ||
           replace(gen_random_uuid()::text, '-', ''), 'hex'), 'base64'),
         '+/', '-_'), '=');
$$ LANGUAGE sql VOLATILE;


-- ── Departments ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_departments (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL UNIQUE,
  -- The unguessable half of /board/<token>. Rotatable: UPDATE it and every
  -- printed QR for this department dies at once (that's the point — a board
  -- printout walks out of the shop and you re-print rather than re-plumb).
  token       text        NOT NULL UNIQUE DEFAULT prod_board_token(),
  -- Shown on the board under the department name — "what this board is for".
  blurb       text,
  is_active   boolean     NOT NULL DEFAULT true,
  sort_order  integer     NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),

  -- Belt to the mint's suspenders: a mint that silently returned '' or a short
  -- string would hand out a guessable link and nothing else would complain.
  CONSTRAINT production_departments_token_chk CHECK (token ~ '^[A-Za-z0-9_-]{43}$')
);
-- No index on token — the UNIQUE constraint already builds the btree the
-- /board/<token> lookup rides on. (050 declines the same redundant index.)


-- ── Floor roster ─────────────────────────────────────────────────────────────
-- Names for the board's check-off picker. Not accounts, not an FK to employees.
CREATE TABLE IF NOT EXISTS production_people (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid        NOT NULL REFERENCES production_departments(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  is_active     boolean     NOT NULL DEFAULT true,
  sort_order    integer     NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department_id, name)
);

CREATE INDEX IF NOT EXISTS production_people_dept_idx ON production_people (department_id);


-- ── Tasks ────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS production_tasks (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  department_id uuid        NOT NULL REFERENCES production_departments(id) ON DELETE CASCADE,
  title         text        NOT NULL,
  detail        text,

  -- NULL => a standing duty. Non-NULL => the job/unit it belongs to. Free text:
  -- there is no deals→equipment→shop link in this schema to FK to (deals.job_name
  -- is sales metadata; equipment is the post-ship installed base), so inventing
  -- one here would be a lie. Typed by the manager, grouped by exact string.
  project       text,

  -- 'once'   — a one-off; done stays done.
  -- 'daily'  — resets every shop-local day.
  -- 'weekly' — resets Monday (shop-local).
  -- Enforced in ONE place at read time: effectiveDone() in lib/production.ts.
  cadence       text        NOT NULL DEFAULT 'once'
                            CHECK (cadence IN ('once', 'daily', 'weekly')),

  priority      text        NOT NULL DEFAULT 'normal'
                            CHECK (priority IN ('normal', 'high')),

  due_date      date,
  -- NULL => unassigned, which the board surfaces on purpose ("nobody has this").
  -- Free text matching production_people.name, NOT an FK: the roster is editable
  -- and renaming or removing a person must never delete the record of who did
  -- the work. Same snapshot reasoning as crib_events.actor_name (050).
  assignee      text,

  status        text        NOT NULL DEFAULT 'open'
                            CHECK (status IN ('open', 'done', 'blocked')),
  blocked_note  text,

  -- Shop-LOCAL completion date (America/New_York), not a timestamp: the recurring
  -- reset compares calendar days, and storing UTC would roll the board over at
  -- 8pm local. Written together with status by the check-off route.
  done_on       date,
  done_by       text,
  done_at       timestamptz,

  sort_order    integer     NOT NULL DEFAULT 0,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  -- Soft delete: archived tasks leave the board but keep their event trail.
  archived_at   timestamptz,

  -- A 'done' row must carry its provenance, or "who checked this off" silently
  -- becomes unanswerable — the one question the trail exists to answer.
  CONSTRAINT production_tasks_done_chk CHECK (
    status <> 'done' OR (done_on IS NOT NULL AND done_at IS NOT NULL)
  )
);

-- The board's only query: one department's live tasks, in display order.
CREATE INDEX IF NOT EXISTS production_tasks_board_idx
  ON production_tasks (department_id, archived_at, sort_order);


-- ── Check-off trail ──────────────────────────────────────────────────────────
-- Append-only. actor_name is typed on the floor and NOT verified — it answers
-- "who says they did this", which is what an honor-system board can offer.
CREATE TABLE IF NOT EXISTS production_task_events (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    uuid        NOT NULL REFERENCES production_tasks(id) ON DELETE CASCADE,
  action     text        NOT NULL
                         CHECK (action IN ('created', 'done', 'reopened', 'blocked', 'unblocked', 'edited')),
  actor_name text,
  -- 'board' = someone on the floor with the QR link; 'admin' = a signed-in
  -- manager. Worth distinguishing: only one of the two is authenticated.
  source     text        NOT NULL DEFAULT 'board' CHECK (source IN ('board', 'admin')),
  note       text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS production_task_events_task_idx
  ON production_task_events (task_id, created_at DESC);


-- ── Lockdown ─────────────────────────────────────────────────────────────────
ALTER TABLE production_departments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_people       ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_tasks        ENABLE ROW LEVEL SECURITY;
ALTER TABLE production_task_events  ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies — service-role only. See the SECURITY note at the
-- top: a read policy on production_departments would leak every token at once.

REVOKE EXECUTE ON FUNCTION prod_board_token() FROM public, anon, authenticated;
-- Not redundant with the REVOKE above — it's the counterweight. Postgres grants
-- function EXECUTE *via* PUBLIC, so if service_role held it only through that
-- PUBLIC membership the REVOKE would strip service_role too and every "Add
-- department" would fail with "permission denied for function prod_board_token".
GRANT  EXECUTE ON FUNCTION prod_board_token() TO service_role;


-- ── Grant the perm. DO NOT SKIP — adding it to lib/roles.ts does NOTHING. ────
--
-- Once role_permissions has ANY rows, the code-side DEFAULT_ROLE_PERMS is dead:
-- lib/permissions.getPermMatrix() seeds every scoped role to [] then fills from
-- the DB, so hasPermission()'s `matrix?.[role] ?? DEFAULT_ROLE_PERMS[role]` never
-- reaches the default. Without the row below, a production_manager opening
-- /admin/production gets a silent 302 to /admin — no error anywhere. That has
-- shipped for real twice ('tools' in 045, fixed only in 051).
--
-- The perm is `production_board`, NOT `production`: `production` is already a
-- StaffRole (the base floor tier), and a perm sharing that name would sit
-- confusingly beside it — precisely the `tools` vs `tool_crib` collision that
-- roles.ts:262-265 warns about at length.
INSERT INTO role_permissions (role, perm) VALUES
  ('production_manager', 'production_board')
ON CONFLICT (role, perm) DO NOTHING;


-- ── Seed the three departments ───────────────────────────────────────────────
-- Starting list, per the ask ("Production, Fabrication, Electrical … I think").
-- Rename/add/deactivate at /admin/production — no deploy needed. Tokens mint
-- themselves from the column DEFAULT.
INSERT INTO production_departments (name, blurb, sort_order) VALUES
  ('Production',   'Assembly, build and unit completion.', 10),
  ('Fabrication',  'Sheet metal, welding and frame work.', 20),
  ('Electrical',   'Panels, wiring and controls.',         30)
ON CONFLICT (name) DO NOTHING;


-- ── Verify (run after applying) ──────────────────────────────────────────────
--
-- 1. The perm actually landed. This is the one that fails SILENTLY — a missing
--    row is a 302 to /admin with no error:
--      SELECT role, array_agg(perm ORDER BY perm) FROM role_permissions GROUP BY role;
--      -- production_manager MUST include production_board
--
-- 2. Tokens are unique, URL-safe and full length. Let the table print them; do
--    not assume the shape:
--      SELECT name, length(token) AS len, token ~ '^[A-Za-z0-9_-]{43}$' AS shape_ok
--        FROM production_departments ORDER BY sort_order;
--      -- expect len = 43 and shape_ok = true on all three
--      SELECT count(*), count(DISTINCT token) FROM production_departments;  -- MUST be equal
--
-- 3. anon cannot reach the tables directly. This is the ENTIRE security model
--    and the one thing no page test would catch — a read policy here would hand
--    out every board's token in one request:
--      SET ROLE anon;
--      SELECT count(*) FROM production_departments;  -- expect permission denied / 0 rows
--      RESET ROLE;
--
-- 4. service_role can call the mint and nobody else can:
--      SELECT has_function_privilege('service_role',  'prod_board_token()', 'EXECUTE') AS service_ok,
--             has_function_privilege('authenticated', 'prod_board_token()', 'EXECUTE') AS authed_bad,
--             has_function_privilege('anon',          'prod_board_token()', 'EXECUTE') AS anon_bad;
--      -- expect true / false / false
--
-- 5. The done-provenance constraint bites (must ERROR):
--      INSERT INTO production_tasks (department_id, title, status)
--      VALUES ((SELECT id FROM production_departments LIMIT 1), 'ZZ verify', 'done');
--
-- 6. Re-running this whole file changes nothing (idempotency):
--      -- run it again; the counts below must not move, and tokens must NOT rotate
--      SELECT count(*) FROM production_departments;              -- expect 3
--      SELECT count(*) FROM role_permissions WHERE perm = 'production_board';  -- expect 1
--
-- 7. Grab a real board URL to open:
--      SELECT name, '/board/' || token AS url FROM production_departments ORDER BY sort_order;
