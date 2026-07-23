export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import ExportButton from './ExportButton'
import PullReportButton from './PullReportButton'
import SubmissionsToolbar from './SubmissionsToolbar'
import SubmissionsTable, { type SubmissionRow } from './SubmissionsTable'
import { ListCardPage, ListCard, CardHead } from '@/components/admin/list-card'
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
  const start = (page - 1) * limit
  const showingTo = Math.min(start + limit, count)

  return (
    // Warm canvas; the whole inbox — header, filters, table, pager — lives in one
    // card (docs/list-views.md). Data flow stays server-side: SubmissionsToolbar
    // navigates query params, so filtering / search / paging all round-trip to the
    // server (page-based, 25 per page) rather than slicing a client array.
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Inbox"
          title="Submissions"
          count={`${count} ${count === 1 ? 'submission' : 'submissions'}`}
          actions={
            <>
              {activeForm && <PullReportButton formId={activeForm.id} formTitle={activeForm.title} />}
              <ExportButton
                formId={searchParams.form_id}
                isRead={searchParams.is_read}
                search={searchParams.search}
                formTitle={activeForm?.title}
              />
            </>
          }
        />

        {/* Status tabs (with counts) + read-state pills */}
        <div className="px-5 py-2.5 border-b border-hairline">
          <Suspense>
            <SubmissionsToolbar
              variant="header"
              currentStatus={searchParams.status}
              currentRead={searchParams.is_read}
              counts={counts}
            />
          </Suspense>
        </div>

        {/* Search + form filter */}
        <div className="px-5 pt-3 border-b border-hairline">
          <Suspense>
            <SubmissionsToolbar
              variant="toolbar"
              currentSearch={searchParams.search}
              currentForm={searchParams.form_id}
              forms={forms}
            />
          </Suspense>
        </div>

        {/* Table (client) — CardTable + Rows, selection + row actions preserved */}
        <SubmissionsTable
          submissions={submissions as SubmissionRow[]}
          emptyHint={searchParams.search ? `No results for "${searchParams.search}"` : 'No submissions found'}
        />

        {/* Pagination — server-side (page-based); restyled into the card footer */}
        {count > 0 && (
          <div className="flex items-center gap-4 px-5 py-3.5 border-t border-hairline flex-wrap">
            <span className="text-[12.5px] text-ink-muted">
              Showing <b className="font-semibold text-ink-secondary tabular-nums">{start + 1}&ndash;{showingTo}</b>
              {' '}of <b className="font-semibold text-ink-secondary tabular-nums">{count}</b> {count === 1 ? 'submission' : 'submissions'}
            </span>
            <div className="flex-1" />
            <Pager page={page} totalPages={totalPages} searchParams={searchParams} />
          </div>
        )}
      </ListCard>
    </ListCardPage>
  )
}

// Preserve the current filter/search/status selection when moving between pages.
function pageHref(sp: SearchParams, n: number) {
  const params = new URLSearchParams()
  params.set('page', String(n))
  if (sp.form_id) params.set('form_id', sp.form_id)
  if (sp.is_read) params.set('is_read', sp.is_read)
  if (sp.status)  params.set('status', sp.status)
  if (sp.search)  params.set('search', sp.search)
  return `?${params.toString()}`
}

// Windowed pager rendered as server <Link>s (‹ 1 … 4 5 6 … 20 ›), matching the
// list-card footer look. Server-driven: each link loads that page from Supabase.
function Pager({ page, totalPages, searchParams }: { page: number; totalPages: number; searchParams: SearchParams }) {
  if (totalPages <= 1) return null

  const win: (number | '…')[] = [1]
  const lo = Math.max(2, page - 1), hi = Math.min(totalPages - 1, page + 1)
  if (lo > 2) win.push('…')
  for (let n = lo; n <= hi; n++) win.push(n)
  if (hi < totalPages - 1) win.push('…')
  if (totalPages > 1) win.push(totalPages)

  const btn = 'min-w-[30px] h-[30px] px-2 inline-flex items-center justify-center text-[12.5px] font-medium rounded-lg tabular-nums transition-colors'
  return (
    <div className="flex items-center gap-1">
      {page > 1 ? (
        <Link href={pageHref(searchParams, page - 1)} className={`${btn} text-ink-secondary hover:bg-surface-strong`} aria-label="Previous page">
          <ChevronLeft size={14} />
        </Link>
      ) : (
        <span className={`${btn} text-ink-faint opacity-40`} aria-hidden><ChevronLeft size={14} /></span>
      )}
      {win.map((n, i) => n === '…'
        ? <span key={`d${i}`} className={`${btn} text-ink-faint`}>…</span>
        : <Link key={n} href={pageHref(searchParams, n)} className={`${btn} ${n === page ? 'bg-brand text-white' : 'text-ink-secondary hover:bg-surface-strong'}`}>{n}</Link>,
      )}
      {page < totalPages ? (
        <Link href={pageHref(searchParams, page + 1)} className={`${btn} text-ink-secondary hover:bg-surface-strong`} aria-label="Next page">
          <ChevronRight size={14} />
        </Link>
      ) : (
        <span className={`${btn} text-ink-faint opacity-40`} aria-hidden><ChevronRight size={14} /></span>
      )}
    </div>
  )
}
