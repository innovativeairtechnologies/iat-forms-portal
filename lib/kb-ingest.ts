import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildChunks, pagesFromTranscript, titleFromFilename } from '@/lib/kb-chunking.mjs'

// ─────────────────────────────────────────────────────────────────────────────
// Commit an APPROVED document into the RAG pool (kb_documents / kb_chunks),
// factored out so both approval paths share one implementation:
//   • the portal upload review card  (/api/admin/kb/ingest)
//   • the SharePoint queue approval  (/api/admin/kb/queue/[id]/approve)
//
// Chunking runs the unconditional competitor scrub (lib/kb-chunking.mjs →
// buildChunks); the human review card is a gate ON TOP of that, not instead of it.
//
// PROVENANCE MATTERS: a doc approved from the SharePoint queue must carry
// source='sharepoint' + sharepoint_item_id, because the pull's anti-loop dedup
// asks kb_documents "which SharePoint items are already published?". Without it
// an approved doc is re-queued on every subsequent pull, forever.
// ─────────────────────────────────────────────────────────────────────────────

const INSERT_BATCH = 500
export const MAX_TRANSCRIPT_CHARS = 400_000 // sanity cap; a 16K-token transcription is ~60KB

export type IngestProvenance = {
  source?: string | null
  sharepointItemId?: string | null
  sharepointEtag?: string | null
}

export type IngestResult =
  | { ok: true; id: string; title: string; chunks: number; pageCount: number; isInternal: boolean }
  | { ok: false; status: number; error: string }

export async function ingestTranscript(
  transcript: string,
  filename: string,
  isInternal: boolean,
  provenance: IngestProvenance = {},
): Promise<IngestResult> {
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return { ok: false, status: 413, error: 'That document is too large to store.' }
  }

  const pages = pagesFromTranscript(transcript)
  const chunks = buildChunks(pages) // cleans + competitor-scrubs unconditionally
  if (chunks.length === 0) {
    return { ok: false, status: 422, error: 'No readable text to store.' }
  }

  // Idempotent by filename: replace a prior same-named doc (chunks cascade).
  const title = titleFromFilename(filename)
  await supabaseAdmin.from('kb_documents').delete().eq('source_filename', filename)

  const { data: doc, error: docErr } = await supabaseAdmin
    .from('kb_documents')
    .insert({
      title,
      source_filename: filename,
      category: null,
      is_internal: isInternal,
      page_count: pages.length,
      source: provenance.source ?? null,
      sharepoint_item_id: provenance.sharepointItemId ?? null,
      sharepoint_etag: provenance.sharepointEtag ?? null,
    })
    .select('id')
    .single()
  if (docErr || !doc) {
    console.error('[kb-ingest] document insert error:', docErr)
    return { ok: false, status: 500, error: 'Could not save the document. Please try again.' }
  }

  const rows = chunks.map((c) => ({ ...c, document_id: doc.id }))
  for (let i = 0; i < rows.length; i += INSERT_BATCH) {
    const { error: chErr } = await supabaseAdmin.from('kb_chunks').insert(rows.slice(i, i + INSERT_BATCH))
    if (chErr) {
      // Roll back the header so we don't leave a ghost doc with no chunks.
      await supabaseAdmin.from('kb_documents').delete().eq('id', doc.id)
      console.error('[kb-ingest] chunk insert error:', chErr)
      return { ok: false, status: 500, error: 'Could not save the document text. Please try again.' }
    }
  }

  return { ok: true, id: doc.id, title, chunks: chunks.length, pageCount: pages.length, isInternal }
}
