/* Image uploads for the Learn lesson editor.

   Browser-only: the bytes go straight from the browser to Supabase Storage using
   a one-shot signed URL minted by /api/upload — routing them through a route
   handler would 413 on anything over Vercel's ~4.5MB function body limit, which
   a phone photo or a full-window screenshot clears easily.

   ⚠️ No 'use client' directive on purpose: this is a plain module imported by
   client components. Marking it would make it a client-module *boundary*, and
   importing a value from one of those into a Server Component 500s the page.
   It pulls in the browser Supabase client, so keep it out of server files. */

import { createSupabaseBrowser } from '@/lib/supabase-browser'

const BUCKET = 'form-uploads'

/** Must stay a subset of ALLOWED_EXT in app/api/upload/route.ts — that route is
 *  the real gate and derives the extension from the name we send, so anything
 *  here that it rejects would fail after the user had already picked a file. */
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp'])

/** Used to name clipboard images, which arrive with no usable filename. */
const EXT_FOR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
}

/** Explicit rather than `image/*`: the picker should not offer SVG (an active
 *  content type we deliberately don't store) or HEIC (which /api/upload rejects). */
export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/gif,image/webp'

export const IMAGE_MAX_BYTES = 10 * 1024 * 1024

/** The 10MB cap is the `form-uploads` bucket's own file_size_limit (migration
 *  021), so it is enforced by Storage whatever the browser claims. */
export const IMAGE_HINT = 'JPG, PNG, GIF or WebP · max 10MB'

/**
 * The filename to upload under, or null if this file isn't a storable image.
 * Pasted screenshots have either no name or a name with no extension, so fall
 * back to the MIME type — /api/upload keys its allowlist off the extension.
 */
function storageName(file: File): string | null {
  const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (ALLOWED_EXT.has(ext)) return file.name
  const fromMime = EXT_FOR_MIME[file.type.toLowerCase()]
  return fromMime ? `pasted-image.${fromMime}` : null
}

/** A human-readable reason this file can't be used, or null if it's fine. */
export function imageFileError(file: File): string | null {
  if (!storageName(file)) {
    const type = file.type.toLowerCase()
    if (type === 'image/svg+xml') return 'SVG isn’t supported — export it as a PNG first.'
    if (type === 'image/heic' || type === 'image/heif') {
      return 'HEIC isn’t supported — on an iPhone, share the photo as JPEG first.'
    }
    return `That file isn’t a supported image (${IMAGE_HINT.split(' · ')[0]}).`
  }
  if (file.size > IMAGE_MAX_BYTES) return 'That image is over 10MB — please resize it first.'
  return null
}

/** Pull the image files out of a paste or drop. Clipboard screenshots come
 *  through `items` rather than `files` in some browsers, so check both. */
export function imageFilesFrom(dt: DataTransfer | null | undefined): File[] {
  if (!dt) return []
  const direct = Array.from(dt.files ?? []).filter(f => f.type.startsWith('image/'))
  if (direct.length) return direct
  return Array.from(dt.items ?? [])
    .filter(i => i.kind === 'file' && i.type.startsWith('image/'))
    .map(i => i.getAsFile())
    .filter((f): f is File => f !== null)
}

/** Upload one image and resolve with its public URL. Throws with a message fit
 *  to show the author. */
export async function uploadLessonImage(file: File): Promise<string> {
  const problem = imageFileError(file)
  if (problem) throw new Error(problem)
  const name = storageName(file)!

  const res = await fetch('/api/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, size: file.size }),
  })
  const data = await res.json().catch(() => null)
  if (!res.ok || !data) throw new Error(data?.error || 'Could not start the upload.')

  const sb = createSupabaseBrowser()
  const { error } = await sb.storage
    .from(BUCKET)
    .uploadToSignedUrl(data.path, data.token, file, { contentType: file.type || undefined })
  if (error) throw new Error(error.message || 'Could not upload that image.')

  if (typeof data.url !== 'string' || !data.url) {
    throw new Error('Uploaded, but the image URL came back empty.')
  }
  return data.url
}

/**
 * Turn a Trainual placeholder caption into alt text.
 *
 * The 133 imported placeholders read
 *   "📷 Image from Trainual: <what the image was> — re-upload via admin editor"
 * and the middle is a real description, so replacing one gets meaningful alt
 * text for free. Returns '' if nothing useful is left.
 */
export function placeholderAlt(caption: string): string {
  return caption
    .replace(/^\s*[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]+\s*/u, '')
    .replace(/^image from trainual:\s*/i, '')
    .replace(/\s*[—–-]\s*re-upload via admin editor\.?\s*$/i, '')
    .trim()
}
