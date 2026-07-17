# Conditional form fields + ratings tally

Two form-builder capabilities added 2026-06-26. Both are **additive**: a field with no condition
renders exactly as before, so all existing forms are unaffected.

## Conditional fields ("Show only when…")
A field can be configured to show **only when another field currently equals a given value**.

- **Schema (migration 028):** `form_fields.show_when_field` (the controlling field's *label*) and
  `show_when_value` (the value that reveals it — or several **pipe-separated** values,
  `Electric|Natural Gas`, read as "show when the controlling field equals **any of** these").
  `NULL` = always show.
- **Why label, not id:** submission `data` is keyed by field label, so the condition references the
  controlling field by label — the same key the renderers and the server read.
- **The controlling field must actually exist, and must offer the value.** `isFieldVisible` reads
  `answers[show_when_field]`; if no field carries that label, the lookup is `undefined` forever and
  the gated fields are **permanently hidden**. The gate doesn't gate — it erases, silently. Same if
  the controlling field exists but its `options` don't include the `show_when_value`. The **builder
  can't** create this (it only offers existing Dropdown/Single-Choice fields as controllers) — but a
  **script can**, and one did: see "The 2026-07 Department outage" below. Any script that writes
  `show_when_*` must assert both, as `scripts/add-perf-review-department-field.mjs` and
  `scripts/update-idp-test-report.mjs` do.
- **Builder:** two views, both writing the same columns (toggle in the toolbar):
  - **Form view** (default, `components/admin/FormCanvas.tsx`) — select a field, open its inline
    editor → **Conditional logic** → pick a controlling Dropdown/Single-Choice field, then tick
    **any of** its values (multi-select chips → pipe-joined `show_when_value`). Conditional fields
    wear a badge; controllers show a "drives N" count. Form view also flags the two traps below
    inline as you edit — **duplicate labels** and **dangling/stale conditions** (`computeIssues`) —
    which is the first time the builder itself warns about the failure a script can create.
  - **List view** (classic) — the right-hand **"Show only when…"** panel (single value).
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

## Print views
Two browser-native print views (Print **or** Save-as-PDF), both admin-only and respecting the
`show_when` conditions:
- **`/print/forms/[id]`** — pick a department and preview **only that department's questions** as a
  blank questionnaire (universal sections + that dept's gated questions) before sending to team
  leads. Linked from the form-builder toolbar (next to **Tally**). Generic: any conditional form
  offers a selector for its controlling field; a non-conditional form just prints the whole form.
- **`/print/submissions/[id]`** — a clean printout of a completed submission showing **only the
  fields that applied to that person's department** (`visibleFields(fields, submission.data)`), to
  hand to the employee. Linked from the submission detail (next to **Download PDF**).

Standalone `/print/*` routes (no admin chrome → clean output), self-gated with `getAdminUser()`.
Shared `components/PrintFrame` + `PrintButton`. Uses the same `lib/forms.ts` visibility helper as
the renderers, so what prints matches what a team lead actually fills in.

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

### The 2026-07 Department outage (fixed 2026-07-16)

Step 3 above gated 22 department-specific fields on a controlling field labeled `Department` —
**which did not exist on the form.** Nothing writes `answers['Department']`, so from the moment that
script ran until 2026-07-16, **all 22 department-specific questions were permanently hidden and
could not be filled in by anyone.**

It hid in plain sight for two reasons:

- **The print views looked fine**, because they *fabricate* the controlling answer.
  `app/print/forms/[id]/page.tsx` falls back to reconstructing the department list from the distinct
  `show_when_value`s when the controlling field is missing, and `BlankFormPrint.tsx` then injects
  `{ [controllingLabel]: dept }` as a synthetic answer. So the blank questionnaire printed correctly
  while the live form showed nothing — "works in print, broken in the form" is the signature.
- **It fails closed and silently.** No error, no empty state — the questions simply aren't there, and
  `stripHiddenAnswers` drops them from any submission.

Evidence it was a regression, not a form that never worked: the 2026-07-07 submission answered two of
the fields (`Office: Accuracy and organization…` = "Superstar"). Before the gating, every
department's questions showed to everyone and the reviewer filled in the relevant ones — which is
also why that submission carries no `Department` key.

**Fix:** `node scripts/add-perf-review-department-field.mjs` (dry-run) → `--commit`. Adds the missing
required `select` labeled exactly `Department` at the end of the *Employee Information* section
(sort_order 3, beside Employee Name / Review Date), applied to both `performance-review-form` and the
inactive `perf-new` copy. Idempotent — skips a form that already has the field.

**The option list is not a free choice.** It's dictated by the questions the form actually has:
`Office, Engineering, Sales, Marketing, Production, Management` — the distinct `show_when_value`s on
the 22 gated fields. Offering a department with no questions behind it (other portal forms use wider
lists: Shipping/Receiving, Administration, Quality Control, IT) would strand the reviewer on an empty
Department-Specific section. That the perf review has no questions for those departments is a
separate **content** gap. The script asserts the coverage in both directions: it exits non-zero if any
gated field awaits a value the select doesn't offer, and warns if an option has no questions.
