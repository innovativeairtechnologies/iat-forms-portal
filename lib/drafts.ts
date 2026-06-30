import { createSupabaseServer } from './supabase-server'
import { supabaseAdmin } from './supabase-admin'

// Shape passed to the client "Resume" list. Mirrors EmployeeFormsView's local
// FormDraftItem (kept separate so the client component never imports this
// server-only module).
export type UserFormDraft = {
  id: string
  form_id: string
  slug: string
  title: string
  label: string | null
  data: Record<string, unknown>
  current_step: number
  updated_at: string
}

// The logged-in user's in-progress form drafts (newest first), for the "Resume"
// list. Returns [] when signed out or on any error — drafts are a nicety and must
// never block the page from rendering.
export async function getUserFormDrafts(): Promise<UserFormDraft[]> {
  try {
    const supabase = await createSupabaseServer()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return []

    const { data } = await supabaseAdmin
      .from('form_drafts')
      .select('id, form_id, label, data, current_step, updated_at, forms(title, slug, is_active)')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })

    // Supabase types the to-one `forms` embed as an array; at runtime it's a single
    // object (or null). Cast to the real shape.
    const rows = (data || []) as unknown as Array<{
      id: string; form_id: string; label: string | null; data: unknown
      current_step: number; updated_at: string
      forms: { title: string; slug: string; is_active: boolean } | null
    }>
    return rows
      .filter((d) => d.forms?.is_active)
      .map((d) => ({
        id: d.id,
        form_id: d.form_id,
        title: d.forms!.title,
        slug: d.forms!.slug,
        label: d.label,
        data: (d.data || {}) as Record<string, unknown>,
        current_step: d.current_step,
        updated_at: d.updated_at,
      }))
  } catch {
    return []
  }
}
