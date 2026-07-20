import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeRole, landingForRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

// Root is a role-aware router: it never renders UI, it just sends each visitor
// to the right home. Individual public forms live at /forms/[slug]; there is no
// public forms index (removed 2026-07-15 — forms are reached by direct link).
export default async function RootRouter() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Every internal role lands on the shared company home (/home); customers go to
  // their own portal. From /home, "Launch IAT Portal" sends each person on into
  // their actual workspace (homeForRole). Middleware re-gates whichever we pick.
  redirect(landingForRole(normalizeRole(profile?.role)))
}
