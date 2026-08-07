import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSooAuth } from '@/lib/api-auth'

/* One-shot signed upload URL for a DryWare Sales Submittal.
 *
 * The browser uploads bytes straight to the private `soo-submittals` bucket
 * with this token, bypassing Vercel's ~4.5MB function request-body limit — the
 * Ferrara sample is 15.2MB. The extract route then reads it back server-side.
 *
 * ⚠️ Unlike app/api/admin/customers/extract-submittal, the object is KEPT after
 * extraction. There it holds customer PII the route no longer needs, so it is
 * deleted in a `finally`. Here the submittal is the EVIDENCE behind every
 * extracted fact — a reviewer checking "where did 3,000 CFM come from?" clicks
 * through to page 28. Deleting it would leave the provenance trail pointing at
 * nothing.
 */

const BUCKET = 'soo-submittals'
// Matches the bucket's own file_size_limit in migration 084. Submittals grow
// with the number of vendor cut sheets DryWare staples on.
const MAX_BYTES = 25 * 1024 * 1024

export async function POST(req: NextRequest) {
  const auth = await requireSooAuth()
  if (auth instanceof NextResponse) return auth

  const body = (await req.json().catch(() => null)) as { name?: string; size?: number } | null
  const name = typeof body?.name === 'string' ? body.name.trim() : ''
  const size = typeof body?.size === 'number' && Number.isFinite(body.size) ? body.size : 0

  if (!name) return NextResponse.json({ error: 'Missing file name' }, { status: 400 })
  if (size > MAX_BYTES) {
    return NextResponse.json({ error: 'That submittal is larger than 25MB.' }, { status: 400 })
  }
  const ext = name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || ''
  if (ext !== 'pdf') {
    return NextResponse.json({ error: 'Submittals must be a PDF.' }, { status: 400 })
  }

  const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).createSignedUploadUrl(path)
  if (error || !data) {
    console.error('[soo/upload-url] signed-url error:', error)
    return NextResponse.json({ error: 'Could not start the upload.' }, { status: 500 })
  }
  return NextResponse.json({ path, token: data.token })
}
