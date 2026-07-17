-- ─────────────────────────────────────────────────────────────────────────────
-- 057_crib_short_label.sql — a short, hand-authored descriptor for the printed
-- tool label.
--
-- WHY: crib_tools.name can be the full manufacturer name ("Fluke 87V-MAX Digital
-- Multimeter", "Deluxe Electronic Test Lead Set") — too long for the 1in Avery
-- label, which now shows the QR + item code + a 2-3 word descriptor + the company
-- name. This is that descriptor: "Meter kit", "Test leads". Distinct from `name`
-- because it's a human's short call sign for the sticker, not a truncation of the
-- full name. Nullable; the label falls back to the (clamped) name when it's empty.
--
-- Safe, non-breaking add. Run by hand in the Supabase SQL editor.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE crib_tools ADD COLUMN IF NOT EXISTS short_label text;

-- Seed the tool Jacob named as the example. Harmless to re-run; change either via
-- /admin/tool-crib/<id> anytime.
UPDATE crib_tools SET short_label = 'Meter kit'  WHERE tag_code = 'IAT-0008' AND short_label IS NULL;
UPDATE crib_tools SET short_label = 'Test leads' WHERE tag_code = 'IAT-0007' AND short_label IS NULL;

-- ── verify ───────────────────────────────────────────────────────────────────
--   SELECT tag_code, name, short_label FROM crib_tools ORDER BY tag_code;
