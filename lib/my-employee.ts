import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * The signed-in person's row in `employees`, which is what `tickets.owner_id`
 * and `rfq_requests.assignee_id` point at — so it is what any "mine" filter has
 * to resolve to.
 *
 * ⚠️ EMAIL IS THE ONLY JOIN. There is no `user_id` on `employees` (see the type
 * in lib/supabase.ts) and no email on `profiles`; the auth user and the employee
 * row are related by address alone. Two consequences worth knowing:
 *
 *   - Case-insensitive, because an invite-typed address and an auth address
 *     routinely differ only in capitalization.
 *   - NOT `.maybeSingle()`. The employees table is not staff-only — every
 *     customer invite adds a row — so a duplicate address is a thing that can
 *     happen, and maybeSingle() throws rather than degrades when it does.
 *     (Checked 2026-08-21: 10 rows, 0 duplicate addresses, 0 blanks. This is
 *     precaution against the shape of the table, not a fix for current data.)
 *     Active rows sort first and the first is taken.
 *
 * Returns null when there is no match; every caller must treat that as "no
 * personal view available" and hide the feature rather than showing an empty one.
 */
export async function employeeIdForEmail(email: string | null | undefined): Promise<string | null> {
  const addr = email?.trim()
  if (!addr) return null

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, is_active')
    .ilike('email', addr)
    .order('is_active', { ascending: false })
    .limit(1)

  if (error) {
    console.error('[my-employee] lookup failed:', error.message)
    return null
  }
  return data?.[0]?.id ?? null
}
