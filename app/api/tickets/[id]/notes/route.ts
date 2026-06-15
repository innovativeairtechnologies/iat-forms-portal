import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'
import { sanitizeNoteHtml, noteHasContent, sanitizeAttachments } from '@/lib/sanitize'

// Internal ticket notes. Writes go through this admin-gated, service-role route
// (NOT the browser anon client) so notes can only be created by authenticated
// admins, and content is sanitized server-side before storage.

export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const err = await requireAdminAuth(); if (err) return err
  const { data, error } = await supabaseAdmin
    .from('ticket_notes')
    .select('*')
    .eq('ticket_id', params.id)
    .order('created_at', { ascending: true })

  if (error) return NextResponse.json({ error: 'Failed to load notes' }, { status: 500 })
  return NextResponse.json(
    (data ?? []).map(n => ({
      ...n,
      content: sanitizeNoteHtml(n.content),
      attachments: sanitizeAttachments(n.attachments, params.id),
    }))
  )
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const err = await requireAdminAuth(); if (err) return err

  const body = await req.json().catch(() => null)
  const clean = sanitizeNoteHtml(typeof body?.content === 'string' ? body.content : '')
  const attachments = sanitizeAttachments(body?.attachments, params.id)
  if (!noteHasContent(clean) && attachments.length === 0) {
    return NextResponse.json({ error: 'Add a note or an attachment' }, { status: 400 })
  }

  // Only set `attachments` when present so text-only notes still save even if
  // migration 019 hasn't been run yet (the column would be missing). Normalize
  // empty content to '' so an attachment-only note doesn't render a stray <p>.
  const insert: Record<string, unknown> = {
    ticket_id: params.id,
    content: noteHasContent(clean) ? clean : '',
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

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const err = await requireAdminAuth(); if (err) return err
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
