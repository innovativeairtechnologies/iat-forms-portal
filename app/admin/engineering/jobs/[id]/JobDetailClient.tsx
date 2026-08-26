'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AlertCircle, CalendarClock, Plus, RefreshCw, Trash2 } from 'lucide-react'
import PageChrome from '@/app/admin/PageChrome'
import { ListCardPage, ListCard, CardHead, StatStrip, Stat } from '@/components/admin/list-card'
import { StatusPill } from '@/components/admin/list'
import {
  COMPLEXITIES, COMPLEXITY_LABELS, JOB_STATUSES, JOB_STATUS_LABELS, JOB_STATUS_TONE,
  OPEN_STATUSES, STREAMS, STREAM_BLURB, STREAM_LABELS, STREAM_TONE, shortDate, streamProgress,
  type EngJob, type EngTaskRow, type Stream,
} from '@/lib/engineering'
import type { JobRollUp } from '@/lib/eng-data'
import TaskEditRow from '../../TaskEditRow'
import { Nothing, ProgressBar, StreamChip } from '../../ui'

const BTN =
  'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-hairline text-[12.5px] font-medium ' +
  'text-ink-secondary hover:text-ink hover:border-hairline-strong transition-colors disabled:opacity-40'

const FIELD =
  'h-8 rounded-lg border border-hairline bg-surface px-2 text-[12.5px] text-ink ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors disabled:opacity-50'

export default function JobDetailClient({
  job, tasks, rollUp, assignees, onDemand, canDelete,
}: {
  job: EngJob
  tasks: EngTaskRow[]
  rollUp: JobRollUp
  assignees: { id: string; name: string }[]
  onDemand: { stream: Stream; step: string; title: string }[]
  canDelete: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const call = async (body: Record<string, unknown>, describe: (d: Record<string, number>) => string) => {
    setBusy(true); setError(null); setNotice(null)
    try {
      const res = await fetch(`/api/admin/engineering/jobs/${job.id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || `Could not complete that (HTTP ${res.status}).`)
      else { setNotice(describe(d)); startTransition(() => router.refresh()) }
    } catch (err) { setError(String(err)) }
    setBusy(false)
  }

  const addTask = async (stream: Stream, step: string) => {
    setBusy(true); setError(null); setNotice(null)
    try {
      const res = await fetch('/api/admin/engineering/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ job_id: job.id, stream, step }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) setError(d.error || `Could not add the task (HTTP ${res.status}).`)
      else startTransition(() => router.refresh())
    } catch (err) { setError(String(err)) }
    setBusy(false)
  }

  const remove = async () => {
    if (!confirm(`Delete job ${job.job_number} and all ${tasks.length} of its tasks? This cannot be undone — set it to Cancelled instead if you want to keep the record.`)) return
    setBusy(true)
    const res = await fetch(`/api/admin/engineering/jobs/${job.id}`, { method: 'DELETE' })
    if (res.ok) router.push('/admin/engineering/jobs')
    else { const d = await res.json().catch(() => ({})); setError(d.error || 'Could not delete the job.'); setBusy(false) }
  }

  const working = busy || pending
  const streamsPresent = STREAMS.filter(s => tasks.some(t => t.stream === s))

  return (
    <>
      <PageChrome record={job.job_number}>
        <select
          className={FIELD}
          value={job.status}
          disabled={working}
          onChange={e => call({ status: e.target.value }, () => `Job set to ${JOB_STATUS_LABELS[e.target.value as keyof typeof JOB_STATUS_LABELS]}.`)}
          aria-label="Job status"
        >
          {JOB_STATUSES.map(s => <option key={s} value={s}>{JOB_STATUS_LABELS[s]}</option>)}
        </select>
        <button type="button" className={BTN} disabled={working}
          onClick={() => call({ action: 'regenerate' }, d => d.inserted ? `${d.inserted} task${d.inserted === 1 ? '' : 's'} added from the scheduling rules.` : 'Already complete — every step in the rules is on this job.')}>
          <RefreshCw size={13} /> Regenerate plan
        </button>
        <button type="button" className={BTN} disabled={working || !job.po_date}
          title={job.po_date ? 'Re-apply the cycle times to every open task' : 'Set a PO date first — there is nothing to count from'}
          onClick={() => call({ action: 'redate' }, d => d.updated ? `${d.updated} open task${d.updated === 1 ? '' : 's'} re-dated from the PO.` : 'Nothing to move.')}>
          <CalendarClock size={13} /> Re-date from PO
        </button>
      </PageChrome>

      <ListCardPage>
        <div className="space-y-3">
          <ListCard>
            <CardHead
              overline="Engineering job"
              title={
                <span className="flex items-baseline gap-2.5">
                  <span className="tabular-nums">{job.job_number}</span>
                  <StatusPill tone={JOB_STATUS_TONE[job.status]}>{JOB_STATUS_LABELS[job.status]}</StatusPill>
                </span>
              }
              count={[job.customer_name, job.project_name, job.model_number].filter(Boolean).join(' · ') || 'No customer or project recorded'}
            />
            <StatStrip>
              <Stat tone="emerald" label="Overall" value={`${rollUp.progress}%`} sub="Mean of the buckets on this job" />
              <Stat tone="sky" label="Open tasks" value={rollUp.open} />
              <Stat tone={rollUp.atRisk ? 'rose' : 'slate'} label="At risk" value={rollUp.atRisk} sub="Overdue, trending late or blocked" />
              <Stat tone="slate" label="Next due" value={shortDate(rollUp.nextDue)} />
            </StatStrip>

            {/* Job facts, editable in place. A detail page whose fields are
                read-only sends people back to a spreadsheet to fix a model
                number, which is how the spreadsheet stays alive. */}
            <div className="grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-4">
              {([
                ['customer_name', 'Customer', 'text'],
                ['project_name', 'Project', 'text'],
                ['model_number', 'Model', 'text'],
                ['po_date', 'PO date', 'date'],
                ['ship_date', 'Target ship', 'date'],
              ] as const).map(([key, label, type]) => (
                <label key={key} className="block">
                  <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.055em] text-ink-muted">{label}</span>
                  <input
                    type={type}
                    className={`${FIELD} w-full ${type === 'date' ? 'tabular-nums' : ''}`}
                    defaultValue={(job[key] as string | null) ?? ''}
                    disabled={working}
                    onBlur={e => e.target.value !== ((job[key] as string | null) ?? '') && call({ [key]: e.target.value }, () => `${label} saved.`)}
                  />
                </label>
              ))}
              <label className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.055em] text-ink-muted">Complexity</span>
                <select className={`${FIELD} w-full`} value={job.complexity} disabled={working}
                  onChange={e => call({ complexity: e.target.value }, () => 'Complexity saved.')}>
                  {COMPLEXITIES.map(c => <option key={c} value={c}>{COMPLEXITY_LABELS[c]}</option>)}
                </select>
              </label>
            </div>

            {!job.po_date && (
              <div className="flex items-start gap-2 border-t border-hairline bg-amber-50 px-5 py-2.5 dark:bg-amber-500/10">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500" />
                <p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
                  No PO date, so nothing on this job has a generated due date and nothing can be projected ahead or behind.
                  Set one above, then press <strong className="font-semibold">Re-date from PO</strong>.
                </p>
              </div>
            )}

            {notice && (
              <p className="border-t border-hairline px-5 py-2.5 text-[12px] text-emerald-600 dark:text-emerald-400">{notice}</p>
            )}
            {error && (
              <div className="flex items-start gap-2 border-t border-rose-200 bg-rose-50 px-5 py-2.5 dark:border-rose-500/20 dark:bg-rose-500/10">
                <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
                <p className="text-[12px] leading-relaxed text-rose-700 dark:text-rose-300">{error}</p>
                <button onClick={() => setError(null)} className="ml-auto shrink-0 text-[11px] font-medium text-rose-600 hover:underline dark:text-rose-400">Dismiss</button>
              </div>
            )}
          </ListCard>

          {tasks.length === 0 ? (
            <ListCard>
              <Nothing>
                This job has no plan. Press <strong className="font-semibold text-ink-secondary">Regenerate plan</strong> above to
                create it from the scheduling rules.
              </Nothing>
            </ListCard>
          ) : (
            streamsPresent.map(stream => {
              const list = tasks.filter(t => t.stream === stream)
              const open = list.filter(t => (OPEN_STATUSES as readonly string[]).includes(t.status)).length
              const progress = streamProgress(list)
              const adds = onDemand.filter(o => o.stream === stream)
              return (
                <ListCard key={stream}>
                  <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2.5">
                    <StreamChip stream={stream} />
                    <h3 className="text-[12.5px] font-semibold text-ink">{STREAM_LABELS[stream]}</h3>
                    <span className="hidden text-[11.5px] text-ink-muted sm:inline">{STREAM_BLURB[stream]}</span>
                    <span className="ml-auto flex items-center gap-3">
                      <span className="w-28"><ProgressBar value={progress} tone={STREAM_TONE[stream]} showValue /></span>
                      <span className="text-[11.5px] tabular-nums text-ink-muted">{open} open</span>
                      {adds.map(a => (
                        <button key={a.step} type="button" disabled={working} onClick={() => addTask(a.stream, a.step)}
                          className="inline-flex items-center gap-1 text-[11.5px] font-medium text-ink-muted transition-colors hover:text-brand-ink disabled:opacity-40">
                          <Plus size={12} /> {a.title}
                        </button>
                      ))}
                    </span>
                  </div>
                  {list.map(t => <TaskEditRow key={t.id} task={t} assignees={assignees} />)}
                </ListCard>
              )
            })
          )}

          <div className="flex items-center gap-3 pb-4">
            <Link href="/admin/engineering/jobs" className="text-[12px] text-ink-muted transition-colors hover:text-ink">← All jobs</Link>
            {canDelete && (
              <button type="button" onClick={remove} disabled={working}
                className="ml-auto inline-flex items-center gap-1.5 text-[12px] font-medium text-rose-600 transition-colors hover:underline disabled:opacity-40 dark:text-rose-400">
                <Trash2 size={13} /> Delete this job
              </button>
            )}
          </div>
        </div>
      </ListCardPage>
    </>
  )
}
