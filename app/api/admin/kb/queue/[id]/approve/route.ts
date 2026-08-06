import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { ingestTranscript } from '@/lib/kb-ingest'

// Approve one queued SharePoint document → commit it to Jerry's knowledge.
//
// The transcript is read from the QUEUE ROW server-side, never accepted from the
// request body: the browser was shown a scrub preview of a specific document, so
// what gets stored must be that same document's text.
//
// The published row is stamped with source='sharepoint' + sharepoint_item_id.
// That stamp IS the anti-loop mechanism — the next pull asks kb_documents which
// SharePoint items are already published and skips them. Without it, this
// document would be re-queued on every pull forever.
//
//   POST /api/admin/kb/queue/{id}/approve   { is_internal?: boolean }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const err = await requireAdminAuth(); if (err) return err
  const { id } = await params

  const { is_internal } = (await req.json().catch(() => ({}))) as { is_internal?: boolean }
  const internal = is_internal !== false // default staff-only

  const { data: row, error: rowErr } = await supabaseAdmin
    .from('kb_review_queue')
    .select('id, status, source, external_id, external_etag, external_ctag, filename, transcript')
    .eq('id', id)
    .maybeSingle()

  if (rowErr) {
    console.error('[kb/queue/approve] load error:', rowErr)
    return NextResponse.json({ error: 'Could not load that document.' }, { status: 500 })
  }
  if (!row) return NextResponse.json({ error: 'That document is no longer in the queue.' }, { status: 404 })
  if (row.status !== 'pending') {
    return NextResponse.json({ error: `That document was already ${row.status}.` }, { status: 409 })
  }
  // A discovered-but-unread row has no transcript yet — there is nothing to
  // approve, and nothing was ever shown to a human to approve.
  if (!row.transcript) {
    return NextResponse.json(
      { error: 'That document hasn’t been read yet — read it first, then review.' },
      { status: 409 },
    )
  }

  const result = await ingestTranscript(row.transcript as string, row.filename as string, internal, {
    source: (row.source as string) || 'sharepoint',
    sharepointItemId: (row.external_id as string) ?? null,
    sharepointEtag: (row.external_etag as string) ?? null,
    sharepointCtag: (row.external_ctag as string) ?? null,
  })
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status })
  }

  // Only now resolve the queue row — if the commit failed above, the document
  // stays pending so it can be retried rather than silently disappearing.
  const { error: updErr } = await supabaseAdmin
    .from('kb_review_queue')
    .update({ status: 'approved', resolved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
  if (updErr) {
    // The document IS in Jerry (and carries its sharepoint_item_id, so the pull
    // won't re-queue it) — surface the bookkeeping failure without failing the
    // whole approval.
    console.error('[kb/queue/approve] queue update error:', updErr)
  }

  return NextResponse.json({
    id: result.id,
    title: result.title,
    chunks: result.chunks,
    pageCount: result.pageCount,
    isInternal: result.isInternal,
  })
}
