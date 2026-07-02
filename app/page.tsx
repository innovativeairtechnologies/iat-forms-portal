import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeRole, homeForRole } from '@/lib/roles'

export const dynamic = 'force-dynamic'

// Root is a role-aware router: it never renders UI, it just sends each visitor
// to the right home. The public forms directory now lives at /forms.
export default async function RootRouter() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  // Single source of truth: admins/scoped roles → their /admin home, customers
  // → /customer, base production → /employee. Avoids the /employee detour bounce.
  redirect(homeForRole(normalizeRole(profile?.role)))
}
