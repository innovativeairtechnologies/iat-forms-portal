import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'

export const dynamic = 'force-dynamic'

const MAX_BYTES = 15 * 1024 * 1024
const ALLOWED_EXT = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'heic'])

/**
 * Bridge: signed upload for an SRV photo.
 *
 * These go into THIS project's public `form-uploads` bucket, not the customer
 * project's. That isn't incidental: the SRV submit path validates every photo
 * URL with isOurUpload(), which requires the internal storage host. Uploading
 * customer-side would produce URLs that submit then rejects — so the photos
 * belong here, and the customer browser PUTs bytes straight to this bucket.
 *
 * The returned publicUrl is the exact shape isOurUpload() accepts, so the client
 * can hand it straight back in the payload.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/srv-photo')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  const name = requireString(auth.body, 'name')
  const size = typeof auth.body.size === 'number' && Number.isFinite(auth.body.size) ? auth.body.size : 0

  if (!customerId) return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })
  if (!name) return NextResponse.json({ error: 'Missing file name' }, { status: 400 })
  if (size > MAX_BYTES) return NextResponse.json({ error: 'Image too large (max 15MB)' }, { status: 400 })

  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (!ALLOWED_EXT.has(ext)) {
    return NextResponse.json({ error: 'Please upload an image' }, { status: 400 })
  }

  // Namespaced by customer so uploads are traceable, with a random component so
  // paths aren't guessable.
  const path = `srv/${customerId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from('form-uploads').createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[bridge/srv-photo] signed-url error:', error)
    return NextResponse.json({ error: 'Could not start upload' }, { status: 500 })
  }

  const base = process.env.NEXT_PUBLIC_SUPABASE_URL!.replace(/\/$/, '')
  const signedUrl = new URL(data.signedUrl, `${base}/storage/v1/`).toString()
  const publicUrl = `${base}/storage/v1/object/public/form-uploads/${path}`

  return NextResponse.json({ path, signedUrl, publicUrl })
}
