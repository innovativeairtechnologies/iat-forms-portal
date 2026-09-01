import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { findingForTag, resolveTag } from '@/lib/pp-tag'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, MEDIA_EXT, type MediaKind } from '@/lib/post-production'

/* POST /api/walk/<token>/upload-url — a one-shot signed upload URL, no login.
 *
 * ⚠️ THIS IS THE MOST SENSITIVE ROUTE IN THE FEATURE. It hands an anonymous
 * caller the ability to write bytes into our storage, so every constraint here
 * is load-bearing:
 *
 *   • The tag must resolve and be active.
 *   • The caller must name a finding that hangs off a walkaround belonging to
 *     THIS tag and is still a draft. No finding, no URL. That is what stops the
 *     token being a general-purpose upload key for the bucket.
 *   • The signed URL is ONE-SHOT and for a server-generated path. The client's
 *     filename is never used — it could carry traversal segments or collide
 *     with another walk's media.
 *   • Size is capped before the URL is minted, and the bucket carries the same
 *     limit (099/098) so a lying client cannot beat it.
 *   • Extension allowlist per kind. Browsers report media MIME types
 *     inconsistently — Safari records audio/mp4 into a .m4a, Android Chrome
 *     audio/webm — so the extension is what is validated and the MIME is only
 *     recorded.
 *
 * The bucket stays PRIVATE. Nothing written here is readable without either an
 * admin session or this same tag's token.
 *
 * Bytes never transit this function: a Vercel request body is capped at ~4.5MB
 * before route code runs, and a single phone photo clears that.
 */

const BUCKET = 'post-production'
const KINDS: MediaKind[] = ['photo', 'video', 'audio']

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const limited = await rateLimit(req, { name: 'walk-upload', max: 200, windowSeconds: 600 })
  if (limited) return limited

  const { token } = await params
  const tag = await resolveTag(token)
  if (tag instanceof NextResponse) return tag

  const body = await req.json().catch(() => ({}))

  // No orphan uploads: the bytes must be destined for a note this tag owns.
  const owned = await findingForTag(tag.id, String(body?.finding_id ?? ''))
  if (owned instanceof NextResponse) return owned

  const kind = body?.kind as MediaKind
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const size = typeof body?.size === 'number' && Number.isFinite(body.size) ? body.size : 0

  if (!KINDS.includes(kind)) return NextResponse.json({ error: 'Unknown attachment type.' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Missing file name.' }, { status: 400 })

  if (size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({
      error: kind === 'video'
        ? `That clip is over ${MAX_UPLOAD_LABEL}. It is the recording quality, not the length — drop the phone camera to 1080p.`
        : `That file is over the ${MAX_UPLOAD_LABEL} limit.`,
    }, { status: 400 })
  }

  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!MEDIA_EXT[kind].includes(ext)) {
    return NextResponse.json(
      { error: `That file type${ext ? ` (.${ext})` : ''} can't be attached here.` },
      { status: 400 },
    )
  }

  const path = `${kind}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[walk/upload-url] signed-url error:', error)
    return NextResponse.json({ error: 'Could not start the upload.' }, { status: 500 })
  }
  // signedUrl too: the client PUTs to it with XHR so it can report progress.
  return NextResponse.json({ path, token: data.token, signedUrl: data.signedUrl })
}
