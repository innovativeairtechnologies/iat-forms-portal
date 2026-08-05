import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProposalsAuth } from '@/lib/api-auth'
import { rateLimit } from '@/lib/rate-limit'
import { calculateDesiccantPerformance, getSizingCatalog } from '@/lib/dryware-sizing'
import { calculateSizing, parseSizingInputs } from '@/lib/sizing'
import { buildDesmodRequest, readDesmodResponse, reconcileVerification } from '@/lib/desmod'

/* Verify a proposal's stored selection against DryWare's wheel model, and
 * freeze the result onto the row.
 *
 * This exists as its own route rather than accepting a `verification` object on
 * PATCH because a verification is the difference between "preliminary" and
 * "engineering" on a customer-facing document. It must therefore only ever be
 * produced by the server calling DryWare — never handed in by a client that
 * could forge it.
 *
 * The selection is recomputed from the STORED inputs, not the stored result, so
 * the verification provably belongs to the run the proposal carries.
 *
 * ⚠️ DryWare's calculator is single-threaded at ~1.9s and answers HTTP 200 for
 * every failure. See lib/desmod.ts.
 */

export const dynamic = 'force-dynamic'
export const maxDuration = 30

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireProposalsAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const limited = await rateLimit(req, { name: 'proposal_verify', max: 30, windowSeconds: 300 })
  if (limited) return limited

  const { data: proposal } = await supabaseAdmin
    .from('proposals')
    .select('id, status, sizing_inputs')
    .eq('id', id)
    .single()
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (proposal.status === 'approved') {
    return NextResponse.json(
      { error: 'This proposal is approved. Reopen it before re-verifying.' },
      { status: 409 },
    )
  }
  if (!proposal.sizing_inputs) {
    return NextResponse.json(
      { error: 'This proposal has no sizing selection to verify.' },
      { status: 400 },
    )
  }

  const inputs = parseSizingInputs(proposal.sizing_inputs)
  const { sizes, source } = await getSizingCatalog()
  const result = calculateSizing(inputs, sizes)

  const blocking = result.warnings.find((w) => w.severity === 'error')
  if (blocking) {
    return NextResponse.json(
      { error: `The stored selection has an unresolved problem: ${blocking.message}` },
      { status: 400 },
    )
  }

  const built = buildDesmodRequest(inputs, result)
  if (!built.ok) return NextResponse.json({ error: built.message }, { status: 400 })

  let raw: unknown
  try {
    raw = await calculateDesiccantPerformance(built.request)
  } catch (e) {
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not reach DryWare. ${detail}` }, { status: 502 })
  }

  const read = readDesmodResponse(raw)
  if (!read.ok) {
    return NextResponse.json(
      { error: read.message, code: read.code },
      { status: read.code === 'rejected' ? 422 : 502 },
    )
  }

  const verification = reconcileVerification(
    result,
    built.request,
    read.response,
    new Date().toISOString(),
  )

  // The recomputed result is frozen alongside the verification: the two must
  // describe the same selection, and the catalog may have moved since creation.
  const { data, error } = await supabaseAdmin
    .from('proposals')
    .update({ sizing_result: result, catalog_source: source, verification })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('Proposal verify save error:', error)
    return NextResponse.json({ error: 'Verified, but could not save it.' }, { status: 500 })
  }

  return NextResponse.json({ proposal: data })
}
