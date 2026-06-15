-- ─────────────────────────────────────────────────────────────────────────────
-- 017_equipment_pm.sql  — Phase 2 v2: preventive-maintenance interval per unit
--
-- pm_interval_months drives the "due for PM" view. Next PM = (last ticket | install
-- | ship date) + pm_interval_months (see lib/equipment.ts). Defaults to 12 so
-- units get annual PM tracking out of the box; set NULL on a unit to opt it out.
-- Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE equipment ADD COLUMN IF NOT EXISTS pm_interval_months integer DEFAULT 12;
