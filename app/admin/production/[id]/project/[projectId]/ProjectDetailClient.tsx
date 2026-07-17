'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, Plus, Trash2, X, ExternalLink, Ban, RotateCcw, Check, Copy, Pencil, Loader2,
} from 'lucide-react'
import type {
  ProductionDepartment,
  ProductionPerson,
  ProductionProject,
  ProductionTask,
} from '@/lib/supabase'
import {
  effectiveDone, groupByPhase, boardProgress, isUnassigned, isOverdue, CADENCE_LABELS,
} from '@/lib/production'

const btnCx =
  'flex items-center gap-2 px-3 py-2 text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-60'
const inputCx =
  'w-full h-9 px-3 text-[16px] sm:text-[13px] bg-canvas border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand transition-all'

type Props = {
  department: ProductionDepartment
  project: ProductionProject
  tasks: ProductionTask[]
  people: ProductionPerson[]
  today: string
}

export default function ProjectDetailClient({ department, project, tasks, people, today }: Props) {
  const router = useRouter()
  const [editingProject, setEditingProject] = useState(false)
  const [addingTask, setAddingTask] = useState(false)
  const [editingTask, setEditingTask] = useState<ProductionTask | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const phases = useMemo(() => groupByPhase(tasks), [tasks])
  const progress = useMemo(() => boardProgress(tasks, today), [tasks, today])

  const patchTask = async (id: string, patch: Record<string, unknown>) => {
    setError('')
    const res = await fetch('/api/admin/production/tasks', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...patch }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return setError(d.error || 'Could not save that.')
    }
    router.refresh()
  }

  const archiveTask = async (id: string) => {
    setError('')
    const res = await fetch(`/api/admin/production/tasks?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return setError(d.error || 'Could not remove that task.')
    }
    router.refresh()
  }

  const duplicate = async () => {
    setBusy(true)
    setError('')
    const res = await fetch('/api/admin/production/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duplicate_id: project.id }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) return setError(data.error || 'Could not duplicate that project.')
    if (data.id) router.push(`/admin/production/${department.id}/project/${data.id}`)
    router.refresh()
  }

  return (
    <div className="flex-1 overflow-auto bg-canvas">
      <div className="sticky top-0 z-10 flex h-14 items-center gap-2 border-b border-hairline bg-canvas px-5">
        <div className="flex min-w-0 items-center gap-1.5 text-[13px]">
          <Link href="/admin/production" className="text-ink-faint transition-colors hover:text-ink-secondary">
            Production Board
          </Link>
          <ChevronRight size={13} className="flex-shrink-0 text-ink-faint" />
          <Link href={`/admin/production/${department.id}`} className="text-ink-faint transition-colors hover:text-ink-secondary">
            {department.name}
          </Link>
          <ChevronRight size={13} className="flex-shrink-0 text-ink-faint" />
          <span className="truncate font-semibold text-ink">{project.name}</span>
        </div>
        <a
          href={`/board/${department.token}?project=${project.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto flex flex-shrink-0 items-center gap-1.5 text-[12px] text-ink-muted transition-colors hover:text-ink-secondary"
        >
          <ExternalLink size={13} />
          <span className="hidden sm:inline">View this project&apos;s board</span>
          <span className="sm:hidden">Board</span>
        </a>
      </div>

      <div className="max-w-3xl p-4 sm:p-8">
        {/* ── Project header ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h1 className="text-[22px] tracking-tight text-ink" style={{ fontWeight: 620 }}>
                  {project.name}
                </h1>
                {project.status === 'complete' && (
                  <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                    Complete
                  </span>
                )}
              </div>
              {project.type && <p className="mt-1 text-[13px] text-ink-muted">{project.type}</p>}
            </div>
            <div className="flex flex-shrink-0 items-center gap-1.5">
              <button onClick={() => setEditingProject(true)} className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
                <Pencil size={13} />
                Edit
              </button>
              <button onClick={duplicate} disabled={busy} className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
                Duplicate
              </button>
            </div>
          </div>

          {project.detail && (
            <p className="mt-3 max-w-2xl text-[13px] leading-relaxed text-ink-secondary">{project.detail}</p>
          )}

          {project.people.length > 0 && (
            <p className="mt-3 text-[12.5px] text-ink-muted">
              <span className="text-ink-faint">On this build: </span>
              {project.people.join(', ')}
            </p>
          )}

          <div className="mt-4 rounded-xl border border-hairline bg-surface p-4">
            <div className="flex items-baseline justify-between text-[13px]">
              <span className="text-ink-secondary">
                <strong className="tabular-nums text-ink" style={{ fontWeight: 620 }}>{progress.done}</strong>
                <span className="text-ink-muted"> of </span>
                <strong className="tabular-nums text-ink" style={{ fontWeight: 620 }}>{progress.total}</strong>
                <span className="text-ink-muted"> done</span>
              </span>
              <span className="tabular-nums text-ink-muted">{progress.pct}%</span>
            </div>
            <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
              <div className="h-full rounded-full bg-brand" style={{ width: `${progress.pct}%` }} />
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-hairline bg-surface px-4 py-2.5 text-[13px] text-rose-600">
            {error}
          </div>
        )}

        {/* ── Tasks ─────────────────────────────────────────────────────────── */}
        <div className="mb-2 flex items-center justify-between px-1">
          <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Tasks</h2>
          <button onClick={() => setAddingTask(true)} className={`${btnCx} bg-brand hover:bg-brand-hover text-brand-ink`}>
            <Plus size={14} />
            Add task
          </button>
        </div>

        {phases.length === 0 ? (
          <div className="rounded-xl border border-hairline bg-surface py-14 text-center">
            <p className="text-[13px] text-ink-muted">No tasks yet.</p>
            <p className="mt-1 text-[12px] text-ink-faint">
              Add tasks, and group them by phase (Day 1, Framing…) if you like.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {phases.map((group) => (
              <section key={group.phase ?? '__none'}>
                {group.phase && (
                  <h3 className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-faint">
                    {group.phase}
                  </h3>
                )}
                <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
                  {group.tasks.map((t, i) => (
                    <TaskRow
                      key={t.id}
                      task={t}
                      today={today}
                      first={i === 0}
                      onPatch={patchTask}
                      onEdit={() => setEditingTask(t)}
                      onArchive={archiveTask}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      {editingProject && (
        <EditProjectModal project={project} people={people} onClose={() => setEditingProject(false)} />
      )}
      {addingTask && (
        <TaskModal
          mode="add"
          department={department}
          project={project}
          people={people}
          onClose={() => setAddingTask(false)}
        />
      )}
      {editingTask && (
        <TaskModal
          mode="edit"
          department={department}
          project={project}
          people={people}
          task={editingTask}
          onClose={() => setEditingTask(null)}
        />
      )}
    </div>
  )
}

// ─── Task row ────────────────────────────────────────────────────────────────

function TaskRow({
  task,
  today,
  first,
  onPatch,
  onEdit,
  onArchive,
}: {
  task: ProductionTask
  today: string
  first: boolean
  onPatch: (id: string, patch: Record<string, unknown>) => void
  onEdit: () => void
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
          <IconBtn label="Unblock" onClick={() => onPatch(task.id, { status: 'open', blocked_note: '' })}>
            <RotateCcw size={14} />
          </IconBtn>
        ) : (
          <>
            <IconBtn label={done ? 'Mark not done' : 'Mark done'} onClick={() => onPatch(task.id, { status: done ? 'open' : 'done' })}>
              <Check size={14} className={done ? 'text-brand' : ''} />
            </IconBtn>
            <IconBtn label="Block" onClick={() => onPatch(task.id, { status: 'blocked' })}>
              <Ban size={14} />
            </IconBtn>
          </>
        )}
        <IconBtn label="Edit" onClick={onEdit}>
          <Pencil size={13} />
        </IconBtn>
        <IconBtn label="Remove" onClick={() => onArchive(task.id)}>
          <Trash2 size={14} />
        </IconBtn>
      </div>
    </div>
  )
}

function IconBtn({ label, onClick, children }: { label: string; onClick: () => void; children: React.ReactNode }) {
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

// ─── Edit project ────────────────────────────────────────────────────────────

function EditProjectModal({
  project,
  people,
  onClose,
}: {
  project: ProductionProject
  people: ProductionPerson[]
  onClose: () => void
}) {
  const router = useRouter()
  const [name, setName] = useState(project.name)
  const [type, setType] = useState(project.type ?? '')
  const [detail, setDetail] = useState(project.detail ?? '')
  const [status, setStatus] = useState(project.status)
  const [crew, setCrew] = useState<string[]>(project.people)
  const [extra, setExtra] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const toggle = (n: string) =>
    setCrew((c) => (c.includes(n) ? c.filter((x) => x !== n) : [...c, n]))

  const addExtra = () => {
    const n = extra.trim()
    if (n && !crew.includes(n)) setCrew((c) => [...c, n])
    setExtra('')
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('A project name is required.')
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/production/projects', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: project.id, name, type, detail, status, people: crew }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(data.error || 'Could not save that.')
    onClose()
    router.refresh()
  }

  // Roster names not already on the crew (crew may also hold free-text extras).
  const rosterNames = people.map((p) => p.name)
  const extras = crew.filter((n) => !rosterNames.includes(n))

  return (
    <ModalShell title="Edit project" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <Field label="Project name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCx} autoFocus />
        </Field>
        <Field label="Type" hint="Free text — unit model, customer, 'R&D', anything.">
          <input value={type} onChange={(e) => setType(e.target.value)} className={inputCx} placeholder="IDP-4000, dual-wheel" />
        </Field>
        <Field label="Detail" hint="Optional notes shown at the top of the project.">
          <textarea
            value={detail}
            onChange={(e) => setDetail(e.target.value)}
            rows={3}
            className={`${inputCx} h-auto resize-none py-2`}
          />
        </Field>

        <div>
          <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-ink-faint">On this build</span>
          <p className="mb-2 text-[11px] text-ink-faint">
            Shown on the board as who&apos;s on it. Doesn&apos;t change who can be assigned tasks.
          </p>
          {rosterNames.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {rosterNames.map((n) => {
                const on = crew.includes(n)
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => toggle(n)}
                    className={
                      'rounded-full border px-3 py-1 text-[12.5px] transition-colors ' +
                      (on ? 'border-brand bg-brand-soft text-brand' : 'border-hairline text-ink-secondary hover:bg-surface-soft')
                    }
                  >
                    {n}
                  </button>
                )
              })}
            </div>
          )}
          {extras.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {extras.map((n) => (
                <span key={n} className="flex items-center gap-1.5 rounded-full border border-brand bg-brand-soft py-1 pl-3 pr-1 text-[12.5px] text-brand">
                  {n}
                  <button type="button" onClick={() => toggle(n)} aria-label={`Remove ${n}`} className="rounded-full p-0.5 hover:opacity-70">
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <div className="mt-2 flex gap-2">
            <input
              value={extra}
              onChange={(e) => setExtra(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addExtra()
                }
              }}
              placeholder="Add someone not on the roster…"
              className={inputCx}
            />
            <button type="button" onClick={addExtra} className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
              <Plus size={14} />
            </button>
          </div>
        </div>

        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value as typeof status)} className={inputCx}>
            <option value="active">Active</option>
            <option value="complete">Complete (hide from the floor board)</option>
          </select>
        </Field>

        {error && <p className="text-[12.5px] text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`${btnCx} bg-brand hover:bg-brand-hover text-brand-ink`}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ─── Add / edit task ─────────────────────────────────────────────────────────

function TaskModal({
  mode,
  department,
  project,
  people,
  task,
  onClose,
}: {
  mode: 'add' | 'edit'
  department: ProductionDepartment
  project: ProductionProject
  people: ProductionPerson[]
  task?: ProductionTask
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState({
    title: task?.title ?? '',
    detail: task?.detail ?? '',
    phase: task?.phase ?? '',
    assignee: task?.assignee ?? '',
    cadence: task?.cadence ?? 'once',
    priority: task?.priority ?? 'normal',
    due_date: task?.due_date ?? '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('Give the task a title.')
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/production/tasks', {
      method: mode === 'add' ? 'POST' : 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        mode === 'add'
          ? { ...form, department_id: department.id, project_id: project.id }
          : { ...form, id: task!.id }
      ),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(data.error || 'Could not save that task.')
    onClose()
    router.refresh()
  }

  return (
    <ModalShell
      title={mode === 'add' ? `Add a task — ${project.name}` : 'Edit task'}
      subtitle={mode === 'add' ? 'Give it a phase to group it (Day 1, Framing…), or leave blank.' : undefined}
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <Field label="Task">
          <input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCx} placeholder="Weld the base frame" autoFocus />
        </Field>
        <Field label="Detail" hint="Optional.">
          <input value={form.detail} onChange={(e) => set('detail', e.target.value)} className={inputCx} />
        </Field>
        <Field label="Phase" hint="Blank = ungrouped. Same text groups tasks together (e.g. 'Day 1').">
          <input value={form.phase} onChange={(e) => set('phase', e.target.value)} className={inputCx} placeholder="Day 1" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assigned to" hint="Blank = unassigned.">
            <select value={form.assignee} onChange={(e) => set('assignee', e.target.value)} className={inputCx}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
              {/* Preserve an assignee that isn't (or is no longer) on the roster. */}
              {form.assignee && !people.some((p) => p.name === form.assignee) && (
                <option value={form.assignee}>{form.assignee}</option>
              )}
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
            {saving ? 'Saving…' : mode === 'add' ? 'Add task' : 'Save'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

// ─── Shared modal chrome ─────────────────────────────────────────────────────

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-auto rounded-xl border border-hairline bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between border-b border-hairline bg-surface px-5 py-4">
          <div>
            <h2 className="text-[15px] text-ink" style={{ fontWeight: 620 }}>{title}</h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-ink-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-ink-faint transition-colors hover:text-ink-secondary">
            <X size={16} />
          </button>
        </div>
        {children}
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
