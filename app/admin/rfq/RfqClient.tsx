'use client'

import { useMemo, useState } from 'react'
import { Layers } from 'lucide-react'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar, CardTable, Row,
  EmptyRow, ListSearch, FilterDropdown, Pagination, usePagedList,
} from '@/components/admin/list-card'
import { StatusPill, type Tone } from '@/components/admin/list'
import { RFQ_STATUSES, RFQ_STATUS_LABELS, type RfqStatus } from '@/lib/rfq-status'

const STATUS_TONE: Record<RfqStatus, Tone> = {
  new: 'sky', reviewing: 'amber', quoted: 'emerald', closed: 'slate',
}

/** The list payload — `data` (the full wizard state) is deliberately not selected. */
export type RfqRow = {
  id: string
  reference: string
  track: string
  application_label: string
  company: string
  contact_name: string
  email: string
  project_name: string
  location: string
  date_required: string | null
  status: RfqStatus
  is_read: boolean
  summary: {
    track?: string
    complete?: boolean
    total_lb_per_hr?: number
    dry_air_cfm?: number
    lb_per_hr?: number
    cfm?: number
    leaving_grains?: number
  } | null
  created_at: string
}

const COLS = 'grid-cols-[130px_minmax(180px,1.2fr)_minmax(150px,1fr)_minmax(150px,1fr)_110px_100px]'

const fmtDate = (d: string) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

/** The one number that tells a rep whether this is a big job or a small one. */
function headline(r: RfqRow): string {
  const s = r.summary
  if (!s?.complete) return '—'
  return r.track === 'room'
    ? `${s.total_lb_per_hr ?? '—'} lb/hr · ${(s.dry_air_cfm ?? 0).toLocaleString()} cfm`
    : `${(s.cfm ?? 0).toLocaleString()} cfm @ ${s.leaving_grains ?? '—'} gr/lb`
}

export default function RfqClient({ rows }: { rows: RfqRow[] }) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('__all')
  const [track, setTrack] = useState('__all')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (status !== '__all' && r.status !== status) return false
      if (track !== '__all' && r.track !== track) return false
      if (!q) return true
      return [r.reference, r.company, r.contact_name, r.email, r.project_name, r.location, r.application_label]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [rows, search, status, track])

  const { page, setPage, perPage, setPerPage, totalPages, start, end } = usePagedList(
    filtered.length, { resetKey: `${search}|${status}|${track}` }
  )

  const counts = useMemo(() => ({
    unread: rows.filter(r => !r.is_read).length,
    room: rows.filter(r => r.track === 'room').length,
    process: rows.filter(r => r.track === 'process').length,
  }), [rows])

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Sales"
          title="Requests for Quote"
          count={`${rows.length} survey${rows.length === 1 ? '' : 's'} · submitted through /support/rfq`}
        />
        <StatStrip>
          <Stat tone="sky" label="Unread" value={counts.unread} />
          <Stat tone="emerald" label="Room" value={counts.room} sub="Space held at a condition" />
          <Stat tone="violet" label="Process" value={counts.process} sub="Leaving-air spec" />
        </StatStrip>
        <Toolbar>
          <ListSearch value={search} onChange={setSearch} placeholder="Search company, project, reference…" />
          <FilterDropdown
            icon={Layers}
            allLabel="All statuses"
            value={status}
            onChange={setStatus}
            options={RFQ_STATUSES.map(s => ({ value: s, label: RFQ_STATUS_LABELS[s] }))}
          />
          <FilterDropdown
            icon={Layers}
            allLabel="Both tracks"
            value={track}
            onChange={setTrack}
            options={[{ value: 'room', label: 'Room' }, { value: 'process', label: 'Process' }]}
          />
        </Toolbar>
        <CardTable
          cols={COLS}
          minWidth={940}
          head={
            <>
              <span>Reference</span>
              <span>Company &amp; contact</span>
              <span>Project</span>
              <span>The job</span>
              <span>Status</span>
              <span className="justify-self-end">Received</span>
            </>
          }
        >
          {filtered.length === 0 ? (
            <EmptyRow>
              {rows.length === 0
                ? 'No requests yet. They arrive here the moment someone completes the survey at /support/rfq.'
                : 'Nothing matches that filter.'}
            </EmptyRow>
          ) : (
            filtered.slice(start, end).map(r => (
              <Row key={r.id} cols={COLS} href={`/admin/rfq/${r.id}`}>
                <span className="min-w-0">
                  <span className={`block truncate text-[12.5px] tabular-nums ${r.is_read ? 'text-ink-secondary' : 'font-medium text-ink'}`}>
                    {r.reference}
                  </span>
                  <span className="block truncate text-[11px] capitalize text-ink-muted">{r.track}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-medium text-ink">{r.company || 'Not given'}</span>
                  <span className="block truncate text-[11.5px] text-ink-muted">{r.contact_name || r.email}</span>
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[12.5px] text-ink-secondary">{r.project_name || <span className="text-ink-faint">Unnamed</span>}</span>
                  <span className="block truncate text-[11px] text-ink-muted">{r.application_label}</span>
                </span>
                <span className="truncate text-[12.5px] tabular-nums text-ink-secondary">{headline(r)}</span>
                <span><StatusPill tone={STATUS_TONE[r.status]}>{RFQ_STATUS_LABELS[r.status]}</StatusPill></span>
                <span className="justify-self-end text-[12px] tabular-nums text-ink-muted">{fmtDate(r.created_at)}</span>
              </Row>
            ))
          )}
        </CardTable>
        <Pagination
          page={page} perPage={perPage} total={filtered.length} totalPages={totalPages}
          onPage={setPage} onPerPage={setPerPage} unit="requests"
        />
      </ListCard>
    </ListCardPage>
  )
}
