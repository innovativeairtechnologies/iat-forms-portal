import { NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// The "From SharePoint" review queue — documents the pull has read + scrubbed
// and parked for a human. Admin-only, READ.
//
// The transcript is deliberately NOT returned here: it can be hundreds of KB per
// row and the list only needs enough to render the review card's header. The
// approve route reads the transcript server-side from the queue row itself, so
// it never has to make the round trip through the browser.
//
//   GET /api/admin/kb/queue

export async function GET() {
  const err = await requireAdminAuth(); if (err) return err

  const { data, error } = await supabaseAdmin
    .from('kb_review_queue')
    .select('id, source, external_id, filename, title, web_url, detected_by, findings, page_count, chunk_estimate, created_at')
    .eq('status', 'pending')
    .order('created_at', { ascending: true })
    .limit(200)

  if (error) {
    console.error('[kb/queue] list error:', error)
    return NextResponse.json({ error: 'Could not load the review queue.' }, { status: 500 })
  }

  const { data: state } = await supabaseAdmin
    .from('kb_sync_state')
    .select('last_synced_at, last_result')
    .eq('source', 'sharepoint')
    .maybeSingle()

  return NextResponse.json({
    pending: data ?? [],
    lastSyncedAt: state?.last_synced_at ?? null,
    lastResult: state?.last_result ?? null,
  })
}
