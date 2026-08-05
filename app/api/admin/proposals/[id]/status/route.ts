import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProposalsAuth } from '@/lib/api-auth'
import { approvalBlockers } from '@/lib/proposals'

/* Move a proposal along the ladder: draft → in_review → approved, and back.
 *
 * Status lives here rather than in the generic PATCH so that approval can
 * re-run the blockers SERVER-SIDE. The editor computes the same list live for
 * the UI, but that copy is advisory — this one is the gate.
 *
 * Approval is what lifts the DRAFT watermark from the PDF, which is the whole
 * control: a draft can be produced and circulated freely, but only an admin can
 * make it read as final.
 */

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as { action?: string } | null
  const action = body?.action

  if (action !== 'submit' && action !== 'approve' && action !== 'reopen') {
    return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
  }

  const { data: proposal } = await supabaseAdmin
    .from('proposals')
    .select('*')
    .eq('id', id)
    .single()
  if (!proposal) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Approving needs the approver's authority. So does reopening an APPROVED
  // proposal — otherwise anyone with the base perm could clear an approval,
  // edit the prose and re-approve nothing.
  const needsApprover = action === 'approve' || (action === 'reopen' && proposal.status === 'approved')
  const auth = await requireProposalsAuth({ approve: needsApprover })
  if (auth instanceof NextResponse) return auth

  const now = new Date().toISOString()
  const update: Record<string, unknown> = {}

  if (action === 'submit') {
    if (!proposal.edited_sections) {
      return NextResponse.json({ error: 'Draft the proposal before submitting it.' }, { status: 409 })
    }
    update.status = 'in_review'
    update.submitted_by = auth.userId
    update.submitted_at = now
  }

  if (action === 'approve') {
    const blockers = approvalBlockers(proposal)
    if (blockers.length > 0) {
      return NextResponse.json(
        { error: 'This proposal cannot be approved yet.', blockers },
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
    // The stored PDF was the approved artifact. Once the document is reopened it
    // no longer represents anything approved, so the pointer is cleared and the
    // object removed — a stale "approved PDF" is worse than none.
    if (proposal.pdf_path) {
      const { error: rmErr } = await supabaseAdmin.storage
        .from('proposal-docs')
        .remove([proposal.pdf_path])
      if (rmErr) console.error('Proposal PDF remove error:', rmErr)
      update.pdf_path = null
      update.pdf_generated_at = null
    }
  }

  const { data, error } = await supabaseAdmin
    .from('proposals')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('Proposal status error:', error)
    return NextResponse.json({ error: 'Could not update the status.' }, { status: 500 })
  }
  return NextResponse.json({ proposal: data })
}
