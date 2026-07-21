import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { analyzeDocument } from '@/lib/kb-analyze'
import { graphConfigured, driveDelta, downloadItem, type GraphDriveItem } from '@/lib/graph'

// Scheduled PULL: SharePoint → Jerry's Brain review queue.
//
// Asks SharePoint "what changed since last time" (delta), reads + scrubs each new
// document with the same engine as a manual upload, and parks it in kb_review_queue
// as PENDING. It NEVER publishes to Jerry — a human approves later in the "From
// SharePoint" queue. READ ONLY (no writes back to SharePoint in v1).
//
// Authenticated with CRON_SECRET, same as the other scheduled jobs, and fails
// closed. Safe no-op until Graph env is configured — so it can ship inert, before
// it's added to the vercel.json schedule.
//
// GET /api/cron/kb-sharepoint-sync

const SYNC_SOURCE = 'sharepoint'
const BATCH = 12 // max NEW documents read per run (bounds time + AI cost)
const SUPPORTED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!graphConfigured()) {
    return NextResponse.json({ skipped: 'SharePoint not configured' })
  }

  try {
    // ── where did we leave off? ────────────────────────────────────────────────
    const { data: state } = await supabaseAdmin
      .from('kb_sync_state').select('delta_link').eq('source', SYNC_SOURCE).maybeSingle()

    const { items, deltaLink } = await driveDelta(state?.delta_link ?? null)

    // ── candidates: supported files we haven't already queued or published ──────
    const files = items.filter(
      (i: GraphDriveItem) => i.file && !i.folder && !i.deleted && SUPPORTED.has(i.file?.mimeType || ''),
    )
    const deletions = items.filter((i) => i.deleted).length

    // Skip anything already pending review or already published (anti-loop + no re-analyze).
    const { data: pending } = await supabaseAdmin
      .from('kb_review_queue').select('external_id').eq('source', SYNC_SOURCE).eq('status', 'pending')
    const { data: published } = await supabaseAdmin
      .from('kb_documents').select('sharepoint_item_id').not('sharepoint_item_id', 'is', null)
    const seen = new Set<string>([
      ...(pending || []).map((r) => r.external_id as string),
      ...(published || []).map((r) => r.sharepoint_item_id as string),
    ])
    const candidates = files.filter((f) => !seen.has(f.id))

    // ── read + scrub up to BATCH, park as pending ──────────────────────────────
    let queued = 0, failed = 0
    for (const item of candidates.slice(0, BATCH)) {
      try {
        const bytes = await downloadItem(item.id)
        const result = await analyzeDocument(bytes, item.file?.mimeType || '', item.name || 'document')
        if (!result.ok) { failed++; continue }
        const { error: insErr } = await supabaseAdmin.from('kb_review_queue').insert({
          source: SYNC_SOURCE,
          external_id: item.id,
          external_etag: item.eTag ?? null,
          filename: item.name ?? 'document',
          title: result.title,
          web_url: item.webUrl ?? null,
          detected_by: item.lastModifiedBy?.user?.displayName ?? null,
          transcript: result.transcript,
          findings: result.findings,
          page_count: result.pageCount,
          chunk_estimate: result.chunkCount,
        })
        if (insErr) { failed++; console.error('[cron/kb-sharepoint-sync] queue insert:', insErr.message) }
        else queued++
      } catch (e) {
        failed++
        console.error('[cron/kb-sharepoint-sync] item failed:', item.name, e)
      }
    }

    // Advance the cursor ONLY when we've drained every new candidate this run —
    // otherwise re-fetch the delta next run and process the next batch (already-
    // queued items are skipped above, so nothing is re-read).
    const drained = candidates.length <= BATCH
    const summary = `queued ${queued}, failed ${failed}, ${candidates.length - Math.min(candidates.length, BATCH)} remaining, ${deletions} deletion(s) noted`
    await supabaseAdmin.from('kb_sync_state').upsert({
      source: SYNC_SOURCE,
      delta_link: drained ? deltaLink : (state?.delta_link ?? null),
      last_synced_at: new Date().toISOString(),
      last_result: summary,
      updated_at: new Date().toISOString(),
    })

    return NextResponse.json({ queued, failed, remaining: Math.max(0, candidates.length - BATCH), deletions, drained })
  } catch (e) {
    console.error('[cron/kb-sharepoint-sync] error:', e)
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}
