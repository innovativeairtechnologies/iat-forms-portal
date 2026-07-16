import { supabaseAdmin } from '@/lib/supabase-admin'
import { getPermMatrix } from '@/lib/permissions'
import { hasPermission, normalizeRole, type Perm } from '@/lib/roles'
import type { Employee } from '@/lib/supabase'

/* ─────────────────────────────────────────────────────────────────────────────
   Staff vs customers in the `employees` table.

   EVERY auth user gets an employees row. handle_new_user() (migration 001) fires
   on every auth.users insert, including the ones /api/admin/customers/invite
   creates for customers. That route then sets profiles.role = 'customer', but
   nothing removes the employees row the trigger just made — so a customer sits
   in `employees` looking exactly like staff, and every future invite adds
   another one. Filtering them out is therefore a permanent duty of any surface
   that reads `employees` as a staff roster, not a one-time data cleanup.

   These helpers are the join, because there is no FK to join on: employees.id
   and profiles.id both reference auth.users(id), but neither references the
   other, so PostgREST cannot embed one in the other. The role must be fetched
   separately and matched in memory.

   NB: an employees row with NO profiles row is NOT a customer — it resolves to
   role = null and stays in the roster. That state is real (one employee-portal
   test account is in it) and deliberate.
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Auth ids whose profile marks them a customer rather than staff.
 *
 * Fails OPEN — on an unreadable profiles table this returns an empty set, so
 * callers show the roster they showed before this filter existed. That is the
 * right failure for a roster: a blank org chart reads as "everyone left", which
 * is a worse lie than a too-long list. Anything making an AUTHORIZATION decision
 * must use isCustomer() instead, which fails closed.
 */
export async function getCustomerIds(): Promise<Set<string>> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'customer')

  if (error) {
    console.error('[staff] could not load customer ids, showing unfiltered roster:', error)
    return new Set()
  }
  return new Set((data ?? []).map((p) => p.id as string))
}

/**
 * Is this one account a customer? For authorization decisions.
 *
 * Fails CLOSED — an unreadable profile answers "yes, a customer" so the caller
 * refuses the action. Do not swap this for getCustomerIds(), which fails open on
 * purpose for the opposite reason.
 */
export async function isCustomer(id: string): Promise<boolean> {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('role')
    .eq('id', id)
    .maybeSingle()

  if (error) {
    console.error('[staff] could not read profile role, refusing:', error)
    return true
  }
  return data?.role === 'customer'
}

/* ─────────────────────────────────────────────────────────────────────────────
   Resolving people from `profiles.role`, not `employees.is_admin`.

   `is_admin` is a denormalized copy of "profiles.role = admin" with exactly two
   writers (/api/employees/invite, /api/admin/users/[id]/role). Any third path
   that sets a role — a dashboard hand-edit, a migration, a new route — leaves it
   stale, and a stale `is_admin` silently keeps a demoted admin on the recipient
   lists below. Both helpers therefore resolve the role live and never read that
   column. See docs/roles-and-permissions.md.
   ───────────────────────────────────────────────────────────────────────────── */

/**
 * Active staff holding `perm`, as employees rows — for assignable-owner pickers,
 * NOT for access decisions (the caller's own guard does that).
 *
 * Reads the role from `profiles` and the grant from the live matrix — the same
 * pair the lib/api-auth.ts guards use — so granting or revoking a perm in
 * /admin/permissions moves the list without a deploy, and the list can't disagree
 * with who middleware lets onto the matching page.
 *
 * No getCustomerIds() call is needed here, and adding one would be redundant:
 * hasPermission() is false for `customer` and for the null role an employees row
 * with no profile resolves to, so both are already excluded — by holding no
 * permission rather than by being filtered.
 *
 * Fails CLOSED, unlike getCustomerIds() above: an unreadable profiles table gives
 * an empty list. That inverts on purpose — a roster's worst failure is a blank
 * org chart reading as "everyone left", but a picker's worst failure is offering
 * the wrong people, and every auth user has an employees row to offer. Callers
 * needing a currently-set value to stay selectable must union it back in
 * themselves (see the ticket-owner picker).
 */
export async function getEmployeesWithPerm(perm: Perm): Promise<Pick<Employee, 'id' | 'name'>[]> {
  const [{ data: profiles, error }, matrix] = await Promise.all([
    supabaseAdmin.from('profiles').select('id, role'),
    getPermMatrix(),
  ])

  if (error) {
    console.error(`[staff] could not load roles for the '${perm}' roster:`, error)
    return []
  }

  const ids = (profiles ?? [])
    .filter((p) => hasPermission(normalizeRole(p.role as string | null), perm, matrix))
    .map((p) => p.id as string)
  if (ids.length === 0) return []

  const { data, error: rosterErr } = await supabaseAdmin
    .from('employees')
    .select('id, name')
    .in('id', ids)
    .eq('is_active', true)
    .order('name')

  if (rosterErr) {
    console.error(`[staff] could not load the '${perm}' roster:`, rosterErr)
    return []
  }
  return data ?? []
}

/**
 * Active admins, as employees rows — the recipients of admin notification email
 * (daily digest, new ticket, new PTO/sick request).
 *
 * THROWS on an unreadable profiles table rather than returning []: a recipient
 * list you couldn't compute is not an empty recipient list, and silently mailing
 * nobody is how a digest dies unnoticed. Callers that would rather degrade than
 * fail catch it and fall back to ADMIN_NOTIFICATION_EMAIL.
 */
export async function getAdminRecipients(): Promise<Employee[]> {
  const { data: profiles, error } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('role', 'admin')
  if (error) throw error

  const ids = (profiles ?? []).map((p) => p.id as string)
  if (ids.length === 0) return []

  const { data, error: rosterErr } = await supabaseAdmin
    .from('employees')
    .select('*')
    .in('id', ids)
    .eq('is_active', true)
  if (rosterErr) throw rosterErr
  return data ?? []
}
