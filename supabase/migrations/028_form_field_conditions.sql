-- ─────────────────────────────────────────────────────────────────────────────
-- 028_form_field_conditions.sql — conditional form fields
--
-- Adds optional show-when logic to form_fields: a field is shown only when the
-- field labeled `show_when_field` currently equals `show_when_value`. Submission
-- data is keyed by field label, so the condition references the controlling
-- field by its label (e.g. show_when_field = 'Department').
--
-- Additive + backwards-compatible: every existing field has NULL show_when_field,
-- which the renderer/validator treat as "always visible" — no behavior change for
-- the other ~40 forms. Idempotent. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS show_when_field text;
ALTER TABLE form_fields ADD COLUMN IF NOT EXISTS show_when_value text;

-- verify:
--   SELECT column_name FROM information_schema.columns
--    WHERE table_name='form_fields' AND column_name LIKE 'show_when%';
