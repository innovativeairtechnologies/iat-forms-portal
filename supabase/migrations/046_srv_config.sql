-- ─────────────────────────────────────────────────────────────────────────────
-- 046_srv_config.sql — DB-backed, admin-editable SRV content
--
-- The Start-Up Readiness Verification content (its 10 sections' items, readings,
-- and photos) used to live only in code (lib/srv.ts SRV_SECTIONS). This single
-- JSONB row makes it editable from /admin/srv without a deploy. Until a row is
-- saved, lib/srv-config.getSrvSections() falls back to the code default — so the
-- customer SRV renders identically before and after this migration.
--
-- Single row (id = 1). `sections` mirrors the SrvSection[] shape from lib/srv.ts;
-- section KEYS/numbers/conditionals are held fixed by the save API (the 3D
-- hotspot map keys off them) — only their content is editable.
--
-- SECURITY: RLS on, NO policies → service-role only. Both the customer SRV page
-- and the admin editor read/write it server-side via supabaseAdmin (never the
-- anon client), and the save route is getAdminUser-gated. It's form config, not
-- user data.
--
-- Idempotent. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS srv_config (
  id         int PRIMARY KEY DEFAULT 1,
  sections   jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  CONSTRAINT srv_config_singleton CHECK (id = 1)
);

ALTER TABLE srv_config ENABLE ROW LEVEL SECURITY;

-- ── verify (run after applying) ──────────────────────────────────────────────
--   SELECT id, jsonb_array_length(sections) AS section_count, updated_at, updated_by FROM srv_config;
