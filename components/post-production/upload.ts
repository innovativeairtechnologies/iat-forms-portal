'use client'

import { resizeImage } from '@/lib/image-resize'
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_LABEL, humanBytes, type Media, type MediaKind } from '@/lib/post-production'

/* Getting a photo, a clip or a voice note off a phone and into the private
   bucket.

   Two steps, always: ask a gated route for a one-shot signed upload URL, then
   push the bytes STRAIGHT to Storage. The bytes never transit a Vercel function
   — that request body is capped at ~4.5MB, enforced before route code runs, so
   a size check inside the route would never even execute. One phone photo
   clears it; a 2-minute video is not close.

   ── Why XHR rather than supabase-js uploadToSignedUrl ──────────────────────
   PROGRESS. `fetch` cannot report upload progress; XMLHttpRequest can, via
   `xhr.upload.onprogress`. At 50MB that was a nicety. At 135MB — a 2-minute
   1080p clip — a silent two-minute wait on shop wifi is indistinguishable from
   a hang, and the person gives up or reloads and loses the walk.

   Verified 2026-09-01 that a plain PUT to the signed URL, carrying only the
   anon key and the token already in the query string, returns 200. So dropping
   the client library here costs nothing: the signed URL is just an endpoint.

   ⚠️ Resumable (TUS) uploads were investigated and are NOT usable here. Probed
   against the live project: the signed-upload token is refused by the resumable
   endpoint with "new row violates row-level security policy", and the
   post-production bucket carries no storage policies at all (service-role only,
   deliberately). Making resumable work would mean either opening the bucket to
   the anon key — which ships in every browser bundle — or proxying every chunk
   through our own routes. Progress plus retry covers the real pain far more
   cheaply. See docs/post-production.md. */

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

export type UploadOptions = {
  duration_ms?: number
  /** Merged into the upload-url request. The token route requires `finding_id`
   *  so it can refuse to mint a URL for bytes that are not destined for a note
   *  that sticker owns; the admin route ignores it. */
  extraBody?: Record<string, unknown>
  /** 0–1. Fires many times a second during the transfer. */
  onProgress?: (fraction: number) => void
}

/** PUT the bytes with progress. Resolves to null on success, or a message.
 *
 *  Kept separate so the retry path re-runs ONLY this half — a retry must not
 *  mint a second signed URL and leave the first one's half-written object
 *  behind. */
function putWithProgress(url: string, blob: Blob, onProgress?: (f: number) => void): Promise<string | null> {
  return new Promise(resolve => {
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url, true)
    xhr.setRequestHeader('apikey', anon)
    if (blob.type) xhr.setRequestHeader('Content-Type', blob.type)

    xhr.upload.onprogress = e => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total)
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(1); resolve(null) }
      // Storage answers with JSON; show its message when there is one, because
      // "upload failed" tells somebody standing at a unit nothing.
      else {
        let msg = `The upload failed (HTTP ${xhr.status}).`
        try { const j = JSON.parse(xhr.responseText); if (j?.message) msg = j.message } catch { /* keep the default */ }
        resolve(msg)
      }
    }
    // A dropped connection mid-transfer lands here, which on shop wifi is the
    // common case rather than the exotic one.
    xhr.onerror = () => resolve('The connection dropped before the upload finished.')
    xhr.ontimeout = () => resolve('The upload timed out.')
    xhr.onabort = () => resolve('The upload was cancelled.')
    xhr.send(blob)
  })
}

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
  extra: UploadOptions = {},
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
        return { ok: false, error: `That photo is over ${MAX_UPLOAD_LABEL} and could not be resized here.` }
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
     * is advice that cannot work and reads as the app being broken. */
    return {
      ok: false,
      error: kind === 'video'
        ? `That clip is ${humanBytes(payload.size)} and the limit is ${MAX_UPLOAD_LABEL}. It is the recording quality, not the length — on an iPhone, Settings › Camera › Record Video › 1080p HD at 30 fps (that screen shows the size per minute). A photo and a voice note also work.`
        : `That file is ${humanBytes(payload.size)} and the limit is ${MAX_UPLOAD_LABEL}.`,
    }
  }

  extra.onProgress?.(0)

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...(extra.extraBody ?? {}), kind, name, size: payload.size }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) return { ok: false, error: json.error || 'Could not start the upload.' }

  // The route hands back a signed URL. Absolute already in current supabase-js,
  // but normalised here so a library change cannot silently produce a bad URL.
  const base = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').replace(/\/+$/, '')
  const signed: string = json.signedUrl?.startsWith('http')
    ? json.signedUrl
    : `${base}/storage/v1${json.signedUrl ?? ''}`

  const failure = await putWithProgress(signed, payload, extra.onProgress)
  if (failure) return { ok: false, error: failure }

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
