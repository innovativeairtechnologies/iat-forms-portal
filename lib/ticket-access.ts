import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'
import { getCustomerUser } from '@/lib/customer-auth'

export type TicketAuth = { role: 'admin' } | { role: 'customer'; customerId: string }

/**
 * Resolves either an admin session (full access to any ticket) or a customer
 * session that OWNS this specific ticket (re-verified against the DB — never
 * trusted from the client/route params alone). Returns a NextResponse error
 * if neither applies, so callers can `if (auth instanceof NextResponse) return auth`.
 *
 * Ownership mirrors the exact `.or()` check app/customer/page.tsx uses to build
 * "My Requests" (customer_id match OR customer_email match), just scoped to one
 * ticket instead of a list — a ticket is "theirs" if it was explicitly linked to
 * their customer account, or if the email matches (covers tickets filed before
 * a customer login existed / a different contact at the same company).
 *
 * This is the single security boundary shared by every dual-auth ticket route
 * (notes, attachments, attachments/download, attachments/preview) — admin and
 * customer requests both funnel through here so the ownership check can't be
 * skipped or duplicated-and-drifted across routes.
 */
export async function requireTicketAccess(ticketId: string): Promise<TicketAuth | NextResponse> {
  const adminErr = await requireAdminAuth()
  if (adminErr === null) return { role: 'admin' }

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

  return { role: 'customer', customerId: session.customerId }
}
