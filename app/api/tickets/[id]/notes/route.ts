import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'
import { requireTicketAccess } from '@/lib/ticket-access'
import { sanitizeNoteHtml, noteHasContent, sanitizeAttachments } from '@/lib/sanitize'

// Ticket notes — a shared reply thread. Writes go through this service-role
// route (NOT the browser anon client), content is sanitized server-side before
// storage, and access is gated via requireTicketAccess, which resolves one of
// three callers (see lib/ticket-access.ts):
//
//   admin    — sees everything; the ONLY role that may push a note to the customer.
//   staff    — holds the `tickets` perm (sales/engineering/production_manager).
//              Sees everything (the admin ticket page already server-renders every
//              internal note to them), posts INTERNAL notes only.
//   customer — only their own ticket; sees only public notes.
//
// visibility/author_type are always forced server-side from `auth` (see migration
// 037's header) so neither can be spoofed by the client.

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
    (data ?? []).map(n => {
      // Strip the author identity (migration 054) for customers: a public note
      // is IAT replying, and which staff member typed it is not the customer's
      // business. Dropped here rather than never selected, because staff/admin
      // callers of this same query DO get it.
      const { author_id, author_name, ...rest } = n
      const base = auth.role === 'customer' ? rest : n
      return {
        ...base,
        content: sanitizeNoteHtml(n.content),
        attachments: sanitizeAttachments(n.attachments, params.id),
      }
    })
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
  // just re-verified against the DB. Branch on the exact role, never on
  // `!== 'admin'`, or staff would fall into the customer branch.
  let visibility: 'internal' | 'public'
  let authorType: 'admin' | 'customer'
  if (auth.role === 'admin') {
    // Admins may opt a note into being shown to the customer ("Reply to
    // customer"); anything missing/invalid defaults to internal (locked-in
    // default — no historical or malformed request can leak).
    visibility = body?.visibility === 'public' ? 'public' : 'internal'
    authorType = 'admin'
  } else if (auth.role === 'staff') {
    // Scoped `tickets` roles post INTERNAL notes only. Forced, ignoring whatever
    // the client sent: sending text to a customer under IAT's name is an
    // admin-only act, so the UI hides the "Reply to customer" toggle for them
    // AND this line makes hiding it unnecessary for security. author_type stays
    // 'admin' — it means "IAT staff, not the customer", and is what the customer
    // thread keys on. These notes are never customer-visible anyway.
    visibility = 'internal'
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
    // Who wrote it (migration 054) — resolved from the session by
    // requireTicketAccess, never read from the request body. The name is a
    // snapshot: deleting the account later must not erase who said what.
    author_id: auth.actorId,
    author_name: auth.actorName,
  }
  if (attachments.length) insert.attachments = attachments

  let { data, error } = await supabaseAdmin
    .from('ticket_notes')
    .insert(insert)
    .select()
    .single()

  // Migration 054 not applied yet → the author columns don't exist. Save the
  // note unattributed rather than fail: this route is the only way to reply on a
  // ticket, and losing a typed note is worse than losing its byline. Attribution
  // starts working the moment 054 runs, with no redeploy.
  if (error && (error.code === 'PGRST204' || error.code === '42703')) {
    console.warn('[notes] migration 054 not applied — saving without attribution:', error.message)
    const { author_id, author_name, ...withoutAuthor } = insert
    ;({ data, error } = await supabaseAdmin
      .from('ticket_notes')
      .insert(withoutAuthor)
      .select()
      .single())
  }

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
