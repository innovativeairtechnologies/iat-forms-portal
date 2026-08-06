import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireAdminAuth } from '@/lib/api-auth'

// One-shot signed upload URL for a document being fed into Jerry's knowledge pool.
// The browser uploads bytes directly to the private `kb-uploads` bucket with this
// token, bypassing Vercel's ~4.5MB function request-body limit (same pattern as
// the Submittal scanner). The ingest route then reads it back server-side.
// Admin-only — this writes to the shared knowledge base.

const KB_UPLOADS_BUCKET = 'kb-uploads'
// 50MB. The old 20MB ceiling existed because every document went to Claude for
// vision transcription, where base64 inflation puts the real limit near 24MB.
// A born-digital PDF now has its text layer read locally instead — no size or
// page ceiling at all — so the cap is set by storage rather than by the reader.
// (Supabase's own per-file limit applies underneath this; if a large upload is
// rejected downstream, raise BOTH the project-wide and the bucket limit — the
// effective maximum is the lower of the two.)
const MAX_BYTES = 50 * 1024 * 1024
const ALLOWED_EXT = new Set(['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp'])

export async function POST(req: NextRequest) {
  const err = await requireAdminAuth(); if (err) return err

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const size = typeof body?.size === 'number' && Number.isFinite(body.size) ? body.size : 0

  if (!name) return NextResponse.json({ error: 'Missing file name' }, { status: 400 })
  if (size > MAX_BYTES) return NextResponse.json({ error: 'That file is too large (max 50MB).' }, { status: 400 })

  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: `Unsupported file type${ext ? ` (.${ext})` : ''}. Feed me a PDF or an image.` }, { status: 400 })
  }

  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const { data, error } = await supabaseAdmin.storage.from(KB_UPLOADS_BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[kb/upload-url] signed-url error:', error)
    return NextResponse.json({ error: 'Could not start upload' }, { status: 500 })
  }
  return NextResponse.json({ path, token: data.token })
}
