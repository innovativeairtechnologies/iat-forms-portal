import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

// Drop an uploaded file that was reviewed and NOT approved.
//
// The analyze step used to delete every upload as soon as it had a transcript.
// It no longer does — approval needs the original bytes to file into SharePoint.
// That trade has to be paid for here: a discarded review must clean up after
// itself, or the bucket slowly fills with files nobody chose to keep.
//
// Admin-only. Deletes exactly one object from the private upload bucket, and
// nothing in Jerry or SharePoint.
//
//   POST /api/admin/kb/upload/discard  { path }

const KB_UPLOADS_BUCKET = 'kb-uploads'

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  const { path } = (await req.json().catch(() => ({}))) as { path?: string }
  if (!path || typeof path !== 'string') {
    return NextResponse.json({ error: 'Missing path.' }, { status: 400 })
  }
  // Upload paths are minted server-side as `<timestamp>-<random>.<ext>` — refuse
  // anything with structure, so this can never be pointed at another prefix.
  if (path.includes('/') || path.includes('..')) {
    return NextResponse.json({ error: 'Invalid path.' }, { status: 400 })
  }

  const { error } = await supabaseAdmin.storage.from(KB_UPLOADS_BUCKET).remove([path])
  if (error) {
    console.error('[kb/upload/discard] remove error:', error.message)
    return NextResponse.json({ error: 'Could not discard that upload.' }, { status: 500 })
  }
  return NextResponse.json({ discarded: true })
}
