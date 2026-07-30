import { NextRequest, NextResponse } from 'next/server'
import { requireCaseStudiesAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { approvalBlockers, type CaseStudy } from '@/lib/case-studies'

export const dynamic = 'force-dynamic'

/**
 * Status transitions. Kept OUT of the generic PATCH so the marketing/admin
 * approve gate can't be sidestepped by writing `status` directly.
 *
 *   submit  — draft → in_review          any case_studies holder
 *   approve — in_review → approved       marketing or admin ONLY, and only
 *                                        with no unresolved gaps/flags
 *   reopen  — in_review|approved → draft approved needs marketing/admin
 *                                        (unlocking published copy is the same
 *                                        trust level as approving it)
 */
export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireCaseStudiesAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await props.params

  const { action } = (await req.json().catch(() => ({}))) as { action?: string }
  if (!action || !['submit', 'approve', 'reopen'].includes(action)) {
    return NextResponse.json({ error: 'Invalid action.' }, { status: 400 })
  }

  const { data } = await supabaseAdmin
    .from('case_studies')
    .select('*')
    .eq('id', id)
    .single()
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const study = data as CaseStudy

  const now = new Date().toISOString()

  if (action === 'submit') {
    if (study.status !== 'draft') {
      return NextResponse.json({ error: 'Only a draft can be submitted for review.' }, { status: 409 })
    }
    if (!study.edited_sections) {
      return NextResponse.json({ error: 'Generate a draft before submitting for review.' }, { status: 409 })
    }
    const { error } = await supabaseAdmin
      .from('case_studies')
      .update({ status: 'in_review', submitted_by: auth.userId, submitted_at: now })
      .eq('id', id)
    if (error) return NextResponse.json({ error: 'Could not submit.' }, { status: 500 })
    return NextResponse.json({ status: 'in_review' })
  }

  if (action === 'approve') {
    const approver = await requireCaseStudiesAuth({ approve: true })
    if (approver instanceof NextResponse) return approver
    if (study.status !== 'in_review') {
      return NextResponse.json({ error: 'Only a study in review can be approved.' }, { status: 409 })
    }
    // Server-side re-check — the UI disables the button, but the gate lives here.
    const blockers = approvalBlockers(study)
    if (blockers.length) {
      return NextResponse.json({ error: 'Not approvable yet.', blockers }, { status: 409 })
    }
    const { error } = await supabaseAdmin
      .from('case_studies')
      .update({ status: 'approved', approved_by: approver.userId, approved_at: now })
      .eq('id', id)
    if (error) return NextResponse.json({ error: 'Could not approve.' }, { status: 500 })
    return NextResponse.json({ status: 'approved' })
  }

  // reopen
  if (study.status === 'draft') {
    return NextResponse.json({ error: 'Already a draft.' }, { status: 409 })
  }
  if (study.status === 'approved') {
    const approver = await requireCaseStudiesAuth({ approve: true })
    if (approver instanceof NextResponse) return approver
  }
  const { error } = await supabaseAdmin
    .from('case_studies')
    // Clear the approval stamp — a reopened study must earn it again.
    .update({ status: 'draft', approved_by: null, approved_at: null })
    .eq('id', id)
  if (error) return NextResponse.json({ error: 'Could not reopen.' }, { status: 500 })
  return NextResponse.json({ status: 'draft' })
}
