export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { Inbox, ChevronLeft, ChevronRight } from 'lucide-react'
import ExportButton from './ExportButton'
import PullReportButton from './PullReportButton'
import SubmissionsToolbar from './SubmissionsToolbar'
import { Suspense } from 'react'

interface SearchParams {
  form_id?: string
  is_read?: string
  status?: string
  page?: string
  search?: string
}

const STATUS_CONFIG: Record<string, { label: string; cls: string }> = {
  open:        { label: 'Open',        cls: 'bg-gray-100  text-gray-500  dark:bg-zinc-800     dark:text-gray-400'  },
  in_progress: { label: 'In Progress', cls: 'bg-amber-50  text-amber-600 dark:bg-amber-950/40 dark:text-amber-400' },
  resolved:    { label: 'Resolved',    cls: 'bg-green-50  text-green-600 dark:bg-green-950/40 dark:text-green-400' },
}

const COL = 'grid-cols-[20px_1fr_180px_108px_72px_28px]'

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase()
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

export default async function SubmissionsPage({ searchParams }: { searchParams: SearchParams }) {
  const { submissions, count, forms, page, limit, counts } = await getSubmissions(searchParams)
  const totalPages = Math.ceil(count / limit)
  const activeForm = forms.find((f: { id: string; title: string }) => f.id === searchParams.form_id)

  return (
    <div className="flex-1 overflow-auto">

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
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">

          {/* Column headers */}
          <div className={`grid ${COL} border-b border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/40`}>
            <div />
            <div className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Submitter
            </div>
            <div className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Form
            </div>
            <div className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Status
            </div>
            <div className="px-3 py-2.5 text-[10.5px] font-semibold uppercase tracking-wider text-gray-400 dark:text-zinc-500">
              Age
            </div>
            <div />
          </div>

          {/* Rows */}
          {submissions.length === 0 ? (
            <div className="py-16 text-center">
              <Inbox size={28} className="text-gray-200 dark:text-gray-700 mx-auto mb-3" />
              <p className="text-[13px] text-gray-400">
                {searchParams.search ? `No results for "${searchParams.search}"` : 'No submissions found'}
              </p>
              <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            submissions.map((sub: {
              id: string
              form_title: string | null
              submitted_at: string
              is_read: boolean
              status?: string
              data: Record<string, unknown>
            }, i: number) => {
              const name  = String(sub.data?.['Employee Name'] || sub.data?.['Full Name'] || sub.data?.['Name'] || 'Anonymous')
              const emailRaw = sub.data?.['Employee Email'] || sub.data?.['Email'] || sub.data?.['Email Address']
              const email = emailRaw ? String(emailRaw) : null
              const ini   = name === 'Anonymous' ? '?' : initials(name)
              const s     = STATUS_CONFIG[sub.status || 'open'] ?? STATUS_CONFIG.open

              return (
                <Link
                  key={sub.id}
                  href={`/admin/submissions/${sub.id}`}
                  className={`grid ${COL} items-center hover:bg-gray-50/80 dark:hover:bg-zinc-800/40 transition-colors group ${
                    i !== 0 ? 'border-t border-gray-50 dark:border-zinc-800/60' : ''
                  } ${i % 2 === 1 ? 'bg-gray-50/40 dark:bg-zinc-800/10' : ''}`}
                >
                  {/* Unread dot */}
                  <div className="flex items-center justify-center py-3">
                    {!sub.is_read && <div className="w-1.5 h-1.5 rounded-full bg-[#089447]" />}
                  </div>

                  {/* Submitter */}
                  <div className="px-3 py-3 min-w-0 flex items-center gap-2.5">
                    <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0 text-[9px] font-bold text-gray-500 dark:text-gray-400">
                      {ini}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[13px] truncate transition-colors group-hover:text-[#089447] ${sub.is_read ? 'text-gray-600 dark:text-gray-400' : 'font-semibold text-gray-900 dark:text-white'}`}>
                        {name}
                      </p>
                      {email && (
                        <p className="text-[11px] text-gray-400 truncate">{email}</p>
                      )}
                    </div>
                  </div>

                  {/* Form */}
                  <div className="px-3 py-3 min-w-0">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-lg bg-gray-100 dark:bg-zinc-800 text-[11px] font-medium text-gray-600 dark:text-gray-400 truncate max-w-full">
                      {sub.form_title || '—'}
                    </span>
                  </div>

                  {/* Status */}
                  <div className="px-3 py-3">
                    <span className={`inline-flex text-[11px] font-semibold px-2 py-0.5 rounded-full ${s.cls}`}>
                      {s.label}
                    </span>
                  </div>

                  {/* Age */}
                  <div className="px-3 py-3">
                    <span className="text-[12px] text-gray-400 tabular-nums">{timeAgo(sub.submitted_at)}</span>
                  </div>

                  {/* Chevron */}
                  <div className="pr-3 flex justify-end">
                    <ChevronRight size={13} className="text-gray-200 dark:text-gray-700 group-hover:text-gray-400 dark:group-hover:text-gray-500 transition-colors" />
                  </div>
                </Link>
              )
            })
          )}
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <p className="text-[12px] text-gray-400">Page {page} of {totalPages} · {count} total</p>
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
