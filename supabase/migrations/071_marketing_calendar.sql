-- ─────────────────────────────────────────────────────────────────────────────
-- 071 — Marketing calendar (/admin/marketing)
--
-- The content calendar for social posts, email campaigns, blog articles, trade
-- shows and paid ads. Deliberately its OWN table rather than another overload of
-- deal_follow_ups (048 + 064): that table is a deal reminder whose rows CASCADE
-- when DryWare prunes a deal, which would silently delete marketing work that
-- has nothing to do with a deal.
--
-- Taxonomy (channel / platform / status) is intentionally NOT constrained by a
-- CHECK. The values live in lib/marketing.ts and are validated there and in the
-- POST/PATCH routes, which are the only writers (RLS below denies everyone
-- else). Adding "TikTok" or "Podcast" should be a one-line TS edit, not a
-- migration + deploy. The UI falls back to the neutral tone for any value it
-- doesn't recognise, so an unknown channel renders plainly instead of blank.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS marketing_events (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date  date NOT NULL,
  title       text NOT NULL,
  channel     text NOT NULL DEFAULT 'social',
  -- Only meaningful when channel = 'social' (linkedin / facebook / …). Kept as
  -- a plain nullable column rather than a second table: one value, no history.
  platform    text,
  status      text NOT NULL DEFAULT 'planned',
  owner       text,
  link        text,
  notes       text,
  created_by  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- The calendar reads one month at a time, always ordered by date.
CREATE INDEX IF NOT EXISTS marketing_events_date_idx ON marketing_events (event_date);

-- Service-role only, exactly like deal_follow_ups (048): RLS on with NO policies
-- means the anon/authenticated clients can neither read nor write. Access is
-- gated in-app by requireMarketingAuth() on every route.
ALTER TABLE marketing_events ENABLE ROW LEVEL SECURITY;

-- ── Grant the perm. DO NOT SKIP — adding it to lib/roles.ts does NOTHING. ────
--
-- Once role_permissions has ANY rows, the code-side DEFAULT_ROLE_PERMS is dead:
-- lib/permissions.getPermMatrix() seeds every scoped role to [] then fills from
-- the DB, so hasPermission()'s `matrix?.[role] ?? DEFAULT_ROLE_PERMS[role]` never
-- reaches the default. Without the row below, someone on the marketing role
-- opening /admin/marketing gets a silent 302 to /admin — no error anywhere.
--
-- Perm is named marketing_calendar, not `marketing`: `marketing` is already a
-- StaffRole, and a perm sharing that name would read as "the marketing role's
-- perm" (the same collision production_board and tool_crib were named around).
INSERT INTO role_permissions (role, perm) VALUES
  ('marketing', 'marketing_calendar')
ON CONFLICT (role, perm) DO NOTHING;

-- Verify:
--   SELECT count(*) FROM role_permissions WHERE perm = 'marketing_calendar';  -- expect 1
--   SELECT role, array_agg(perm ORDER BY perm) FROM role_permissions GROUP BY role;
