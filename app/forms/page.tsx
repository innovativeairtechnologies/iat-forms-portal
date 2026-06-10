import { supabase } from '@/lib/supabase'
import type { Category, Form } from '@/lib/supabase'
import FormsPortal from '@/components/FormsPortal'

async function getData() {
  const [{ data: categories }, { data: forms }, { data: submissionCounts }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('forms').select('*, categories(*)').eq('is_active', true).order('title'),
    supabase.from('submissions').select('form_id'),
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
