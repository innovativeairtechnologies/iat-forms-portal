-- ─────────────────────────────────────────────────────────────────────────────
-- 064_crib_assign.sql — admin "assign" custody action.
--
-- WHY: check-out records who SCANNED a tool. But some people don't scan — they
-- just take tools and keep them. An admin needs to assign those tools to that
-- person directly, so the crib reflects reality. Transfer already moves a
-- checked-out tool between people; assign is its missing sibling — it issues an
-- AVAILABLE tool to someone on their behalf (and can reassign a checked-out one).
--
-- Logged as its own 'assign' action with the acting admin as actor and the
-- assignee as subject — so the timeline reads "Admin assigned it to Bob", not a
-- fake self-checkout. Follows the same locked-read + single-transaction pattern
-- as the other crib_* functions (see 050); SECURITY INVOKER, execute revoked.
--
-- Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

-- Allow the new 'assign' event action.
ALTER TABLE crib_events DROP CONSTRAINT IF EXISTS crib_events_action_chk;
ALTER TABLE crib_events ADD CONSTRAINT crib_events_action_chk CHECK (
  action IN ('created','check_out','check_in','force_check_in','transfer','status_change','note','assign')
);

-- Assign one tool to p_to. Works on an available tool (issues it) or a
-- checked-out one (reassigns it). Refuses maintenance/lost/retired — those must
-- be brought back to available first, so you can't hand someone a tool the crib
-- believes is lost. reason is optional (an issuance, not a forced override).
CREATE OR REPLACE FUNCTION crib_assign(p_tag text, p_actor uuid, p_to uuid, p_reason text DEFAULT NULL)
RETURNS crib_tools AS $$
DECLARE t crib_tools; v_status text; v_prev uuid;
BEGIN
  IF p_to IS NULL THEN
    RAISE EXCEPTION 'RECIPIENT_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT status, held_by INTO v_status, v_prev
    FROM crib_tools WHERE tag_code = p_tag FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'TOOL_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_status NOT IN ('available','checked_out') THEN
    RAISE EXCEPTION 'TOOL_NOT_ASSIGNABLE' USING ERRCODE = 'P0001';
  END IF;
  IF v_prev = p_to THEN
    RAISE EXCEPTION 'ALREADY_HELD_BY_RECIPIENT' USING ERRCODE = 'P0001';
  END IF;

  UPDATE crib_tools
     SET status = 'checked_out', held_by = p_to, held_since = now()
   WHERE tag_code = p_tag
  RETURNING * INTO t;

  INSERT INTO crib_events (tool_id, action, actor_id, actor_name, subject_id, subject_name, from_status, to_status, from_held_by, to_held_by, reason)
  VALUES (t.id, 'assign', p_actor, crib_emp_name(p_actor), p_to, crib_emp_name(p_to), v_status, 'checked_out', v_prev, p_to, p_reason);

  RETURN t;
END $$ LANGUAGE plpgsql;

-- Bulk: assign every assignable tool to p_to in one transaction. Available tools
-- always; checked-out ones only when p_include_held (and never a tool already
-- theirs). Skips maintenance/lost/retired. Returns how many were assigned. Loops
-- crib_assign so the per-tool rules and event log stay identical to the single
-- path; the WHERE pre-filters exactly the rows crib_assign would accept, so no
-- iteration can raise and abort the batch.
CREATE OR REPLACE FUNCTION crib_assign_all(p_actor uuid, p_to uuid, p_reason text DEFAULT NULL, p_include_held boolean DEFAULT false)
RETURNS integer AS $$
DECLARE r record; cnt integer := 0;
BEGIN
  IF p_to IS NULL THEN
    RAISE EXCEPTION 'RECIPIENT_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  FOR r IN
    SELECT tag_code FROM crib_tools
     WHERE status = 'available'
        OR (p_include_held AND status = 'checked_out' AND held_by IS DISTINCT FROM p_to)
     ORDER BY tag_code
     FOR UPDATE
  LOOP
    PERFORM crib_assign(r.tag_code, p_actor, p_to, p_reason);
    cnt := cnt + 1;
  END LOOP;

  RETURN cnt;
END $$ LANGUAGE plpgsql;

-- Lockdown — service-role only, same posture as the other crib_* functions.
REVOKE EXECUTE ON FUNCTION crib_assign(text, uuid, uuid, text)            FROM public, anon, authenticated;
REVOKE EXECUTE ON FUNCTION crib_assign_all(uuid, uuid, text, boolean)     FROM public, anon, authenticated;
GRANT  EXECUTE ON FUNCTION crib_assign(text, uuid, uuid, text)            TO service_role;
GRANT  EXECUTE ON FUNCTION crib_assign_all(uuid, uuid, text, boolean)     TO service_role;

-- ── verify (run after applying) ──────────────────────────────────────────────
--   -- assign one available tool to an employee, then confirm it's checked out:
--   SELECT crib_assign('IAT-0007', (SELECT id FROM employees LIMIT 1), (SELECT id FROM employees LIMIT 1));
--   -- the event should read action='assign' with actor + subject:
--   SELECT action, actor_name, subject_name, from_status, to_status FROM crib_events ORDER BY created_at DESC LIMIT 1;
--   -- service_role only:
--   SELECT has_function_privilege('authenticated', 'crib_assign(text, uuid, uuid, text)', 'EXECUTE'); -- false
