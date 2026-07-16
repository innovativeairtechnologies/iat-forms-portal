import type { FormField } from './supabase'

// Conditional visibility for form fields (migration 028). A field is visible
// unless it carries a "show when" condition that the current answers don't
// satisfy. `answers` is keyed by field label — the same shape as a submission's
// `data` — so the same helper works in the client renderers AND the server-side
// submit validation.

// `show_when_value` holds one value ("Yes") or several pipe-separated
// ("Electric|Natural Gas"), which reads as "show when the controlling field
// equals any of these".
function acceptedValues(showWhenValue: string | null): string[] {
  return String(showWhenValue ?? '').split('|').map((v) => v.trim())
}

export function isFieldVisible(
  field: Pick<FormField, 'show_when_field' | 'show_when_value'>,
  answers: Record<string, unknown>,
): boolean {
  if (!field.show_when_field) return true
  const current = String(answers[field.show_when_field] ?? '')
  return acceptedValues(field.show_when_value).includes(current)
}

// A condition can point at a field that is itself conditional (IDP: Heat Type →
// Amps? → the no-amps checklist). A stale answer to a now-hidden controlling
// field must not keep its dependants on screen, so visibility resolves up the
// whole chain, not just one link.
const MAX_CONDITION_DEPTH = 20

/** The subset of `fields` currently visible given the answers so far. */
export function visibleFields(fields: FormField[], answers: Record<string, unknown>): FormField[] {
  const byLabel = new Map<string, FormField>()
  for (const f of fields) if (!byLabel.has(f.label)) byLabel.set(f.label, f)

  const resolve = (field: FormField, depth: number): boolean => {
    if (!field.show_when_field) return true
    if (depth >= MAX_CONDITION_DEPTH) return true // circular show-when chain
    if (!isFieldVisible(field, answers)) return false
    const controller = byLabel.get(field.show_when_field)
    return controller ? resolve(controller, depth + 1) : true
  }

  return fields.filter((f) => resolve(f, 0))
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
