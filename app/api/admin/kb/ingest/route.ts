import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildChunks, pagesFromTranscript, titleFromFilename } from '@/lib/kb-chunking.mjs'

// Phase 2 of feeding Jerry's Brain — COMMIT an approved document into the RAG
// pool (kb_documents / kb_chunks). The transcript was produced by
// /api/admin/kb/analyze (phase 1: Claude reads the file + scrub preview) and
// comes back here once the admin approves it in the review card. Chunking runs
// the unconditional competitor scrub (lib/kb-chunking.mjs → buildChunks) — the
// preview is a human gate ON TOP of that, not instead of it.
//
// Admin-only. `is_internal` decides whether the doc reaches the customer
// assistant (default true = staff-only). Idempotent per filename: re-feeding a
// same-named file replaces the prior version.

const INSERT_BATCH = 500
const MAX_TRANSCRIPT_CHARS = 400_000 // sanity cap; a 16K-token transcription is ~60KB

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  const { transcript, filename, is_internal } = (await req.json().catch(() => ({}))) as {
    transcript?: string; filename?: string; is_internal?: boolean
  }
  if (!transcript || typeof transcript !== 'string' || !filename || typeof filename !== 'string') {
    return NextResponse.json({ error: 'Missing document details.' }, { status: 400 })
  }
  if (transcript.length > MAX_TRANSCRIPT_CHARS) {
    return NextResponse.json({ error: 'That document is too large to store.' }, { status: 413 })
  }
  const internal = is_internal !== false // default staff-only

  try {
    const pages = pagesFromTranscript(transcript)
    const chunks = buildChunks(pages) // cleans + competitor-scrubs unconditionally
    if (chunks.length === 0) {
      return NextResponse.json({ error: 'No readable text to store.' }, { status: 422 })
    }

    // Idempotent by filename: replace a prior same-named doc (chunks cascade).
    const title = titleFromFilename(filename)
    await supabaseAdmin.from('kb_documents').delete().eq('source_filename', filename)
    const { data: doc, error: docErr } = await supabaseAdmin
      .from('kb_documents')
      .insert({ title, source_filename: filename, category: null, is_internal: internal, page_count: pages.length })
      .select('id')
      .single()
    if (docErr || !doc) {
      console.error('[kb/ingest] document insert error:', docErr)
      return NextResponse.json({ error: 'Could not save the document. Please try again.' }, { status: 500 })
    }

    const rows = chunks.map((c) => ({ ...c, document_id: doc.id }))
    for (let i = 0; i < rows.length; i += INSERT_BATCH) {
      const { error: chErr } = await supabaseAdmin.from('kb_chunks').insert(rows.slice(i, i + INSERT_BATCH))
      if (chErr) {
        // Roll back the header so we don't leave a ghost doc with no chunks.
        await supabaseAdmin.from('kb_documents').delete().eq('id', doc.id)
        console.error('[kb/ingest] chunk insert error:', chErr)
        return NextResponse.json({ error: 'Could not save the document text. Please try again.' }, { status: 500 })
      }
    }

    return NextResponse.json({ id: doc.id, title, chunks: chunks.length, pageCount: pages.length, isInternal: internal })
  } catch (e) {
    console.error('[kb/ingest] error:', e)
    return NextResponse.json({ error: 'Something went wrong storing that document. Please try again.' }, { status: 500 })
  }
}
