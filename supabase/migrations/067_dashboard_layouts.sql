-- ─────────────────────────────────────────────────────────────────────────────
-- 067_dashboard_layouts.sql — per-user "build your own" dashboard layouts.
--
-- Backs the customizable department dashboards: each user stores an ordered list
-- of cards ({ id, span }) that overrides their department's default layout. One
-- row per user; the ABSENCE of a row ⇒ the code-defined per-role default is used,
-- so this changes nothing until a user actually customizes. Purely additive — no
-- existing table or data is touched.
--
-- The dashboard is server-rendered with the service-role client (which bypasses
-- RLS), but RLS is enabled as defense-in-depth so a row is only ever readable /
-- writable by its owner through any user-scoped (anon/authenticated) client.
--
-- Reversible: DROP TABLE IF EXISTS public.dashboard_layouts;
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.dashboard_layouts (
  user_id    uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  layout     jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dashboard_layouts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dashboard_layouts_own_select ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_own_select ON public.dashboard_layouts
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS dashboard_layouts_own_insert ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_own_insert ON public.dashboard_layouts
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dashboard_layouts_own_update ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_own_update ON public.dashboard_layouts
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS dashboard_layouts_own_delete ON public.dashboard_layouts;
CREATE POLICY dashboard_layouts_own_delete ON public.dashboard_layouts
  FOR DELETE USING (auth.uid() = user_id);
