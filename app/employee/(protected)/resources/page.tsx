import type { Category, Form } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import FormsBrowser from '@/components/FormsBrowser'

export const dynamic = 'force-dynamic'

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

  const formsWithCount = (forms || []).map((f) => ({ ...f, submission_count: countMap[f.id] || 0 }))

  return {
    categories: (categories || []) as Category[],
    forms: formsWithCount as (Form & { categories: Category })[],
  }
}

export default async function ResourcesFormsPage() {
  const { categories, forms } = await getData()

  return (
    <div className="flex-1 overflow-auto">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Resources</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Employee Forms</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Every IAT form, grouped by category.</p>
      </div>

      {/* Same browsing layout as the public /forms directory */}
      <div className="max-w-5xl mx-auto px-6 pt-8">
        <FormsBrowser categories={categories} forms={forms} />
      </div>
    </div>
  )
}
