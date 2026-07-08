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

## Note
This is a print/layout feature only — it never changes a form's questions,
options, scale, or any submission. Editing what a form *asks* is done in the form
builder as usual.
