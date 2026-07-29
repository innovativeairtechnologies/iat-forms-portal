-- 069_app_settings.sql
-- A tiny key/value store for single-value app settings that admins edit from the
-- UI (no bespoke table per setting). First use: the company-home "days
-- incident-free" streak start date, editable at /admin/home-content.
--
-- Reads/writes go through the service role (RLS on, no policies), same pattern as
-- the company-home editorial tables (058). The home page falls back to the code
-- constant lib/home-content.ts SAFETY.since when the row is absent, so the app is
-- correct before this migration is applied.

CREATE TABLE IF NOT EXISTS app_settings (
  key         text PRIMARY KEY,
  value       text,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  updated_by  uuid
);

ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
-- No policies: only the service role (which bypasses RLS) touches this table.
