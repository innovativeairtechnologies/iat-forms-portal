import { createSupabaseServer } from './supabase-server'
import { supabaseAdmin } from './supabase-admin'
import { NextResponse } from 'next/server'
import { normalizeRole, hasPermission } from './roles'
import { getPermMatrix } from './permissions'

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
  // Consult the DB-backed matrix (migration 045) — the same source middleware
  // and the nav use — so revoking 'deals' in /admin/permissions actually blocks
  // deal writes (not just hides the page), and granting it to another scoped
  // role enables writes to match the page access. Falls back to code defaults if
  // the matrix is unavailable.
  const matrix = await getPermMatrix()
  if (!hasPermission(role, 'deals', matrix)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/**
 * Manage guard for the Tool Crib admin routes (registry writes, force check-in,
 * custody transfer, labels). Matrix-backed like requireDealsAuth — that one's
 * doc comment says to add a similarly-scoped, similarly-named guard rather than
 * reuse it, so this is that guard, not a second caller of `deals`.
 *
 * Consults the DB matrix (045) so revoking `tool_crib` in /admin/permissions
 * actually blocks writes rather than merely hiding the page.
 */
export async function requireToolCribAuth(): Promise<NextResponse | null> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  const matrix = await getPermMatrix()
  if (!hasPermission(role, 'tool_crib', matrix)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }
  return null
}

/**
 * Scan guard: ANY signed-in staff member may check a tool out or back in —
 * including the base `production` role, who hold no admin perms at all. That's
 * the whole point: the person grabbing the drill is the person scanning it.
 *
 * Deliberately NOT perm-gated. Gating scans on `tool_crib` would mean only
 * managers could take tools out, which defeats the feature.
 *
 * Returns the actor's employees.id (= auth user id) and name. Resolving these
 * here rather than trusting the client is what makes "who took it" trustworthy —
 * the identity comes from the session cookie, never from the request body.
 * The employees row must exist because crib_tools.held_by FKs to it; a missing
 * row fails here with a legible message instead of an opaque FK violation.
 */
export async function requireCribActor(): Promise<{ actorId: string; actorName: string } | NextResponse> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  if (role === 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: employee } = await supabaseAdmin
    .from('employees')
    .select('id, name, is_active')
    .eq('id', user.id)
    .single()

  if (!employee) {
    return NextResponse.json(
      { error: 'Your account isn’t linked to an employee record — ask an admin to set that up.' },
      { status: 403 }
    )
  }
  if (employee.is_active === false) {
    return NextResponse.json({ error: 'This account is deactivated.' }, { status: 403 })
  }

  return { actorId: employee.id, actorName: employee.name ?? 'Unknown' }
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
