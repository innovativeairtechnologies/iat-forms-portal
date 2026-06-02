import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { Mail, MailOpen } from 'lucide-react'

interface SearchParams {
  form_id?: string
  is_read?: string
  page?: string
}

async function getSubmissions(searchParams: SearchParams) {
  const page = parseInt(searchParams.page || '1')
  const limit = 25
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('submissions')
    .select('*', { count: 'exact' })
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (searchParams.form_id) query = query.eq('form_id', searchParams.form_id)
  if (searchParams.is_read !== undefined) query = query.eq('is_read', searchParams.is_read === 'true')

  const { data, count } = await query
  const { data: forms } = await supabaseAdmin
    .from('forms')
    .select('id,title')
    .order('title')

  return { submissions: data || [], count: count || 0, forms: forms || [], page, limit }
}

export default async function SubmissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { submissions, count, forms, page, limit } = await getSubmissions(searchParams)
  const totalPages = Math.ceil(count / limit)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1a1a2e]">Submissions</h1>
          <p className="text-sm text-gray-500 mt-0.5">{count} total</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-[8px] p-4 mb-4 flex flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Form</label>
          <FilterSelect
            name="form_id"
            current={searchParams.form_id}
            options={[{ value: '', label: 'All Forms' }, ...forms.map((f: { id: string; title: string }) => ({ value: f.id, label: f.title }))]}
          />
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</label>
          <FilterSelect
            name="is_read"
            current={searchParams.is_read}
            options={[
              { value: '', label: 'All' },
              { value: 'false', label: 'Unread' },
              { value: 'true', label: 'Read' },
            ]}
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-[8px] overflow-hidden">
        {submissions.length === 0 ? (
          <div className="py-16 text-center text-gray-400 text-sm">No submissions found</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-6"></th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Form</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Submitted</th>
                <th className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {submissions.map((sub: { id: string; form_title: string | null; submitted_at: string; is_read: boolean }) => (
                <tr key={sub.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4">
                    {sub.is_read
                      ? <MailOpen size={15} className="text-gray-300" />
                      : <Mail size={15} className="text-[#0a7cff]" />
                    }
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/admin/submissions/${sub.id}`}
                      className={`hover:text-[#0a7cff] transition-colors ${sub.is_read ? 'text-gray-600' : 'font-semibold text-[#1a1a2e]'}`}
                    >
                      {sub.form_title || '—'}
                    </Link>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{formatDateTime(sub.submitted_at)}</td>
                  <td className="px-5 py-4">
                    {sub.is_read ? (
                      <span className="text-xs text-gray-400">Read</span>
                    ) : (
                      <span className="text-xs font-semibold text-[#0a7cff] bg-[#e8f2ff] px-2 py-0.5 rounded">Unread</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
            <Link
              key={p}
              href={`?page=${p}${searchParams.form_id ? `&form_id=${searchParams.form_id}` : ''}${searchParams.is_read ? `&is_read=${searchParams.is_read}` : ''}`}
              className={`w-8 h-8 flex items-center justify-center rounded-[6px] text-sm font-medium ${
                p === page ? 'bg-[#1a1a2e] text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-[#0a7cff]'
              }`}
            >
              {p}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}

function FilterSelect({ name, current, options }: { name: string; current?: string; options: { value: string; label: string }[] }) {
  return (
    <form>
      <select
        name={name}
        defaultValue={current || ''}
        onChange={(e) => {
          const url = new URL(window.location.href)
          if (e.target.value) url.searchParams.set(name, e.target.value)
          else url.searchParams.delete(name)
          url.searchParams.delete('page')
          window.location.href = url.toString()
        }}
        className="border border-gray-200 rounded-[6px] px-3 py-1.5 text-sm text-[#1a1a2e] outline-none focus:border-[#0a7cff]"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </form>
  )
}
