'use client'

import { useMemo, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Layers, Plus } from 'lucide-react'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar, CardTable, Row,
  EmptyRow, ListSearch, FilterDropdown, Pagination, usePagedList,
} from '@/components/admin/list-card'
import { StatusPill } from '@/components/admin/list'
import {
  COMPLEXITIES, COMPLEXITY_LABELS, JOB_STATUSES, JOB_STATUS_LABELS, JOB_STATUS_TONE,
  STREAM_SHORT, shortDate,
} from '@/lib/engineering'
import type { JobRollUp } from '@/lib/eng-data'
import { ProgressBar } from '../ui'
import NewJobDialog from './NewJobDialog'

export type JobRow = JobRollUp & { owners: string[]; taskCount: number }

const COLS = 'grid-cols-[90px_minmax(160px,1.2fr)_minmax(140px,1fr)_130px_minmax(150px,1fr)_110px_100px_100px]'

export default function JobsClient({ rows, preview }: {
  rows: JobRow[]
  /** Cycle days from the live playbook, for the New Job dialog's date preview. */
  preview: { label: string; cycleDays: number | null }[]
}) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('active')
  const [complexity, setComplexity] = useState('__all')
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (status !== '__all' && r.job.status !== status) return false
      if (complexity !== '__all' && r.job.complexity !== complexity) return false
      if (!q) return true
      return [r.job.job_number, r.job.customer_name, r.job.project_name, r.job.model_number, ...r.owners]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [rows, search, status, complexity])

  const { page, setPage, perPage, setPerPage, totalPages, start, end } = usePagedList(
    filtered.length, { resetKey: `${search}|${status}|${complexity}` },
  )

  const counts = useMemo(() => ({
    active: rows.filter(r => r.job.status === 'active').length,
    atRisk: rows.filter(r => r.job.status === 'active' && r.atRisk > 0).length,
    overdue: rows.filter(r => r.job.status === 'active' && r.overdue > 0).length,
    // A job with no tasks is the one failure mode job creation can leave behind
    // (see the note in the POST route: the job is created first, and a failed
    // generation does not roll it back). Surfacing it as a counted, filterable
    // state is what makes that failure visible instead of silent.
    unplanned: rows.filter(r => r.job.status === 'active' && r.taskCount === 0).length,
  }), [rows])

  return (
    <ListCardPage>
      <div className="space-y-3">
        <ListCard>
          <CardHead
            overline="Engineering"
            title="Jobs"
            count={`${rows.length} ${rows.length === 1 ? 'job' : 'jobs'} on record`}
            actions={
              <button
                type="button"
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand text-white text-[12.5px] font-medium hover:bg-brand-hover transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <Plus size={14} /> New job
              </button>
            }
          />
          <StatStrip>
            <Stat tone="sky" label="Active" value={counts.active} />
            <Stat tone={counts.atRisk ? 'rose' : 'slate'} label="With work at risk" value={counts.atRisk} sub="Overdue, trending late or blocked" />
            <Stat tone={counts.overdue ? 'rose' : 'slate'} label="With overdue work" value={counts.overdue} />
            <Stat tone={counts.unplanned ? 'amber' : 'slate'} label="No plan yet" value={counts.unplanned} sub="Open one and press Regenerate" />
          </StatStrip>
          <Toolbar>
            <ListSearch value={search} onChange={setSearch} placeholder="Search job number, customer, project…" />
            <FilterDropdown
              icon={Layers}
              allLabel="All statuses"
              value={status}
              onChange={setStatus}
              options={JOB_STATUSES.map(s => ({ value: s, label: JOB_STATUS_LABELS[s] }))}
            />
            <FilterDropdown
              icon={Layers}
              allLabel="Any complexity"
              value={complexity}
              onChange={setComplexity}
              options={COMPLEXITIES.map(c => ({ value: c, label: COMPLEXITY_LABELS[c] }))}
            />
          </Toolbar>

          {error && (
            <div className="flex items-start gap-2 px-5 py-2.5 bg-rose-50 dark:bg-rose-500/10 border-b border-rose-200 dark:border-rose-500/20">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
              <p className="text-[12px] leading-relaxed text-rose-700 dark:text-rose-300">{error}</p>
              <button onClick={() => setError(null)} className="ml-auto shrink-0 text-[11px] font-medium text-rose-600 dark:text-rose-400 hover:underline">Dismiss</button>
            </div>
          )}

          <CardTable
            cols={COLS}
            minWidth={1080}
            head={
              <>
                <span>Job</span>
                <span>Customer</span>
                <span>Project</span>
                <span>Progress</span>
                <span>Buckets</span>
                <span>Owners</span>
                <span>Next due</span>
                <span className="justify-self-end">Status</span>
              </>
            }
          >
            {filtered.length === 0 ? (
              <EmptyRow>
                {rows.length === 0
                  ? 'No jobs yet. Open one with a job number and a PO date and the whole plan generates itself.'
                  : 'Nothing matches that filter.'}
              </EmptyRow>
            ) : (
              filtered.slice(start, end).map(r => (
                <Row key={r.job.id} cols={COLS} href={`/admin/engineering/jobs/${r.job.id}`}>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-semibold tabular-nums text-ink group-hover:text-brand-ink transition-colors">
                      {r.job.job_number}
                    </span>
                    <span className="block truncate text-[11px] text-ink-muted">{COMPLEXITY_LABELS[r.job.complexity]}</span>
                  </span>
                  <span className="truncate text-[12.5px] text-ink-secondary">{r.job.customer_name || <span className="text-ink-faint">Not given</span>}</span>
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] text-ink-secondary">{r.job.project_name || <span className="text-ink-faint">Unnamed</span>}</span>
                    {r.job.model_number && <span className="block truncate text-[11px] tabular-nums text-ink-muted">{r.job.model_number}</span>}
                  </span>
                  <span className="min-w-0">
                    {r.taskCount === 0
                      ? <span className="text-[11.5px] text-amber-700 dark:text-amber-400">No plan</span>
                      : <ProgressBar value={r.progress} tone={r.overdue ? 'rose' : r.atRisk ? 'amber' : 'emerald'} showValue />}
                  </span>
                  <span className="flex flex-wrap gap-1 min-w-0">
                    {r.byStream.length === 0
                      ? <span className="text-[11.5px] text-ink-faint">—</span>
                      : r.byStream.map(s => (
                          <span
                            key={s.stream}
                            title={`${STREAM_SHORT[s.stream]} · ${s.progress}% · ${s.open} open`}
                            className={`text-[10px] font-semibold tabular-nums px-1.5 py-[2px] rounded ${
                              s.open === 0
                                ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400'
                                : 'bg-surface-strong text-ink-muted'
                            }`}
                          >
                            {STREAM_SHORT[s.stream]} {s.progress}%
                          </span>
                        ))}
                  </span>
                  <span className="truncate text-[12px] text-ink-secondary">
                    {r.owners.length === 0
                      ? <span className="text-amber-700 dark:text-amber-400">Unassigned</span>
                      : r.owners.length === 1 ? r.owners[0] : `${r.owners[0]} +${r.owners.length - 1}`}
                  </span>
                  <span className="text-[12px] tabular-nums text-ink-muted">{shortDate(r.nextDue)}</span>
                  <span className="justify-self-end">
                    <StatusPill tone={JOB_STATUS_TONE[r.job.status]}>{JOB_STATUS_LABELS[r.job.status]}</StatusPill>
                  </span>
                </Row>
              ))
            )}
          </CardTable>
          <Pagination
            page={page} perPage={perPage} total={filtered.length} totalPages={totalPages}
            onPage={setPage} onPerPage={setPerPage} unit="jobs"
          />
        </ListCard>
      </div>

      {open && (
        <NewJobDialog
          preview={preview}
          onClose={() => setOpen(false)}
          onCreated={(id, generated, generateError) => {
            setOpen(false)
            if (generateError) {
              // Loud, and it stays on screen. A job that generated nothing looks
              // exactly like a job with nothing to do until someone misses a date.
              setError(`Job created, but its plan did not generate: ${generateError}. Open the job and press “Regenerate plan”.`)
              startTransition(() => router.refresh())
              return
            }
            router.push(`/admin/engineering/jobs/${id}`)
          }}
        />
      )}
    </ListCardPage>
  )
}
