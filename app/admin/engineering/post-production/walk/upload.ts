'use client'

import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { resizeImage } from '@/lib/image-resize'
import { MAX_UPLOAD_BYTES, type Media, type MediaKind } from '@/lib/post-production'

/* Getting a photo, a clip or a voice note off a phone and into the private
   bucket.

   Two steps, always: ask an admin-gated route for a one-shot signed upload URL,
   then push the bytes STRAIGHT to Storage. The bytes never transit a Vercel
   function — that request body is capped at ~4.5MB, enforced before route code
   runs, so a size check inside the route would never even execute. One phone
   photo clears it; a video is not close. */

export type UploadResult =
  | { ok: true; media: Media }
  | { ok: false; error: string }

export async function uploadMedia(
  kind: MediaKind,
  file: Blob,
  filename: string,
  extra: { duration_ms?: number } = {},
): Promise<UploadResult> {
  let payload: Blob = file
  let name = filename

  if (kind === 'photo') {
    /* Downscale first. A 12MB phone original is wasteful for something that gets
       looked at once on a laptop, slow to sign and slow to load on shop wifi.
       2000px keeps a legible photograph of a nameplate or a weld.

       ⚠️ HEIC does not decode in <canvas>, so resizeImage rejects on iPhones
       that hand over the original rather than converting. That is NOT a failure
       here: the original is uploaded as-is if it fits, because a big photo is
       enormously better than no photo when somebody is standing at the unit. */
    try {
      const { blob } = await resizeImage(file as File, { maxDim: 2000, quality: 0.85 })
      payload = blob
      name = 'photo.jpg'
    } catch {
      if (file.size > MAX_UPLOAD_BYTES) {
        return { ok: false, error: 'That photo is too large and could not be resized here.' }
      }
    }
  }

  if (payload.size > MAX_UPLOAD_BYTES) {
    return {
      ok: false,
      error: kind === 'video'
        ? 'That clip is over 50MB — about a minute of 1080p. Try a shorter one.'
        : 'That file is over the 50MB limit.',
    }
  }

  const res = await fetch('/api/admin/post-production/upload-url', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind, name, size: payload.size }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: json.error || 'Could not start the upload.' }

  const sb = createSupabaseBrowser()
  const { error } = await sb.storage
    .from('post-production')
    .uploadToSignedUrl(json.path, json.token, payload, {
      contentType: payload.type || undefined,
    })
  if (error) return { ok: false, error: error.message || 'The upload did not finish.' }

  return {
    ok: true,
    media: {
      kind,
      path: json.path,
      mime: payload.type || undefined,
      bytes: payload.size,
      duration_ms: extra.duration_ms,
    },
  }
}

/** The extension a recorded blob should be stored under.
 *
 *  Browsers disagree here and it matters twice: Storage keys off the extension,
 *  and a transcription provider picks its decoder from it. Safari records
 *  `audio/mp4` (which belongs in a .m4a), Android Chrome records
 *  `audio/webm;codecs=opus`. Guessing wrong produces a file that plays nowhere. */
export function extForMime(mime: string, fallback: string): string {
  const m = mime.toLowerCase()
  if (m.includes('mp4')) return 'm4a'
  if (m.includes('webm')) return 'webm'
  if (m.includes('ogg')) return 'ogg'
  if (m.includes('mpeg')) return 'mp3'
  if (m.includes('wav')) return 'wav'
  if (m.includes('quicktime')) return 'mov'
  return fallback
}
