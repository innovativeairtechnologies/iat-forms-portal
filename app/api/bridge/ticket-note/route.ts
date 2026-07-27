import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { getBridgeTicket } from '@/lib/bridge-ticket-access'
import { sanitizeNoteHtml, noteHasContent } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

/**
 * Bridge: customer posts a reply on their own ticket.
 *
 * visibility and author_type are FORCED server-side from the resolved role —
 * never read from the request. A customer must not be able to write an internal
 * note or impersonate staff, and the only way to guarantee that is to ignore
 * whatever the caller sends for those fields.
 *
 * Attachments are not accepted here yet: ticket media lives in the internal
 * private bucket and needs its own signed-upload bridge, so a customer-side
 * attachment would have nowhere to land.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/ticket-note')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  const ticketId = requireString(auth.body, 'ticketId')
  const rawContent = typeof auth.body.content === 'string' ? auth.body.content : ''

  if (!customerId || !ticketId) {
    return NextResponse.json({ error: 'Missing customerId or ticketId' }, { status: 400 })
  }

  const owned = await getBridgeTicket(customerId, ticketId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const content = sanitizeNoteHtml(rawContent)
  if (!noteHasContent(content)) {
    return NextResponse.json({ error: 'Please write a message.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('ticket_notes')
    .insert({
      ticket_id: ticketId,
      content,
      visibility: 'public', // forced
      author_type: 'customer', // forced
    })
    .select('id, content, created_at, author_type')
    .single()

  if (error) return NextResponse.json({ error: 'Could not post your message.' }, { status: 500 })
  return NextResponse.json({ note: { ...data, attachments: [] } })
}
