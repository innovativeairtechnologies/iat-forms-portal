'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  ChevronRight, Plus, Trash2, X, UserRound, ExternalLink, Ban, RotateCcw, Check,
  Copy, FolderKanban, Loader2,
} from 'lucide-react'
import type {
  ProductionDepartment,
  ProductionPerson,
  ProductionProject,
  ProductionTask,
} from '@/lib/supabase'
import {
  effectiveDone, buildBoard, isUnassigned, isOverdue, CADENCE_LABELS, type ProjectView,
} from '@/lib/production'

const btnCx =
  'flex items-center gap-2 px-3 py-2 text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-60'
const inputCx =
  'w-full h-9 px-3 text-[16px] sm:text-[13px] bg-canvas border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand transition-all'

type Props = {
  department: ProductionDepartment
  projects: ProductionProject[]
  tasks: ProductionTask[]
  people: ProductionPerson[]
  today: string
}

export default function DeptDetailClient({ department, projects, tasks, people, today }: Props) {
  const router = useRouter()
  const [addingProject, setAddingProject] = useState(false)
  const [addingStanding, setAddingStanding] = useState(false)
  const [error, setError] = useState('')

  const board = useMemo(() => buildBoard(tasks, projects, today), [tasks, projects, today])

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
              {projects.length} {projects.length === 1 ? 'project' : 'projects'}
              {board.standing.length > 0 &&
                ` · ${board.standing.length} standing ${board.standing.length === 1 ? 'duty' : 'duties'}`}
            </p>
          </div>
          <button
            onClick={() => setAddingProject(true)}
            className={`${btnCx} bg-brand hover:bg-brand-hover text-brand-ink px-4 py-2.5 text-[13px]`}
          >
            <Plus size={15} />
            New project
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-hairline bg-surface px-4 py-2.5 text-[13px] text-rose-600">
            {error}
          </div>
        )}

        {/* ── Projects ─────────────────────────────────────────────────────── */}
        <section className="mb-10">
          <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            Projects
          </h2>
          {board.projects.length === 0 ? (
            <div className="rounded-xl border border-hairline bg-surface py-14 text-center">
              <FolderKanban size={26} className="mx-auto mb-3 text-ink-faint" />
              <p className="text-[13px] text-ink-muted">No projects yet.</p>
              <p className="mt-1 text-[12px] text-ink-faint">
                Add a build, or duplicate one — most builds share a task list.
              </p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {board.projects.map((view) => (
                <ProjectCard
                  key={view.project.id}
                  department={department}
                  view={view}
                  onError={setError}
                />
              ))}
            </div>
          )}
        </section>

        {/* ── Standing duties ──────────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="mb-2 flex items-center justify-between px-1">
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              Every day · standing duties
            </h2>
            <button
              onClick={() => setAddingStanding(true)}
              className="flex items-center gap-1 text-[12px] font-semibold text-brand transition-opacity hover:opacity-80"
            >
              <Plus size={13} />
              Add
            </button>
          </div>
          {board.standing.length === 0 ? (
            <div className="rounded-xl border border-hairline bg-surface px-4 py-5 text-[12.5px] text-ink-faint">
              None. Standing duties show on the board every day, above the projects — a safety
              walk, a clean-up, a machine check.
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
              {board.standing.map((t, i) => (
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
          )}
        </section>

        <Roster department={department} people={people} />
      </div>

      {addingProject && (
        <NewProjectModal department={department} onClose={() => setAddingProject(false)} />
      )}
      {addingStanding && (
        <AddStandingModal department={department} people={people} onClose={() => setAddingStanding(false)} />
      )}
    </div>
  )
}

// ─── Project card ────────────────────────────────────────────────────────────

function ProjectCard({
  department,
  view,
  onError,
}: {
  department: ProductionDepartment
  view: ProjectView
  onError: (m: string) => void
}) {
  const router = useRouter()
  const { project, progress } = view
  const [busy, setBusy] = useState<null | 'duplicate' | 'archive'>(null)

  const href = `/admin/production/${department.id}/project/${project.id}`

  const duplicate = async () => {
    setBusy('duplicate')
    onError('')
    const res = await fetch('/api/admin/production/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ duplicate_id: project.id }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(null)
    if (!res.ok) return onError(data.error || 'Could not duplicate that project.')
    // Land on the copy so the manager can rename + re-date from a running start.
    if (data.id) router.push(`/admin/production/${department.id}/project/${data.id}`)
    router.refresh()
  }

  const archive = async () => {
    if (!confirm(`Remove "${project.name}" and its tasks from the board? Its check-off history is kept.`)) return
    setBusy('archive')
    onError('')
    const res = await fetch(`/api/admin/production/projects?id=${encodeURIComponent(project.id)}`, {
      method: 'DELETE',
    })
    setBusy(null)
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      return onError(d.error || 'Could not remove that project.')
    }
    router.refresh()
  }

  return (
    <div className="flex flex-col rounded-xl border border-hairline bg-surface p-4">
      <Link
        href={href}
        className="group flex items-start justify-between gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <div className="min-w-0">
          <span className="flex items-center gap-1 text-[15px] text-ink transition-colors group-hover:text-brand" style={{ fontWeight: 620 }}>
            <span className="truncate">{project.name}</span>
            <ChevronRight size={14} className="flex-shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5" />
          </span>
          {project.type && <p className="mt-0.5 truncate text-[12px] text-ink-muted">{project.type}</p>}
        </div>
        <span className="flex-shrink-0 text-[12px] tabular-nums text-ink-muted">
          {progress.done}/{progress.total}
        </span>
      </Link>

      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-surface-strong">
        <div className="h-full rounded-full bg-brand" style={{ width: `${progress.pct}%` }} />
      </div>

      {project.people.length > 0 && (
        <p className="mt-2.5 truncate text-[11.5px] text-ink-faint">On this build: {project.people.join(', ')}</p>
      )}

      <div className="mt-3 flex items-center gap-1.5 border-t border-hairline-soft pt-3">
        <button onClick={duplicate} disabled={!!busy} className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
          {busy === 'duplicate' ? <Loader2 size={13} className="animate-spin" /> : <Copy size={13} />}
          Duplicate
        </button>
        <button
          onClick={archive}
          disabled={!!busy}
          className={`${btnCx} ml-auto text-ink-muted hover:text-rose-600`}
          title="Remove from board"
          aria-label={`Remove ${project.name}`}
        >
          {busy === 'archive' ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
        </button>
      </div>
    </div>
  )
}

// ─── Standing-duty row (department-level tasks) ──────────────────────────────

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

// ─── Roster (unchanged from 055) ─────────────────────────────────────────────

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
    <section>
      <h2 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        Department roster
      </h2>
      <div className="rounded-xl border border-hairline bg-surface p-4">
        <p className="text-[12.5px] leading-relaxed text-ink-muted">
          Names here become the tap-to-pick list when someone checks a task off, and the pool you
          tag onto a project&apos;s crew. They aren&apos;t portal logins — just names, so nobody
          types theirs on a cold morning.
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
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Add a name…" className={`${inputCx} sm:max-w-xs`} />
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

// ─── Modals ──────────────────────────────────────────────────────────────────

function NewProjectModal({ department, onClose }: { department: ProductionDepartment; onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Give the project a name.')
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/production/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ department_id: department.id, name, type }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(data.error || 'Could not add that project.')
    onClose()
    if (data.id) router.push(`/admin/production/${department.id}/project/${data.id}`)
    router.refresh()
  }

  return (
    <ModalShell title={`New project — ${department.name}`} subtitle="You'll add its tasks next." onClose={onClose}>
      <form onSubmit={submit} className="space-y-4 p-5">
        <Field label="Project name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCx} placeholder="Acme Unit A" autoFocus />
        </Field>
        <Field label="Type" hint="Optional — unit model, customer, 'R&D', anything.">
          <input value={type} onChange={(e) => setType(e.target.value)} className={inputCx} placeholder="IDP-4000, dual-wheel" />
        </Field>
        {error && <p className="text-[12.5px] text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`${btnCx} bg-brand hover:bg-brand-hover text-brand-ink`}>
            {saving ? 'Creating…' : 'Create project'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

const EMPTY_STANDING = { title: '', detail: '', assignee: '', cadence: 'daily', priority: 'normal', due_date: '' }

function AddStandingModal({
  department,
  people,
  onClose,
}: {
  department: ProductionDepartment
  people: ProductionPerson[]
  onClose: () => void
}) {
  const router = useRouter()
  const [form, setForm] = useState(EMPTY_STANDING)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const set = (k: keyof typeof EMPTY_STANDING, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) return setError('Give the task a title.')
    setSaving(true)
    setError('')
    // No project_id => a department-wide standing duty.
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
    <ModalShell
      title="Add a standing duty"
      subtitle="Shows on the board every day, above the projects."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <Field label="Task">
          <input value={form.title} onChange={(e) => set('title', e.target.value)} className={inputCx} placeholder="Morning safety walk" autoFocus />
        </Field>
        <Field label="Detail" hint="Optional.">
          <input value={form.detail} onChange={(e) => set('detail', e.target.value)} className={inputCx} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Assigned to" hint="Blank = unassigned.">
            <select value={form.assignee} onChange={(e) => set('assignee', e.target.value)} className={inputCx}>
              <option value="">Unassigned</option>
              {people.map((p) => (
                <option key={p.id} value={p.name}>{p.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Repeats">
            <select value={form.cadence} onChange={(e) => set('cadence', e.target.value)} className={inputCx}>
              <option value="daily">Every day</option>
              <option value="weekly">Every week</option>
              <option value="once">One-off</option>
            </select>
          </Field>
        </div>
        {error && <p className="text-[12.5px] text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`${btnCx} bg-brand hover:bg-brand-hover text-brand-ink`}>
            {saving ? 'Adding…' : 'Add duty'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

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
