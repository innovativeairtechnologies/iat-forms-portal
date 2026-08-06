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
    const { data: file, error: dlErr } = await supabaseAdmin.storage.from(KB_UPLOADS_BUCKET).download(path)
    if (dlErr || !file) {
      console.error('[kb/analyze] download error:', dlErr)
      return NextResponse.json({ error: 'Could not read the uploaded file. Please try again.' }, { status: 404 })
    }
    const bytes = Buffer.from(await file.arrayBuffer())

    const result = await analyzeDocument(bytes, media_type, filename)
    if (!result.ok) {
      // "Too large to read" is not the same as broken: the document is fine, it
      // just can't be read here. Hand back the code and the staged path so the
      // caller can offer to file it in SharePoint anyway rather than dead-end.
      if (result.code === 'too-large-to-read') {
        return NextResponse.json(
          { error: result.message, code: result.code, storagePath: path, storageMime: media_type },
          { status: 422 },
        )
      }
      const status = result.code === 'unsupported' ? 400 : result.code === 'empty' ? 422 : 500
      return NextResponse.json({ error: result.message, code: result.code }, { status })
    }

    return NextResponse.json({
      transcript: result.transcript,
      title: result.title,
      pageCount: result.pageCount,
      chunkCount: result.chunkCount,
      findings: result.findings,
      // Carried back so approval can file the ORIGINAL into SharePoint. The
      // upload used to be deleted here, the moment the transcript existed —
      // correct when Jerry was the only destination, but it is exactly what made
      // Push impossible: the bytes were gone seconds after they arrived, and
      // SharePoint would have had nothing to receive but AI-transcribed text.
      // The object now survives until it is either filed (approve) or explicitly
      // dropped (discard), so it can never be orphaned by simply walking away.
      storagePath: path,
      storageMime: media_type,
      // 'text-layer' means the PDF's own words were read directly — no AI
      // transcription, no length ceiling. Worth surfacing: it tells the reviewer
      // the text is the document's own, not a model's reading of it.
      method: result.method,
    })
  } catch (e) {
    console.error('[kb/analyze] error:', e)
    return NextResponse.json({ error: 'Something went wrong reading that document. Please try again.' }, { status: 500 })
  }
}
