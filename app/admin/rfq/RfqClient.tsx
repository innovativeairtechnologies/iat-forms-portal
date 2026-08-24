'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Layers, UserRound, AlertCircle, Eye, CheckCircle2, UserCheck } from 'lucide-react'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar, CardTable, Row,
  EmptyRow, ListSearch, FilterDropdown, Pagination, usePagedList,
} from '@/components/admin/list-card'
import { StatusPill, type Tone } from '@/components/admin/list'
import {
  useBulkSelect, SelectBox, BulkBar, BulkActionButton, BulkDeleteButton,
} from '@/components/admin/bulk-select'
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
  assignee_id: string | null
  assignee_name: string | null
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

const COLS = 'grid-cols-[34px_125px_minmax(170px,1.15fr)_minmax(140px,1fr)_minmax(140px,1fr)_110px_105px_95px]'

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

export default function RfqClient({ rows, canDelete, myEmployeeId }: {
  rows: RfqRow[]
  /** Full admins only — /api/admin/bulk-delete refuses everyone else. */
  canDelete: boolean
  /** employees.id for the signed-in person, or null if they have no row. */
  myEmployeeId: string | null
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('__all')
  const [track, setTrack] = useState('__all')
  const [owner, setOwner] = useState('__all')
  const sel = useBulkSelect()
  const [pending, startTransition] = useTransition()
  const [actionError, setActionError] = useState<string | null>(null)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (status !== '__all' && r.status !== status) return false
      if (track !== '__all' && r.track !== track) return false
      if (owner === '__unassigned' && r.assignee_id) return false
      if (owner !== '__all' && owner !== '__unassigned' && r.assignee_id !== owner) return false
      if (!q) return true
      return [r.reference, r.company, r.contact_name, r.email, r.project_name, r.location, r.application_label]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [rows, search, status, track, owner])

  const { page, setPage, perPage, setPerPage, totalPages, start, end } = usePagedList(
    filtered.length, { resetKey: `${search}|${status}|${track}|${owner}` }
  )

  const owners = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rows) if (r.assignee_id && r.assignee_name) seen.set(r.assignee_id, r.assignee_name)
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  /**
   * Apply one triage change to every selected row.
   *
   * Deliberately drives the EXISTING per-row endpoint once per id rather than
   * adding a bulk PATCH. That route already owns the perm gate, the status
   * whitelist, the reminder-stamp clearing and the assignment email — a second
   * write path would have to reimplement all of it and would drift. A triage
   * queue is tens of rows, not thousands, so the cost is a few requests.
   *
   * ⚠️ Failures are COLLECTED and shown. A partial success that looks total is
   * the worst outcome here: the rows simply would not move and nothing would say
   * why. (The ticket queue had exactly that bug — see TicketsQueueClient.)
   */
  const applyToSelected = (patch: Record<string, unknown>, label: string) => {
    const ids = sel.ids
    if (!ids.length) return
    setActionError(null)
    startTransition(async () => {
      const results = await Promise.all(ids.map(async id => {
        try {
          const res = await fetch(`/api/admin/rfq/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(patch),
          })
          if (res.ok) return null
          const data = await res.json().catch(() => ({}))
          return { id, error: data.error || `HTTP ${res.status}` }
        } catch (err) {
          return { id, error: String(err) }
        }
      }))

      const failed = results.filter(Boolean) as { id: string; error: string }[]
      if (failed.length) {
        const refs = failed
          .map(f => rows.find(r => r.id === f.id)?.reference ?? f.id)
          .join(', ')
        setActionError(`${label}: ${failed.length} of ${ids.length} could not be updated (${refs}) — ${failed[0].error}`)
      } else {
        sel.clear()
      }
      router.refresh()
    })
  }

  // Select-all is PAGE-scoped — see the note on togglePage in bulk-select.tsx.
  // Taking the whole filtered set would put off-screen rows into a selection that
  // has a Delete button on it.
  const pageRows = filtered.slice(start, end)
  const allSelected = pageRows.length > 0 && pageRows.every(r => sel.has(r.id))
  const someSelected = pageRows.some(r => sel.has(r.id))

  const counts = useMemo(() => ({
    unread: rows.filter(r => !r.is_read).length,
    unassigned: rows.filter(r => !r.assignee_id && r.status === 'new').length,
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
          <Stat tone={counts.unassigned ? 'amber' : 'slate'} label="Unassigned" value={counts.unassigned} sub="Nobody owns these yet" />
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
          {/* "Unassigned" first — it is the filter that finds the problem. */}
          <FilterDropdown
            icon={UserRound}
            allLabel="Anyone"
            value={owner}
            onChange={setOwner}
            options={[
              { value: '__unassigned', label: 'Unassigned' },
              ...owners.map(o => ({ value: o.id, label: o.name })),
            ]}
          />
        </Toolbar>
        {/* A refused bulk action. Above the table, not a toast — a partial
            failure needs to stay on screen next to the rows that did not move. */}
        {actionError && (
          <div className="flex items-start gap-2 px-4 py-2.5 bg-rose-50 dark:bg-rose-500/10 border-b border-rose-200 dark:border-rose-500/20">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
            <p className="text-[12px] leading-relaxed text-rose-700 dark:text-rose-300">{actionError}</p>
            <button
              onClick={() => setActionError(null)}
              className="ml-auto shrink-0 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline"
            >
              Dismiss
            </button>
          </div>
        )}
        <CardTable
          cols={COLS}
          minWidth={1074}
          head={
            <>
              <SelectBox
                className="hidden sm:flex"
                checked={allSelected}
                indeterminate={someSelected}
                label={allSelected ? 'Clear selection on this page' : 'Select all requests on this page'}
                onChange={() => sel.togglePage(pageRows.map(r => r.id), !allSelected)}
              />
              <span>Reference</span>
              <span>Company &amp; contact</span>
              <span>Project</span>
              <span>The job</span>
              <span>Owner</span>
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
            pageRows.map(r => (
              <Row key={r.id} cols={COLS} href={`/admin/rfq/${r.id}`} selected={sel.has(r.id)}>
                <SelectBox className="hidden sm:flex" checked={sel.has(r.id)} onChange={() => sel.toggle(r.id)} />
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
                <span className="truncate text-[12.5px]">
                  {r.assignee_name
                    ? <span className="text-ink-secondary">{r.assignee_name}</span>
                    : <span className="text-amber-700 dark:text-amber-400">Unassigned</span>}
                </span>
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

      {/* Bulk bar. Order is deliberate: the two triage moves people actually make
          in batches first, then assignment, then the irreversible one last and
          visually separate. */}
      <BulkBar count={sel.count} onClear={sel.clear}>
        <BulkActionButton
          icon={<Eye size={13} />}
          label="Reviewing"
          disabled={pending}
          onClick={() => applyToSelected({ status: 'reviewing' }, 'Mark reviewing')}
        />
        <BulkActionButton
          icon={<CheckCircle2 size={13} />}
          label="Close"
          disabled={pending}
          onClick={() => applyToSelected({ status: 'closed' }, 'Close')}
        />
        {myEmployeeId && (
          <BulkActionButton
            icon={<UserCheck size={13} />}
            label="Assign to me"
            disabled={pending}
            onClick={() => applyToSelected({ assignee_id: myEmployeeId }, 'Assign to me')}
          />
        )}
        {/* Full admins only — see the note in page.tsx. */}
        {canDelete && <BulkDeleteButton entity="rfq" ids={sel.ids} onDone={sel.clear} />}
      </BulkBar>
    </ListCardPage>
  )
}
