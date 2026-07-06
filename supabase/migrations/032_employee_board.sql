-- ─────────────────────────────────────────────────────────────────────────────
-- 032_employee_board.sql — per-user "My Board" whiteboard layout
--
-- Backs the opt-in employee homepage at /employee/board: a FigJam-style board of
-- draggable post-it cards. Each employee arranges their own board; this column
-- stores that personal arrangement as JSON:
--   { v, hidden: string[], note: string,
--     layouts: { lg: [{ i, x, y, w, h, static }], xs: [...] } }
--
-- Self-service, per-user data. Written from a server action (app/employee/
-- (canvas)/board/actions.ts) that resolves the user from the authenticated
-- session and writes only that user's row — same trust model as the org-chart
-- actions. Default '{}'::jsonb means "never customised", so the app falls back to
-- the curated default layout. Additive + idempotent.
-- Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

alter table public.employees
  add column if not exists board_layout jsonb not null default '{}'::jsonb;
