import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { PlusCircle } from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import FormsListClient from './FormsListClient'

async function getForms() {
  const [{ data: forms }, { data: submissions }] = await Promise.all([
    supabaseAdmin
      .from('forms')
      .select('*, categories(name)')
      .order('created_at', { ascending: false }),
    supabaseAdmin
      .from('submissions')
      .select('form_id'),
  ])

  const countByForm: Record<string, number> = {}
  ;(submissions || []).forEach((s: { form_id: string }) => {
    countByForm[s.form_id] = (countByForm[s.form_id] || 0) + 1
  })

  return { forms: forms || [], countByForm }
}

export default async function FormsListPage() {
  const { forms, countByForm } = await getForms()

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">Forms</h1>
          <p className="text-sm text-gray-500 mt-0.5">{forms.length} total</p>
        </div>
        <Link
          href="/admin/forms/new"
          className="flex items-center gap-2 bg-[#1a1a2e] hover:bg-[#0f0f20] text-white text-sm font-semibold px-4 py-2.5 rounded-[8px] transition-colors"
        >
          <PlusCircle size={16} />
          New Form
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-[8px] overflow-hidden">
        {forms.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">
            No forms yet. <Link href="/admin/forms/new" className="text-[#0a7cff] hover:underline">Create one</Link>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submissions</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Created</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {forms.map((form: { id: string; title: string; slug: string; is_active: boolean; created_at: string; categories: { name: string } | null }) => (
                <tr key={form.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    <div>
                      <p className="font-semibold text-[#1a1a2e]">{form.title}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">/forms/{form.slug}</p>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{form.categories?.name || '—'}</td>
                  <td className="px-5 py-4">
                    <Link href={`/admin/submissions?form_id=${form.id}`} className="font-semibold text-[#0a7cff] hover:underline">
                      {countByForm[form.id] || 0}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{formatDateTime(form.created_at)}</td>
                  <td className="px-5 py-4">
                    <FormsListClient formId={form.id} isActive={form.is_active} />
                  </td>
                  <td className="px-5 py-4 text-right">
                    <Link
                      href={`/admin/forms/${form.id}/edit`}
                      className="text-xs text-[#0a7cff] hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
