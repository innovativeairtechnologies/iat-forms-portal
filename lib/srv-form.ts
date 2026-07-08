import { supabaseAdmin } from './supabase-admin'
import type { Form, FormField } from './supabase'
import {
  SRV_FORM_SLUG, SRV_FORM_TITLE, SRV_FORM_DESCRIPTION, SRV_FORM_CATEGORY,
  srvFormFieldDefs, type SrvSection,
} from './srv'
import { getSrvSections } from './srv-config'

const SRV_NOTIFY_FALLBACK = 'jacob.younker@dehumidifiers.com'

/**
 * Find-or-create the SRV form row and keep its form_fields in sync with
 * lib/srv.ts (the admin detail page renders a submission by iterating its
 * form's fields, so they must exactly match the flattened labels). The form
 * stays is_active-agnostic: /customer/srv is the canonical entry point.
 * Shared by the submit + draft routes.
 */
export async function ensureSrvForm(sectionsOverride?: SrvSection[]): Promise<{ form: Form; fields: FormField[] } | null> {
  let { data: form } = await supabaseAdmin
    .from('forms')
    .select('*')
    .eq('slug', SRV_FORM_SLUG)
    .single()

  if (!form) {
    // Category is best-effort — the form is functional without one.
    const { data: cat } = await supabaseAdmin
      .from('categories')
      .select('id')
      .eq('name', SRV_FORM_CATEGORY)
      .single()

    const { data: created, error } = await supabaseAdmin
      .from('forms')
      .insert({
        title: SRV_FORM_TITLE,
        description: SRV_FORM_DESCRIPTION,
        slug: SRV_FORM_SLUG,
        category_id: cat?.id ?? null,
        is_active: false,
        success_message: 'Thank you. Your Start-Up Readiness Verification has been received.',
      })
      .select()
      .single()
    if (error || !created) {
      console.error('[srv] Failed to create SRV form:', error)
      return null
    }
    form = created
  }

  // An SRV landing silently would stall a start-up — if the form has NO
  // notification rules at all, seed the default. Admin-edited rules are
  // untouched (we only act on zero).
  const { count: ruleCount } = await supabaseAdmin
    .from('notification_rules')
    .select('*', { count: 'exact', head: true })
    .eq('form_id', form.id)
  if ((ruleCount ?? 0) === 0) {
    await supabaseAdmin.from('notification_rules').insert({
      form_id: form.id,
      recipient_email: SRV_NOTIFY_FALLBACK,
      recipient_name: 'IAT Service',
      send_on_submit: true,
      email_subject: 'New Start-Up Readiness Verification (SRV)',
    })
  }

  const expected = srvFormFieldDefs(sectionsOverride ?? await getSrvSections())
  const { data: existing } = await supabaseAdmin
    .from('form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('sort_order')

  const projection = (rows: Array<{ label: string; field_type: string; options: string[] | null; is_required: boolean }>) =>
    JSON.stringify(rows.map((f) => [f.label, f.field_type, f.options ?? null, f.is_required]))

  if (projection(existing || []) !== projection(expected)) {
    // Content model changed (or the old draft's fields are still there) — replace
    // wholesale. Submission data is denormalized by label, so history is safe.
    if (existing?.length) {
      await supabaseAdmin.from('form_fields').delete().eq('form_id', form.id)
    }
    const { error } = await supabaseAdmin.from('form_fields').insert(
      expected.map((f, i) => ({
        form_id: form!.id,
        label: f.label,
        field_type: f.field_type,
        placeholder: f.placeholder,
        options: f.options,
        is_required: f.is_required,
        sort_order: i,
      }))
    )
    if (error) console.error('[srv] Field sync failed:', error)
    // Title/description drift too when the model changes.
    await supabaseAdmin
      .from('forms')
      .update({ title: SRV_FORM_TITLE, description: SRV_FORM_DESCRIPTION })
      .eq('id', form.id)
  }

  const { data: fields } = await supabaseAdmin
    .from('form_fields')
    .select('*')
    .eq('form_id', form.id)
    .order('sort_order')

  return { form: form as Form, fields: (fields || []) as FormField[] }
}

/** Light lookup when field sync isn't needed (draft reads, page loads). */
export async function getSrvForm(): Promise<Form | null> {
  const { data } = await supabaseAdmin
    .from('forms')
    .select('*')
    .eq('slug', SRV_FORM_SLUG)
    .single()
  return (data as Form) || null
}

// ── Review state (stored under a non-field key in submissions.data, so it
//    never renders as a response row in the admin detail page) ────────────────

export type SrvReview = {
  decision: 'approve' | 'return'
  notes: string
  at: string
  by: string
  /** Set on the old submission when a revision supersedes it. */
  superseded_by?: string
}

export function getSrvReview(data: Record<string, unknown>): SrvReview | null {
  const r = data?.['_review']
  if (!r || typeof r !== 'object') return null
  return r as SrvReview
}
