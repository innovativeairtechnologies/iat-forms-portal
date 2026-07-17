import type { FormField, NotificationRule } from '@/lib/supabase'
import {
  Type, AlignLeft, Hash, Mail, ListOrdered, CheckSquare,
  Calendar, Upload, Pen, ToggleLeft, SeparatorHorizontal,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

// Client-side editing shapes: strip the DB-managed columns and carry a stable
// `_id` so React keys and drag-and-drop survive reorders (the real `id` only
// exists after save, and saving deletes+reinserts every row — see the
// label-keyed model note).
export type BuilderField = Omit<FormField, 'id' | 'form_id' | 'created_at'> & { _id: string }
export type BuilderRule = Omit<NotificationRule, 'id' | 'form_id' | 'created_at'> & { _id: string }

export type FieldType = FormField['field_type']

export const FIELD_TYPES: { type: FieldType; label: string; icon: LucideIcon; hint: string }[] = [
  { type: 'text',           label: 'Short Text',    icon: Type,                hint: 'Single line' },
  { type: 'email',          label: 'Email',         icon: Mail,                hint: 'Validated email' },
  { type: 'number',         label: 'Number',        icon: Hash,                hint: 'Numeric only' },
  { type: 'textarea',       label: 'Long Text',     icon: AlignLeft,           hint: 'Multi-line' },
  { type: 'select',         label: 'Dropdown',      icon: ListOrdered,         hint: 'Pick one · can drive logic' },
  { type: 'radio',          label: 'Single Choice', icon: ToggleLeft,          hint: 'Pick one · can drive logic' },
  { type: 'checkbox',       label: 'Multi Choice',  icon: CheckSquare,         hint: 'Pick many' },
  { type: 'date',           label: 'Date',          icon: Calendar,            hint: 'Date picker' },
  { type: 'file',           label: 'File Upload',   icon: Upload,              hint: 'Attachment' },
  { type: 'signature',      label: 'Signature',     icon: Pen,                 hint: 'Draw to sign' },
  { type: 'section_header', label: 'Section',       icon: SeparatorHorizontal, hint: 'Group divider' },
]

export const FIELD_TYPE_META: Record<FieldType, { label: string; icon: LucideIcon }> =
  Object.fromEntries(FIELD_TYPES.map((f) => [f.type, { label: f.label, icon: f.icon }])) as Record<
    FieldType,
    { label: string; icon: LucideIcon }
  >

// Field types that carry an `options` list.
export const OPTION_TYPES = new Set<FieldType>(['select', 'radio', 'checkbox'])
// Field types that can *drive* another field's visibility (single-value answers).
export const CONTROLLER_TYPES = new Set<FieldType>(['select', 'radio'])
// Field types that render a text placeholder (section_header reuses it as a description).
export const PLACEHOLDER_TYPES = new Set<FieldType>(['text', 'email', 'number', 'textarea', 'section_header'])

let idCounter = 0
export const uid = () => `field-${++idCounter}`

/** A fresh field of the given type, with sensible defaults for its shape. */
export function makeField(type: FieldType, sort_order: number): BuilderField {
  return {
    _id: uid(),
    label: FIELD_TYPES.find((t) => t.type === type)?.label || 'New Field',
    field_type: type,
    placeholder: null,
    options: OPTION_TYPES.has(type) ? ['Option 1', 'Option 2'] : null,
    is_required: false,
    sort_order,
    show_when_field: null,
    show_when_value: null,
  }
}

// `show_when_value` holds one value or several pipe-separated ("Electric|Natural Gas"),
// read as "show when the controlling field equals ANY of these". These two helpers are
// the single source of truth for that encoding in the builder UI.
export function parseWhenValues(v: string | null): string[] {
  return String(v ?? '')
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function joinWhenValues(values: string[]): string | null {
  const cleaned = values.map((s) => s.trim()).filter(Boolean)
  return cleaned.length ? cleaned.join('|') : null
}
