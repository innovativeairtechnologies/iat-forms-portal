import { supabaseAdmin } from '@/lib/supabase-admin'
import FormBuilder from '@/components/admin/FormBuilder'

async function getCategories() {
  const { data } = await supabaseAdmin.from('categories').select('*').order('sort_order')
  return data || []
}

export default async function NewFormPage() {
  const categories = await getCategories()
  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-2 text-sm text-gray-500 flex-shrink-0">
        <span>Admin</span>
        <span>/</span>
        <span>Forms</span>
        <span>/</span>
        <span className="text-[#1a1a2e] font-medium">New Form</span>
      </div>
      <div className="flex-1 overflow-hidden">
        <FormBuilder categories={categories} />
      </div>
    </div>
  )
}
