import 'server-only'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * Ownership check for the customer-portal ticket bridges.
 *
 * Mirrors requireTicketAccess's customer branch, with the same narrowing the
 * tickets-list bridge uses: the match email is derived HERE from the customer's
 * own record rather than taken from the caller. A caller-supplied email would
 * let a compromised customer deployment reach another company's tickets.
 *
 * Returns null for "not yours" AND for "doesn't exist" — deliberately
 * indistinguishable, so ticket ids can't be probed.
 */
export async function getBridgeTicket(customerId: string, ticketId: string) {
  const [{ data: customer }, { data: ticket }] = await Promise.all([
    supabaseAdmin.from('customers').select('contact_email').eq('id', customerId).maybeSingle(),
    supabaseAdmin
      .from('tickets')
      .select('id, customer_id, customer_email, status, customer_marked_resolved')
      .eq('id', ticketId)
      .maybeSingle(),
  ])

  if (!ticket) return null

  const email = (customer?.contact_email || '').toLowerCase()
  const owns =
    ticket.customer_id === customerId ||
    (!!email && !!ticket.customer_email && ticket.customer_email.toLowerCase() === email)

  return owns ? ticket : null
}
