-- ─────────────────────────────────────────────────────────────────────────────
-- 065_org_layout.sql — free-placement layout for the admin org chart.
--
-- The org chart is normally a computed tidy-tree (positions derived live from
-- manager_id). "Free layout" mode lets an admin drag nodes to arbitrary spots on
-- the shared canvas; these two columns persist that hand-placement.
--   • NULL (the default, and every existing row) = "use the computed layout", so
--     the chart is visually unchanged until someone actually drags a node.
--   • A value = the node was hand-placed at (org_x, org_y) in Free layout mode.
--
-- Shared/global (one canonical org chart, not per-user like the employee board),
-- so writes are admin-gated in app/admin/org-chart/actions.ts (service-role +
-- getAdminUser). Additive + idempotent.
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS org_x double precision;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS org_y double precision;
