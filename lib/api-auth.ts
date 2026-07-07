import { createSupabaseServer } from './supabase-server'
import { supabaseAdmin } from './supabase-admin'
import { NextResponse } from 'next/server'
import { normalizeRole, hasPermission } from './roles'

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
 * Scoped write guard for the deals (sales pipeline) API routes only. Every
 * other write endpoint in the app gates on requireAdminAuth (admin-only) per
 * the v1 roles model — this is a deliberate, narrow exception because the
 * deals feature's whole point is that sales reps edit their own pipeline
 * in-place (see docs/roles-and-permissions.md). Do not reuse this for any
 * other route; add a similarly-scoped, similarly-named guard instead.
 */
export async function requireDealsAuth(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  if (!hasPermission(role, 'deals')) {
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
