export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { formatDateTime } from '@/lib/utils'
import { Inbox, ChevronLeft, ChevronRight } from 'lucide-react'
import FilterSelect from './FilterSelect'
import SearchBar from './SearchBar'
import ExportButton from './ExportButton'
import { Suspense } from 'react'

interface SearchParams {
  form_id?: string
  is_read?: string
  status?: string
  page?: string
  search?: string
}

const STATUS_STYLES: Record<string, string> = {
  open: 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400',
  in_progress: 'bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400',
  resolved: 'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]',
}

const STATUS_LABELS: Record<string, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  resolved: 'Resolved',
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
  if (searchParams.is_read) query = query.eq('is_read', searchParams.is_read === 'true')
  if (searchParams.status) query = query.eq('status', searchParams.status)
  if (searchParams.search) {
    const term = `%${searchParams.search}%`
    query = query.or(`form_title.ilike.${term},data::text.ilike.${term}`)
  }

  const { data, count } = await query
  const { data: forms } = await supabaseAdmin.from('forms').select('id,title').order('title')

  return { submissions: data || [], count: count || 0, forms: forms || [], page, limit }
}

export default async function SubmissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { submissions, count, forms, page, limit } = await getSubmissions(searchParams)
  const totalPages = Math.ceil(count / limit)
  const activeForm = forms.find((f: { id: string; title: string }) => f.id === searchParams.form_id)

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Inbox</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">
              {activeForm ? activeForm.title : 'All Submissions'}
            </h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {count} {count === 1 ? 'submission' : 'submissions'}
              {searchParams.search && ` matching "${searchParams.search}"`}
            </p>
          </div>
          <ExportButton
            formId={searchParams.form_id}
            isRead={searchParams.is_read}
            search={searchParams.search}
            formTitle={activeForm?.title}
          />
        </div>
      </div>

      <div className="p-8">
        {/* Filter + search bar */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-card px-5 py-3.5 mb-4 flex flex-wrap items-center gap-4">
          <Suspense>
            <SearchBar current={searchParams.search} />
          </Suspense>
          <div className="w-px h-4 bg-gray-100 dark:bg-gray-800" />
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Form</span>
            <FilterSelect
              name="form_id"
              current={searchParams.form_id}
              options={[{ value: '', label: 'All Forms' }, ...forms.map((f: { id: string; title: string }) => ({ value: f.id, label: f.title }))]}
            />
          </div>
          <div className="w-px h-4 bg-gray-100 dark:bg-gray-800" />
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Status</span>
            <FilterSelect
              name="status"
              current={searchParams.status}
              options={[
                { value: '', label: 'All Statuses' },
                { value: 'open', label: 'Open' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'resolved', label: 'Resolved' },
              ]}
            />
          </div>
          <div className="w-px h-4 bg-gray-100 dark:bg-gray-800" />
          <div className="flex items-center gap-2.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Read</span>
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
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card overflow-hidden">
          {submissions.length === 0 ? (
            <div className="py-20 text-center">
              <Inbox size={28} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-[14px] font-medium text-gray-400">
                {searchParams.search ? `No results for "${searchParams.search}"` : 'No submissions found'}
              </p>
              <p className="text-[12px] text-gray-300 dark:text-gray-600 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-50 dark:border-gray-800">
                  <th className="px-6 py-3.5 text-left w-4"></th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Submitter</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Form</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Submitted</th>
                  <th className="px-4 py-3.5 text-left text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 dark:divide-gray-800">
                {submissions.map((sub: { id: string; form_title: string | null; submitted_at: string; is_read: boolean; data: Record<string, unknown> }) => {
                  const submitterName = sub.data?.['Employee Name'] || sub.data?.['Full Name'] || sub.data?.['Name'] || null
                  const submitterEmail = sub.data?.['Employee Email'] || sub.data?.['Email'] || sub.data?.['Email Address'] || null
                  const initials = submitterName
                    ? String(submitterName).split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
                    : '?'
                  return (
                    <tr key={sub.id} className="hover:bg-gray-50/70 dark:hover:bg-gray-800/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className={`w-2 h-2 rounded-full ${sub.is_read ? 'bg-transparent' : 'bg-[#089447]'}`} />
                      </td>
                      <td className="px-4 py-4">
                        <Link href={`/admin/submissions/${sub.id}`} className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center flex-shrink-0 text-[11px] font-bold text-gray-400 dark:text-gray-500">
                            {initials}
                          </div>
                          <div>
                            <p className={`text-[13px] ${sub.is_read ? 'text-gray-600 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-white'} group-hover:text-[#089447] transition-colors`}>
                              {String(submitterName || 'Anonymous')}
                            </p>
                            {submitterEmail && (
                              <p className="text-[11px] text-gray-400">{String(submitterEmail)}</p>
                            )}
                          </div>
                        </Link>
                      </td>
                      <td className="px-4 py-4">
                        <span className="inline-flex items-center px-2.5 py-1 rounded-lg bg-gray-50 dark:bg-gray-800 text-[12px] font-medium text-gray-600 dark:text-gray-400">
                          {sub.form_title || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-[13px] text-gray-500 dark:text-gray-400">{formatDateTime(sub.submitted_at)}</td>
                      <td className="px-4 py-4">
                        <div className="flex items-center gap-2">
                          {(() => {
                            const s = (sub as { status?: string }).status || 'open'
                            return (
                              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[s] || STATUS_STYLES.open}`}>
                                {STATUS_LABELS[s] || 'Open'}
                              </span>
                            )
                          })()}
                          {!sub.is_read && (
                            <span className="w-1.5 h-1.5 rounded-full bg-[#089447] flex-shrink-0" title="Unread" />
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-[12px] text-gray-400">Page {page} of {totalPages} · {count} total</p>
            <div className="flex items-center gap-1.5">
              {page > 1 && (
                <Link
                  href={`?page=${page - 1}${searchParams.form_id ? `&form_id=${searchParams.form_id}` : ''}${searchParams.is_read ? `&is_read=${searchParams.is_read}` : ''}${searchParams.search ? `&search=${searchParams.search}` : ''}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[12px] font-medium text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  <ChevronLeft size={13} /> Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`?page=${page + 1}${searchParams.form_id ? `&form_id=${searchParams.form_id}` : ''}${searchParams.is_read ? `&is_read=${searchParams.is_read}` : ''}${searchParams.search ? `&search=${searchParams.search}` : ''}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-[12px] font-medium text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                >
                  Next <ChevronRight size={13} />
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
