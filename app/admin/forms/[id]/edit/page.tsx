import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import FormBuilder from '@/components/admin/FormBuilder'
import type { Form, FormField, NotificationRule, Category } from '@/lib/supabase'

async function getData(id: string) {
  const [{ data: form }, { data: categories }] = await Promise.all([
    supabaseAdmin
      .from('forms')
      .select('*, form_fields(*), notification_rules(*)')
      .eq('id', id)
      .single(),
    supabaseAdmin.from('categories').select('*').order('sort_order'),
  ])
  return { form, categories: (categories || []) as Category[] }
}

export default async function EditFormPage({ params }: { params: { id: string } }) {
  const { form, categories } = await getData(params.id)
  if (!form) notFound()

  const fullForm = form as Form & { form_fields: FormField[]; notification_rules: NotificationRule[] }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800 px-6 py-3 flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 flex-shrink-0">
        <span>Admin</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span>Forms</span>
        <span className="text-gray-300 dark:text-gray-600">/</span>
        <span className="text-gray-900 dark:text-white font-medium">Edit: {form.title}</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <FormBuilder categories={categories} initialForm={fullForm} />
      </div>
    </div>
  )
}
