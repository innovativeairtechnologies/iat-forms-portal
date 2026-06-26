import type { FormField } from './supabase'

// Conditional visibility for form fields (migration 028). A field is visible
// unless it carries a "show when" condition that the current answers don't
// satisfy. `answers` is keyed by field label — the same shape as a submission's
// `data` — so the same helper works in the client renderers AND the server-side
// submit validation.

export function isFieldVisible(
  field: Pick<FormField, 'show_when_field' | 'show_when_value'>,
  answers: Record<string, unknown>,
): boolean {
  if (!field.show_when_field) return true
  const current = answers[field.show_when_field]
  return String(current ?? '') === String(field.show_when_value ?? '')
}

/** The subset of `fields` currently visible given the answers so far. */
export function visibleFields(fields: FormField[], answers: Record<string, unknown>): FormField[] {
  return fields.filter((f) => isFieldVisible(f, answers))
}

/** Submission data with hidden fields' values dropped, so a submission only ever
 *  carries answers for fields that were actually shown. */
export function stripHiddenAnswers(fields: FormField[], answers: Record<string, unknown>): Record<string, unknown> {
  const shown = new Set(
    visibleFields(fields, answers)
      .filter((f) => f.field_type !== 'section_header')
      .map((f) => f.label),
  )
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(answers)) {
    if (shown.has(k)) out[k] = v
  }
  return out
}
