import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProposalsAuth } from '@/lib/api-auth'

/* Store and retrieve the approved PDF.
 *
 * POST  → a one-shot signed upload URL. The browser renders the PDF (jsPDF) and
 *         PUTs the bytes straight to Supabase Storage, because routing a
 *         multi-megabyte body through a Vercel function hits the ~4.5MB request
 *         cap. Same idiom as app/api/admin/customers/submittal-upload.
 * PUT   → record the path once the upload lands.
 * GET   → a short-lived signed read URL (the bucket is private).
 *
 * Only an APPROVED proposal is archived. A draft PDF is watermarked and
 * disposable; the point of storing one is to have an immutable record of the
 * document that was cleared for distribution.
 */

export const dynamic = 'force-dynamic'

const MAX_BYTES = 20 * 1024 * 1024

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireProposalsAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const { data: proposal } = await supabaseAdmin
    .from('proposals')
    .select('id, status')
    .eq('id', id)
    .single()
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (proposal.status !== 'approved') {
    return NextResponse.json(
      { error: 'Only an approved proposal is archived.' },
      { status: 409 },
    )
  }

  const body = (await req.json().catch(() => null)) as { size?: unknown } | null
  const size = typeof body?.size === 'number' && Number.isFinite(body.size) ? body.size : 0
  // The client-claimed size is advisory — the bucket's own file_size_limit is
  // the real gate — but rejecting an obviously oversized upload early is cheap.
  if (size > MAX_BYTES) {
    return NextResponse.json({ error: 'That PDF is too large to archive.' }, { status: 400 })
  }

  // Server-generated key: a client filename must never become a storage path.
  const path = `${id}/${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`

  const { data, error } = await supabaseAdmin.storage
    .from('proposal-docs')
    .createSignedUploadUrl(path)

  if (error || !data) {
    console.error('Proposal PDF signed-url error:', error)
    return NextResponse.json({ error: 'Could not start the upload.' }, { status: 500 })
  }

  return NextResponse.json({ path, token: data.token })
}

export async function PUT(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireProposalsAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const body = (await req.json().catch(() => null)) as { path?: unknown } | null
  const path = typeof body?.path === 'string' ? body.path : ''
  // Confine the recorded path to this proposal's own prefix, so a caller cannot
  // point one proposal's record at another's stored document.
  if (!path.startsWith(`${id}/`)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const { data: current } = await supabaseAdmin
    .from('proposals')
    .select('pdf_path')
    .eq('id', id)
    .single()

  const { error } = await supabaseAdmin
    .from('proposals')
    .update({ pdf_path: path, pdf_generated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) {
    console.error('Proposal PDF record error:', error)
    return NextResponse.json({ error: 'Could not record the PDF.' }, { status: 500 })
  }

  // Drop the superseded object rather than leaving orphans in the bucket.
  if (current?.pdf_path && current.pdf_path !== path) {
    const { error: rmErr } = await supabaseAdmin.storage
      .from('proposal-docs')
      .remove([current.pdf_path])
    if (rmErr) console.error('Proposal PDF cleanup error:', rmErr)
  }

  return NextResponse.json({ ok: true })
}

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireProposalsAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const { data: proposal } = await supabaseAdmin
    .from('proposals')
    .select('pdf_path')
    .eq('id', id)
    .single()
  if (!proposal?.pdf_path) {
    return NextResponse.json({ error: 'No archived PDF for this proposal.' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('proposal-docs')
    .createSignedUrl(proposal.pdf_path, 60 * 60)

  if (error || !data) {
    console.error('Proposal PDF signed-read error:', error)
    return NextResponse.json({ error: 'Could not open the PDF.' }, { status: 500 })
  }
  return NextResponse.json({ url: data.signedUrl })
}
