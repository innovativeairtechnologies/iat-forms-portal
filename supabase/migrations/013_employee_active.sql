-- ─────────────────────────────────────────────────────────────────────────────
-- 013_employee_active.sql
-- Employee offboarding. `is_active=false` marks a departed employee: hidden from
-- the staff directory, skipped by the weekly PTO accrual, and excluded from
-- ticket-owner assignment. Paired with banning their auth user (in the
-- /api/employees/[id]/status route) this also blocks login. Existing rows
-- default to active, so this is a safe, non-breaking add.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE employees ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;
