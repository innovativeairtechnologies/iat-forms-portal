'use client'

import { useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Deal } from '@/lib/supabase'
import { computeSummary } from '@/lib/deals'
import { formatCurrency } from '@/lib/utils'
import PipelineView from './PipelineView'
import CRMView from './CRMView'
import FocusedView from './FocusedView'

/* ────────────────────────────────────────────────────────────────────────────
   Deals — the "Forecast Pulse" MVP. One in-memory dataset (mirrors the Gantt
   editor's single-useState-lifted-to-the-parent pattern), rendered through
   three simultaneously-mounted views so each keeps its own filter/sort state
   independently when the tab switches (no remount, no refetch).
   ──────────────────────────────────────────────────────────────────────────── */

type Tab = 'pipeline' | 'crm' | 'focused'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'pipeline', label: 'Pipeline', blurb: 'financial forecast' },
  { value: 'crm', label: 'CRM', blurb: 'relationships' },
  { value: 'focused', label: 'Focused', blurb: "today's priorities" },
]

const inp = 'w-full text-[13px] text-zinc-800 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600'
const lbl = 'text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1'

const EMPTY_FORM = {
  customer: '', group_name: 'MAIN', assigned_to: '', total_cost: '', confidence: '50',
  unit_model: '', job_name: '', projected: '', rep: '', rep_contact: '', date_quoted: '', notes: '',
}

export default function DealsClient({ initialDeals }: { initialDeals: Deal[] }) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [tab, setTab] = useState<Tab>('pipeline')
  const [err, setErr] = useState<string | null>(null)

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const summary = useMemo(() => computeSummary(deals), [deals])

  // Last-known-server-good copy of every deal. Optimistic edits update `deals`
  // immediately; a successful persist folds the patch in here, and a failed or
  // network-dropped persist reverts the deal to this copy — so the UI can never
  // keep showing a value the DB rejected (weighted totals are computed from
  // these rows, so drift here would corrupt every visible number).
  const serverDeals = useRef<Map<string, Deal>>(new Map(initialDeals.map((d) => [d.id, d])))

  const patchLocal = (id: string, patch: Partial<Deal>) =>
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  const revertToServer = (id: string) =>
    setDeals((prev) => prev.map((d) => (d.id === id ? serverDeals.current.get(id) ?? d : d)))

  const persist = async (id: string, patch: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/admin/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        revertToServer(id)
        setErr(j.error || 'Could not save that change.')
        return
      }
      const prior = serverDeals.current.get(id)
      if (prior) serverDeals.current.set(id, { ...prior, ...(patch as Partial<Deal>) })
      setErr(null)
    } catch {
      revertToServer(id)
      setErr('Network error — that change was not saved.')
    }
  }

  const setStatus = (id: string, status: 'Won' | 'Lost' | null) => {
    patchLocal(id, { status })
    persist(id, { status })
  }

  const removeDeal = async (id: string) => {
    const removed = deals.find((d) => d.id === id)
    setDeals((p) => p.filter((d) => d.id !== id))
    try {
      const res = await fetch(`/api/admin/deals/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      serverDeals.current.delete(id)
      setErr(null)
    } catch {
      // Re-insert just this deal (not a full snapshot restore, which would
      // clobber other edits made while the DELETE was in flight).
      if (removed) setDeals((p) => (p.some((d) => d.id === id) ? p : [removed, ...p]))
      setErr('Could not delete that deal.')
    }
  }

  const set = (k: keyof typeof form, v: string) => setForm((f) => ({ ...f, [k]: v }))

  const openNew = () => { setForm(EMPTY_FORM); setCreateError(''); setShowNew(true) }

  const submitNew = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.customer.trim()) { setCreateError('Customer is required.'); return }
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/deals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          assigned_to: form.assigned_to || null,
          unit_model: form.unit_model || null,
          job_name: form.job_name || null,
          projected: form.projected || null,
          rep: form.rep || null,
          rep_contact: form.rep_contact || null,
          date_quoted: form.date_quoted || null,
          notes: form.notes || null,
          total_cost: Number(form.total_cost) || 0,
          confidence: Math.round(Math.max(0, Math.min(100, Number(form.confidence) || 0))),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setCreateError(json.error || 'Could not create that deal.'); return }
      serverDeals.current.set(json.deal.id, json.deal)
      setDeals((prev) => [json.deal, ...prev])
      setShowNew(false)
    } catch {
      setCreateError('Network error — the deal was not created.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Header */}
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Sales</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Deals</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {formatCurrency(summary.totalCost)} total · {formatCurrency(summary.totalWeighted)} weighted · {deals.length} {deals.length === 1 ? 'deal' : 'deals'}
            </p>
          </div>
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Plus size={15} />
            New Deal
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-8">
        {/* Tabs — underline style, matches Employees/Customers */}
        <div className="flex items-center gap-6 mb-4 border-b border-zinc-200 dark:border-zinc-800">
          {TABS.map(({ value, label, blurb }) => {
            const active = tab === value
            return (
              <button
                key={value}
                onClick={() => setTab(value)}
                className={`relative pb-2.5 text-[13px] whitespace-nowrap transition-colors ${
                  active ? 'font-semibold text-zinc-900 dark:text-white' : 'font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                {label}
                <span className="ml-1.5 text-[11px] font-normal text-zinc-300 dark:text-zinc-600 hidden sm:inline">{blurb}</span>
                {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-emerald-500" />}
              </button>
            )
          })}
        </div>

        {err && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
            {err}
            <button onClick={() => setErr(null)} className="text-rose-400 hover:text-rose-600 flex-shrink-0"><X size={13} /></button>
          </div>
        )}

        {/* All three views stay mounted so switching tabs never resets a view's
            own filter/sort state — see the module comment above. */}
        <div className={tab === 'pipeline' ? '' : 'hidden'}>
          <PipelineView deals={deals} onStatusChange={setStatus} />
        </div>
        <div className={tab === 'crm' ? '' : 'hidden'}>
          <CRMView deals={deals} />
        </div>
        <div className={tab === 'focused' ? '' : 'hidden'}>
          <FocusedView deals={deals} onPatchLocal={patchLocal} onPersist={persist} onDelete={removeDeal} />
        </div>
      </div>

      {/* New deal modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onMouseDown={() => setShowNew(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <form
            onSubmit={submitNew}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl p-5 max-h-[85vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-bold text-zinc-900 dark:text-white">New Deal</h2>
              <button type="button" onClick={() => setShowNew(false)} className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300">
                <X size={18} />
              </button>
            </div>

            {createError && (
              <div className="mb-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
                {createError}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className={lbl}>Customer</label>
                <input className={inp} value={form.customer} onChange={(e) => set('customer', e.target.value)} placeholder="Company or client name" autoFocus />
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
                <input className={inp} type="number" min="0" step="1" value={form.total_cost} onChange={(e) => set('total_cost', e.target.value)} placeholder="0" />
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
                <textarea className={inp} rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl text-[13px] font-medium text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors">
                Cancel
              </button>
              <button
                type="submit"
                disabled={creating}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
              >
                {creating ? 'Creating…' : 'Create Deal'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
