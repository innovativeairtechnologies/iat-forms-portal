import { supabaseAdmin } from '@/lib/supabase-admin'
import { analyzeDocument } from '@/lib/kb-analyze'
import { driveDelta, downloadItem, type GraphDriveItem } from '@/lib/graph'
import { titleFromFilename } from '@/lib/kb-chunking.mjs'

// ─────────────────────────────────────────────────────────────────────────────
// The SharePoint → Jerry PULL, in TWO phases.
//
// The first live run taught us why it has to be two: one request that downloads
// AND Claude-transcribes a batch of PDFs cannot finish inside the 300s function
// limit (this library averages 2.2MB per PDF and has several 10-24MB manuals),
// and because each row was written only after its own transcription, a timeout
// meant NOTHING was saved. A smaller batch wouldn't fix it either — one big
// manual can exhaust the limit by itself. So the unit of work is ONE document.
//
//   1. discoverSharePointDocuments() — delta + metadata only, NO AI. Fast enough
//      to sweep the whole library in a single request. Every new file lands in
//      kb_review_queue as pending-but-unread.
//   2. analyzeQueuedDocument(id)     — downloads and scrubs exactly ONE document,
//      filling in its transcript + findings. Comfortably inside the limit, and a
//      document that fails records why instead of taking the run down with it.
//
// READ ONLY: nothing is ever written to SharePoint. Nothing is ever published to
// Jerry here either — a human approves from the review queue.
//
// Anti-loop: a file already queued, or already published with that
// sharepoint_item_id, is skipped. Re-running is cheap and never duplicates.
// ─────────────────────────────────────────────────────────────────────────────

export const SYNC_SOURCE = 'sharepoint'

/** Only these are transcribable today. Office formats (.docx/.xlsx/.pptx) are
 *  deliberately skipped in v1 — they'd need text extraction first. */
const SUPPORTED = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'])

export type DiscoverResult = {
  discovered: number
  skipped: number
  deletions: number
  alreadyKnown: number
  summary: string
}

/**
 * Phase 1 — ask SharePoint what's changed and record every new supported file as
 * an unread queue row. Metadata only: no downloads, no AI, so this stays fast
 * even across a whole library.
 */
export async function discoverSharePointDocuments(): Promise<DiscoverResult> {
  const { data: state } = await supabaseAdmin
    .from('kb_sync_state').select('delta_link').eq('source', SYNC_SOURCE).maybeSingle()

  const { items, deltaLink } = await driveDelta(state?.delta_link ?? null)

  const files = items.filter(
    (i: GraphDriveItem) => i.file && !i.folder && !i.deleted && SUPPORTED.has(i.file?.mimeType || ''),
  )
  // Files we can see but can't read yet (Word/Excel/PowerPoint/etc.) — counted so
  // "nothing appeared" is explainable rather than mysterious.
  const skipped = items.filter(
    (i: GraphDriveItem) => i.file && !i.folder && !i.deleted && !SUPPORTED.has(i.file?.mimeType || ''),
  ).length
  const deletions = items.filter((i) => i.deleted).length

  // Skip anything already queued (in any state) or already published.
  const { data: queued } = await supabaseAdmin
    .from('kb_review_queue').select('external_id').eq('source', SYNC_SOURCE)
  const { data: published } = await supabaseAdmin
    .from('kb_documents').select('sharepoint_item_id').not('sharepoint_item_id', 'is', null)
  const seen = new Set<string>([
    ...(queued || []).map((r) => r.external_id as string),
    ...(published || []).map((r) => r.sharepoint_item_id as string),
  ])
  const fresh = files.filter((f) => !seen.has(f.id))

  let discovered = 0
  if (fresh.length) {
    const rows = fresh.map((item) => ({
      source: SYNC_SOURCE,
      external_id: item.id,
      external_etag: item.eTag ?? null,
      filename: item.name ?? 'document',
      title: titleFromFilename(item.name ?? 'document'),
      web_url: item.webUrl ?? null,
      detected_by: item.lastModifiedBy?.user?.displayName ?? null,
      mime_type: item.file?.mimeType ?? null,
      size_bytes: item.size ?? null,
      transcript: null,
      findings: {},
      status: 'pending',
    }))
    // onConflict matches the partial unique index on (source, external_id) for
    // pending rows — a concurrent discover can't create duplicates.
    const { error, count } = await supabaseAdmin
      .from('kb_review_queue')
      .upsert(rows, { onConflict: 'source,external_id', ignoreDuplicates: true, count: 'exact' })
    if (error) {
      console.error('[kb-sharepoint-sync] discover insert:', error.message)
      throw new Error('Found the documents but could not save them to the review queue.')
    }
    discovered = count ?? rows.length
  }

  // The cursor advances here because discovery genuinely finished the delta —
  // reading is tracked per row, so it can't lose work.
  const summary = `discovered ${discovered}, ${files.length - fresh.length} already known, ${skipped} unsupported, ${deletions} deletion(s) noted`
  await supabaseAdmin.from('kb_sync_state').upsert({
    source: SYNC_SOURCE,
    delta_link: deltaLink,
    last_synced_at: new Date().toISOString(),
    last_result: summary,
    updated_at: new Date().toISOString(),
  })

  return { discovered, skipped, deletions, alreadyKnown: files.length - fresh.length, summary }
}

export type AnalyzeQueuedResult =
  | { ok: true; id: string; title: string; pageCount: number; chunkCount: number }
  | { ok: false; id: string; error: string }

/**
 * Phase 2 — read exactly ONE queued document: download it from SharePoint,
 * transcribe + scrub it, and fill in the row. A failure is recorded on the row
 * (analyze_error) rather than thrown away, so a document that can't be read is
 * visible and retryable and never blocks the others.
 */
export async function analyzeQueuedDocument(id: string): Promise<AnalyzeQueuedResult> {
  const { data: row, error: rowErr } = await supabaseAdmin
    .from('kb_review_queue')
    .select('id, external_id, filename, mime_type, status')
    .eq('id', id)
    .maybeSingle()

  if (rowErr || !row) return { ok: false, id, error: 'That document is no longer in the queue.' }
  if (row.status !== 'pending') return { ok: false, id, error: `That document was already ${row.status}.` }

  const fail = async (message: string): Promise<AnalyzeQueuedResult> => {
    await supabaseAdmin.from('kb_review_queue')
      .update({ analyze_error: message }).eq('id', id)
    return { ok: false, id, error: message }
  }

  try {
    const bytes = await downloadItem(row.external_id as string)
    const result = await analyzeDocument(
      bytes,
      (row.mime_type as string) || '',
      (row.filename as string) || 'document',
    )
    if (!result.ok) return fail(result.message)

    const { error: updErr } = await supabaseAdmin
      .from('kb_review_queue')
      .update({
        title: result.title,
        transcript: result.transcript,
        findings: result.findings,
        page_count: result.pageCount,
        chunk_estimate: result.chunkCount,
        analyzed_at: new Date().toISOString(),
        analyze_error: null,
      })
      .eq('id', id)
    if (updErr) {
      console.error('[kb-sharepoint-sync] analyze update:', updErr.message)
      return fail('Read the document but could not save it. Try again.')
    }

    return { ok: true, id, title: result.title, pageCount: result.pageCount, chunkCount: result.chunkCount }
  } catch (e) {
    console.error('[kb-sharepoint-sync] analyze failed:', row.filename, e)
    return fail(e instanceof Error ? e.message : 'Could not read that document.')
  }
}

/** The oldest unread pending document, or null when everything is read. */
export async function nextUnreadQueued(): Promise<{ id: string; filename: string } | null> {
  const { data } = await supabaseAdmin
    .from('kb_review_queue')
    .select('id, filename')
    .eq('status', 'pending')
    .is('analyzed_at', null)
    .is('analyze_error', null)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()
  return data ? { id: data.id as string, filename: data.filename as string } : null
}
