import { createSupabaseServer } from './supabase-server'
import { supabaseAdmin } from './supabase-admin'

export async function getAdminUser() {
  const supabase = createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, display_name, is_super_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') return null
  return {
    user,
    displayName: profile.display_name || user.email?.split('@')[0] || 'Admin',
    role: profile.role as 'admin',
    isSuperAdmin: profile.is_super_admin === true,
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  return (await getAdminUser()) !== null
}
