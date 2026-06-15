import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'

// Public on purpose: file fields on public forms upload through here, so an admin
// guard breaks them (it 401'd every non-admin form filler).
//
// The browser uploads the file BYTES directly to storage using the one-shot
// signed upload URL returned here — routing the bytes through this function
// would 413 on anything over Vercel's ~4.5MB request-body limit (which silently
// broke larger photos/PDFs). Defenses: per-IP rate limit, extension allowlist,
// server-generated random path, the client-claimed size check below, and the
// form-uploads bucket's own 10MB file_size_limit (migration 021).
//
// max: 150 / 10 min — photo-heavy forms (e.g. SRV has ~31 photo fields) blew
// through the old cap of 20 mid-submission, 429ing the rest of the form.

const MAX_BYTES = 10 * 1024 * 1024
const ALLOWED_EXT = new Set(['jpg', 'jpeg', 'png', 'gif', 'webp', 'pdf'])

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { name: 'upload', max: 150, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json().catch(() => null)
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const size = typeof body?.size === 'number' && Number.isFinite(body.size) ? body.size : 0

    if (!name) return NextResponse.json({ error: 'No file name provided' }, { status: 400 })
    if (size > MAX_BYTES) return NextResponse.json({ error: 'File too large (max 10MB)' }, { status: 400 })

    const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
    if (!ALLOWED_EXT.has(ext)) return NextResponse.json({ error: 'Invalid file type' }, { status: 400 })

    // Server-generated random path — user filenames are never used as storage keys.
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

    const { data, error } = await supabaseAdmin.storage
      .from('form-uploads')
      .createSignedUploadUrl(fileName)

    if (error || !data) {
      console.error('Upload signed-url error:', error)
      return NextResponse.json({ error: 'Could not start upload' }, { status: 500 })
    }

    // form-uploads is public-read, so the public URL is deterministic.
    const { data: pub } = supabaseAdmin.storage.from('form-uploads').getPublicUrl(fileName)

    return NextResponse.json({ path: fileName, token: data.token, url: pub.publicUrl })
  } catch (err) {
    console.error('Upload route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
