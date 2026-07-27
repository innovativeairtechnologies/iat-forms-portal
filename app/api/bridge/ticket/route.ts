import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { getBridgeTicket } from '@/lib/bridge-ticket-access'
import { sanitizeNoteHtml, sanitizeAttachments } from '@/lib/sanitize'

export const dynamic = 'force-dynamic'

// Customer-safe ticket columns for the detail view. Same allow-list the internal
// customer detail page settled on (after it was fixed for leaking the whole row),
// minus customer_id which stays internal.
const DETAIL_COLUMNS =
  'id, ticket_number, status, priority, created_at, problem_description, serial_number, model_number, voltage, customer_name, customer_company, customer_email, customer_phone, preferred_contact_method, customer_marked_resolved, photo_urls'

/**
 * Bridge: one ticket's detail + its PUBLIC reply thread.
 *
 * Two layers of note filtering, both deliberate and both kept:
 *   • visibility = 'public'  — internal staff notes never cross the boundary
 *   • author_id / author_name are NEVER selected — a public note is "IAT
 *     replying"; which staff member typed it isn't the customer's business
 *
 * Content and attachments are re-sanitized on read (not just on write), because
 * rows predating the write-side sanitizer still exist.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/ticket')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  const ticketId = requireString(auth.body, 'ticketId')
  if (!customerId || !ticketId) {
    return NextResponse.json({ error: 'Missing customerId or ticketId' }, { status: 400 })
  }

  // "Not yours" and "doesn't exist" both land here as 404, so ids can't be probed.
  const owned = await getBridgeTicket(customerId, ticketId)
  if (!owned) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [{ data: ticket }, { data: notes }] = await Promise.all([
    supabaseAdmin.from('tickets').select(DETAIL_COLUMNS).eq('id', ticketId).single(),
    supabaseAdmin
      .from('ticket_notes')
      .select('id, ticket_id, content, attachments, created_at, author_type')
      .eq('ticket_id', ticketId)
      .eq('visibility', 'public')
      .order('created_at', { ascending: true }),
  ])

  const safeNotes = (notes ?? []).map((n) => ({
    id: n.id,
    author_type: n.author_type,
    created_at: n.created_at,
    content: sanitizeNoteHtml(n.content),
    attachments: sanitizeAttachments(n.attachments, ticketId),
  }))

  return NextResponse.json({ ticket, notes: safeNotes })
}
