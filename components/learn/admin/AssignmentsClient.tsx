'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Plus, Trash2, Loader2, AlertTriangle, Users, CalendarClock, Check, X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { AssignmentReport, StaffMember, AudienceType } from '@/lib/learn-assignments'

/* Assign required training, and see who has actually done it.

   The head-count next to the audience picker is the important bit: department
   is free text on the employee record and blank for most staff, so
   "Dept · Warehouse" can resolve to nobody. Showing the number BEFORE saving
   turns a silent no-op into an obvious one. (The API refuses a zero-person
   audience too — this is the humane half of the same guard.) */

const FOCUS = 'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

type ScopeOption = { type: 'module' | 'category'; id: string; label: string; group: string }

export default function AssignmentsClient({
  reports, staff, scopes,
}: {
  reports: AssignmentReport[]
  staff: StaffMember[]
  scopes: ScopeOption[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const [scopeKey, setScopeKey] = useState(scopes[0] ? `${scopes[0].type}:${scopes[0].id}` : '')
  const [audienceType, setAudienceType] = useState<AudienceType>('everyone')
  const [audienceValue, setAudienceValue] = useState('')
  const [dueOn, setDueOn] = useState('')

  const roles = useMemo(
    () => [...new Set(staff.map(s => s.role).filter((r): r is string => !!r))].sort(),
    [staff],
  )
  const departments = useMemo(
    () => [...new Set(staff.map(s => s.department).filter((d): d is string => !!d))].sort(),
    [staff],
  )
  const noDept = staff.filter(s => !s.department).length

  /** Live head-count for the chosen audience — the anti-silent-no-op affordance. */
  const resolved = useMemo(() => {
    switch (audienceType) {
      case 'everyone': return staff.length
      case 'user': return staff.filter(s => s.id === audienceValue).length
      case 'role': return staff.filter(s => s.role === audienceValue).length
      case 'department': return staff.filter(s => s.department === audienceValue).length
    }
  }, [staff, audienceType, audienceValue])

  async function create() {
    const [scopeType, scopeId] = scopeKey.split(':')
    setBusy('create'); setError(null)
    try {
      const res = await fetch('/api/learn/assignments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeType, scopeId, audienceType,
          audienceValue: audienceType === 'everyone' ? undefined : audienceValue,
          dueOn: dueOn || undefined,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError([data.error, data.hint].filter(Boolean).join(' ')); return }
      setOpen(false); setAudienceValue(''); setDueOn('')
      router.refresh()
    } catch {
      setError('Could not save — check your connection.')
    } finally { setBusy(null) }
  }

  async function remove(id: string) {
    setBusy(id); setError(null)
    try {
      const res = await fetch(`/api/learn/assignments/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(String(d.error ?? 'Could not remove.')); return
      }
      router.refresh()
    } finally { setBusy(b => (b === id ? null : b)) }
  }

  const needsValue = audienceType !== 'everyone'
  const canSave = scopeKey && (!needsValue || audienceValue) && resolved > 0

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/admin/learn-content" className={cn('mb-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:text-ink', FOCUS)}>
        <ArrowLeft size={15} /> Back to content
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-[650] tracking-tight text-ink">Required training</h1>
          <p className="mt-1.5 max-w-2xl text-[13.5px] leading-relaxed text-ink-secondary">
            Assign a subject or category to people, and see who has finished it. Completion is the
            same rule the library uses — the lessons read, plus the quiz passed where one is published.
          </p>
        </div>
        <button
          onClick={() => { setOpen(o => !o); setError(null) }}
          className={cn('inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-hover', FOCUS)}
        >
          {open ? <X size={14} /> : <Plus size={14} />} {open ? 'Cancel' : 'Assign training'}
        </button>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-lg border border-rose-200 bg-rose-50/60 p-3 text-[12.5px] font-medium text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
          {error}
        </p>
      )}

      {/* ── Create ─────────────────────────────────────────────────────── */}
      {open && (
        <section className="mb-6 rounded-xl border border-hairline bg-surface p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">What</span>
              <select
                value={scopeKey}
                onChange={e => setScopeKey(e.target.value)}
                className={cn('mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-ink', FOCUS)}
              >
                {scopes.map(s => (
                  <option key={`${s.type}:${s.id}`} value={`${s.type}:${s.id}`}>{s.group} — {s.label}</option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Due date (optional)</span>
              <input
                type="date"
                value={dueOn}
                onChange={e => setDueOn(e.target.value)}
                className={cn('mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-ink', FOCUS)}
              />
            </label>

            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Who</span>
              <select
                value={audienceType}
                onChange={e => { setAudienceType(e.target.value as AudienceType); setAudienceValue('') }}
                className={cn('mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-ink', FOCUS)}
              >
                <option value="everyone">Everyone on staff</option>
                <option value="role">By role</option>
                <option value="user">One person</option>
                <option value="department">By department</option>
              </select>
            </label>

            <label className={cn('block', !needsValue && 'invisible')}>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                {audienceType === 'role' ? 'Role' : audienceType === 'department' ? 'Department' : 'Person'}
              </span>
              <select
                value={audienceValue}
                onChange={e => setAudienceValue(e.target.value)}
                className={cn('mt-1.5 h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-ink', FOCUS)}
              >
                <option value="">Choose…</option>
                {audienceType === 'role' && roles.map(r => <option key={r} value={r}>{r}</option>)}
                {audienceType === 'user' && staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                {audienceType === 'department' && departments.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </label>
          </div>

          {/* Head-count — the guard against a silent no-op */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className={cn(
              'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-semibold',
              resolved > 0
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
                : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
            )}>
              <Users size={12} />
              {resolved === 0 ? 'Matches nobody' : `${resolved} ${resolved === 1 ? 'person' : 'people'}`}
            </span>

            {audienceType === 'department' && noDept > 0 && (
              <span className="text-[11.5px] text-amber-700 dark:text-amber-400">
                {noDept} of {staff.length} staff have no department set — they can&apos;t be reached this way.
              </span>
            )}

            <button
              onClick={create}
              disabled={!canSave || busy === 'create'}
              className={cn('ml-auto inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[12.5px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-50', FOCUS)}
            >
              {busy === 'create' ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />} Assign
            </button>
          </div>
        </section>
      )}

      {/* ── Reporting ──────────────────────────────────────────────────── */}
      {reports.length === 0 ? (
        <p className="rounded-xl border border-dashed border-hairline bg-surface-soft px-6 py-12 text-center text-[13.5px] text-ink-muted">
          Nothing is required yet. Assign a subject to get a completion report here.
        </p>
      ) : (
        <div className="space-y-3">
          {reports.map(r => {
            const isOpen = expanded === r.id
            const allDone = r.headcount > 0 && r.completeCount >= r.headcount
            return (
              <section key={r.id} className={cn(
                'rounded-xl border bg-surface',
                r.overdue ? 'border-rose-300 dark:border-rose-500/40' : 'border-hairline',
              )}>
                <div className="flex flex-wrap items-center gap-3 px-5 py-4">
                  <button
                    onClick={() => setExpanded(isOpen ? null : r.id)}
                    aria-expanded={isOpen}
                    aria-controls={`people-${r.id}`}
                    className={cn('min-w-0 flex-1 text-left', FOCUS)}
                  >
                    <p className="text-[14px] font-[650] text-ink">{r.scopeLabel}</p>
                    <p className="mt-0.5 text-[12px] text-ink-muted">
                      {r.audienceLabel} · {r.headcount} {r.headcount === 1 ? 'person' : 'people'}
                      {r.dueOn && (
                        <>
                          {' · '}
                          <span className={r.overdue ? 'font-semibold text-rose-700 dark:text-rose-400' : ''}>
                            {r.overdue
                              ? `overdue by ${Math.abs(r.daysUntilDue!)} day${Math.abs(r.daysUntilDue!) === 1 ? '' : 's'}`
                              : `due ${r.dueOn}`}
                          </span>
                        </>
                      )}
                    </p>
                  </button>

                  <div className="flex items-center gap-3">
                    <div className="w-32">
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-[11px] text-ink-muted">Complete</span>
                        <span className="text-[11.5px] font-semibold tabular-nums text-ink">
                          {r.completeCount}/{r.headcount}
                        </span>
                      </div>
                      <span className="block h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
                        <span
                          className={cn('block h-full rounded-full', allDone ? 'bg-emerald-500' : r.overdue ? 'bg-rose-500' : 'bg-brand')}
                          style={{ width: `${r.headcount ? Math.round((r.completeCount / r.headcount) * 100) : 0}%` }}
                        />
                      </span>
                    </div>
                    <button
                      onClick={() => remove(r.id)}
                      disabled={busy === r.id}
                      aria-label={`Remove requirement: ${r.scopeLabel}`}
                      className={cn('rounded-md p-1.5 text-ink-faint transition-colors hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10 dark:hover:text-rose-400', FOCUS)}
                    >
                      {busy === r.id ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                    </button>
                  </div>
                </div>

                {isOpen && (
                  <ul id={`people-${r.id}`} className="divide-y divide-hairline-soft border-t border-hairline">
                    {r.people.map(p => (
                      <li key={p.userId} className="flex items-center gap-3 px-5 py-2.5">
                        <span className={cn(
                          'grid h-6 w-6 flex-shrink-0 place-items-center rounded-full',
                          p.complete ? 'bg-emerald-600 text-white' : 'bg-surface-strong text-ink-muted',
                        )}>
                          {p.complete ? <Check size={12} /> : <CalendarClock size={11} />}
                        </span>
                        <span className="flex-1 truncate text-[13px] text-ink-secondary">{p.name}</span>
                        <span className="text-[12px] tabular-nums text-ink-muted">{p.done}/{p.total} subjects</span>
                        <span className={cn('w-10 text-right text-[12px] font-semibold tabular-nums', p.complete ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink')}>
                          {p.pct}%
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            )
          })}
        </div>
      )}

      {staff.length === 0 && (
        <p className="mt-4 flex items-start gap-2 text-[12.5px] text-amber-700 dark:text-amber-400">
          <AlertTriangle size={14} className="mt-0.5 flex-shrink-0" />
          No active staff found, so nothing can be assigned.
        </p>
      )}
    </div>
  )
}
