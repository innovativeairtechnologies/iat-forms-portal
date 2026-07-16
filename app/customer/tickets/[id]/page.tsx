import { notFound } from 'next/navigation'
import { getCustomerUser } from '@/lib/customer-auth'
import CustomerSessionError from '@/components/customer/CustomerSessionError'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeNoteHtml, sanitizeAttachments } from '@/lib/sanitize'
import CustomerTicketDetailClient from './CustomerTicketDetailClient'
import type { Ticket, TicketNote } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

export default async function CustomerTicketDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params
  const session = await getCustomerUser()
  if (!session) return <CustomerSessionError />

  const { data: ticket } = await supabaseAdmin
    .from('tickets')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()
  if (!ticket) notFound()

  // Ownership check — same shape as the "My Requests" `.or()` filter in
  // app/customer/page.tsx (customer_id match OR customer_email match), just
  // applied to this one ticket. Not matching here is treated identically to
  // "doesn't exist" so a customer can't probe for other companies' ticket ids.
  const email = (session.user.email || session.customer.contact_email || '').toLowerCase()
  const owns =
    ticket.customer_id === session.customerId ||
    (!!ticket.customer_email && ticket.customer_email.toLowerCase() === email)
  if (!owns) notFound()

  // Defense in depth: filter to visibility='public' here too, even though the
  // notes API route (used for posting/refetching) also enforces this — the
  // initial server-rendered payload should never even fetch internal notes.
  // Columns are listed explicitly for the same reason: `author_id`/`author_name`
  // (migration 054) must never reach a customer's browser — a public note is IAT
  // replying, and which staff member typed it isn't the customer's business.
  // A bare '*' would ship the name the moment 054 lands.
  const { data: notes } = await supabaseAdmin
    .from('ticket_notes')
    .select('id, ticket_id, content, attachments, created_at, visibility, author_type')
    .eq('ticket_id', params.id)
    .eq('visibility', 'public')
    .order('created_at', { ascending: true })

  const safeNotes = (notes ?? []).map(n => ({
    ...n,
    content: sanitizeNoteHtml(n.content),
    attachments: sanitizeAttachments(n.attachments, params.id),
  })) as TicketNote[]

  return <CustomerTicketDetailClient ticket={ticket as Ticket} initialNotes={safeNotes} />
}
