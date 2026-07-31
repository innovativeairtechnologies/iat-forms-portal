-- ─────────────────────────────────────────────────────────────────────────────
-- 073_diagram_studio_perm.sql — permission seed for /admin/diagram-studio
--
-- The Application Diagram Studio is the one place the sales team builds the
-- airflow figures that go into proposals. It holds NO data of its own: the page
-- is entirely client-side (like /admin/sizing-studio), work autosaves into the
-- rep's own browser, and figures travel as exported PNG/SVG/JSON files. So this
-- migration creates no tables — it exists solely to grant the new `diagrams`
-- perm, which is the only thing a code change cannot do on its own.
--
-- WHY A MIGRATION IS REQUIRED: once role_permissions holds any rows,
-- lib/permissions.getPermMatrix() fills the matrix from the DB and
-- DEFAULT_ROLE_PERMS in lib/roles.ts is never consulted. Adding the perm to the
-- code list alone would grant nothing, silently — the nav item would simply stay
-- hidden and the route would 302 home. scripts/check-perm-seed.mjs asserts the
-- two lists agree, and it runs as a prebuild gate.
--
-- Audience:
--   sales        — builds the figure for a proposal (the primary user)
--   engineering  — checks/corrects the psychrometric values on it
--   marketing    — reuses the exported figures in collateral and case studies
--
-- Apply via Supabase CLI (npx supabase db push, after `migration repair` — see
-- the 059–063 history-drift note in the project memory).
-- ─────────────────────────────────────────────────────────────────────────────

INSERT INTO role_permissions (role, perm) VALUES
  ('sales', 'diagrams'),
  ('engineering', 'diagrams'),
  ('marketing', 'diagrams')
ON CONFLICT (role, perm) DO NOTHING;

-- ── Verify (run after applying) ──────────────────────────────────────────────
--   SELECT role FROM role_permissions WHERE perm = 'diagrams' ORDER BY role;
--     -- expect 3 rows: engineering, marketing, sales
