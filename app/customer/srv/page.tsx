import type { Metadata } from 'next'
import { getCustomerUser } from '@/lib/customer-auth'
import CustomerSessionError from '@/components/customer/CustomerSessionError'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Equipment } from '@/lib/supabase'
import { unflattenSrvData } from '@/lib/srv'
import { getSrvForm, getSrvReview } from '@/lib/srv-form'
import { getSrvSections } from '@/lib/srv-config'
import SrvExperience, { type SrvUnitOption, type SrvRevision, type SrvServerDraft } from './SrvExperience'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Start-Up Readiness Verification — IAT',
}

export default async function SrvPage(props: { searchParams: Promise<{ resume?: string }> }) {
  const session = await getCustomerUser()
  if (!session) return <CustomerSessionError />

  const { customerId, customer, displayName, user } = session
  const email = (user.email || customer.contact_email || '').toLowerCase()
  const { resume } = await props.searchParams

  // The SRV content (DB-backed, editable at /admin/srv; falls back to code).
  const sections = await getSrvSections()

  const { data: equipmentData } = await supabaseAdmin
    .from('equipment')
    .select('*')
    .eq('customer_id', customerId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  const units: SrvUnitOption[] = ((equipmentData || []) as Equipment[]).map((u) => ({
    id: u.id,
    model_number: u.model_number || '',
    serial_number: u.serial_number || '',
    location: u.location || null,
  }))

  // ── Revision path: ?resume=<submission id> from a "returned" email ─────────
  // Ownership is re-verified server-side; the link being guessable is fine.
  let revision: SrvRevision | null = null
  if (resume) {
    const { data: sub } = await supabaseAdmin
      .from('submissions')
      .select('id, form_title, data')
      .eq('id', resume)
      .single()
    const owns =
      sub &&
      (sub.data?.['_customer_id'] === customerId ||
        String(sub.data?.['Email Address'] || '').toLowerCase() === email)
    const review = sub ? getSrvReview(sub.data) : null
    if (owns && review?.decision === 'return' && !review.superseded_by) {
      const state = unflattenSrvData(sub.data as Record<string, unknown>, sections)
      revision = {
        priorId: sub!.id,
        reviewerNotes: review.notes,
        revisionNumber: (parseInt(String(sub!.data?.['Revision'] || '1'), 10) || 1) + 1,
        ...state,
      }
    }
  }

  // ── Server draft (cross-device resume) — skipped when revising ─────────────
  let serverDraft: SrvServerDraft | null = null
  if (!revision) {
    const form = await getSrvForm()
    if (form) {
      const { data: draftRow } = await supabaseAdmin
        .from('form_drafts')
        .select('data, updated_at')
        .eq('user_id', user.id)
        .eq('form_id', form.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (draftRow?.data && typeof draftRow.data === 'object') {
        serverDraft = { draft: draftRow.data as SrvServerDraft['draft'], updated_at: draftRow.updated_at }
      }
    }
  }

  return (
    <SrvExperience
      sectionDefs={sections}
      prefill={{
        companyName: customer.company_name,
        contactName: displayName,
        email,
        phone: customer.phone || '',
        location: customer.location || '',
        units,
      }}
      serverDraft={serverDraft}
      revision={revision}
    />
  )
}
