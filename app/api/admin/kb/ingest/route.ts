import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { ingestTranscript } from '@/lib/kb-ingest'
import { pushDocumentToSharePoint } from '@/lib/kb-push'

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

// Approval now also uploads the original to SharePoint, so this route needs room
// for a multi-megabyte transfer on top of the chunk inserts.
export const maxDuration = 300

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  const {
    transcript, filename, is_internal,
    storage_path, storage_mime, push_folder_id, push_folder_name,
  } = (await req.json().catch(() => ({}))) as {
    transcript?: string; filename?: string; is_internal?: boolean
    storage_path?: string; storage_mime?: string
    push_folder_id?: string | null; push_folder_name?: string | null
  }
  if (!transcript || typeof transcript !== 'string' || !filename || typeof filename !== 'string') {
    return NextResponse.json({ error: 'Missing document details.' }, { status: 400 })
  }
  const internal = is_internal !== false // default staff-only

  try {
    const result = await ingestTranscript(transcript, filename, internal, {
      source: 'portal',
      storagePath: storage_path ?? null,
      storageMime: storage_mime ?? null,
      pushFolderId: push_folder_id ?? null,
      pushFolderName: push_folder_name ?? null,
    })
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status })

    // File the ORIGINAL into SharePoint — the other half of the 1:1 repository.
    // Deliberately after the document is safely in Jerry, and deliberately
    // non-fatal: a push failure is reported alongside a successful approval, not
    // instead of it. The reason is recorded on the row either way, so nothing
    // fails silently and nothing has to be re-approved to retry.
    let push: { ok: boolean; error?: string; folderName?: string | null } | null = null
    if (storage_path) {
      const pushed = await pushDocumentToSharePoint(result.id)
      push = pushed.ok
        ? { ok: true, folderName: pushed.folderName }
        : { ok: false, error: pushed.error }
    }

    return NextResponse.json({
      id: result.id,
      title: result.title,
      chunks: result.chunks,
      pageCount: result.pageCount,
      isInternal: result.isInternal,
      push,
    })
  } catch (e) {
    console.error('[kb/ingest] error:', e)
    return NextResponse.json({ error: 'Something went wrong storing that document. Please try again.' }, { status: 500 })
  }
}
