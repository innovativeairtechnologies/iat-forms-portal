'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Plus } from 'lucide-react'
import PageChrome from '../PageChrome'
import { StatusPill, timeAgo, type Tone } from '@/components/admin/list'
import {
  CardHead, CardTable, EmptyRow, ListCard, ListCardPage, ListSearch, Row, Stat, StatStrip,
  TagPill, Toolbar, Pagination, usePagedList,
} from '@/components/admin/list-card'

/* The Sequence of Operation list.
 *
 * The "Not applicable" column is deliberately on the LIST, not hidden inside the
 * document. A sequence assembled from a unit configuration is only trustworthy
 * if you can see what it left out — so the count of excluded clauses travels
 * with the row, and a document still carrying BLOCKED clauses reads as a
 * problem at a glance rather than looking finished. */

export type SooListRow = {
  id: string
  title: string
  customer_name: string
  project_name: string
  unit_tag: string | null
  status: string
  library_version: number | null
  assembled_at: string | null
  updated_at: string
  excluded: number
  blocked: number
}

const STATUS_TONE: Record<string, Tone> = { draft: 'slate', in_review: 'amber', approved: 'emerald' }
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', in_review: 'In review', approved: 'Approved' }

const COLS = 'grid-cols-[minmax(220px,2.2fr)_minmax(150px,1.3fr)_110px_120px_130px_120px]'

export default function SooClient({ rows }: { rows: SooListRow[] }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter((r) =>
      [r.title, r.customer_name, r.project_name, r.unit_tag ?? ''].join(' ').toLowerCase().includes(needle)
    )
  }, [rows, q])

  const paged = usePagedList(filtered.length, { resetKey: q })
  const visible = filtered.slice(paged.start, paged.end)

  const blockedDocs = rows.filter((r) => r.blocked > 0).length
  const awaiting = rows.filter((r) => r.status === 'in_review').length
  const approved = rows.filter((r) => r.status === 'approved').length

  async function create() {
    setCreating(true)
    try {
      const res = await fetch('/api/admin/soo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.id) router.push(`/admin/soo/${data.id}`)
      else alert(data?.error ?? 'Could not create the document.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <>
      <PageChrome>
        <button
          type="button"
          onClick={create}
          disabled={creating}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          <Plus size={15} /> {creating ? 'Creating…' : 'New sequence'}
        </button>
      </PageChrome>

      <ListCardPage>
        <ListCard>
          <CardHead
            overline="Engineering"
            title="Submittal Generator"
            count={`${rows.length} document${rows.length === 1 ? '' : 's'}`}
          />

          <StatStrip>
            <Stat tone="slate" label="Documents" value={rows.length} />
            <Stat tone="amber" label="Awaiting review" value={awaiting} />
            <Stat tone="emerald" label="Approved" value={approved} />
            <Stat
              tone={blockedDocs ? 'rose' : 'slate'}
              label="With unresolved clauses"
              value={blockedDocs}
              sub={blockedDocs ? 'These need facts before they can ship' : undefined}
            />
          </StatStrip>

          <Toolbar>
            <ListSearch value={q} onChange={setQ} placeholder="Search customer, project or tag…" width={280} />
          </Toolbar>

          <CardTable
            cols={COLS}
            minWidth={900}
            head={
              <>
                <span>Project</span>
                <span>Customer</span>
                <span>Status</span>
                <span className="justify-self-end">Not applicable</span>
                <span className="justify-self-end">Unresolved</span>
                <span className="justify-self-end">Updated</span>
              </>
            }
          >
            {visible.length === 0 && (
              <EmptyRow>
                {rows.length === 0
                  ? 'No sequences yet. Start one and enter the unit configuration.'
                  : 'Nothing matches that search.'}
              </EmptyRow>
            )}

            {visible.map((r) => (
              <Row key={r.id} cols={COLS} href={`/admin/soo/${r.id}`}>
                <div className="min-w-0 flex items-center gap-2.5">
                  <FileText size={15} className="text-ink-muted flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[13px] text-ink truncate">{r.project_name || r.title || 'Untitled'}</p>
                    {r.unit_tag && <p className="text-[11.5px] text-ink-muted truncate">{r.unit_tag}</p>}
                  </div>
                </div>

                <span className="text-[13px] text-ink-secondary truncate">{r.customer_name || '—'}</span>

                <span>
                  <StatusPill tone={STATUS_TONE[r.status] ?? 'slate'}>
                    {STATUS_LABEL[r.status] ?? r.status}
                  </StatusPill>
                </span>

                <span className="justify-self-end text-[13px] tabular-nums text-ink-muted">
                  {r.assembled_at ? r.excluded : '—'}
                </span>

                <span className="justify-self-end">
                  {r.blocked > 0
                    ? <TagPill tone="rose">{`${r.blocked} blocked`}</TagPill>
                    : <span className="text-[13px] tabular-nums text-ink-muted">{r.assembled_at ? '0' : '—'}</span>}
                </span>

                <span className="justify-self-end text-[12.5px] text-ink-muted">{timeAgo(r.updated_at)}</span>
              </Row>
            ))}
          </CardTable>

          <Pagination
            page={paged.page}
            totalPages={paged.totalPages}
            perPage={paged.perPage}
            total={filtered.length}
            onPage={paged.setPage}
            onPerPage={paged.setPerPage}
            unit="sequences"
          />
        </ListCard>
      </ListCardPage>
    </>
  )
}
