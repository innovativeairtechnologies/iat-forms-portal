'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Pencil, Trash2, X, AlertTriangle, Check } from 'lucide-react'
import { StatusPill, type Tone } from '@/components/admin/list'
import {
  saveAnnouncement, saveEvent, saveOpening, saveSpotlight, deleteContent, type ContentTable,
} from './actions'

/* Admin editor for the company-home content. Schema-driven: each entity declares
   its fields once and shares the list + modal-form + delete machinery. Token-clean
   per DESIGN.md — one green primary (Add), soft-wash Tone pills for status. */

type Row = Record<string, any>
type Emp = { id: string; name: string; job_title: string | null; department: string | null }

type FieldType = 'text' | 'textarea' | 'date' | 'select' | 'number' | 'checkbox' | 'employee'
type FieldDef = {
  key: string
  label: string
  type: FieldType
  options?: { value: string; label: string }[]
  placeholder?: string
  full?: boolean
}

const NEWS_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'text', full: true, placeholder: 'Company Picnic' },
  { key: 'body', label: 'Body', type: 'textarea', full: true, placeholder: 'A short line or two…' },
  { key: 'category', label: 'Category', type: 'select', options: [
    { value: '', label: '—' }, { value: 'news', label: 'News' }, { value: 'safety', label: 'Safety' },
    { value: 'event', label: 'Event' }, { value: 'it', label: 'IT' },
  ] },
  { key: 'published_at', label: 'Date', type: 'date' },
  { key: 'pinned', label: 'Pin to top', type: 'checkbox' },
]
const EVENT_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'text', full: true, placeholder: 'All-Hands Meeting' },
  { key: 'description', label: 'Description', type: 'textarea', full: true },
  { key: 'starts_on', label: 'Start date', type: 'date' },
  { key: 'ends_on', label: 'End date (optional)', type: 'date' },
  { key: 'kind', label: 'Kind', type: 'select', options: [
    { value: 'event', label: 'Event' }, { value: 'holiday', label: 'Holiday' }, { value: 'training', label: 'Training' },
    { value: 'visit', label: 'Visit' }, { value: 'closure', label: 'Closure' },
  ] },
]
const OPENING_FIELDS: FieldDef[] = [
  { key: 'title', label: 'Title', type: 'text', full: true, placeholder: 'Production Associate' },
  { key: 'department', label: 'Department', type: 'text' },
  { key: 'location', label: 'Location', type: 'text' },
  { key: 'employment_type', label: 'Type', type: 'select', options: [
    { value: '', label: '—' }, { value: 'Full-time', label: 'Full-time' }, { value: 'Part-time', label: 'Part-time' }, { value: 'Contract', label: 'Contract' },
  ] },
  { key: 'description', label: 'Description', type: 'textarea', full: true },
  { key: 'apply_url', label: 'Apply link or mailto', type: 'text', full: true, placeholder: 'mailto:careers@…' },
  { key: 'sort', label: 'Sort order', type: 'number' },
  { key: 'is_open', label: 'Open', type: 'checkbox' },
]
const SPOTLIGHT_FIELDS: FieldDef[] = [
  { key: 'employee_id', label: 'Employee', type: 'employee' },
  { key: 'kind', label: 'Kind', type: 'select', options: [
    { value: 'spotlight', label: 'Spotlight' }, { value: 'welcome', label: 'Welcome (new employee)' },
  ] },
  { key: 'headline', label: 'Headline / role', type: 'text', full: true, placeholder: 'Fabrication Team Lead' },
  { key: 'blurb', label: 'Blurb', type: 'textarea', full: true },
  { key: 'active', label: 'Active', type: 'checkbox' },
]

type EntityKey = ContentTable
type Entity = {
  key: EntityKey
  label: string
  singular: string
  fields: FieldDef[]
  defaults: Row
  save: (input: any) => Promise<void>
  rowTitle: (r: Row, emps: Emp[]) => string
  rowMeta: (r: Row, emps: Emp[]) => { tone: Tone; label: string }[]
  rowSub?: (r: Row, emps: Emp[]) => string | null
}

const empName = (id: string, emps: Emp[]) => emps.find((e) => e.id === id)?.name || 'Unknown'

const ENTITIES: Entity[] = [
  {
    key: 'announcements', label: 'News', singular: 'news item', fields: NEWS_FIELDS,
    defaults: { title: '', body: '', category: 'news', published_at: '', pinned: false },
    save: saveAnnouncement,
    rowTitle: (r) => r.title,
    rowSub: (r) => r.body || null,
    rowMeta: (r) => [
      ...(r.pinned ? [{ tone: 'violet' as Tone, label: 'Pinned' }] : []),
      ...(r.category ? [{ tone: 'slate' as Tone, label: r.category }] : []),
    ],
  },
  {
    key: 'events', label: 'Events', singular: 'event', fields: EVENT_FIELDS,
    defaults: { title: '', description: '', starts_on: '', ends_on: '', kind: 'event' },
    save: saveEvent,
    rowTitle: (r) => r.title,
    rowSub: (r) => r.starts_on ? `${r.starts_on}${r.ends_on ? ` – ${r.ends_on}` : ''}` : null,
    rowMeta: (r) => [{ tone: 'sky', label: r.kind || 'event' }],
  },
  {
    key: 'openings', label: 'Openings', singular: 'opening', fields: OPENING_FIELDS,
    defaults: { title: '', department: '', location: '', employment_type: '', description: '', apply_url: '', sort: 0, is_open: true },
    save: saveOpening,
    rowTitle: (r) => r.title,
    rowSub: (r) => [r.department, r.location, r.employment_type].filter(Boolean).join(' · ') || null,
    rowMeta: (r) => [{ tone: r.is_open ? 'emerald' : 'slate', label: r.is_open ? 'Open' : 'Closed' }],
  },
  {
    key: 'spotlights', label: 'Spotlights', singular: 'spotlight', fields: SPOTLIGHT_FIELDS,
    defaults: { employee_id: '', kind: 'spotlight', headline: '', blurb: '', active: true },
    save: saveSpotlight,
    rowTitle: (r, emps) => empName(r.employee_id, emps),
    rowSub: (r) => r.headline || r.blurb || null,
    rowMeta: (r) => [
      { tone: r.kind === 'welcome' ? 'sky' : 'violet', label: r.kind === 'welcome' ? 'Welcome' : 'Spotlight' },
      ...(r.active ? [] : [{ tone: 'slate' as Tone, label: 'Inactive' }]),
    ],
  },
]

const inputCls =
  'w-full rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint transition-colors hover:border-hairline-strong focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const labelCls = 'block text-[12px] font-medium text-ink-secondary mb-1'

export function HomeContentManager({
  announcements, events, openings, spotlights, employees, tablesMissing,
}: {
  announcements: Row[]; events: Row[]; openings: Row[]; spotlights: Row[]; employees: Emp[]; tablesMissing: boolean
}) {
  const router = useRouter()
  const rowsByKey: Record<EntityKey, Row[]> = { announcements, events, openings, spotlights }
  const [tab, setTab] = useState<EntityKey>('announcements')
  const [editing, setEditing] = useState<{ entity: Entity; row: Row } | null>(null)
  const [confirmDel, setConfirmDel] = useState<string | null>(null)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const entity = ENTITIES.find((e) => e.key === tab)!
  const rows = rowsByKey[tab]

  const openNew = () => { setError(''); setEditing({ entity, row: { ...entity.defaults } }) }
  const openEdit = (row: Row) => {
    setError('')
    // normalize a timestamptz to a date-input value
    const norm = { ...row }
    if (typeof norm.published_at === 'string') norm.published_at = norm.published_at.slice(0, 10)
    setEditing({ entity, row: norm })
  }

  const save = () => {
    if (!editing) return
    setError('')
    startTransition(async () => {
      try {
        await editing.entity.save(editing.row)
        setEditing(null)
        router.refresh()
      } catch (e: any) {
        setError(e?.message || 'Could not save.')
      }
    })
  }

  const remove = (id: string) => {
    setError('')
    startTransition(async () => {
      try {
        await deleteContent(tab, id)
        setConfirmDel(null)
        router.refresh()
      } catch (e: any) {
        setError(e?.message || 'Could not delete.')
      }
    })
  }

  return (
    <div className="flex-1 overflow-y-auto bg-canvas">
      <div className="mx-auto max-w-[900px] px-4 py-6 sm:px-6 sm:py-8">
        {/* Header */}
        <div className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">System</p>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-ink">Company Home</h1>
            <p className="mt-0.5 text-[13px] text-ink-muted">
              Edit the content on the <a href="/home" className="text-ink-secondary underline-offset-2 hover:text-brand-ink hover:underline">company home</a>. An empty section falls back to sensible defaults.
            </p>
          </div>
          <button
            onClick={openNew}
            className="inline-flex h-9 flex-shrink-0 items-center gap-2 rounded-lg bg-brand px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Plus size={15} /> Add {entity.singular}
          </button>
        </div>

        {tablesMissing && (
          <div className="mb-4 flex items-start gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[12.5px] text-amber-700 dark:border-amber-500/25 dark:bg-amber-500/10 dark:text-amber-400">
            <AlertTriangle size={15} className="mt-0.5 flex-shrink-0" />
            <span>The content tables aren’t in the database yet. Run migration <code className="font-mono">058_company_home.sql</code> in Supabase, then reload. The home page still renders its defaults until then.</span>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {ENTITIES.map((e) => {
            const active = e.key === tab
            return (
              <button
                key={e.key}
                onClick={() => setTab(e.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-medium transition-colors ${
                  active ? 'bg-ink text-canvas' : 'text-ink-muted hover:bg-surface-strong hover:text-ink'
                }`}
              >
                {e.label}
                <span className={`text-[11px] tabular-nums ${active ? 'text-canvas opacity-70' : 'text-ink-faint'}`}>{rowsByKey[e.key].length}</span>
              </button>
            )
          })}
        </div>

        {error && !editing && <p className="mb-3 text-[12.5px] text-rose-500">{error}</p>}

        {/* List */}
        <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
          {rows.length === 0 ? (
            <div className="px-5 py-10 text-center">
              <p className="text-[13px] font-medium text-ink">No {entity.label.toLowerCase()} yet</p>
              <p className="mt-1 text-[12.5px] text-ink-muted">The home page shows its built-in default for this card until you add one.</p>
            </div>
          ) : (
            <ul>
              {rows.map((r, i) => (
                <li key={r.id} className={`flex items-center gap-3 px-5 py-3 ${i > 0 ? 'border-t border-hairline-soft' : ''}`}>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-[13.5px] font-semibold text-ink">{entity.rowTitle(r, employees)}</p>
                      {entity.rowMeta(r, employees).map((m, j) => (
                        <StatusPill key={j} tone={m.tone}>{m.label}</StatusPill>
                      ))}
                    </div>
                    {entity.rowSub?.(r, employees) && (
                      <p className="mt-0.5 line-clamp-1 text-[12px] text-ink-muted">{entity.rowSub(r, employees)}</p>
                    )}
                  </div>
                  <div className="flex flex-shrink-0 items-center gap-1">
                    <button onClick={() => openEdit(r)} title="Edit" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink">
                      <Pencil size={14} />
                    </button>
                    {confirmDel === r.id ? (
                      <button onClick={() => remove(r.id)} disabled={pending} className="inline-flex h-8 items-center gap-1 rounded-lg bg-rose-500 px-2.5 text-[11.5px] font-medium text-white transition-colors hover:bg-rose-600 disabled:opacity-50">
                        <Check size={13} /> Delete
                      </button>
                    ) : (
                      <button onClick={() => setConfirmDel(r.id)} title="Delete" className="flex h-8 w-8 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-strong hover:text-rose-500">
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Edit / add modal */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/40 p-4 backdrop-blur-[2px]" onClick={() => setEditing(null)}>
          <div className="mt-[6vh] w-full max-w-[520px] rounded-2xl border border-hairline bg-surface shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between border-b border-hairline-soft px-5 py-3.5">
              <h2 className="text-[14px] font-semibold text-ink">
                {editing.row.id ? 'Edit' : 'New'} {editing.entity.singular}
              </h2>
              <button onClick={() => setEditing(null)} className="flex h-7 w-7 items-center justify-center rounded-lg text-ink-muted hover:bg-surface-strong hover:text-ink">
                <X size={15} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 px-5 py-4">
              {editing.entity.fields.map((f) => {
                const val = editing.row[f.key]
                const set = (v: any) => setEditing((cur) => cur && ({ ...cur, row: { ...cur.row, [f.key]: v } }))
                const wrap = (node: React.ReactNode) => (
                  <div key={f.key} className={f.type === 'checkbox' ? 'col-span-2' : f.full ? 'col-span-2' : 'col-span-2 sm:col-span-1'}>
                    {f.type !== 'checkbox' && <label className={labelCls}>{f.label}</label>}
                    {node}
                  </div>
                )
                if (f.type === 'textarea') return wrap(<textarea rows={3} className={`${inputCls} resize-y`} value={val ?? ''} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />)
                if (f.type === 'checkbox') return wrap(
                  <label className="flex cursor-pointer items-center gap-2 text-[13px] text-ink">
                    <input type="checkbox" checked={!!val} onChange={(e) => set(e.target.checked)} className="h-4 w-4 accent-[var(--brand)]" />
                    {f.label}
                  </label>,
                )
                if (f.type === 'select') return wrap(
                  <select className={inputCls} value={val ?? ''} onChange={(e) => set(e.target.value)}>
                    {f.options!.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>,
                )
                if (f.type === 'employee') return wrap(
                  <select className={inputCls} value={val ?? ''} onChange={(e) => set(e.target.value)}>
                    <option value="">Select an employee…</option>
                    {employees.map((e) => <option key={e.id} value={e.id}>{e.name}{e.job_title ? ` — ${e.job_title}` : ''}</option>)}
                  </select>,
                )
                if (f.type === 'number') return wrap(<input type="number" className={inputCls} value={val ?? 0} onChange={(e) => set(e.target.value === '' ? 0 : Number(e.target.value))} />)
                if (f.type === 'date') return wrap(<input type="date" className={inputCls} value={val ?? ''} onChange={(e) => set(e.target.value)} />)
                return wrap(<input type="text" className={inputCls} value={val ?? ''} placeholder={f.placeholder} onChange={(e) => set(e.target.value)} />)
              })}
            </div>

            {error && <p className="px-5 text-[12.5px] text-rose-500">{error}</p>}

            <div className="flex items-center justify-end gap-2 border-t border-hairline-soft px-5 py-3.5">
              <button onClick={() => setEditing(null)} className="h-9 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[12.5px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink">
                Cancel
              </button>
              <button onClick={save} disabled={pending} className="inline-flex h-9 items-center gap-2 rounded-lg bg-brand px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover active:scale-[0.98] disabled:opacity-50">
                {pending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
