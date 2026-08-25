import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'

/* Stores the quote PDF the customer's browser just built (migration 095).
 *
 * ── Why the browser has to send it ──────────────────────────────────────────
 * lib/rfq-pdf.ts is browser-only by design — it uses <canvas> to downscale the
 * logo — so the server cannot produce this document. If we want the engineer to
 * see EXACTLY what the customer is holding, the bytes have to come from the
 * machine that made them. Regenerating server-side later would give a document
 * that matches today's template, not the one that was sent.
 *
 * ── Why not upload straight to Storage from the browser ─────────────────────
 * ⛔ That would need an anonymous INSERT policy on the bucket, and anonymous
 * storage writes are an open item in the ideas backlog (§8.2). This keeps the
 * write on the service role behind a validated endpoint instead. The trade is a
 * ~4.5MB Vercel function-body cap, which a ~200KB vector PDF clears easily —
 * unlike ticket photos, which genuinely do have to bypass the route.
 *
 * ── What stops a stranger writing junk here ─────────────────────────────────
 * The endpoint is necessarily anonymous, the same as the submit it follows. Four
 * guards, none of which alone is enough:
 *
 *   1. The reference must exist.
 *   2. `pdf_path` must still be NULL — ONE write per request, ever. This is the
 *      important one: it means the worst case is a race against the genuine
 *      browser in the seconds after a submit, not the ability to overwrite an
 *      engineer's copy later.
 *   3. The request must be recent (see WINDOW_MINUTES) — an old reference, which
 *      is the kind someone might find on a forwarded PDF, is refused.
 *   4. Rate limited per IP, and the payload is size-capped before decoding.
 *
 * The content itself is checked for a %PDF- header. That is not security — it is
 * to keep obvious garbage out of the bucket.
 *
 * A failure here is deliberately NOT fatal to anything. The survey is already
 * committed; a missing PDF degrades to what every row looked like before this
 * shipped, and the admin page handles NULL as normal.
 */

/** How long after submit we will still accept the document. */
const WINDOW_MINUTES = 30
/** Base64 ceiling before decode. ~200KB expected; this is generous, and the
 *  bucket enforces 5MB on the object itself as a second bound. */
const MAX_BASE64 = 3_000_000

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { name: 'rfq-pdf', max: 10, windowSeconds: 600 })
  if (limited) return limited

  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const reference = String(body.reference ?? '').trim()
  const b64 = typeof body.pdf === 'string' ? body.pdf : ''
  if (!reference || !b64) {
    return NextResponse.json({ error: 'reference and pdf are both required' }, { status: 400 })
  }
  if (b64.length > MAX_BASE64) {
    return NextResponse.json({ error: 'Too large' }, { status: 413 })
  }

  const { data: row } = await supabaseAdmin
    .from('rfq_requests')
    .select('id, reference, pdf_path, created_at')
    .eq('reference', reference)
    .maybeSingle()

  // Deliberately the same response for "no such reference" and "already have
  // one": this endpoint should not confirm which references exist.
  if (!row || row.pdf_path) {
    return NextResponse.json({ ok: true, stored: false })
  }

  const ageMinutes = (Date.now() - new Date(row.created_at as string).getTime()) / 60_000
  if (ageMinutes > WINDOW_MINUTES) {
    return NextResponse.json({ ok: true, stored: false })
  }

  let bytes: Buffer
  try {
    bytes = Buffer.from(b64, 'base64')
  } catch {
    return NextResponse.json({ error: 'Unreadable payload' }, { status: 400 })
  }
  if (bytes.length < 1000 || bytes.subarray(0, 5).toString('latin1') !== '%PDF-') {
    return NextResponse.json({ error: 'Not a PDF' }, { status: 400 })
  }

  const path = `${row.id}/IAT-RFQ-${reference}.pdf`
  const { error: upErr } = await supabaseAdmin.storage
    .from('rfq-pdfs')
    .upload(path, bytes, { contentType: 'application/pdf', upsert: false })

  if (upErr) {
    console.error('[rfq/pdf] upload failed for', reference, upErr.message)
    return NextResponse.json({ error: 'Could not store the document' }, { status: 500 })
  }

  const { error: rowErr } = await supabaseAdmin
    .from('rfq_requests')
    .update({ pdf_path: path, pdf_stored_at: new Date().toISOString() })
    .eq('id', row.id)
    // Only if it is STILL unclaimed — closes the race between two uploads
    // arriving together, so the row can never point at the loser's object.
    .is('pdf_path', null)

  if (rowErr) {
    console.error('[rfq/pdf] row update failed for', reference, rowErr.message)
    return NextResponse.json({ error: 'Could not record the document' }, { status: 500 })
  }

  console.log(`[rfq/pdf] stored ${bytes.length} bytes for ${reference}`)
  return NextResponse.json({ ok: true, stored: true })
}
