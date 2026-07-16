-- ─────────────────────────────────────────────────────────────────────────────
-- 050_tool_crib.sql — Tool Crib: barcode check-out / check-in for warehouse tools
--
-- WHY: shared tools walk off the floor and nobody knows who took them or where
-- they went — a recurring, unbudgeted replacement cost. This gives every tool a
-- QR label (printed by the portal, not purchased) and a permanent custody record:
-- who has it right now, and who had it before.
--
-- NAMING: `crib_*`, NOT `tools`. /admin/tools, /tools/*, the `tools` perm and
-- lib/tools.ts are the internal FIELD-APP LAUNCHER (duct traverse, calculators) —
-- a completely different feature in this same app. Do not conflate them.
--
-- CUSTODY MODEL: current custody is denormalized onto crib_tools (status,
-- held_by, held_since); crib_events is the append-only log. The row is a CACHE
-- of the log. Chosen over deriving custody from the latest event because "who
-- has it right now" renders on every list row — deriving means a lateral join
-- per row on a table that only grows. The invariant this buys us a duty to keep:
-- EVERY custody write goes through one of the crib_* functions below, which
-- update the row and append the event in the SAME transaction. No route may
-- write crib_tools.status/held_by directly.
--
-- SECURITY: RLS on, NO policies — service-role only, same posture as equipment
-- (016) and ticket_notes. The functions are SECURITY INVOKER (the default) and
-- have EXECUTE revoked from public/anon/authenticated. See the long note above
-- crib_check_out for why SECURITY DEFINER would be a hole here.
--
-- Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tables ───────────────────────────────────────────────────────────────────

-- Codes are minted by the DB, not the app: a sequence can't race two concurrent
-- creates into the same code the way a SELECT max()+1 would.
CREATE SEQUENCE IF NOT EXISTS crib_tag_seq START 1;

-- Mints 'IAT-0042'. A plain `lpad(nextval(...)::text, 4, '0')` in the column
-- DEFAULT would be a latent trap: lpad does not only pad — it TRUNCATES on the
-- right when the value is longer than the target width. At nextval = 10000 it
-- returns '1000', minting 'IAT-1000', which tool #1000 already owns; the UNIQUE
-- constraint then rejects it, "Add tool" dies with an opaque 500, and every
-- later attempt collides the same way — permanently, and only fixable with
-- another migration. (Note the sequence also burns on every FAILED insert, so
-- this isn't strictly "the 10,000th tool".) Past 9999 the code simply gets
-- wider — normalizeTagCode() in lib/tool-crib.ts already accepts up to 6 digits.
--
-- A function rather than an inline CASE because a column DEFAULT can't contain a
-- subquery, and inlining CASE would call nextval() twice.
CREATE OR REPLACE FUNCTION crib_next_tag() RETURNS text AS $$
DECLARE n bigint;
BEGIN
  n := nextval('crib_tag_seq');
  RETURN 'IAT-' || CASE WHEN n < 10000 THEN lpad(n::text, 4, '0') ELSE n::text END;
END $$ LANGUAGE plpgsql VOLATILE;

CREATE TABLE IF NOT EXISTS crib_tools (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  -- The code printed under the QR ('IAT-0042'). Short and digits-only after the
  -- prefix so a scuffed label can be read aloud and typed without O/0 or I/1
  -- ambiguity. No check digit: the code goes straight into a UNIQUE-indexed
  -- exact lookup that is itself authoritative — a typo returns "no such tool"
  -- in one round trip, which is all a check digit would have bought.
  tag_code        text          NOT NULL UNIQUE DEFAULT crib_next_tag(),
  name            text          NOT NULL,
  category        text,
  make            text,
  model           text,
  -- The MANUFACTURER's serial, not our tag. Distinct on purpose: tag_code is
  -- ours and permanent, serial_number is theirs and may be missing/duplicated.
  serial_number   text,
  home_location   text,                                  -- 'Cage A · Shelf 3'
  photo_urls      text[],
  purchase_cost   numeric(10,2),
  purchase_date   date,

  -- available | checked_out | maintenance | lost | retired
  status          text          NOT NULL DEFAULT 'available',
  held_by         uuid          REFERENCES employees(id) ON DELETE SET NULL,
  held_since      timestamptz,
  -- Reserved: no due-date UI, cron or email in v1 (deliberate — see docs).
  -- Present so due dates land later as a UI change, not a migration.
  due_at          timestamptz,
  condition_note  text,

  -- Reserved for quantity-tracked consumables (drill bits, blades). v1 is
  -- unique-only: 1 label = 1 tool = 1 row. Nothing reads these yet.
  kind            text          NOT NULL DEFAULT 'unique',
  quantity        integer,

  notes           text,
  created_at      timestamptz   NOT NULL DEFAULT now(),
  updated_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT crib_tools_status_chk CHECK (status IN ('available','checked_out','maintenance','lost','retired')),
  CONSTRAINT crib_tools_kind_chk   CHECK (kind IN ('unique','consumable')),
  -- Guarantees a typed code can always be matched with upper(trim(input)) against
  -- the plain UNIQUE btree — no ILIKE, no functional index, no case surprises.
  CONSTRAINT crib_tools_tag_upper_chk CHECK (tag_code = upper(tag_code)),
  -- The custody invariant, enforced by the DB rather than trusted to callers:
  -- if it isn't checked out, NOBODY holds it. Blocks the incoherent
  -- "available but held_by is set" state that a buggy caller could otherwise
  -- write, which would make the floor list lie about who has what.
  --
  -- Deliberately NOT the stronger "checked_out ⇒ held_by IS NOT NULL": held_by
  -- is ON DELETE SET NULL, and that cascade fires an UPDATE. The stronger form
  -- would make deleting an employee who holds a tool fail with a constraint
  -- violation — which would break /admin/reset (it calls auth.admin.deleteUser,
  -- and employees.id cascades from auth.users). A checked-out tool whose holder
  -- was deleted is therefore legal and renders as an unknown holder; a manager
  -- clears it with crib_force_check_in. The history in crib_events survives
  -- regardless (see the name snapshots there).
  CONSTRAINT crib_tools_custody_chk CHECK (
    status = 'checked_out' OR (held_by IS NULL AND held_since IS NULL)
  )
);

-- NB: no index on tag_code — the UNIQUE constraint above already builds a btree,
-- and a second one would just cost writes and disk. (016_equipment.sql does
-- declare that redundant index on its own unique serial_number; not copying it.)
CREATE INDEX IF NOT EXISTS crib_tools_status_idx   ON crib_tools (status);
CREATE INDEX IF NOT EXISTS crib_tools_held_by_idx  ON crib_tools (held_by);
CREATE INDEX IF NOT EXISTS crib_tools_category_idx ON crib_tools (category);

-- Append-only. Never UPDATE or DELETE a row here — this is the audit trail that
-- answers "who had it before", and a forced check-in must stay attributable.
CREATE TABLE IF NOT EXISTS crib_events (
  id              uuid          PRIMARY KEY DEFAULT gen_random_uuid(),
  tool_id         uuid          NOT NULL REFERENCES crib_tools(id) ON DELETE CASCADE,
  -- created | check_out | check_in | force_check_in | transfer | status_change | note
  action          text          NOT NULL,
  actor_id        uuid          REFERENCES employees(id) ON DELETE SET NULL,  -- who DID it
  subject_id      uuid          REFERENCES employees(id) ON DELETE SET NULL,  -- who custody moved TO

  -- Name SNAPSHOTS, captured at write time. Not redundant with the FKs above:
  -- those are ON DELETE SET NULL, and /admin/reset hard-deletes accounts via
  -- auth.admin.deleteUser (employees.id cascades from auth.users). Without these
  -- columns, deleting an account would erase the record of who took what — which
  -- is the ONE question this entire feature exists to answer. The FKs stay for
  -- joins on live employees; these are what make the history immortal.
  actor_name      text,
  subject_name    text,

  from_status     text,
  to_status       text,
  from_held_by    uuid          REFERENCES employees(id) ON DELETE SET NULL,
  to_held_by      uuid          REFERENCES employees(id) ON DELETE SET NULL,
  reason          text,          -- REQUIRED for force_check_in / transfer (enforced in the fns)
  condition_note  text,
  created_at      timestamptz   NOT NULL DEFAULT now(),

  CONSTRAINT crib_events_action_chk CHECK (
    action IN ('created','check_out','check_in','force_check_in','transfer','status_change','note')
  )
);

CREATE INDEX IF NOT EXISTS crib_events_tool_idx  ON crib_events (tool_id, created_at DESC);
CREATE INDEX IF NOT EXISTS crib_events_actor_idx ON crib_events (actor_id);

-- keep updated_at fresh on edits (same pattern as equipment / 016)
CREATE OR REPLACE FUNCTION set_crib_tools_updated_at() RETURNS trigger AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS crib_tools_set_updated_at ON crib_tools;
CREATE TRIGGER crib_tools_set_updated_at
  BEFORE UPDATE ON crib_tools
  FOR EACH ROW EXECUTE FUNCTION set_crib_tools_updated_at();


-- ── Custody functions ────────────────────────────────────────────────────────
--
-- Each one does the status change AND the event insert in a single transaction,
-- so custody can never move without a log entry.
--
-- Concurrency: two people scanning the same drill at the same instant would race
-- a read-then-write in the API route. The guard is the `WHERE ... AND status =
-- 'available'` predicate — it takes the row lock, and the loser matches 0 rows
-- and raises instead of silently stealing custody.
--
-- SECURITY INVOKER (the default) is deliberate. DO NOT make these DEFINER:
-- Postgres grants EXECUTE to PUBLIC on new functions, and Supabase's PostgREST
-- exposes public-schema functions as RPCs to anon/authenticated. A DEFINER
-- function would let any signed-in user move custody straight from the browser,
-- bypassing the API routes' auth checks AND the RLS-no-policies posture. As
-- INVOKER, an `authenticated` caller hits RLS-with-no-policies, matches zero
-- rows and fails closed on its own. The REVOKEs at the bottom are the belt to
-- that suspenders.

-- Name snapshot helper. Kept STABLE so the planner can inline it.
CREATE OR REPLACE FUNCTION crib_emp_name(p_id uuid) RETURNS text AS $$
  SELECT name FROM employees WHERE id = p_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION crib_check_out(p_tag text, p_actor uuid)
RETURNS crib_tools AS $$
DECLARE t crib_tools;
BEGIN
  UPDATE crib_tools
     SET status = 'checked_out', held_by = p_actor, held_since = now()
   WHERE tag_code = p_tag AND status = 'available'
  RETURNING * INTO t;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOOL_NOT_AVAILABLE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO crib_events (tool_id, action, actor_id, actor_name, subject_id, subject_name, from_status, to_status, to_held_by)
  VALUES (t.id, 'check_out', p_actor, crib_emp_name(p_actor), p_actor, crib_emp_name(p_actor), 'available', 'checked_out', p_actor);

  RETURN t;
END $$ LANGUAGE plpgsql;

-- Self-service return. Only the holder may call this; a manager returning
-- someone else's tool goes through crib_force_check_in (which demands a reason).
CREATE OR REPLACE FUNCTION crib_check_in(p_tag text, p_actor uuid, p_condition_note text DEFAULT NULL)
RETURNS crib_tools AS $$
DECLARE t crib_tools; v_status text; v_holder uuid;
BEGIN
  -- Locked pre-read, for the SAME reason as crib_set_status below: a single
  -- UPDATE ... WHERE tag/status/held_by can't tell "no such tag" from "not
  -- yours" — zero rows means both. Without this, someone who mistypes a scuffed
  -- label gets "This isn't checked out to you" and goes hunting for a phantom
  -- holder instead of re-reading the label. Unlike check-out, the scan route has
  -- no compensating lookup on this path, so the wrong message would reach the
  -- floor unmodified. TOOL_NOT_FOUND is already mapped in CRIB_ERRORS.
  SELECT status, held_by INTO v_status, v_holder
    FROM crib_tools WHERE tag_code = p_tag FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOOL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'checked_out' OR v_holder IS DISTINCT FROM p_actor THEN
    RAISE EXCEPTION 'NOT_HELD_BY_ACTOR' USING ERRCODE = 'P0001';
  END IF;

  UPDATE crib_tools
     SET status = 'available', held_by = NULL, held_since = NULL,
         condition_note = COALESCE(p_condition_note, condition_note)
   WHERE tag_code = p_tag
  RETURNING * INTO t;

  -- from_held_by is p_actor by construction — the guard above proved it.
  INSERT INTO crib_events (tool_id, action, actor_id, actor_name, from_status, to_status, from_held_by, condition_note)
  VALUES (t.id, 'check_in', p_actor, crib_emp_name(p_actor), 'checked_out', 'available', p_actor, p_condition_note);

  RETURN t;
END $$ LANGUAGE plpgsql;

-- Manager escape hatch: the holder quit, lost their phone, or just forgot.
-- Without this a stuck row needs a hand-edit in the SQL editor, which is how
-- people stop trusting the data. Reason is mandatory and the actor is recorded,
-- so this can't be used to quietly launder a loss.
CREATE OR REPLACE FUNCTION crib_force_check_in(p_tag text, p_actor uuid, p_reason text)
RETURNS crib_tools AS $$
DECLARE t crib_tools; v_prev uuid; v_status text;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- FOR UPDATE takes the row lock BEFORE we read held_by. Without it, a
  -- concurrent check-in/check-out landing between the read and the UPDATE would
  -- write the wrong person into permanent history — and this is precisely the
  -- record that has to survive an argument about who lost the tool.
  SELECT status, held_by INTO v_status, v_prev
    FROM crib_tools WHERE tag_code = p_tag FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOOL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'checked_out' THEN
    RAISE EXCEPTION 'TOOL_NOT_CHECKED_OUT' USING ERRCODE = 'P0001';
  END IF;

  UPDATE crib_tools
     SET status = 'available', held_by = NULL, held_since = NULL
   WHERE tag_code = p_tag
  RETURNING * INTO t;

  INSERT INTO crib_events (tool_id, action, actor_id, actor_name, subject_id, subject_name, from_status, to_status, from_held_by, reason)
  VALUES (t.id, 'force_check_in', p_actor, crib_emp_name(p_actor), v_prev, crib_emp_name(v_prev), 'checked_out', 'available', v_prev, p_reason);

  RETURN t;
END $$ LANGUAGE plpgsql;

-- Dave handed the drill to Mike without walking it back to the crib.
CREATE OR REPLACE FUNCTION crib_transfer(p_tag text, p_actor uuid, p_to uuid, p_reason text)
RETURNS crib_tools AS $$
DECLARE t crib_tools; v_prev uuid; v_status text;
BEGIN
  IF p_reason IS NULL OR btrim(p_reason) = '' THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  IF p_to IS NULL THEN
    RAISE EXCEPTION 'RECIPIENT_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- Locked read — see crib_force_check_in for why.
  SELECT status, held_by INTO v_status, v_prev
    FROM crib_tools WHERE tag_code = p_tag FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOOL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_status <> 'checked_out' THEN
    RAISE EXCEPTION 'TOOL_NOT_CHECKED_OUT' USING ERRCODE = 'P0001';
  END IF;
  IF v_prev = p_to THEN
    RAISE EXCEPTION 'ALREADY_HELD_BY_RECIPIENT' USING ERRCODE = 'P0001';
  END IF;

  UPDATE crib_tools
     SET held_by = p_to, held_since = now()
   WHERE tag_code = p_tag
  RETURNING * INTO t;

  INSERT INTO crib_events (tool_id, action, actor_id, actor_name, subject_id, subject_name, from_status, to_status, from_held_by, to_held_by, reason)
  VALUES (t.id, 'transfer', p_actor, crib_emp_name(p_actor), p_to, crib_emp_name(p_to), 'checked_out', 'checked_out', v_prev, p_to, p_reason);

  RETURN t;
END $$ LANGUAGE plpgsql;

-- Lifecycle move that isn't a custody move: available → maintenance/lost/retired
-- and back. Refuses to touch a checked-out tool — force-check-in first, so the
-- custody trail stays honest rather than a tool silently going from someone's
-- hands to 'lost' with no return event.
CREATE OR REPLACE FUNCTION crib_set_status(p_tag text, p_actor uuid, p_status text, p_reason text DEFAULT NULL)
RETURNS crib_tools AS $$
DECLARE t crib_tools; v_from text;
BEGIN
  IF p_status NOT IN ('available','maintenance','lost','retired') THEN
    RAISE EXCEPTION 'BAD_STATUS' USING ERRCODE = 'P0001';
  END IF;

  -- Locked read so the from_status we log is the one we actually transitioned
  -- from, and so "not found" is distinguishable from "checked out" — the older
  -- single-UPDATE form reported a typo'd tag as TOOL_IS_CHECKED_OUT.
  SELECT status INTO v_from FROM crib_tools WHERE tag_code = p_tag FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOOL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_from = 'checked_out' THEN
    RAISE EXCEPTION 'TOOL_IS_CHECKED_OUT' USING ERRCODE = 'P0001';
  END IF;
  IF v_from = p_status THEN
    RETURN (SELECT c FROM crib_tools c WHERE c.tag_code = p_tag);  -- no-op, no event
  END IF;

  UPDATE crib_tools
     SET status = p_status
   WHERE tag_code = p_tag
  RETURNING * INTO t;

  INSERT INTO crib_events (tool_id, action, actor_id, actor_name, from_status, to_status, reason)
  VALUES (t.id, 'status_change', p_actor, crib_emp_name(p_actor), v_from, p_status, p_reason);

  RETURN t;
END $$ LANGUAGE plpgsql;


-- ── Lockdown ─────────────────────────────────────────────────────────────────

ALTER TABLE crib_tools  ENABLE ROW LEVEL SECURITY;
ALTER TABLE crib_events ENABLE ROW LEVEL SECURITY;
-- intentionally no policies — service-role only (admin UI + API run server-side)

-- Postgres grants EXECUTE to PUBLIC on new functions by default, and PostgREST
-- would expose these as browser-callable RPCs. Revoke so the service role is the
-- only caller. Signatures must match exactly or the REVOKE silently no-ops.
REVOKE EXECUTE ON FUNCTION crib_check_out(text, uuid)              FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION crib_check_in(text, uuid, text)         FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION crib_force_check_in(text, uuid, text)   FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION crib_transfer(text, uuid, uuid, text)   FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION crib_set_status(text, uuid, text, text) FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION crib_emp_name(uuid)                     FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION crib_next_tag()                         FROM public, anon, authenticated;

-- Then hand EXECUTE back to service_role EXPLICITLY. This is not redundant with
-- the revokes above — it's the counterweight to them. Postgres grants function
-- EXECUTE *via* PUBLIC by default, so if service_role held it only through that
-- PUBLIC membership, the REVOKEs would strip service_role too and every scan
-- would fail with "permission denied for function crib_check_out" at runtime.
-- Supabase does normally set explicit default privileges for service_role, but
-- relying on that is a silent, environment-dependent bet on the one code path
-- the whole feature runs through. Grant it outright.
GRANT EXECUTE ON FUNCTION crib_check_out(text, uuid)              TO service_role;
GRANT EXECUTE ON FUNCTION crib_check_in(text, uuid, text)         TO service_role;
GRANT EXECUTE ON FUNCTION crib_force_check_in(text, uuid, text)   TO service_role;
GRANT EXECUTE ON FUNCTION crib_transfer(text, uuid, uuid, text)   TO service_role;
GRANT EXECUTE ON FUNCTION crib_set_status(text, uuid, text, text) TO service_role;
GRANT EXECUTE ON FUNCTION crib_emp_name(uuid)                     TO service_role;
-- crib_next_tag runs as the INSERTing role (it's the tag_code column DEFAULT),
-- so service_role needs EXECUTE or every "Add tool" fails.
GRANT EXECUTE ON FUNCTION crib_next_tag()                         TO service_role;


-- ── Grant the perm. DO NOT SKIP — adding it to lib/roles.ts does NOTHING. ────
--
-- Once role_permissions has ANY rows, the code-side DEFAULT_ROLE_PERMS is dead:
-- lib/permissions.getPermMatrix() seeds every scoped role to [] and then fills
-- from the DB, so matrix[role] is always a non-null array — which means
-- hasPermission()'s `matrix?.[role] ?? DEFAULT_ROLE_PERMS[role]` never falls
-- through to the default. Middleware's own per-role read behaves the same way.
-- The code list is only the fallback for an ERRORED or empty table.
--
-- THIS IS NOT HYPOTHETICAL — it is already live: DEFAULT_ROLE_PERMS grants
-- 'tools' to five scoped roles, but migration 045 never seeded a single 'tools'
-- row, so no scoped role actually holds that perm in production today. Without
-- the insert below, tool_crib would break for production_manager in exactly the
-- same silent way (a 302 to /admin, no error).
INSERT INTO role_permissions (role, perm) VALUES
  ('production_manager', 'tool_crib')
ON CONFLICT (role, perm) DO NOTHING;


-- ── Tool photos bucket ───────────────────────────────────────────────────────
-- Provisioned here rather than by hand in the dashboard, so applying this
-- migration is the only go-live step. Private: a signed URL is minted on read.
-- The browser uploads straight to Storage with a signed upload URL — a phone
-- photo blows past Vercel's ~4.5MB function body cap, so the bytes must never
-- transit the function (same reason as the KB + submittal uploads).
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('crib-photos', 'crib-photos', false, 10485760)  -- 10MB
ON CONFLICT (id) DO UPDATE SET file_size_limit = 10485760;
-- No storage policies: uploads are authorized by a service-role-minted signed
-- URL and reads by a service-role-minted signed URL, so the browser never needs
-- direct bucket rights. Matches the RLS-on/no-policies posture above.


-- ── Verify (run after applying) ──────────────────────────────────────────────
--
-- 1. The perm actually landed (this is the one that fails silently — a missing
--    row means production_manager gets a 302 to /admin with no error):
--      SELECT role, array_agg(perm ORDER BY perm) FROM role_permissions GROUP BY role;
--      -- production_manager MUST include tool_crib
--
-- 2. service_role can still call the RPCs, and nobody else can. Both halves
--    matter: the first is "does the feature work at all", the second is "can a
--    signed-in user move custody straight from the browser".
--      SELECT p.proname,
--             has_function_privilege('service_role',  p.oid, 'EXECUTE') AS service_ok,
--             has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authed_bad,
--             has_function_privilege('anon',          p.oid, 'EXECUTE') AS anon_bad
--        FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
--       WHERE n.nspname = 'public' AND p.proname LIKE 'crib\_%';
--      -- EVERY row must be service_ok = true, authed_bad = false, anon_bad = false.
--
-- 3. The custody constraint bites (must ERROR — available yet held):
--      INSERT INTO crib_tools (name, status, held_by)
--      VALUES ('ZZ verify bad', 'available', (SELECT id FROM employees LIMIT 1));
--
-- 4. The double-scan guard. DO NOT hardcode the code here — step 3's INSERT
--    evaluated the tag_code DEFAULT (burning a nextval) BEFORE the CHECK aborted
--    it, and sequence consumption is NOT rolled back. So the sequence has already
--    advanced and the tool below will NOT be IAT-0001. Let the INSERT tell you.
--
--    This matters more than it looks: if you hardcode a code that doesn't exist,
--    BOTH calls raise TOOL_NOT_AVAILABLE (zero rows matched) — the exact error
--    you were told to expect — and the test silently self-certifies without ever
--    exercising the guard.
--
--      INSERT INTO crib_tools (name) VALUES ('ZZ verify drill') RETURNING tag_code;
--      -- use the code it printed below:
--      SELECT crib_check_out('<that code>', (SELECT id FROM employees LIMIT 1));  -- must SUCCEED
--      SELECT crib_check_out('<that code>', (SELECT id FROM employees LIMIT 1));  -- must RAISE TOOL_NOT_AVAILABLE
--    If the FIRST call also raises, the test did not run — recheck the code.
--
-- 5. Exactly one event per custody move, and the name snapshot is populated:
--      SELECT action, actor_name, from_status, to_status FROM crib_events ORDER BY created_at;
--
-- 6. CLEAN UP — this is production. Do this before anyone opens /admin/tool-crib,
--    or a bogus tool shows up on the floor list and in the cost rollup.
--    (crib_events rows cascade away with the tool.)
--      DELETE FROM crib_tools WHERE name LIKE 'ZZ verify%';
--      -- optional: reset the counter so the first real tool is IAT-0001
--      SELECT setval('crib_tag_seq', 1, false);
--      SELECT count(*) FROM crib_tools;   -- expect 0
