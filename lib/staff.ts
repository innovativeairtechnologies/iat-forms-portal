import { supabaseAdmin } from '@/lib/supabase-admin'

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
