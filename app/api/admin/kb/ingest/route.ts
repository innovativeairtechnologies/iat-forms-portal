import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { ingestTranscript } from '@/lib/kb-ingest'

// Phase 2 of feeding Jerry's Brain — COMMIT an approved document into the RAG
// pool (kb_documents / kb_chunks). The transcript was produced by
// /api/admin/kb/analyze (phase 1: Claude reads the file + scrub preview) and
// comes back here once the admin approves it in the review card. Chunking runs
// the unconditional competitor scrub (lib/kb-chunking.mjs → buildChunks) — the
// preview is a human gate ON TOP of that, not instead of it.
//
// This is the PORTAL-UPLOAD path (source='portal'). Documents approved from the
// SharePoint review queue take /api/admin/kb/queue/{id}/approve instead, which
// additionally stamps the SharePoint provenance; both share lib/kb-ingest.
//
// Admin-only. `is_internal` decides whether the doc reaches the customer
// assistant (default true = staff-only). Idempotent per filename: re-feeding a
// same-named file replaces the prior version.

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  const { transcript, filename, is_internal } = (await req.json().catch(() => ({}))) as {
    transcript?: string; filename?: string; is_internal?: boolean
  }
  if (!transcript || typeof transcript !== 'string' || !filename || typeof filename !== 'string') {
    return NextResponse.json({ error: 'Missing document details.' }, { status: 400 })
  }
  const internal = is_internal !== false // default staff-only

  try {
    const result = await ingestTranscript(transcript, filename, internal, { source: 'portal' })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })
    return NextResponse.json({
      id: result.id,
      title: result.title,
      chunks: result.chunks,
      pageCount: result.pageCount,
      isInternal: result.isInternal,
    })
  } catch (e) {
    console.error('[kb/ingest] error:', e)
    return NextResponse.json({ error: 'Something went wrong storing that document. Please try again.' }, { status: 500 })
  }
}
