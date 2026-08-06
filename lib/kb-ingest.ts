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
  // The content tag of the version being published. Compared on every later pull
  // to tell "someone edited this upstream" from "already have it".
  sharepointCtag?: string | null
  // Where the ORIGINAL file is staged, and the folder the admin chose for it.
  // Recorded so the document can be filed into SharePoint after approval — the
  // transcript alone is not something the canonical library should receive.
  storagePath?: string | null
  storageMime?: string | null
  pushFolderId?: string | null
  pushFolderName?: string | null
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

  const title = titleFromFilename(filename)

  // WHAT COUNTS AS "THE SAME DOCUMENT" DEPENDS ON WHERE IT CAME FROM.
  //
  // A portal upload is identified by its filename — re-uploading `IOM.pdf`
  // replaces the previous `IOM.pdf`, which is the behavior people expect.
  //
  // A SharePoint file is NOT. The library is folder-structured and only the leaf
  // name is available, so `IOM.pdf` under two product folders are two different
  // documents that collide on filename. Keying on the name would mean approving
  // the second one DELETES the first (chunks cascade) — silently, and
  // unrecoverably, since discovery skips anything already in the queue, so the
  // victim can never be re-pulled. Key on the immutable SharePoint item id
  // instead, and qualify source_filename so it cannot collide with a portal
  // upload of the same name. (Citations are unaffected — Jerry cites `title`.)
  const spItemId = provenance.sharepointItemId ?? null
  const storedFilename = spItemId ? `sharepoint:${spItemId}/${filename}` : filename

  if (spItemId) {
    await supabaseAdmin.from('kb_documents').delete().eq('sharepoint_item_id', spItemId)
  } else {
    // Never let a portal upload delete a SharePoint-sourced document that merely
    // shares its name.
    await supabaseAdmin.from('kb_documents').delete()
      .eq('source_filename', filename).is('sharepoint_item_id', null)
  }

  const { data: doc, error: docErr } = await supabaseAdmin
    .from('kb_documents')
    .insert({
      title,
      source_filename: storedFilename,
      category: null,
      is_internal: isInternal,
      page_count: pages.length,
      source: provenance.source ?? null,
      sharepoint_item_id: spItemId,
      sharepoint_etag: provenance.sharepointEtag ?? null,
      sharepoint_ctag: provenance.sharepointCtag ?? null,
      // Only a portal upload has an original worth filing back; a
      // sharepoint-sourced document is already in the library.
      storage_path: spItemId ? null : (provenance.storagePath ?? null),
      storage_mime: spItemId ? null : (provenance.storageMime ?? null),
      push_folder_id: spItemId ? null : (provenance.pushFolderId ?? null),
      push_folder_name: spItemId ? null : (provenance.pushFolderName ?? null),
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
