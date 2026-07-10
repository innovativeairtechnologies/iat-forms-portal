'use client'

import { useEffect, useState } from 'react'
import {
  X, ChevronLeft, ChevronRight, Pencil, Trash2, CornerDownLeft,
  User, Users, Cpu, Briefcase, CalendarDays, CalendarRange, Contact,
} from 'lucide-react'
import type { Deal } from '@/lib/supabase'
import { computeWeighted } from '@/lib/deals'
import { formatCurrency, formatDateOnly } from '@/lib/utils'
import { StatusPill, DEAL_STATUS, timeAgo } from '@/components/admin/list'
import { inp, lbl } from './form'

/* ────────────────────────────────────────────────────────────────────────────
   Deal detail — the "click into a deal" card, mirroring the monday.com item
   view the sales team is used to (all columns + a running Updates thread)
   without per-deal pages. Center modal, two modes:

   • View: every field, money strip, one-click status, dated updates.
   • Edit: the same fields as the New Deal modal, Save/Cancel.

   Persistence rides the parent's optimistic machinery (patchLocal → persist →
   revert-on-fail), identical to the Focused tab's inline edits — this modal
   never talks to the API directly.

   "Add update" prepends a dated line to `notes` (the sheet's own convention —
   "8.27.25, Chris said…"), so the Monday updates-feed habit works with zero
   schema change; the full history stays one text field, importable/exportable.
   ──────────────────────────────────────────────────────────────────────────── */

type EditForm = {
  customer: string; group_name: string; assigned_to: string; total_cost: string
  confidence: string; unit_model: string; job_name: string; date_quoted: string
  projected: string; rep: string; rep_contact: string; notes: string
}

const toForm = (d: Deal): EditForm => ({
  customer: d.customer,
  group_name: d.group_name,
  assigned_to: d.assigned_to ?? '',
  total_cost: String(d.total_cost),
  confidence: String(d.confidence),
  unit_model: d.unit_model ?? '',
  job_name: d.job_name ?? '',
  date_quoted: d.date_quoted ?? '',
  projected: d.projected ?? '',
  rep: d.rep ?? '',
  rep_contact: d.rep_contact ?? '',
  notes: d.notes ?? '',
})

/** Diff the edit buffer against the live deal → minimal PATCH payload. */
function buildPatch(d: Deal, f: EditForm): Record<string, unknown> {
  const patch: Record<string, unknown> = {}
  const txt = (v: string) => (v.trim() === '' ? null : v.trim())
  if (f.customer.trim() && f.customer.trim() !== d.customer) patch.customer = f.customer.trim()
  if (f.group_name.trim() && f.group_name.trim() !== d.group_name) patch.group_name = f.group_name.trim()
  if (txt(f.assigned_to) !== d.assigned_to) patch.assigned_to = txt(f.assigned_to)
  const cost = Math.max(0, Number(f.total_cost) || 0)
  if (cost !== d.total_cost) patch.total_cost = cost
  const conf = Math.round(Math.max(0, Math.min(100, Number(f.confidence) || 0)))
  if (conf !== d.confidence) patch.confidence = conf
  if (txt(f.unit_model) !== d.unit_model) patch.unit_model = txt(f.unit_model)
  if (txt(f.job_name) !== d.job_name) patch.job_name = txt(f.job_name)
  if ((f.date_quoted || null) !== d.date_quoted) patch.date_quoted = f.date_quoted || null
  if (txt(f.projected) !== d.projected) patch.projected = txt(f.projected)
  if (txt(f.rep) !== d.rep) patch.rep = txt(f.rep)
  if (txt(f.rep_contact) !== d.rep_contact) patch.rep_contact = txt(f.rep_contact)
  if ((f.notes.trim() === '' ? null : f.notes) !== d.notes) patch.notes = f.notes.trim() === '' ? null : f.notes
  return patch
}

/** Dated update line in the sheet's own style: "7.10.26 — got the PO". */
function updateLine(text: string): string {
  const n = new Date()
  return `${n.getMonth() + 1}.${n.getDate()}.${String(n.getFullYear()).slice(2)} — ${text.trim()}`
}

export default function DealDetailModal({
  deal, index, total, prevId, nextId,
  onOpen, onClose, onPatchLocal, onPersist, onStatus, onDelete,
}: {
  deal: Deal
  index: number
  total: number
  prevId: string | null
  nextId: string | null
  onOpen: (id: string) => void
  onClose: () => void
  onPatchLocal: (id: string, patch: Partial<Deal>) => void
  onPersist: (id: string, patch: Record<string, unknown>) => void
  onStatus: (id: string, status: 'Won' | 'Lost' | null) => void
  onDelete: (id: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState<EditForm>(() => toForm(deal))
  const [update, setUpdate] = useState('')

  // Navigating to another deal resets the modal to view mode for that deal.
  useEffect(() => {
    setEditing(false)
    setForm(toForm(deal))
    setUpdate('')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deal.id])

  // Esc closes (cancels edit first); ←/→ page through deals in view mode.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); if (editing) setEditing(false); else onClose() }
      if (editing) return
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === 'ArrowLeft' && prevId) onOpen(prevId)
      if (e.key === 'ArrowRight' && nextId) onOpen(nextId)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [editing, prevId, nextId, onOpen, onClose])

  const set = (k: keyof EditForm, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const save = () => {
    const patch = buildPatch(deal, form)
    if (Object.keys(patch).length > 0) {
      onPatchLocal(deal.id, patch as Partial<Deal>)
      onPersist(deal.id, patch)
    }
    setEditing(false)
  }

  const postUpdate = () => {
    const text = update.trim()
    if (!text) return
    const notes = updateLine(text) + (deal.notes ? '\n' + deal.notes : '')
    onPatchLocal(deal.id, { notes })
    onPersist(deal.id, { notes })
    setUpdate('')
  }

  const statusInfo = DEAL_STATUS[deal.status ?? 'active']
  const weighted = computeWeighted(deal)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onMouseDown={editing ? undefined : onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-full max-w-2xl rounded-2xl border border-hairline bg-surface max-h-[88vh] overflow-y-auto animate-fade-up"
        style={{ boxShadow: '0 8px 24px rgba(31,30,27,.10), 0 2px 6px rgba(31,30,27,.05)' }}
      >
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-surface border-b border-hairline-soft px-5 sm:px-6 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-[17px] font-semibold text-ink tracking-[-0.01em] truncate">{deal.customer}</h2>
                <StatusPill tone={statusInfo.tone}>{statusInfo.label}</StatusPill>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-md bg-surface-strong text-ink-muted">{deal.group_name}</span>
              </div>
              {(deal.job_name || deal.unit_model) && (
                <p className="mt-0.5 text-[12.5px] text-ink-muted truncate">
                  {deal.job_name || deal.unit_model}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={() => prevId && onOpen(prevId)}
                disabled={!prevId || editing}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink-secondary hover:bg-surface-soft disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Previous deal (←)"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="text-[11px] text-ink-faint tabular-nums px-0.5 whitespace-nowrap">{index + 1} / {total}</span>
              <button
                onClick={() => nextId && onOpen(nextId)}
                disabled={!nextId || editing}
                className="w-7 h-7 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink-secondary hover:bg-surface-soft disabled:opacity-30 disabled:hover:bg-transparent transition-colors"
                title="Next deal (→)"
              >
                <ChevronRight size={15} />
              </button>
              <button onClick={onClose} className="ml-1 w-7 h-7 rounded-lg flex items-center justify-center text-ink-faint hover:text-ink-secondary hover:bg-surface-soft transition-colors" title="Close (Esc)">
                <X size={16} />
              </button>
            </div>
          </div>
        </div>

        <div className="px-5 sm:px-6 py-5 space-y-5">

          {/* ── Money strip ── */}
          <div className="grid grid-cols-3 gap-2.5">
            <MoneyTile label="Total Cost" value={formatCurrency(deal.total_cost)} />
            <MoneyTile label="Weighted" value={formatCurrency(weighted)} accent />
            <MoneyTile label="Confidence" value={`${deal.confidence}%`} />
          </div>

          {!editing ? (
            <>
              {/* ── Status — one click, same semantics as the Pipeline select ── */}
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted mr-1">Status</span>
                <Seg active={deal.status === null} tone="sky" onClick={() => onStatus(deal.id, null)}>Active</Seg>
                <Seg active={deal.status === 'Won'} tone="emerald" onClick={() => onStatus(deal.id, 'Won')}>Won</Seg>
                <Seg active={deal.status === 'Lost'} tone="rose" onClick={() => onStatus(deal.id, 'Lost')}>Lost</Seg>
              </div>

              {/* ── Fields ── */}
              <div className="rounded-xl border border-hairline overflow-hidden">
                <div className="grid grid-cols-1 sm:grid-cols-2">
                  <Field icon={<User size={13} />} label="Assigned To" value={deal.assigned_to} />
                  <Field icon={<Users size={13} />} label="Rep" value={deal.rep} />
                  <Field icon={<Contact size={13} />} label="Rep Contact" value={deal.rep_contact} />
                  <Field icon={<Cpu size={13} />} label="Unit Model" value={deal.unit_model} mono />
                  <Field icon={<Briefcase size={13} />} label="Job Name" value={deal.job_name} />
                  <Field icon={<CalendarDays size={13} />} label="Date Quoted" value={deal.date_quoted ? formatDateOnly(deal.date_quoted) : null} />
                  <Field icon={<CalendarRange size={13} />} label="Projected Close" value={deal.projected} />
                  <Field icon={<Users size={13} />} label="Group" value={deal.group_name} />
                </div>
              </div>

              {/* ── Updates / notes ── */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Updates & notes</span>
                  {deal.notes && <span className="text-[11px] text-ink-faint tabular-nums">{deal.notes.length} chars</span>}
                </div>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <input
                      value={update}
                      onChange={(e) => setUpdate(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); postUpdate() } }}
                      placeholder="Add a dated update… (Enter to post)"
                      className={inp}
                    />
                    {update.trim() && (
                      <CornerDownLeft size={13} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                    )}
                  </div>
                  <button
                    onClick={postUpdate}
                    disabled={!update.trim()}
                    className="h-9 px-3 self-start rounded-lg text-[12.5px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft disabled:opacity-40 transition-colors"
                  >
                    Post
                  </button>
                </div>
                <div className="mt-2 rounded-xl border border-hairline bg-surface-soft px-3.5 py-3 max-h-48 overflow-y-auto">
                  {deal.notes ? (
                    <p className="text-[12.5px] text-ink-secondary whitespace-pre-wrap break-words leading-relaxed">{deal.notes}</p>
                  ) : (
                    <p className="text-[12.5px] text-ink-faint">No notes yet — post the first update above.</p>
                  )}
                </div>
              </div>

              {/* ── Meta ── */}
              <p className="text-[11px] text-ink-faint tabular-nums">
                Created {formatDateOnly(deal.created_at.slice(0, 10))} · last updated {timeAgo(deal.updated_at)} ago
              </p>
            </>
          ) : (
            /* ── Edit mode — same fields as the New Deal modal ── */
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Customer</label>
                <input className={inp} value={form.customer} onChange={(e) => set('customer', e.target.value)} autoFocus />
              </div>
              <div>
                <label className={lbl}>Group</label>
                <input className={inp} value={form.group_name} onChange={(e) => set('group_name', e.target.value)} placeholder="MIKE / JACOB / DAVE…" />
              </div>
              <div>
                <label className={lbl}>Assigned To</label>
                <input className={inp} value={form.assigned_to} onChange={(e) => set('assigned_to', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Total Cost</label>
                <input className={inp} type="number" min="0" step="1" value={form.total_cost} onChange={(e) => set('total_cost', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Confidence %</label>
                <input className={inp} type="number" min="0" max="100" step="1" value={form.confidence} onChange={(e) => set('confidence', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Unit Model</label>
                <input className={inp} value={form.unit_model} onChange={(e) => set('unit_model', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Job Name</label>
                <input className={inp} value={form.job_name} onChange={(e) => set('job_name', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Date Quoted</label>
                <input className={inp} type="date" value={form.date_quoted} onChange={(e) => set('date_quoted', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Projected</label>
                <input className={inp} value={form.projected} onChange={(e) => set('projected', e.target.value)} placeholder="Q4 2026" />
              </div>
              <div>
                <label className={lbl}>Rep</label>
                <input className={inp} value={form.rep} onChange={(e) => set('rep', e.target.value)} />
              </div>
              <div>
                <label className={lbl}>Rep Contact</label>
                <input className={inp} value={form.rep_contact} onChange={(e) => set('rep_contact', e.target.value)} />
              </div>
              <div className="col-span-2">
                <label className={lbl}>Notes</label>
                <textarea className={inp} rows={5} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              </div>
            </div>
          )}
        </div>

        {/* ── Footer ── */}
        <div className="sticky bottom-0 bg-surface border-t border-hairline-soft px-5 sm:px-6 py-3.5 flex items-center justify-between gap-2">
          {!editing ? (
            <>
              <button
                onClick={() => { if (confirm(`Delete the ${deal.customer} deal?`)) { onDelete(deal.id); onClose() } }}
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[12.5px] font-medium text-ink-faint hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors"
              >
                <Trash2 size={13} /> Delete
              </button>
              <div className="flex items-center gap-2">
                <button onClick={onClose} className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft transition-colors">
                  Close
                </button>
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg text-[13px] font-medium text-white transition-colors"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  <Pencil size={13} /> Edit deal
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="text-[11px] text-ink-faint">Editing — changes apply when you save</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => { setForm(toForm(deal)); setEditing(false) }}
                  className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={save}
                  className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-white transition-colors"
                  style={{ backgroundColor: 'var(--brand)' }}
                >
                  Save changes
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MoneyTile({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface-soft px-3.5 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted mb-1">{label}</p>
      <p className={`text-[17px] font-semibold tabular-nums leading-none ${accent ? '' : 'text-ink'}`} style={accent ? { color: 'var(--brand-ink)' } : undefined}>
        {value}
      </p>
    </div>
  )
}

function Seg({ active, tone, onClick, children }: {
  active: boolean; tone: 'sky' | 'emerald' | 'rose'; onClick: () => void; children: React.ReactNode
}) {
  const activeCls = {
    sky: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400 border-sky-200 dark:border-sky-500/30',
    emerald: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
    rose: 'bg-rose-50 text-rose-500 dark:bg-rose-500/10 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
  }[tone]
  return (
    <button
      onClick={onClick}
      className={`h-7 px-2.5 rounded-lg text-[11px] font-semibold uppercase tracking-wider border transition-colors ${
        active ? activeCls : 'border-hairline text-ink-faint hover:text-ink-secondary hover:bg-surface-soft'
      }`}
    >
      {children}
    </button>
  )
}

function Field({ icon, label, value, mono }: { icon: React.ReactNode; label: string; value: string | null; mono?: boolean }) {
  return (
    <div className="flex items-start gap-2.5 px-3.5 py-2.5 border-t border-hairline-soft first:border-t-0 sm:[&:nth-child(2)]:border-t-0">
      <span className="mt-0.5 text-ink-faint flex-shrink-0">{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
        <p className={`text-[13px] text-ink mt-0.5 break-words ${mono ? 'font-mono text-[12px]' : ''} ${value ? '' : 'text-ink-faint'}`}>
          {value || '—'}
        </p>
      </div>
    </div>
  )
}
