import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { warrantyState, isExpiringSoon } from '@/lib/equipment'
import TicketsQueueClient from './TicketsQueueClient'

export const dynamic = 'force-dynamic'

/**
 * The signed-in person's row in `employees`, which is what `tickets.owner_id`
 * points at — so it is what "My Tickets" has to filter on.
 *
 * ⚠️ EMAIL IS THE ONLY JOIN. There is no user_id on `employees` (see the type in
 * lib/supabase.ts); the auth user and the employee row are related by address
 * alone. Two consequences worth knowing before touching this:
 *
 *   - Case-insensitive match, because an invite-typed address and an auth
 *     address routinely differ only in capitalization.
 *   - NOT `.maybeSingle()`. The employees table is not staff-only — every
 *     customer invite adds a row — so a duplicate address is a thing that can
 *     happen, and maybeSingle() throws rather than degrades when it does.
 *     (Checked 2026-08-21: 10 rows, 0 duplicate addresses, 0 blanks. This is
 *     precaution against the shape of the table, not a fix for current data.)
 *     Active rows sort first and the first is taken.
 *
 * Returns null when there is no match, and the client hides the tab rather than
 * showing one that is always empty.
 */
async function myEmployeeId(): Promise<string | null> {
  const actor = await getAdminSurfaceUser()
  const email = actor?.user.email?.trim()
  if (!email) return null

  const { data, error } = await supabaseAdmin
    .from('employees')
    .select('id, is_active')
    .ilike('email', email)
    .order('is_active', { ascending: false })
    .limit(1)

  if (error) {
    console.error('[admin/tickets] employee lookup failed:', error.message)
    return null
  }
  return data?.[0]?.id ?? null
}

export default async function AdminTicketsPage() {
  const [{ data: tickets }, { data: equipment }, meId] = await Promise.all([
    supabaseAdmin.from('tickets').select('*, owner:employees(id, name)').order('created_at', { ascending: false }),
    supabaseAdmin.from('equipment').select('serial_number, ship_date, warranty_months, warranty_end'),
    myEmployeeId(),
  ])

  // serial → warranty state, for an at-intake badge in the queue
  const warrantyBySerial: Record<string, 'in' | 'expiring' | 'out' | 'unknown'> = {}
  for (const e of equipment ?? []) {
    const s = warrantyState(e)
    warrantyBySerial[e.serial_number] = s === 'in' && isExpiringSoon(e) ? 'expiring' : s
  }

  return <TicketsQueueClient tickets={tickets || []} warrantyBySerial={warrantyBySerial} meId={meId} />
}
