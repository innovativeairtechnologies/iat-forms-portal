# Conditional form fields + ratings tally

Two form-builder capabilities added 2026-06-26. Both are **additive**: a field with no condition
renders exactly as before, so all existing forms are unaffected.

## Conditional fields ("Show only when…")
A field can be configured to show **only when another field currently equals a given value**.

- **Schema (migration 028):** `form_fields.show_when_field` (the controlling field's *label*) and
  `show_when_value` (the value that reveals it). `NULL` = always show.
- **Why label, not id:** submission `data` is keyed by field label, so the condition references the
  controlling field by label — the same key the renderers and the server read.
- **Builder:** select a field → Field Settings → **"Show only when…"** → pick a controlling field
  (any Dropdown / Single-Choice field) and the value.
- **Where it's enforced** (all share `lib/forms.ts`):
  - `components/StepFormModal.tsx` — steps derive from the *visible* fields; conditional fields
    appear/disappear as answers change, empty sections collapse, hidden answers are stripped on submit.
  - `components/FormRenderer.tsx` (embeds) — same visibility filter.
  - `app/api/submit/route.ts` — hidden fields are skipped in required-validation (server backstop).

## Ratings tally
`/admin/forms/[id]/tally` (linked from the builder toolbar) aggregates a form's submissions:
per **Employee Name**, counts how many **Superstar / Rockstar / Star / Performer** that person
received across all rating (radio) questions in all of their reviews. Admin-only (gated by the
`/admin` layout). Built for reviews/bonuses.

## Performance Review form — applying the data changes
The form itself lives in the **form builder (database)**, not in code. Its 2026-06 edits ship as a
script. **Order matters:**

1. Run **`supabase/migrations/028_form_field_conditions.sql`** in the Supabase SQL editor.
2. Deploy the code (the renderers/builder/tally that read the new columns).
3. Run **`node scripts/update-performance-review.mjs`** (dry-run) → review the planned changes →
   **`node scripts/update-performance-review.mjs --commit`** to apply. It:
   - removes 5 fields (Position Title, Supervisor Name, Review Period, Position Description,
     Position Description Document),
   - swaps every rating field's options to Superstar / Rockstar / Star / Performer,
   - gates each Department-Specific question by Department.

The script is **idempotent** — safe to re-run. Universal sections (general competencies,
Safety/Initiative/Growth, Summary & Goals, Signatures) are left unconditional.
