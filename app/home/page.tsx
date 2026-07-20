import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeRole, landingForRole } from '@/lib/roles'

/* /home now lives INSIDE the portal shell, so the real page is per-shell
   (/admin/home for admin-surface roles, /employee/home for base employees). This
   route stays as a convenience redirect for old links and the login ?redirect=
   param — it sends each visitor to their shell's Company Home. */

export const dynamic = 'force-dynamic'

export default async function HomeRedirect() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  redirect(landingForRole(normalizeRole(profile?.role)))
}
