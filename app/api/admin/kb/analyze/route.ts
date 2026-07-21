import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { analyzeDocument } from '@/lib/kb-analyze'

const KB_UPLOADS_BUCKET = 'kb-uploads'

// Phase 1 of feeding Jerry's Brain — the SCRUB PREVIEW gate. Reads the uploaded
// file (Claude transcription: born-digital and scanned docs alike) and runs the
// scrub analysis, via the shared engine in lib/kb-analyze (also used by the
// SharePoint pull). NOTHING is written to the pool here — the client shows the
// findings and, on approval, posts the transcript to /api/admin/kb/ingest
// (phase 2). The storage object is deleted here either way.

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  const { path, media_type, filename } = (await req.json().catch(() => ({}))) as {
    path?: string; media_type?: string; filename?: string
  }
  if (!path || !media_type || !filename) {
    return NextResponse.json({ error: 'Missing upload details.' }, { status: 400 })
  }

  try {
    try {
      const { data: file, error: dlErr } = await supabaseAdmin.storage.from(KB_UPLOADS_BUCKET).download(path)
      if (dlErr || !file) {
        console.error('[kb/analyze] download error:', dlErr)
        return NextResponse.json({ error: 'Could not read the uploaded file. Please try again.' }, { status: 404 })
      }
      const bytes = Buffer.from(await file.arrayBuffer())

      const result = await analyzeDocument(bytes, media_type, filename)
      if (!result.ok) {
        const status = result.code === 'unsupported' ? 400 : result.code === 'empty' ? 422 : 500
        return NextResponse.json({ error: result.message }, { status })
      }

      return NextResponse.json({
        transcript: result.transcript,
        title: result.title,
        pageCount: result.pageCount,
        chunkCount: result.chunkCount,
        findings: result.findings,
      })
    } finally {
      // The transcript now carries the knowledge; the raw upload is not needed.
      await supabaseAdmin.storage.from(KB_UPLOADS_BUCKET).remove([path]).catch(() => {})
    }
  } catch (e) {
    console.error('[kb/analyze] error:', e)
    return NextResponse.json({ error: 'Something went wrong reading that document. Please try again.' }, { status: 500 })
  }
}
