import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'
import { requireTicketAccess } from '@/lib/ticket-access'
import { sanitizeNoteHtml, noteHasContent, sanitizeAttachments } from '@/lib/sanitize'

// Ticket notes — a shared reply thread. Writes go through this service-role
// route (NOT the browser anon client), content is sanitized server-side before
// storage, and access is dual-gated via requireTicketAccess: an admin sees/can
// post anything, a customer can only see/post on a ticket they own, and a
// customer's note is always forced internal→public/admin→customer server-side
// (see migration 037's header) so visibility can never be spoofed by the client.

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireTicketAccess(params.id)
  if (auth instanceof NextResponse) return auth

  let query = supabaseAdmin
    .from('ticket_notes')
    .select('*')
    .eq('ticket_id', params.id)
    .order('created_at', { ascending: true })

  // Customers only ever see notes explicitly marked public (or their own —
  // which are always public too, per the POST branch below), even though the
  // UI would also filter — never let an internal note leave the server.
  if (auth.role === 'customer') query = query.eq('visibility', 'public')

  const { data, error } = await query

  if (error) return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  return NextResponse.json(
    (data ?? []).map(n => ({
      ...n,
      content: sanitizeNoteHtml(n.content),
      attachments: sanitizeAttachments(n.attachments, params.id),
    }))
  )
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const auth = await requireTicketAccess(params.id)
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const clean = sanitizeNoteHtml(typeof body?.content === 'string' ? body.content : '')
  const attachments = sanitizeAttachments(body?.attachments, params.id)
  if (!noteHasContent(clean) && attachments.length === 0) {
    return NextResponse.json({ error: 'Add a note or an attachment' }, { status: 400 })
  }

  // visibility/author_type are NEVER trusted from the client for what they'd
  // resolve to — they're derived entirely from `auth`, which requireTicketAccess
  // just re-verified against the DB.
  let visibility: 'internal' | 'public'
  let authorType: 'admin' | 'customer'
  if (auth.role === 'admin') {
    // Admins may opt a note into being shown to the customer ("Reply to
    // customer"); anything missing/invalid defaults to internal (locked-in
    // default — no historical or malformed request can leak).
    visibility = body?.visibility === 'public' ? 'public' : 'internal'
    authorType = 'admin'
  } else {
    // Customer-authored notes are always public/customer — forced, ignoring
    // whatever the client sent for these two fields.
    visibility = 'public'
    authorType = 'customer'
  }

  // Only set `attachments` when present so text-only notes still save even if
  // migration 019 hasn't been run yet (the column would be missing). Normalize
  // empty content to '' so an attachment-only note doesn't render a stray <p>.
  const insert: Record<string, unknown> = {
    ticket_id: params.id,
    content: noteHasContent(clean) ? clean : '',
    visibility,
    author_type: authorType,
  }
  if (attachments.length) insert.attachments = attachments

  const { data, error } = await supabaseAdmin
    .from('ticket_notes')
    .insert(insert)
    .select()
    .single()

  if (error) return NextResponse.json({ error: 'Failed to save note' }, { status: 500 })
  return NextResponse.json(data)
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const err = await requireAdminAuth();if (err) return err
  const { note_id } = await req.json().catch(() => ({}))
  if (!note_id) return NextResponse.json({ error: 'note_id required' }, { status: 400 })

  const { error } = await supabaseAdmin
    .from('ticket_notes')
    .delete()
    .eq('id', note_id)
    .eq('ticket_id', params.id)

  if (error) return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  return NextResponse.json({ success: true })
}
