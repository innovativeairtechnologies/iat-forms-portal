import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProposalsAuth } from '@/lib/api-auth'
import { getSizingCatalog } from '@/lib/dryware-sizing'
import { calculateSizing, parseSizingInputs } from '@/lib/sizing'
import { blankSections } from '@/lib/proposals'

/* Create a proposal.
 *
 * Two entry points feed this: the New button on /admin/proposals (empty body),
 * and "Start a proposal" on a Deal or a Sizing Studio run, which passes a
 * deal_id and/or the sizing inputs.
 *
 * ⚠️ The client may send sizing INPUTS but never a sizing RESULT, and never a
 * verification. Both are derived here: the result by recomputing against the
 * live catalog, the verification only ever by the server calling DryWare
 * (POST /api/admin/proposals/[id]/verify). A proposal is a document a customer
 * may read as a commitment, so nothing on it may originate from a request body.
 */

export const dynamic = 'force-dynamic'
// getSizingCatalog() fetches DryWare's product list (~0.5s) when inputs are sent.
export const maxDuration = 30

/** Proposals for one deal — powers the Proposals tab on the deal drawer. */
export async function GET(req: NextRequest) {
  const auth = await requireProposalsAuth()
  if (auth instanceof NextResponse) return auth

  const dealId = req.nextUrl.searchParams.get('deal_id')
  if (!dealId) return NextResponse.json({ error: 'deal_id is required' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('proposals')
    .select('id, title, status, updated_at, verification, sizing_result')
    .eq('deal_id', dealId)
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Proposal list error:', error)
    return NextResponse.json({ error: 'Could not load proposals.' }, { status: 500 })
  }
  return NextResponse.json({ proposals: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireProposalsAuth()
  if (auth instanceof NextResponse) return auth

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null

  const dealId = typeof body?.deal_id === 'string' ? body.deal_id : null

  // Prefill the customer framing from the deal when we came from one. These are
  // SNAPSHOT columns: deals.customer is DryWare-owned and rewritten on every
  // sync, so a proposal that read it live could silently change the company name
  // printed on an already-approved document.
  let customerName = ''
  let jobName = ''
  if (dealId) {
    const { data: deal } = await supabaseAdmin
      .from('deals')
      .select('customer, job_name')
      .eq('id', dealId)
      .single()
    customerName = deal?.customer ?? ''
    jobName = deal?.job_name ?? ''
  }

  // A sizing run, if one was handed over. The Studio persists nothing, so this
  // is the moment a selection first becomes durable.
  let sizingInputs = null
  let sizingResult = null
  let catalogSource: 'dryware' | 'fallback' | null = null
  if (body?.sizing_inputs && typeof body.sizing_inputs === 'object') {
    sizingInputs = parseSizingInputs(body.sizing_inputs)
    const { sizes, source } = await getSizingCatalog()
    sizingResult = calculateSizing(sizingInputs, sizes)
    catalogSource = source
  }

  const title = jobName || customerName || 'Untitled proposal'

  const { data, error } = await supabaseAdmin
    .from('proposals')
    .insert({
      deal_id: dealId,
      title,
      customer_name: customerName,
      job_name: jobName,
      status: 'draft',
      sizing_inputs: sizingInputs,
      sizing_result: sizingResult,
      catalog_source: catalogSource,
      // Seeds the human sections (exclusions boilerplate) but leaves the two AI
      // sections empty — an empty draft is honest, placeholder prose is not.
      edited_sections: blankSections(),
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('Proposal create error:', error)
    return NextResponse.json({ error: 'Could not create the proposal.' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}
