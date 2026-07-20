'use server'

import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/* Server action behind the "Submit a Suggestion" card. Writes to
   company_suggestions (migration 058) via the service role; the inbox is read by
   admins only. Fails gracefully if the table hasn't been migrated yet. */

export async function submitSuggestion(body: string): Promise<{ ok: boolean; error?: string }> {
  const text = (body || '').trim()
  if (!text) return { ok: false, error: 'Please enter a suggestion first.' }
  if (text.length > 4000) return { ok: false, error: 'That’s a bit long — keep it under 4,000 characters.' }

  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Please sign in to submit a suggestion.' }

  // Capture a display name for the inbox (best-effort; blank reads as anonymous).
  let name: string | null = null
  try {
    const { data: emp } = await supabaseAdmin.from('employees').select('name').eq('id', user.id).single()
    name = emp?.name?.trim() || null
  } catch { /* name is optional */ }

  const { error } = await supabaseAdmin
    .from('company_suggestions')
    .insert({ submitted_by: user.id, name, body: text })

  if (error) {
    console.error('[home] suggestion insert failed:', error)
    return { ok: false, error: 'Couldn’t submit right now. Please try again shortly.' }
  }
  return { ok: true }
}
