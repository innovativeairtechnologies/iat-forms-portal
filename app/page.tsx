import { supabase } from '@/lib/supabase'
import type { Category, Form } from '@/lib/supabase'
import FormsPortal from '@/components/FormsPortal'

async function getData() {
  const [{ data: categories }, { data: forms }] = await Promise.all([
    supabase.from('categories').select('*').order('sort_order'),
    supabase.from('forms').select('*, categories(*)').eq('is_active', true).order('title'),
  ])
  return {
    categories: (categories || []) as Category[],
    forms: (forms || []) as (Form & { categories: Category })[],
  }
}

export const revalidate = 60

export default async function HomePage() {
  const { categories, forms } = await getData()
  return <FormsPortal categories={categories} forms={forms} />
}
