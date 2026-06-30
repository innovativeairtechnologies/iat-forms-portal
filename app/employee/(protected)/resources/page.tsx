import type { Category, Form } from '@/lib/supabase'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getUserFormDrafts } from '@/lib/drafts'
import EmployeeFormsView from '@/components/EmployeeFormsView'

export const dynamic = 'force-dynamic'

async function getData() {
  const [{ data: categories }, { data: forms }] = await Promise.all([
    supabaseAdmin.from('categories').select('*').order('sort_order'),
    supabaseAdmin.from('forms').select('*, categories(*)').eq('is_active', true).order('title'),
  ])
  return {
    categories: (categories || []) as Category[],
    forms: (forms || []) as (Form & { categories: Category | null })[],
  }
}

export default async function ResourcesFormsPage() {
  const [{ categories, forms }, drafts] = await Promise.all([getData(), getUserFormDrafts()])
  return <EmployeeFormsView categories={categories} forms={forms} drafts={drafts} />
}
