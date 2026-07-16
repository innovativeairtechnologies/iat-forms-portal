import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireToolCribAuth } from '@/lib/api-auth'

/* One-shot signed upload URL for a tool photo.

   The browser uploads the bytes DIRECTLY to the private crib-photos bucket with
   this token. Vercel functions cap request bodies at ~4.5MB and a phone photo
   sails past that, so the file must never transit the function — same pattern as
   app/api/admin/kb/upload-url and the submittal scanner. */

const BUCKET = 'crib-photos'
const MAX_BYTES = 10 * 1024 * 1024 // matches the bucket's file_size_limit in 050
const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'webp', 'heic', 'heif'])

export async function POST(req: NextRequest) {
  const err = await requireToolCribAuth(); if (err) return err

  const body = await req.json().catch(() => null)
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const size = typeof body?.size === 'number' && Number.isFinite(body.size) ? body.size : 0

  if (!name) return NextResponse.json({ error: 'Missing file name' }, { status: 400 })
  if (size > MAX_BYTES) {
    return NextResponse.json({ error: 'That photo is too large (max 10MB).' }, { status: 400 })
  }

  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json(
      { error: `Unsupported file type${ext ? ` (.${ext})` : ''}. Use a photo.` },
      { status: 400 }
    )
  }

  // Server-generated path — never the client's filename, which could contain
  // traversal segments or collide with another tool's photo.
  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[tool-crib/photo-url] signed-url error:', error)
    return NextResponse.json({ error: 'Could not start upload' }, { status: 500 })
  }
  return NextResponse.json({ path, token: data.token })
}

/* Mint a short-lived read URL. The bucket is private, so <img src> needs one. */
export async function GET(req: NextRequest) {
  const err = await requireToolCribAuth(); if (err) return err

  const path = req.nextUrl.searchParams.get('path')
  if (!path) return NextResponse.json({ error: 'Missing path' }, { status: 400 })

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUrl(path, 60 * 60)
  if (error || !data) {
    return NextResponse.json({ error: 'Could not sign that photo' }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl })
}
