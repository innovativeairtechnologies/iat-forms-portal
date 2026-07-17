'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, Plus, Trash2, X, UserRound, ExternalLink, Ban, RotateCcw, Check,
} from 'lucide-react'
import type { ProductionDepartment, ProductionPerson, ProductionTask } from '@/lib/supabase'
import { effectiveDone, groupForBoard, isUnassigned, isOverdue, CADENCE_LABELS } from '@/lib/production'

const btnCx =
  'flex items-center gap-2 px-3 py-2 text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-60'
const inputCx =
  'w-full h-9 px-3 text-[16px] sm:text-[13px] bg-canvas border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand transition-all'

type Props = {
  department: ProductionDepartment
  tasks: ProductionTask[]
  people: ProductionPerson[]
  today: string
}

export default function DeptDetailClient({ department, tasks, people, today }: Props) {
  const router = useRouter()
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState('')
  const groups = useMemo(() => groupForBoard(tasks), [tasks])

  const patchTask = async (id: string, patch: Record<string, unknown>) => {
    setError('')
    const res = await fetch('/api/admin/production/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not save that.')
      return
    }
    router.refresh()
  }

  const archiveTask = async (id: string) => {
    setError('')
    const res = await fetch(`/api/admin/production/tasks?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not remove that task.')
      return
    }
    router.refresh()
  }

  return (
    <div className="flex-1 overflow-auto bg-canvas">
      {/* Breadcrumb bar. Solid background — opacity modifiers on the semantic
          tokens compile to nothing. See DESIGN.md §2.5. */}
      <div className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-hairline bg-canvas px-5">
        <div className="flex items-center gap-1.5 text-[13px]">
          <Link href="/admin/production" className="text-ink-faint transition-colors hover:text-ink-secondary">
            Production Board
          </Link>
          <ChevronRight size={13} className="text-ink-faint" />
          <span className="font-semibold text-ink">{department.name}</span>
        </div>
        <a
          href={`/board/${department.token}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex items-center gap-1.5 text-[12px] text-ink-muted transition-colors hover:text-ink-secondary"
        >
          <ExternalLink size={13} />
          View as the floor
        </a>
      </div>

      <div className="max-w-4xl p-4 sm:p-8">
        <div className="mb-6 flex items-end justify-between gap-3">
          <div>
            <h1 className="text-[20px] tracking-tight text-ink" style={{ fontWeight: 620 }}>
              {department.name}
            </h1>
            <p className="mt-1 text-[13px] text-ink-muted">
              {tasks.length} {tasks.length === 1 ? 'task' : 'tasks'} on the board
            </p>
          </div>
          <button onClick={() => setAdding(true)} className={`${btnCx} bg-brand hover:bg-brand-hover text-brand-ink px-4 py-2.5 text-[13px]`}>
            <Plus size={15} />
            Add task
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-hairline bg-surface px-4 py-2.5 text-[13px] text-rose-600">
            {error}
          </div>
        )}

        {groups.length === 0 ? (
          <div className="rounded-xl border border-hairline bg-surface py-16 text-center">
            <p className="text-[13px] text-ink-muted">Nothing on this board yet.</p>
            <p className="mt-1 text-[12px] text-ink-faint">
              Add a standing duty (leave Job blank) or work for a specific job.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {groups.map((g) => (
              <section key={g.project ?? '__standing'}>
                <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  {g.project ?? 'Every day · standing duties'}
                </h2>
                <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
                  {g.tasks.map((t, i) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      today={today}
                      first={i === 0}
                      onPatch={patchTask}
                      onArchive={archiveTask}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}

        <Roster department={department} people={people} />
      </div>

      {adding && (
        <AddTaskModal department={department} people={people} onClose={() => setAdding(false)} />
      )}
    </div>
  )
}

function TaskRow({
  task,
  today,
  first,
  onPatch,
  onArchive,
}: {
  task: ProductionTask
  today: string
  first: boolean
  onPatch: (id: string, patch: Record<string, unknown>) => void
  onArchive: (id: string) => void
}) {
  const done = effectiveDone(task, today)
  const blocked = task.status === 'blocked'

  return (
    <div className={`flex items-start gap-3 px-4 py-3 ${first ? '' : 'border-t border-hairline-soft'}`}>
      <div className="min-w-0 flex-1">
        <p className={`text-[13.5px] ${done ? 'text-ink-faint line-through' : 'text-ink'}`}>{task.title}</p>
        {task.detail && <p className="mt-0.5 text-[12px] text-ink-muted">{task.detail}</p>}
        <div className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11.5px] text-ink-faint">
          {isUnassigned(task) ? (
            <span className="rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-700">Unassigned</span>
          ) : (
            <span className="text-ink-muted">{task.assignee}</span>
          )}
          {task.cadence !== 'once' && <span>{CADENCE_LABELS[task.cadence]}</span>}
          {task.priority === 'high' && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">Priority</span>
          )}
          {isOverdue(task, today) && (
            <span className="rounded-full bg-rose-50 px-2 py-0.5 font-medium text-rose-700">Overdue</span>
          )}
          {task.due_date && !isOverdue(task, today) && <span>Due {task.due_date}</span>}
          {done && task.done_by && <span>· {task.done_by}</span>}
          {blocked && (
            <span className="rounded-full bg-surface-strong px-2 py-0.5 font-medium text-ink-muted">
              Blocked{task.blocked_note ? ` · ${task.blocked_note}` : ''}
            </span>
          )}
        </div>
      </div>

      <div className="flex flex-shrink-0 items-center gap-1">
        {blocked ? (
          <IconBtn
            label="Unblock"
            onClick={() => onPatch(task.id, { status: 'open', blocked_note: '' })}
          >
            <RotateCcw size={14} />
          </IconBtn>
        ) : (
          <>
            <IconBtn
              label={done ? 'Mark not done' : 'Mark done'}
              onClick={() => onPatch(task.id, { status: done ? 'open' : 'done' })}
            >
              <Check size={14} className={done ? 'text-brand' : ''} />
            </IconBtn>
            <IconBtn label="Block" onClick={() => onPatch(task.id, { status: 'blocked' })}>
              <Ban size={14} />
            </IconBtn>
          </>
        )}
        <IconBtn label="Remove from board" onClick={() => onArchive(task.id)}>
          <Trash2 size={14} />
        </IconBtn>
      </div>
    </div>
  )
}

function IconBtn({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-lg p-2 text-ink-faint transition-colors hover:bg-surface-soft hover:text-ink-secondary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      {children}
    </button>
  )
}

function Roster({ department, people }: { department: ProductionDepartment; people: ProductionPerson[] }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const add = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return
    setBusy(true)
    setError('')
    const res = await fetch('/api/admin/production/people', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department_id: department.id, name }),
    })
    setBusy(false)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return setError(d.error || 'Could not add that person.')
    }
    setName('')
    router.refresh()
  }

  const remove = async (id: string) => {
    const res = await fetch(`/api/admin/production/people?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (res.ok) router.refresh()
  }

  return (
    <section className="mt-10">
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        Who&apos;s on this crew
      </h2>
      <div className="rounded-xl border border-hairline bg-surface p-4">
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          Names here become the tap-to-pick list when someone checks a task off. They aren&apos;t
          portal logins — just names, so nobody has to type theirs on a cold morning.
        </p>

        {people.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {people.map((p) => (
              <span
                key={p.id}
                className="flex items-center gap-1.5 rounded-full border border-hairline bg-canvas py-1 pl-2.5 pr-1 text-[12.5px] text-ink-secondary"
              >
                <UserRound size={12} className="text-ink-faint" />
                {p.name}
                <button
                  onClick={() => remove(p.id)}
                  aria-label={`Remove ${p.name}`}
                  className="rounded-full p-0.5 text-ink-faint transition-colors hover:text-rose-500"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        )}

        <form onSubmit={add} className="mt-3 flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Add a name…"
            className={`${inputCx} sm:max-w-xs`}
          />
          <button type="submit" disabled={busy || !name.trim()} className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
            <Plus size={14} />
            Add
          </button>
        </form>
        {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
      </div>
    </section>
  )
}

const EMPTY = {
  title: '',
  detail: '',
  project: '',
  assignee: '',
  cadence: 'once',
  priority: 'normal',
  due_date: '',
}

function AddTaskModal({
  department,
  people,
  onClose,
}: {
  department: ProductionDepartment
  people: ProductionPerson[]
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const set = (k: keyof typeof EMPTY, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('Give the task a title.')
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/production/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, department_id: department.id }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(data.error || 'Could not add that task.')
    onClose()
    router.refresh()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-hairline bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between border-b border-hairline bg-surface px-5 py-4">
          <div>
            <h2 className="text-[15px] text-ink" style={{ fontWeight: 620 }}>
              Add a task — {department.name}
            </h2>
            <p className="mt-0.5 text-[12px] text-ink-muted">Leave Job blank for a standing duty.</p>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-ink-faint transition-colors hover:text-ink-secondary">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={submit} className="space-y-4 p-5">
          <Field label="Task">
            <input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCx} placeholder="Weld the base frame" autoFocus />
          </Field>

          <Field label="Detail" hint="Optional — anything the team needs to know.">
            <input value={form.detail} onChange={(e) => set('detail', e.target.value)} className={inputCx} />
          </Field>

          <Field label="Job" hint="Blank = a standing duty that shows every day.">
            <input value={form.project} onChange={(e) => set('project', e.target.value)} className={inputCx} placeholder="Unit 4412" />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Assigned to" hint="Blank = unassigned.">
              <select value={form.assignee} onChange={(e) => set('assignee', e.target.value)} className={inputCx}>
                <option value="">Unassigned</option>
                {people.map((p) => (
                  <option key={p.id} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Repeats">
              <select value={form.cadence} onChange={(e) => set('cadence', e.target.value)} className={inputCx}>
                <option value="once">One-off</option>
                <option value="daily">Every day</option>
                <option value="weekly">Every week</option>
              </select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Priority">
              <select value={form.priority} onChange={(e) => set('priority', e.target.value)} className={inputCx}>
                <option value="normal">Normal</option>
                <option value="high">Priority</option>
              </select>
            </Field>
            <Field label="Due">
              <input type="date" value={form.due_date} onChange={(e) => set('due_date', e.target.value)} className={inputCx} />
            </Field>
          </div>

          {error && <p className="text-[12.5px] text-rose-500">{error}</p>}

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
              Cancel
            </button>
            <button type="submit" disabled={saving} className={`${btnCx} bg-brand hover:bg-brand-hover text-brand-ink`}>
              {saving ? 'Adding…' : 'Add task'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-ink-faint">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-faint">{hint}</span>}
    </label>
  )
}
