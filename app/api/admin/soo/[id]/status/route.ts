import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSooAuth } from '@/lib/api-auth'
import { approvalBlockers, type SooDocument } from '@/lib/soo'

/* Move a document along the ladder: draft → in_review → approved, and back.
 *
 * Status lives here rather than in the generic PATCH so approval can re-run the
 * blockers SERVER-SIDE. The editor computes the same list live for the UI, but
 * that copy is advisory — this one is the gate.
 *
 * What approval means here: an engineer has read the assembled sequence and is
 * willing to hand it to the controls contractor. So the gate refuses while any
 * clause is blocked, any extraction conflict is unresolved, any required project
 * setpoint is still TBD, or any override to a clause carrying a CONTROL CONSTANT
 * lacks a note. That last one is the unusual one, and it is the point: a silent
 * local edit to a 120°F permissive is this document's worst failure mode.
 */

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as { action?: string } | null
  const action = body?.action

  if (action !== 'submit' && action !== 'approve' && action !== 'reopen') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { data: doc } = await supabaseAdmin.from('soo_documents').select('*').eq('id', id).single()
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Approving needs the approver's authority. So does reopening an APPROVED
  // document — otherwise anyone with the base perm could clear an approval, edit
  // the sequence and leave it looking signed off.
  const needsApprover = action === 'approve' || (action === 'reopen' && doc.status === 'approved')
  const auth = await requireSooAuth({ approve: needsApprover })
  if (auth instanceof NextResponse) return auth

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {}

  if (action === 'submit') {
    if (!doc.assembled) {
      return NextResponse.json({ error: 'Assemble the sequence before submitting it.' }, { status: 409 })
    }
    update.status = 'in_review'
    update.submitted_by = auth.userId
    update.submitted_at = now
  }

  if (action === 'approve') {
    const blockers = approvalBlockers(doc as SooDocument)
    if (blockers.length > 0) {
      return NextResponse.json(
        { error: 'This sequence cannot be approved yet.', blockers },
        { status: 409 },
      )
    }
    update.status = 'approved'
    update.approved_by = auth.userId
    update.approved_at = now
  }

  if (action === 'reopen') {
    update.status = 'draft'
    update.approved_by = null
    update.approved_at = null
  }

  const { data, error } = await supabaseAdmin
    .from('soo_documents')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('SOO status error:', error)
    return NextResponse.json({ error: 'Could not update the status.' }, { status: 500 })
  }
  return NextResponse.json({ document: data })
}
