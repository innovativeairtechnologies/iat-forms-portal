import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProposalsAuth } from '@/lib/api-auth'
import { allowedTokens, checkDigits, type Sections } from '@/lib/proposals'

/* Read, edit and delete one proposal.
 *
 * Status is deliberately NOT patchable here — it moves only through
 * ./status/route.ts, which re-runs the approval blockers server-side. Nor is
 * `verification`, `sizing_result` or `pdf_path`: each of those is derived by a
 * dedicated server route, never accepted from a request body.
 */

export const dynamic = 'force-dynamic'

/** Everything a human may type. Note the absence of every derived field. */
const PATCHABLE = [
  'title',
  'customer_name',
  'job_name',
  'site_location',
  'prepared_for',
  'application_input',
  'requirements_input',
  'review_notes',
] as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireProposalsAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const { data, error } = await supabaseAdmin.from('proposals').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ proposal: data })
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireProposalsAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await ctx.params

  const { data: current } = await supabaseAdmin
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // An approved proposal is frozen apart from its review notes. Editing the
  // prose under an approval would make the stamp meaningless — reopen it first.
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const keys = Object.keys(body)
  if (current.status === 'approved' && keys.some((k) => k !== 'review_notes')) {
    return NextResponse.json(
      { error: 'This proposal is approved. Reopen it before editing.' },
      { status: 409 },
    )
  }

  const update: Record<string, unknown> = {}
  for (const key of PATCHABLE) {
    if (key in body) update[key] = typeof body[key] === 'string' ? body[key] : null
  }

  // Sections are handled separately so the digit check can re-run on them.
  //
  // This is the fix for the hole the case-study tool still has: there, the
  // number check runs ONLY at generate time, so a figure a human types into the
  // draft afterwards is never checked. Here every save re-derives the flags,
  // which is why a figure cannot be smuggled in post-generation.
  if (body.edited_sections && typeof body.edited_sections === 'object') {
    const incoming = body.edited_sections as Partial<Sections>
    const sections: Sections = {
      cover_letter: String(incoming.cover_letter ?? ''),
      scope: String(incoming.scope ?? ''),
      exclusions: String(incoming.exclusions ?? ''),
      notes: String(incoming.notes ?? ''),
    }
    update.edited_sections = sections

    const fresh = checkDigits(sections, allowedTokens({ ...current, ...update } as never))
    // Preserve a human's "cleared" decision for a flag whose text is unchanged;
    // a genuinely new figure arrives uncleared and blocks approval again.
    const previous = (current.flags ?? []) as { token: string; section: string; cleared?: boolean }[]
    update.flags = fresh.map((f) => ({
      ...f,
      cleared: previous.some((p) => p.token === f.token && p.section === f.section && p.cleared),
    }))
  }

  // Gap resolution toggles are written back wholesale by the editor.
  if (Array.isArray(body.gaps)) update.gaps = body.gaps
  // Flag clearing, when the editor is only toggling (no section edit in the same save).
  if (Array.isArray(body.flags) && !update.flags) update.flags = body.flags

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('proposals')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('Proposal update error:', error)
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  }
  return NextResponse.json({ proposal: data })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params

  const { data: current } = await supabaseAdmin
    .from('proposals')
    .select('status, pdf_path')
    .eq('id', id)
    .single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Deleting an approved proposal destroys the record of a document that may
  // have gone to a customer, so it takes the approver's authority.
  const auth = await requireProposalsAuth({ approve: current.status === 'approved' })
  if (auth instanceof NextResponse) return auth

  if (current.pdf_path) {
    const { error: rmErr } = await supabaseAdmin.storage
      .from('proposal-docs')
      .remove([current.pdf_path])
    // A leftover object is untidy; a blocked delete is worse. Log and continue.
    if (rmErr) console.error('Proposal PDF remove error:', rmErr)
  }

  const { error } = await supabaseAdmin.from('proposals').delete().eq('id', id)
  if (error) {
    console.error('Proposal delete error:', error)
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
