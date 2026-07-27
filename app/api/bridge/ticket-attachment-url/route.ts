import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { getBridgeTicket } from '@/lib/bridge-ticket-access'
import type { NoteAttachment } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

// Short-lived: long enough to click through, short enough that a leaked URL
// (referer header, pasted link) stops working quickly.
const EXPIRES_SECONDS = 120

/**
 * Bridge: issue a short-lived signed DOWNLOAD url for a ticket attachment.
 *
 * Three checks, deliberately layered:
 *   1. the ticket belongs to this customer
 *   2. the path sits under that ticket's id prefix
 *   3. the path is referenced by a PUBLIC note on that ticket
 *
 * (3) is the one the internal routes don't do. There, an owning customer is kept
 * out of an INTERNAL-note attachment on their own ticket only by the path being
 * an unguessable random string — isolation resting on secrecy rather than a
 * check. Paths do leak (referer headers, pasted links, browser telemetry), so
 * this side verifies membership explicitly instead.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/ticket-attachment-url')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  const ticketId = requireString(auth.body, 'ticketId')
  const path = requireString(auth.body, 'path')
  if (!customerId || !ticketId || !path) {
    return NextResponse.json({ error: 'Missing customerId, ticketId or path' }, { status: 400 })
  }

  const owned = await getBridgeTicket(customerId, ticketId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Prefix + traversal guard.
  if (!path.startsWith(`${ticketId}/`) || path.includes('..')) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Membership: the path must appear on a PUBLIC note of this ticket.
  const { data: notes } = await supabaseAdmin
    .from('ticket_notes')
    .select('attachments')
    .eq('ticket_id', ticketId)
    .eq('visibility', 'public')

  const isPublicAttachment = (notes ?? []).some((n) =>
    ((n.attachments as NoteAttachment[] | null) ?? []).some((a) => a?.path === path)
  )
  if (!isPublicAttachment) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { data, error } = await supabaseAdmin.storage
    .from('ticket-attachments')
    .createSignedUrl(path, EXPIRES_SECONDS)

  if (error || !data) return NextResponse.json({ error: 'Could not open file' }, { status: 500 })
  return NextResponse.json({ url: data.signedUrl })
}
