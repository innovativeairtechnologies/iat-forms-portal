'use client'

import { useState, useMemo, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Loader2, AlertTriangle, UserRound, X, ClipboardList } from 'lucide-react'
import Logo from '@/components/Logo'
import type { ProductionDepartment, ProductionPerson, ProductionTask } from '@/lib/supabase'
import {
  effectiveDone,
  groupForBoard,
  boardProgress,
  isUnassigned,
  isOverdue,
  CADENCE_LABELS,
  MAX_ACTOR_NAME,
} from '@/lib/production'

// ─────────────────────────────────────────────────────────────────────────────
// The shop-floor board. Designed to be used standing up, on a phone, with
// gloves: one screen, big rows, no nav, no login, no menus. Follows DESIGN.md
// (warm canvas, hairline cards, no resting shadows, green ONLY on the check
// action and focus rings, tone pills for status).
//
// Note the absence of `dark:` variants — the semantic tokens re-theme
// themselves. Note also the absence of `/opacity` on any token: those compile
// to NOTHING (the tokens are bare `var(--x)` with no alpha channel), which is
// why focus here uses `outline`, per DESIGN.md §5.
// ─────────────────────────────────────────────────────────────────────────────

/** Remembering the name means one tap to check off, not two screens. Scoped per
 *  department so a shared tablet moved between boards re-asks. */
const nameKey = (deptId: string) => `iat-board-who:${deptId}`

type Props = {
  token: string
  department: Omit<ProductionDepartment, 'token'>
  tasks: ProductionTask[]
  people: ProductionPerson[]
  today: string
}

export default function BoardClient({ token, department, tasks, people, today }: Props) {
  const router = useRouter()
  const [who, setWho] = useState<string | null>(null)
  const [asking, setAsking] = useState<ProductionTask | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // localStorage is read in an effect, not in useState's initialiser: touching
  // it during render breaks SSR (no window on the server) and would hydrate
  // mismatched markup.
  useEffect(() => {
    try {
      setWho(localStorage.getItem(nameKey(department.id)))
    } catch {
      // Private mode / storage disabled — we just ask for the name each time.
    }
  }, [department.id])

  const remember = useCallback(
    (name: string) => {
      setWho(name)
      try {
        localStorage.setItem(nameKey(department.id), name)
      } catch {
        /* non-fatal — the check-off itself already went through */
      }
    },
    [department.id]
  )

  const groups = useMemo(() => groupForBoard(tasks), [tasks])
  const progress = useMemo(() => boardProgress(tasks, today), [tasks, today])

  const send = async (task: ProductionTask, actorName: string) => {
    const done = effectiveDone(task, today)
    setBusyId(task.id)
    setError(null)
    try {
      const res = await fetch(`/api/board/${encodeURIComponent(token)}/check`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          taskId: task.id,
          action: done ? 'reopen' : 'done',
          actorName,
        }),
        // A wedged request must never leave a row spinning forever on a wall tablet.
        signal: AbortSignal.timeout(15000),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Could not save that. Try again.')
        return
      }
      // Re-render from the server rather than patching local state: the board is
      // shared, so someone else has probably changed it since this page loaded.
      router.refresh()
    } catch {
      setError('No connection. Check the shop Wi-Fi and try again.')
    } finally {
      setBusyId(null)
    }
  }

  const onToggle = (task: ProductionTask) => {
    if (busyId) return
    if (!who) {
      setAsking(task) // first tap on this device — find out who this is
      return
    }
    void send(task, who)
  }

  return (
    <div className="min-h-screen bg-canvas text-ink">
      {/* Header — brand mark + which board this is. No nav: there's nowhere else to go. */}
      <header className="sticky top-0 z-30 border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-14 max-w-[720px] items-center gap-2.5 px-4">
          <Logo size={24} className="flex-shrink-0" />
          <div className="flex min-w-0 items-center gap-1.5">
            <span className="text-[14px] font-semibold tracking-tight text-ink">IAT</span>
            <span className="text-[13px] text-ink-faint">/</span>
            <span className="truncate text-[13px] font-medium text-ink-muted">{department.name}</span>
          </div>
          {who && (
            <button
              onClick={() => setWho(null)}
              className="ml-auto flex flex-shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[12px] text-ink-muted transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              <UserRound size={13} />
              <span className="max-w-[110px] truncate">{who}</span>
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[720px] px-4 py-6 sm:py-8">
        <div className="animate-fade-up">
          {/* Where the day stands. One number, not a wall of KPIs. */}
          <div className="mb-6">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              Today&apos;s checklist
            </p>
            <h1
              className="mt-2 text-[26px] leading-tight tracking-tight text-ink sm:text-[30px]"
              style={{ fontWeight: 620 }}
            >
              {department.name}
            </h1>
            {department.blurb && (
              <p className="mt-1.5 text-[13.5px] leading-relaxed text-ink-muted">{department.blurb}</p>
            )}

            <div className="mt-5 rounded-xl border border-hairline bg-surface p-4">
              <div className="flex items-baseline justify-between">
                <span className="text-[13px] text-ink-secondary">
                  <strong className="tabular-nums text-ink" style={{ fontWeight: 620 }}>
                    {progress.done}
                  </strong>
                  <span className="text-ink-muted"> of </span>
                  <strong className="tabular-nums text-ink" style={{ fontWeight: 620 }}>
                    {progress.total}
                  </strong>
                  <span className="text-ink-muted"> done</span>
                </span>
                <span className="text-[13px] tabular-nums text-ink-muted">{progress.pct}%</span>
              </div>
              {/* Progress track. The one place green is decorative-ish — it's the
                  status of the work itself, which DESIGN.md counts as meaning. */}
              <div
                className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-strong"
                role="progressbar"
                aria-valuenow={progress.pct}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${progress.done} of ${progress.total} tasks done`}
              >
                <div
                  className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
                  style={{ width: `${progress.pct}%` }}
                />
              </div>
              {(progress.unassigned > 0 || progress.blocked > 0) && (
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-ink-muted">
                  {progress.unassigned > 0 && <span>{progress.unassigned} unassigned</span>}
                  {progress.blocked > 0 && <span>{progress.blocked} blocked</span>}
                </div>
              )}
            </div>
          </div>

          {error && (
            <div className="mb-4 flex items-start gap-2 rounded-xl border border-hairline bg-surface px-4 py-3 text-[13px] text-rose-600">
              <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {groups.length === 0 ? (
            <div className="rounded-xl border border-hairline bg-surface py-16 text-center">
              <ClipboardList size={26} className="mx-auto mb-3 text-ink-faint" />
              <p className="text-[13px] text-ink-muted">Nothing on this board yet.</p>
              <p className="mt-1 text-[12px] text-ink-faint">Your manager adds the work here.</p>
            </div>
          ) : (
            <div className="space-y-7">
              {groups.map((group) => (
                <section key={group.project ?? '__standing'}>
                  <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                    {group.project ?? 'Every day'}
                  </h2>
                  <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
                    {group.tasks.map((task, i) => (
                      <TaskRow
                        key={task.id}
                        task={task}
                        today={today}
                        first={i === 0}
                        busy={busyId === task.id}
                        disabled={!!busyId && busyId !== task.id}
                        onToggle={() => onToggle(task)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}

          <p className="mt-8 text-[11px] leading-relaxed text-ink-faint">
            This board is shared. Check off what you actually finished — your name is
            recorded next to it.
          </p>
        </div>
      </main>

      {asking && (
        <WhoModal
          people={people}
          onClose={() => setAsking(null)}
          onPick={(name) => {
            remember(name)
            const task = asking
            setAsking(null)
            void send(task, name)
          }}
        />
      )}
    </div>
  )
}

// ─── One line of work ────────────────────────────────────────────────────────

function TaskRow({
  task,
  today,
  first,
  busy,
  disabled,
  onToggle,
}: {
  task: ProductionTask
  today: string
  first: boolean
  busy: boolean
  disabled: boolean
  onToggle: () => void
}) {
  const done = effectiveDone(task, today)
  const blocked = task.status === 'blocked'
  const overdue = isOverdue(task, today)

  // Blocked work isn't checkable — that's the point of blocking it. Rendered as
  // a plain row rather than a dead button so it doesn't read as "tap me".
  const Wrapper = blocked ? 'div' : 'button'

  return (
    <Wrapper
      {...(blocked
        ? {}
        : {
            type: 'button' as const,
            onClick: onToggle,
            disabled: disabled || busy,
            'aria-pressed': done,
            'aria-label': `${done ? 'Uncheck' : 'Check off'} ${task.title}`,
          })}
      className={[
        'flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors',
        first ? '' : 'border-t border-hairline-soft',
        blocked ? 'cursor-default' : 'hover:bg-surface-soft active:bg-surface-strong',
        'focus-visible:relative focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand',
        disabled ? 'opacity-60' : '',
      ].join(' ')}
    >
      {/* The checkbox. 24px box inside a 44px-tall row — a real glove target. */}
      <span
        className={[
          'mt-0.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border transition-colors',
          done ? 'border-brand bg-brand text-brand-ink' : 'border-hairline-strong bg-canvas',
          blocked ? 'border-hairline' : '',
        ].join(' ')}
      >
        {busy ? (
          <Loader2 size={13} className="animate-spin text-ink-muted" />
        ) : done ? (
          <Check size={15} strokeWidth={2.5} />
        ) : blocked ? (
          <X size={13} className="text-ink-faint" />
        ) : null}
      </span>

      <span className="min-w-0 flex-1">
        <span
          className={[
            'block text-[14.5px] leading-snug',
            done ? 'text-ink-faint line-through' : 'text-ink',
          ].join(' ')}
        >
          {task.title}
        </span>

        {task.detail && !done && (
          <span className="mt-0.5 block text-[12.5px] leading-relaxed text-ink-muted">{task.detail}</span>
        )}

        {/* Meta strip — only what changes a decision. */}
        <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px]">
          {done ? (
            <span className="text-ink-faint">
              {task.done_by ? `${task.done_by} · ` : ''}
              {task.cadence === 'once' ? 'Done' : 'Done today'}
            </span>
          ) : (
            <>
              {isUnassigned(task) ? (
                <Pill tone="amber">Unassigned</Pill>
              ) : (
                <span className="text-ink-muted">{task.assignee}</span>
              )}
              {task.priority === 'high' && <Pill tone="rose">Priority</Pill>}
              {overdue && <Pill tone="rose">Overdue</Pill>}
              {task.cadence !== 'once' && (
                <span className="text-ink-faint">{CADENCE_LABELS[task.cadence]}</span>
              )}
            </>
          )}
          {blocked && <Pill tone="slate">Blocked{task.blocked_note ? ` · ${task.blocked_note}` : ''}</Pill>}
        </span>
      </span>
    </Wrapper>
  )
}

/** Soft-wash status pill (DESIGN.md §2.4). Local rather than the admin kit's
 *  StatusPill because that one is pre-token (raw zinc-*) and this is a public,
 *  token-styled surface. */
function Pill({ tone, children }: { tone: 'amber' | 'rose' | 'slate'; children: React.ReactNode }) {
  const cls = {
    amber: 'bg-amber-50 text-amber-700',
    rose: 'bg-rose-50 text-rose-700',
    slate: 'bg-surface-strong text-ink-muted',
  }[tone]
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>
      {children}
    </span>
  )
}

// ─── "Who are you?" ──────────────────────────────────────────────────────────

function WhoModal({
  people,
  onClose,
  onPick,
}: {
  people: ProductionPerson[]
  onClose: () => void
  onPick: (name: string) => void
}) {
  const [typed, setTyped] = useState('')

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md overflow-hidden rounded-t-2xl border border-hairline bg-surface sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-hairline px-5 py-4">
          <div>
            <h2 className="text-[15px] text-ink" style={{ fontWeight: 620 }}>
              Who&apos;s checking this off?
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">
              We&apos;ll remember you on this device.
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Cancel"
            className="p-1 text-ink-faint transition-colors hover:text-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <X size={16} />
          </button>
        </div>

        <div className="max-h-[55vh] overflow-y-auto p-3">
          {people.length > 0 && (
            <div className="grid grid-cols-2 gap-2">
              {people.map((p) => (
                <button
                  key={p.id}
                  onClick={() => onPick(p.name)}
                  className="truncate rounded-lg border border-hairline bg-canvas px-3 py-3 text-left text-[13.5px] text-ink-secondary transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {/* Free-text fallback. The roster will never be complete — a temp, a
              new hire, or someone helping from another department must not be
              locked out of checking off work they actually did. */}
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              const name = typed.trim()
              if (name) onPick(name)
            }}
          >
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              maxLength={MAX_ACTOR_NAME}
              placeholder={people.length ? 'Someone else…' : 'Type your name'}
              aria-label="Your name"
              // 16px on mobile or iOS Safari zooms the viewport on focus.
              className="h-11 min-w-0 flex-1 rounded-lg border border-hairline bg-canvas px-3 text-[16px] text-ink placeholder:text-ink-faint outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand"
            />
            <button
              type="submit"
              disabled={!typed.trim()}
              className="flex-shrink-0 rounded-lg bg-brand px-4 text-[13px] font-semibold text-brand-ink transition-colors hover:bg-brand-hover disabled:opacity-50"
            >
              Continue
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
