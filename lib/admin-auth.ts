import { createSupabaseServer } from './supabase-server'
import { supabaseAdmin } from './supabase-admin'
import { normalizeRole, isAdminSurfaceRole, hasPermission, type Role, type Perm } from './roles'
import { getPermMatrix } from './permissions'

/**
 * STRICT full-admin gate. Returns the user only if they hold the top-level
 * `admin` role — NOT the scoped roles (sales/hr/marketing/engineering/
 * production_manager). This is the guard used by every admin write action and
 * API route, so scoped roles are fail-closed on mutations by default. Its
 * behavior is unchanged from before granular roles existed.
 */
export async function getAdminUser() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, display_name, is_super_admin')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  if (role !== 'admin') return null
  return {
    user,
    displayName: profile?.display_name || user.email?.split('@')[0] || 'Admin',
    role: 'admin' as const,
    isSuperAdmin: profile?.is_super_admin === true,
  }
}

/**
 * LOOSE admin-surface gate. Returns the user if they hold ANY admin-surface role
 * (full `admin` OR a scoped role). Use for the /admin shell (layout + sidebar)
 * and read-only section pages so scoped roles can view their permitted areas.
 * Page-level access per section is enforced in middleware.ts; `can()` lets a page
 * conditionally render section-specific UI.
 */
export async function getAdminSurfaceUser() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('role, display_name, is_super_admin')
    .eq('id', user.id)
    .single()

  const role = normalizeRole(profile?.role)
  if (!isAdminSurfaceRole(role)) return null
  // Read the DB-backed matrix (cached per request) so can() reflects live
  // permission toggles; falls back to code defaults if unavailable.
  const matrix = await getPermMatrix()
  return {
    user,
    displayName: profile?.display_name || user.email?.split('@')[0] || 'User',
    role: role as Role,
    isSuperAdmin: profile?.is_super_admin === true,
    can: (perm: Perm) => hasPermission(role, perm, matrix),
  }
}

export async function isAdminAuthenticated(): Promise<boolean> {
  return (await getAdminUser()) !== null
}
