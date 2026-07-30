import { notFound } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import type { CaseStudy } from '@/lib/case-studies'
import type { Equipment } from '@/lib/supabase'
import CaseStudyEditor from './CaseStudyEditor'

export const dynamic = 'force-dynamic'

export default async function CaseStudyDetailPage(props: { params: Promise<{ id: string }> }) {
  const { id } = await props.params

  const { data } = await supabaseAdmin
    .from('case_studies')
    .select('*, customers(*), case_study_units(*)')
    .eq('id', id)
    .order('sort_order', { referencedTable: 'case_study_units', ascending: true })
    .single()
  if (!data) notFound()
  const study = data as CaseStudy

  // Approve is marketing/admin only (requireCaseStudiesAuth enforces server-side;
  // this just decides whether the button renders).
  const viewer = await getAdminSurfaceUser()
  const canApprove = viewer?.role === 'admin' || viewer?.role === 'marketing'

  // Registered equipment for the linked customer — the "Add from equipment"
  // picker in the units editor. Empty for fresh (unlinked) studies.
  let equipment: Equipment[] = []
  if (study.customer_id) {
    const { data: eq } = await supabaseAdmin
      .from('equipment')
      .select('*')
      .eq('customer_id', study.customer_id)
      .order('created_at', { ascending: true })
    equipment = (eq ?? []) as Equipment[]
  }

  return <CaseStudyEditor initial={study} equipment={equipment} canApprove={canApprove} />
}
