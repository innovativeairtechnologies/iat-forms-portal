import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Category, Form } from '@/lib/supabase'
import FormsPortal from '@/components/FormsPortal'

// Server component: read via the service role so the public submission-count
// stat does not depend on (and is not exposed by) anon RLS on `submissions`.
async function getData() {
  const [{ data: categories }, { data: forms }, { data: submissionCounts }] = await Promise.all([
    supabaseAdmin.from('categories').select('*').order('sort_order'),
    supabaseAdmin.from('forms').select('*, categories(*)').eq('is_active', true).order('title'),
    supabaseAdmin.from('submissions').select('form_id'),
  ])

  const countMap: Record<string, number> = {}
  for (const row of submissionCounts || []) {
    countMap[row.form_id] = (countMap[row.form_id] || 0) + 1
  }

  const formsWithCount = (forms || []).map((f) => ({
    ...f,
    submission_count: countMap[f.id] || 0,
  }))

  return {
    categories: (categories || []) as Category[],
    forms: formsWithCount as (Form & { categories: Category })[],
  }
}

export const revalidate = 60

export default async function FormsDirectoryPage() {
  const { categories, forms } = await getData()
  return <FormsPortal categories={categories} forms={forms} />
}
