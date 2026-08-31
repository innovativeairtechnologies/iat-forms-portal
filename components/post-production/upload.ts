'use client'

import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { resizeImage } from '@/lib/image-resize'
import { MAX_UPLOAD_BYTES, humanBytes, type Media, type MediaKind } from '@/lib/post-production'

/* Getting a photo, a clip or a voice note off a phone and into the private
   bucket.

   Two steps, always: ask an admin-gated route for a one-shot signed upload URL,
   then push the bytes STRAIGHT to Storage. The bytes never transit a Vercel
   function — that request body is capped at ~4.5MB, enforced before route code
   runs, so a size check inside the route would never even execute. One phone
   photo clears it; a video is not close. */

export type UploadResult =
  | {
      ok: true
      media: Media
      /** A local object URL for the bytes just uploaded. Lets a thumbnail render
       *  instantly and, on the no-login page, without making any read request at
       *  all. The caller owns it and must revoke it on unmount. */
      previewUrl: string
    }
  | { ok: false; error: string }

export async function uploadMedia(
  kind: MediaKind,
  file: Blob,
  filename: string,
  /** Which route mints the signed URL. The admin walk and the no-login shop-floor
   *  scan page share every pixel of this component but NOT their authorization:
   *  one is behind requireEngineeringAuth, the other behind a sticker's token.
   *  Passing the endpoint in is what lets the UI be shared without either page
   *  inheriting the other's gate. */
  endpoint: string,
  extra: {
    duration_ms?: number
    /** Merged into the upload-url request. The token route requires
     *  `finding_id` so it can refuse to mint a URL for bytes that are not
     *  destined for a note that sticker owns; the admin route ignores it. */
    extraBody?: Record<string, unknown>
  } = {},
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
    /* ⚠️ SAY THE ACTUAL SIZE, and blame the right thing.
     *
     * This used to read "over 50MB — about a minute of 1080p. Try a shorter
     * one," which sent somebody looking for a fault after a SIX-SECOND clip.
     * The length was never the problem: a phone set to 4K/60 writes roughly as
     * much in ten seconds as 1080p/30 does in a minute, so "shoot a shorter one"
     * is advice that cannot work and reads as the app being broken.
     *
     * The number is what makes it actionable — 220 MB on screen immediately
     * explains itself, and the fix is a camera setting rather than a shorter
     * take. iOS prints the per-minute size for each option on the very screen
     * this points at, so the phone is its own reference. */
    return {
      ok: false,
      error: kind === 'video'
        ? `That clip is ${humanBytes(payload.size)} and the limit is 50 MB. It is the recording quality, not the length — on an iPhone, Settings › Camera › Record Video › 1080p HD at 30 fps (that screen shows the size per minute). A photo and a voice note also work.`
        : `That file is ${humanBytes(payload.size)} and the limit is 50 MB.`,
    }
  }

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(extra.extraBody ?? {}), kind, name, size: payload.size }),
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
    previewUrl: URL.createObjectURL(payload),
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
