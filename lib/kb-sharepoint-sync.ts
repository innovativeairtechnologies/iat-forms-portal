import { supabaseAdmin } from '@/lib/supabase-admin'
import { analyzeDocument } from '@/lib/kb-analyze'
import { driveDelta, downloadItem, type GraphDriveItem } from '@/lib/graph'

// ─────────────────────────────────────────────────────────────────────────────
// The SharePoint → Jerry PULL, as one function both entry points share:
//   • the admin "Pull from SharePoint" button (app/api/admin/kb/sharepoint/sync)
//   • the scheduled cron                      (app/api/cron/kb-sharepoint-sync)
//
// Asks SharePoint "what changed since last time" (delta), reads + scrubs each new
// document with the same engine as a manual upload, and parks it in
// kb_review_queue as PENDING. It NEVER publishes to Jerry — a human approves in
// the "From SharePoint" queue. READ ONLY: nothing is ever written to SharePoint.
//
// Anti-loop: an item already pending review, or already published with that
// sharepoint_item_id, is skipped — so re-running is cheap and never duplicates.
// The delta cursor only advances once every candidate has been drained, so a
// large backlog is processed a batch at a time across repeated runs without
// losing track of where we are.
// ─────────────────────────────────────────────────────────────────────────────

export const SYNC_SOURCE = 'sharepoint'

/** Max NEW documents read per run — bounds wall-clock time and AI cost. */
export const SYNC_BATCH = 12

/** Only these are transcribable today. Office formats (.docx/.xlsx/.pptx) are
 *  deliberately skipped in v1 — they'd need text extraction first. */
const SUPPORTED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export type SyncResult = {
  queued: number
  failed: number
  remaining: number
  skipped: number
  deletions: number
  drained: boolean
  summary: string
}

export async function runSharePointSync(batch = SYNC_BATCH): Promise<SyncResult> {
  // ── where did we leave off? ────────────────────────────────────────────────
  const { data: state } = await supabaseAdmin
    .from('kb_sync_state').select('delta_link').eq('source', SYNC_SOURCE).maybeSingle()

  const { items, deltaLink } = await driveDelta(state?.delta_link ?? null)

  // ── candidates: supported files we haven't already queued or published ─────
  const files = items.filter(
    (i: GraphDriveItem) => i.file && !i.folder && !i.deleted && SUPPORTED.has(i.file?.mimeType || ''),
  )
  // Files we can see but can't read yet (Word/Excel/PowerPoint/etc.) — surfaced
  // so "nothing appeared" is explainable rather than mysterious.
  const skipped = items.filter(
    (i: GraphDriveItem) => i.file && !i.folder && !i.deleted && !SUPPORTED.has(i.file?.mimeType || ''),
  ).length
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

  // ── read + scrub up to `batch`, park as pending ────────────────────────────
  let queued = 0, failed = 0
  for (const item of candidates.slice(0, batch)) {
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
      if (insErr) { failed++; console.error('[kb-sharepoint-sync] queue insert:', insErr.message) }
      else queued++
    } catch (e) {
      failed++
      console.error('[kb-sharepoint-sync] item failed:', item.name, e)
    }
  }

  // Advance the cursor ONLY when we've drained every new candidate this run —
  // otherwise re-fetch the delta next run and process the next batch (already-
  // queued items are skipped above, so nothing is re-read).
  const drained = candidates.length <= batch
  const remaining = Math.max(0, candidates.length - batch)
  const summary = `queued ${queued}, failed ${failed}, ${remaining} remaining, ${skipped} unsupported, ${deletions} deletion(s) noted`

  await supabaseAdmin.from('kb_sync_state').upsert({
    source: SYNC_SOURCE,
    delta_link: drained ? deltaLink : (state?.delta_link ?? null),
    last_synced_at: new Date().toISOString(),
    last_result: summary,
    updated_at: new Date().toISOString(),
  })

  return { queued, failed, remaining, skipped, deletions, drained, summary }
}
