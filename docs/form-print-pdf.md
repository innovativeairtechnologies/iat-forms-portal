# Blank form print / PDF

Every form has a printable "blank" view for filling out by hand or saving as a
PDF, at `/print/forms/[id]` (admin-only). It's reached from the form editor
toolbar via the **Download PDF** button, and produces a clean, print-ready sheet
that the browser's print dialog can "Save as PDF".

## What renders it
- `app/print/forms/[id]/page.tsx` — loads the form + fields (admin-gated) and
  derives the conditional controller (e.g. `Department`) and its values.
- `app/print/forms/[id]/BlankFormPrint.tsx` — renders the sheet. Intentionally
  light-only (no dark mode) so the output is print-ready.
- `components/PrintFrame.tsx` / `components/PrintButton.tsx` — the shared print
  chrome (centered white sheet, `@page` margins, toolbar hidden when printing).

## Header
The sheet leads with a letterhead: the IAT logo (`/iat-logo-transparent.png`)
top-left, then the "Innovative Air Technologies" overline and the form title (plus
`— <department>` when a department is selected). The form's `description` prints
beneath when set. There is no hard-coded "Employee / Reviewer / Date" band —
identity is captured by the form's own fields (e.g. an "Employee Name" text field
+ a "Review Date" date field). Consecutive short single-line fields (text / email /
number / date / file) pair two-per-row.

## Department selector
If a form has conditional fields (`show_when_field` / `show_when_value`; see
[form-conditional-fields.md](form-conditional-fields.md)), the print view shows a
pill selector for the controlling value (one pill per department, say). Picking
one prints only that value's questions — so a Sales review prints Sales
questions, not all six departments' worth.

## Rating matrix
A run of **2+** consecutive choice questions (radio/select) that share identical
options is rendered as one table: the shared options print once as a repeating
column header (`<thead>` with `table-header-group`), one row per question, with a
compact comment line under each. This is what keeps long rating forms (like the
Performance Review) to ~2–3 pages instead of ~7–9.

- The matrix only groups **2+** questions sharing a scale, so a one-off choice
  question still renders the classic vertical checklist, and other forms are
  unaffected.
- The controlling field (e.g. `Department`) is never folded into a matrix.
- A rating's following "— Brief Explanation" / comment textarea is folded in as
  that row's comment line, so no comment is lost — just compacted.

Everything else (text, date, checkbox, signature, long-text) renders as labelled
blanks/boxes sized for writing by hand.

## Annual Review — a bespoke fixed sheet
The Annual Review is the exception to the field-driven model. It has its own
fixed, branded two-page sheet (landscape by default, with a portrait option) at `app/print/annual-review/page.tsx`
(route `/print/annual-review`, admin-gated) — a static, trusted HTML string
(inline SVG icons, logo from `/public`) rendered as-is so the print matches the
approved design exactly. It is not generated from `form_fields`. The Annual
Review form (slug `perf-new`) special-cases its editor "Download PDF" button to
open this page instead of `/print/forms/[id]` (see `components/admin/FormBuilder.tsx`).
To change its content, edit the markup in that page directly.

**Each sheet must fit ONE landscape Letter page at 100% scale** so it prints as a
clean duplex front/back (print with "flip on short edge", scale = Actual size). A
"Fit-to-page compaction" override block near the end of the page's `STYLE` tightens
spacing to keep the front/back within the ~758px usable height (8.5in − 0.6in margins
@ 96dpi). If you add rows/content, re-check the rendered height and re-tighten there —
don't rely on the print dialog's "Fit to page" to rescue an overflow.

**Orientation toggle.** A Landscape/Portrait switch in the on-screen top bar
(`?orientation=portrait`, hidden in print) swaps the `@page` size and merges in
`PORTRAIT_STYLE` — same content, core values reflowed 4-up, and the fit-to-page
compaction relaxed since portrait has ~998px of usable height (vs ~758px landscape).
Both orientations are verified to fit one sheet per page at 100%. The `PrintButton`
label and printed `@page` follow the current selection.

## Note
This is a print/layout feature only — it never changes a form's questions,
options, scale, or any submission. Editing what a form *asks* is done in the form
builder as usual.
