import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { getBridgeTicket } from '@/lib/bridge-ticket-access'
import { sanitizeNoteHtml, sanitizeAttachments, noteHasContent } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

/**
 * Bridge: customer posts a reply on their own ticket.
 *
 * visibility and author_type are FORCED server-side from the resolved role —
 * never read from the request. A customer must not be able to write an internal
 * note or impersonate staff, and the only way to guarantee that is to ignore
 * whatever the caller sends for those fields.
 *
 * Attachments are run through sanitizeAttachments, which drops anything not
 * under this ticket's id prefix — so a note can't reference another ticket's
 * files even though the bucket is shared.
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
  // Scoped to this ticket's prefix, so a note can't reference another ticket's files.
  const attachments = sanitizeAttachments(auth.body.attachments, ticketId)

  // A note needs SOMETHING — text or a file.
  if (!noteHasContent(content) && attachments.length === 0) {
    return NextResponse.json({ error: 'Please write a message.' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('ticket_notes')
    .insert({
      ticket_id: ticketId,
      content,
      attachments,
      visibility: 'public', // forced
      author_type: 'customer', // forced
    })
    .select('id, content, attachments, created_at, author_type')
    .single()

  if (error) return NextResponse.json({ error: 'Could not post your message.' }, { status: 500 })
  return NextResponse.json({ note: data })
}
