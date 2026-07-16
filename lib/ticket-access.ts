import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminUser, getTicketsActor } from '@/lib/admin-auth'
import { getCustomerUser } from '@/lib/customer-auth'

/** Who wrote/requested this — resolved from the session, never from the client. */
export type TicketActor = { actorId: string; actorName: string }

export type TicketAuth =
  | ({ role: 'admin' } & TicketActor)
  | ({ role: 'staff' } & TicketActor)
  | ({ role: 'customer'; customerId: string } & TicketActor)

/**
 * Resolves one of three callers for a ticket route:
 *
 *   'admin'    — full `profiles.role = 'admin'`. Any ticket, and the only role
 *                that may make a note visible to the customer.
 *   'staff'    — holds the `tickets` perm (sales / engineering /
 *                production_manager), read live from the matrix via
 *                getTicketsActor(). Any ticket, INTERNAL notes only.
 *   'customer' — a customer session that OWNS this specific ticket, re-verified
 *                against the DB (never trusted from the client/route params).
 *
 * Returns a NextResponse error if none apply, so callers can
 * `if (auth instanceof NextResponse) return auth`.
 *
 * Ownership mirrors the exact `.or()` check app/customer/page.tsx uses to build
 * "My Requests" (customer_id match OR customer_email match), just scoped to one
 * ticket instead of a list — a ticket is "theirs" if it was explicitly linked to
 * their customer account, or if the email matches (covers tickets filed before
 * a customer login existed / a different contact at the same company).
 *
 * This is the single security boundary shared by every dual-auth ticket route
 * (notes, attachments, attachments/download, attachments/preview) — admin, staff
 * and customer requests all funnel through here so the ownership check can't be
 * skipped or duplicated-and-drifted across routes. Order matters: admin is tried
 * first so a full admin is never downgraded to 'staff' (admins hold every perm,
 * so getTicketsActor would also accept them).
 *
 * NB 'staff' is NOT a customer-facing role. Callers that can expose data to a
 * customer must branch on `role === 'customer'` explicitly rather than testing
 * `role !== 'admin'` — the latter would silently sweep staff into the customer
 * branch. The note-visibility rules in the notes route are written that way.
 */
export async function requireTicketAccess(ticketId: string): Promise<TicketAuth | NextResponse> {
  const admin = await getAdminUser()
  if (admin) return { role: 'admin', actorId: admin.user.id, actorName: admin.displayName }

  const staff = await getTicketsActor()
  if (staff) return { role: 'staff', actorId: staff.user.id, actorName: staff.displayName }

  const session = await getCustomerUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('id, customer_id, customer_email')
    .eq('id', ticketId)
    .maybeSingle()
  if (!ticket) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const email = (session.user.email || session.customer.contact_email || '').toLowerCase()
  const owns =
    ticket.customer_id === session.customerId ||
    (!!ticket.customer_email && ticket.customer_email.toLowerCase() === email)
  if (!owns) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  return {
    role: 'customer',
    customerId: session.customerId,
    actorId: session.user.id,
    actorName: session.displayName,
  }
}
