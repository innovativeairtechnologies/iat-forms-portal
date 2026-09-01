import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, MEDIA_EXT, type MediaKind } from '@/lib/post-production'

/* One-shot signed upload URL for a photo, video clip or voice note taken during
   a walkaround.

   The browser uploads the bytes DIRECTLY to the private post-production bucket
   with this token. A Vercel function caps its request body at ~4.5MB, enforced
   before route code runs, and a single phone photo clears that — never mind a
   video. The bytes must never transit the function. Same pattern as
   /api/admin/tool-crib/photo-url and /api/admin/kb/upload-url. */

const BUCKET = 'post-production'
const KINDS: MediaKind[] = ['photo', 'video', 'audio']

export async function POST(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => null)
  const kind = body?.kind as MediaKind
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const size = typeof body?.size === 'number' && Number.isFinite(body.size) ? body.size : 0

  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Unknown attachment type.' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Missing file name.' }, { status: 400 })

  if (size > MAX_UPLOAD_BYTES) {
    // Say what to DO about it. "File too large" next to a unit, holding a phone,
    // is a dead end; a length is something a person can act on immediately.
    return NextResponse.json({
      error: kind === 'video'
        ? `That clip is over ${MAX_UPLOAD_LABEL}. It is the recording quality, not the length — drop the phone camera to 1080p.`
        : `That file is over the ${MAX_UPLOAD_LABEL} limit.`,
    }, { status: 400 })
  }

  // Extension drives BOTH the stored object's name and, for audio, which decoder
  // a transcription provider picks. Browsers report media MIME types
  // inconsistently (Safari records audio/mp4 into a .m4a, Android Chrome
  // audio/webm), so the extension is validated and the MIME is only recorded.
  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!MEDIA_EXT[kind].includes(ext)) {
    return NextResponse.json(
      { error: `That file type${ext ? ` (.${ext})` : ''} can't be attached as ${kind === 'photo' ? 'a photo' : kind === 'video' ? 'a video' : 'audio'}.` },
      { status: 400 },
    )
  }

  // Server-generated path, never the client's filename — that could carry
  // traversal segments or collide with another walk's media. The kind prefix
  // makes the bucket browsable and lets the read route validate shape.
  const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[post-production/upload-url] signed-url error:', error)
    return NextResponse.json({ error: 'Could not start the upload.' }, { status: 500 })
  }
  return NextResponse.json({ path, token: data.token })
}
