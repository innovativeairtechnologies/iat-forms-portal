import { createSupabaseServer } from './supabase-server'
import { supabaseAdmin } from './supabase-admin'
import { NextResponse } from 'next/server'

export async function requireAdminAuth(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/**
 * Guard for super-admin-only actions (e.g. approving a form to go live).
 * Returns the authenticated user's id on success, or a NextResponse error to
 * return directly. Usage:
 *   const auth = await requireSuperAdmin()
 *   if (auth instanceof NextResponse) return auth
 *   // auth.userId is available
 */
export async function requireSuperAdmin(): Promise<{ userId: string } | NextResponse> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, is_super_admin')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  if (profile?.is_super_admin !== true) {
    return NextResponse.json({ error: 'Super admin approval required.' }, { status: 403 })
  }
  return { userId: user.id }
}
