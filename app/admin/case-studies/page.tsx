import { supabaseAdmin } from '@/lib/supabase-admin'
import type { CaseStudy } from '@/lib/case-studies'
import CaseStudiesClient from './CaseStudiesClient'

export const dynamic = 'force-dynamic'

export default async function CaseStudiesPage() {
  const { data } = await supabaseAdmin
    .from('case_studies')
    .select('*, customers(id, company_name), case_study_units(id, model_number)')
    .order('updated_at', { ascending: false })

  return <CaseStudiesClient studies={(data ?? []) as CaseStudy[]} />
}
