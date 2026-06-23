export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ExportButton from './ExportButton'
import PullReportButton from './PullReportButton'
import SubmissionsToolbar from './SubmissionsToolbar'
import SubmissionsTable, { type SubmissionRow } from './SubmissionsTable'
import { Suspense } from 'react'

interface SearchParams {
  form_id?: string
  is_read?: string
  status?: string
  page?: string
  search?: string
}

async function getSubmissions(searchParams: SearchParams) {
  const page  = parseInt(searchParams.page || '1')
  const limit = 25
  const offset = (page - 1) * limit

  let query = supabaseAdmin
    .from('submissions')
    .select('*', { count: 'exact' })
    .order('submitted_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (searchParams.form_id) query = query.eq('form_id', searchParams.form_id)
  if (searchParams.is_read) query = query.eq('is_read', searchParams.is_read === 'true')
  if (searchParams.status)  query = query.eq('status', searchParams.status)
  if (searchParams.search) {
    const term = `%${searchParams.search}%`
    query = query.or(`form_title.ilike.${term},data::text.ilike.${term}`)
  }

  const [{ data, count }, { data: forms }, { count: openCount }, { count: inProgressCount }, { count: resolvedCount }, { count: totalCount }] =
    await Promise.all([
      query,
      supabaseAdmin.from('forms').select('id,title').order('title'),
      supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'open'),
      supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'in_progress'),
      supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }).eq('status', 'resolved'),
      supabaseAdmin.from('submissions').select('*', { count: 'exact', head: true }),
    ])

  return {
    submissions: data || [],
    count: count || 0,
    forms: forms || [],
    page,
    limit,
    counts: {
      all:         totalCount ?? 0,
      open:        openCount ?? 0,
      in_progress: inProgressCount ?? 0,
      resolved:    resolvedCount ?? 0,
    },
  }
}

export default async function SubmissionsPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams;
  const { submissions, count, forms, page, limit, counts } = await getSubmissions(searchParams)
  const totalPages = Math.ceil(count / limit)
  const activeForm = forms.find((f: { id: string; title: string }) => f.id === searchParams.form_id)

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Inbox</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">
              {activeForm ? activeForm.title : 'All Submissions'}
            </h1>
          </div>
          <div className="flex items-center gap-2 pt-1">
            {activeForm && <PullReportButton formId={activeForm.id} formTitle={activeForm.title} />}
            <ExportButton
              formId={searchParams.form_id}
              isRead={searchParams.is_read}
              search={searchParams.search}
              formTitle={activeForm?.title}
            />
          </div>
        </div>
      </div>

      <div className="p-8">

        {/* Toolbar */}
        <Suspense>
          <SubmissionsToolbar
            currentStatus={searchParams.status}
            currentSearch={searchParams.search}
            currentRead={searchParams.is_read}
            currentForm={searchParams.form_id}
            forms={forms}
            counts={counts}
          />
        </Suspense>

        {/* Table */}
        <SubmissionsTable
          submissions={submissions as SubmissionRow[]}
          emptyHint={searchParams.search ? `No results for "${searchParams.search}"` : 'No submissions found'}
        />

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-[12px] text-zinc-400 dark:text-zinc-500">Page {page} of {totalPages} · {count} total</p>
            <div className="flex items-center gap-1.5">
              {page > 1 && (
                <Link
                  href={`?page=${page - 1}${searchParams.form_id ? `&form_id=${searchParams.form_id}` : ''}${searchParams.is_read ? `&is_read=${searchParams.is_read}` : ''}${searchParams.status ? `&status=${searchParams.status}` : ''}${searchParams.search ? `&search=${searchParams.search}` : ''}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12px] font-medium text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-zinc-600 transition-colors"
                >
                  <ChevronLeft size={13} /> Prev
                </Link>
              )}
              {page < totalPages && (
                <Link
                  href={`?page=${page + 1}${searchParams.form_id ? `&form_id=${searchParams.form_id}` : ''}${searchParams.is_read ? `&is_read=${searchParams.is_read}` : ''}${searchParams.status ? `&status=${searchParams.status}` : ''}${searchParams.search ? `&search=${searchParams.search}` : ''}`}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12px] font-medium text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-zinc-600 transition-colors"
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
