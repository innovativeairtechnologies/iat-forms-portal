'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import { AlertCircle, Check, Loader2 } from 'lucide-react'
import {
  TASK_STATUSES, TASK_STATUS_LABELS, STREAM_TONE, hours as fmtHours, projectTask, shortDate,
  type EngTaskRow, type TaskStatus,
} from '@/lib/engineering'
import { NotSet, ProgressBar, ProjectionPill, StreamChip } from './ui'

/* ────────────────────────────────────────────────────────────────────────────
   One editable task row — the same component on the job page and in the task
   queue, so the two can never drift on what a status change does.

   ── Why every control writes immediately ───────────────────────────────────
   There is no Save button. The meeting's whole complaint was that keeping the
   spreadsheets current was work people skipped, and a row that needs a second
   action to commit is a row that stays wrong. Each control PATCHes on change and
   the server is the only source of truth afterwards (router.refresh()), so the
   projection, the roll-up and the badge all recompute from the same write.

   ── Failures stay on the row ───────────────────────────────────────────────
   A refused write shows next to the control that refused, not as a toast. This
   list is scanned, not watched: a toast that fades while someone is reading a
   different row means the change silently did not happen, which is the exact
   failure this whole section exists to stop.
   ──────────────────────────────────────────────────────────────────────────── */

const CTRL =
  'h-7 rounded-md border border-hairline bg-surface text-[12px] text-ink-secondary px-1.5 ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors ' +
  'hover:border-hairline-strong disabled:opacity-50'

/** The progress steps the buttons offer. Quarters plus the two ends: fine enough
 *  to be honest about where something is, coarse enough that nobody is asked to
 *  decide between 55 and 60 percent — a slider people will not touch reports
 *  nothing, and nothing is the state we are replacing. */
const STEPS = [0, 25, 50, 75, 100]

export default function TaskEditRow({
  task, assignees, showJob = false, dense = false,
}: {
  task: EngTaskRow
  assignees: { id: string; name: string }[]
  showJob?: boolean
  dense?: boolean
}) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [justSaved, setJustSaved] = useState(false)

  const projection = projectTask(task)

  const patch = async (body: Record<string, unknown>) => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/engineering/tasks/${task.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || `Could not save (HTTP ${res.status}).`)
        setSaving(false)
        return
      }
      setJustSaved(true)
      setTimeout(() => setJustSaved(false), 1400)
      startTransition(() => router.refresh())
    } catch (err) {
      setError(String(err))
    }
    setSaving(false)
  }

  const busy = saving || pending

  return (
    <div className={`border-b border-hairline-soft last:border-b-0 ${task.status === 'done' || task.status === 'skipped' ? 'opacity-60' : ''}`}>
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 ${dense ? 'py-2' : 'py-2.5'}`}>
        {showJob && (
          <span className="w-[72px] flex-shrink-0 truncate text-[12.5px] font-semibold tabular-nums text-ink">
            {task.job_id
              ? <Link href={`/admin/engineering/jobs/${task.job_id}`} className="hover:text-brand-ink transition-colors">{task.job_number}</Link>
              : <span className="font-normal text-ink-faint">Standing</span>}
          </span>
        )}
        <span className="flex-shrink-0"><StreamChip stream={task.stream} /></span>

        <span className="min-w-[150px] flex-1 truncate text-[13px] text-ink">{task.title}</span>

        {/* Progress. The tick on the bar is where a linear pace says you should
            be — a bar at 40% with the mark at 70% is the picture of a job running
            late, readable at a glance. */}
        <span className="flex w-[168px] flex-shrink-0 items-center gap-1.5">
          <ProgressBar value={task.progress} expected={projection.expectedPct} tone={STREAM_TONE[task.stream]} showValue />
          <span className="flex gap-px">
            {STEPS.map(p => (
              <button
                key={p}
                type="button"
                disabled={busy || task.progress === p}
                onClick={() => patch({ progress: p })}
                title={`Set to ${p}%`}
                aria-label={`Set progress to ${p} percent`}
                className={`h-4 w-[9px] rounded-[2px] transition-colors disabled:cursor-default ${
                  task.progress >= p && p > 0
                    ? 'bg-brand/70'
                    : 'bg-surface-strong hover:bg-brand/40'
                }`}
              />
            ))}
          </span>
        </span>

        <select
          className={`${CTRL} w-[112px] flex-shrink-0`}
          value={task.status}
          disabled={busy}
          onChange={e => patch({ status: e.target.value as TaskStatus })}
          aria-label="Status"
        >
          {TASK_STATUSES.map(s => <option key={s} value={s}>{TASK_STATUS_LABELS[s]}</option>)}
        </select>

        <select
          className={`${CTRL} w-[128px] flex-shrink-0 ${task.assignee_id ? '' : 'text-amber-700 dark:text-amber-400'}`}
          value={task.assignee_id ?? ''}
          disabled={busy}
          onChange={e => patch({ assignee_id: e.target.value || null })}
          aria-label="Owner"
        >
          <option value="">Unassigned</option>
          {/* An assignee who is no longer on the roster still shows, so the row
              never silently reads "Unassigned" for work somebody owns. */}
          {task.assignee_id && !assignees.some(a => a.id === task.assignee_id) && (
            <option value={task.assignee_id}>{task.assignee_name ?? 'Former owner'}</option>
          )}
          {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>

        <input
          type="date"
          className={`${CTRL} w-[130px] flex-shrink-0 tabular-nums`}
          value={task.due_date ?? ''}
          disabled={busy}
          onChange={e => patch({ due_date: e.target.value || null })}
          aria-label="Due date"
        />

        {/* Target vs actual. The pair is the only honest answer to "are we
            getting faster", which is what the department's own milestones
            ("lead-times under 4 hours, then under 2") are asking for. */}
        <span className="flex w-[112px] flex-shrink-0 items-center gap-1 text-[11.5px] tabular-nums text-ink-muted">
          <input
            type="number"
            step="0.25"
            min="0"
            className={`${CTRL} w-[52px] tabular-nums`}
            defaultValue={task.actual_hours ?? ''}
            disabled={busy}
            placeholder="hrs"
            onBlur={e => {
              const v = e.target.value
              const next = v === '' ? null : Number(v)
              if (next === (task.actual_hours == null ? null : Number(task.actual_hours))) return
              patch({ actual_hours: next })
            }}
            aria-label="Actual hours"
          />
          <span className="text-ink-faint">/</span>
          <span className="truncate">{task.target_hours == null ? <NotSet /> : fmtHours(task.target_hours)}</span>
        </span>

        <span className="flex-shrink-0"><ProjectionPill projection={projection} /></span>

        <span className="w-4 flex-shrink-0">
          {busy ? <Loader2 size={13} className="animate-spin text-ink-faint" />
            : justSaved ? <Check size={13} className="text-emerald-500" />
            : null}
        </span>
      </div>

      {task.status === 'blocked' && (
        <div className="px-4 pb-2 -mt-1">
          <input
            className={`${CTRL} h-7 w-full max-w-xl text-[12px]`}
            defaultValue={task.blocked_reason ?? ''}
            placeholder="What is it blocked on? (a name and a date beats “waiting”)"
            disabled={busy}
            onBlur={e => e.target.value !== (task.blocked_reason ?? '') && patch({ blocked_reason: e.target.value })}
            aria-label="Blocked reason"
          />
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 px-4 pb-2 -mt-1">
          <AlertCircle size={13} className="mt-0.5 shrink-0 text-rose-500" />
          <p className="text-[11.5px] leading-relaxed text-rose-600 dark:text-rose-400">{error}</p>
          <button onClick={() => setError(null)} className="ml-auto shrink-0 text-[11px] font-medium text-rose-600 hover:underline dark:text-rose-400">Dismiss</button>
        </div>
      )}

      {/* Completion date, once there is one. Small, but it is the number every
          lead-time on the leadership report is computed from. */}
      {task.completed_at && (
        <p className="px-4 pb-2 -mt-1 text-[11px] tabular-nums text-ink-faint">
          Finished {shortDate(task.completed_at.slice(0, 10))}
          {task.due_date ? ` · was due ${shortDate(task.due_date)}` : ''}
        </p>
      )}
    </div>
  )
}
