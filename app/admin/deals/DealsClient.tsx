'use client'

import { useMemo, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'
import type { Deal, DealFollowUp } from '@/lib/supabase'
import { computeSummary, PROJECT_TYPES, AUTO_FOLLOW_UP_DAYS, followUpDateFrom, statusForStage, type DealStage } from '@/lib/deals'
import { formatCurrency } from '@/lib/utils'
import { ListPageHeader, tabCx } from '@/components/admin/list'
import SalesDashboard from './SalesDashboard'
import BoardView from './BoardView'
import PipelineView from './PipelineView'
import CRMView from './CRMView'
import FocusedView from './FocusedView'
import CalendarView from './CalendarView'
import DealDetailModal from './DealDetailModal'
import { inp, lbl } from './form'

/* ────────────────────────────────────────────────────────────────────────────
   Deals — the "Forecast Pulse" MVP. One in-memory dataset (mirrors the Gantt
   editor's single-useState-lifted-to-the-parent pattern), rendered through
   simultaneously-mounted views so each keeps its own filter/sort state
   independently when the tab switches (no remount, no refetch). Follow-up
   reminders are lifted here too so the Calendar tab and the deal modal share
   one source of truth.
   ──────────────────────────────────────────────────────────────────────────── */

type Tab = 'dashboard' | 'board' | 'pipeline' | 'crm' | 'focused' | 'calendar'

const TABS: { value: Tab; label: string; blurb: string }[] = [
  { value: 'dashboard', label: 'Dashboard', blurb: 'metrics overview' },
  { value: 'board', label: 'Board', blurb: 'kanban stages' },
  { value: 'pipeline', label: 'Table', blurb: 'financial forecast' },
  { value: 'crm', label: 'CRM', blurb: 'relationships' },
  { value: 'focused', label: 'Focused', blurb: 'hand-picked' },
  { value: 'calendar', label: 'Calendar', blurb: 'follow-ups' },
]

const EMPTY_FORM = {
  customer: '', group_name: 'MAIN', assigned_to: '', total_cost: '', confidence: '50',
  unit_model: '', job_name: '', projected: '', rep: '', rep_contact: '', date_quoted: '', notes: '',
  project_type: '',
}

export default function DealsClient({
  initialDeals, initialFollowUps = [],
}: {
  initialDeals: Deal[]
  initialFollowUps?: DealFollowUp[]
}) {
  const [deals, setDeals] = useState<Deal[]>(initialDeals)
  const [followUps, setFollowUps] = useState<DealFollowUp[]>(initialFollowUps)
  const [tab, setTab] = useState<Tab>('dashboard')
  const [err, setErr] = useState<string | null>(null)

  const [showNew, setShowNew] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  // Deal detail modal: the id + an ordered snapshot of the ids visible in the
  // view it was opened from (its current filter/sort), powering prev/next.
  const [detail, setDetail] = useState<{ id: string; ids: string[] } | null>(null)
  const openDetail = (id: string, ids: string[]) => setDetail({ id, ids })

  const tmpId = useRef(0) // client-side temp ids for optimistic follow-up inserts
  // Intent recorded against a temp id when the user deletes/completes a
  // follow-up that's still mid-POST — reconciled once the real row lands, so
  // the server INSERT (which already committed) isn't orphaned or its toggle lost.
  const pendingFollowUp = useRef<Map<string, 'delete' | { done: boolean }>>(new Map())

  const summary = useMemo(() => computeSummary(deals), [deals])

  // Last-known-server-good copy of every deal. Optimistic edits update `deals`
  // immediately; a successful persist folds the patch in here, and a failed or
  // network-dropped persist reverts the deal to this copy — so the UI can never
  // keep showing a value the DB rejected (weighted totals are computed from
  // these rows, so drift here would corrupt every visible number).
  const serverDeals = useRef<Map<string, Deal>>(new Map(initialDeals.map((d) => [d.id, d])))

  const patchLocal = (id: string, patch: Partial<Deal>) =>
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)))

  // Excel import replaced/extended the whole board server-side: swap in the
  // fresh rows AND rebuild the last-known-server-good map, otherwise a failed
  // edit after an import would "revert" a deal to its pre-import snapshot.
  // Follow-ups come back fresh too (they may have been carried over server-side).
  const applyImported = (fresh: Deal[], freshFollowUps?: DealFollowUp[]) => {
    serverDeals.current = new Map(fresh.map((d) => [d.id, d]))
    setDeals(fresh)
    if (freshFollowUps) setFollowUps(freshFollowUps)
  }

  const revertToServer = (id: string) =>
    setDeals((prev) => prev.map((d) => (d.id === id ? serverDeals.current.get(id) ?? d : d)))

  // In-flight PATCH count per deal. The API returns the FULL updated row
  // (server-derived fields included: synced status, stage_changed_at) — but
  // folding it into visible state while a NEWER edit's persist is still in
  // flight would clobber that edit's optimistic value, so the fold only
  // happens when this counter hits zero.
  const pendingPersists = useRef<Map<string, number>>(new Map())

  const persist = async (id: string, patch: Record<string, unknown>) => {
    const pending = pendingPersists.current
    pending.set(id, (pending.get(id) ?? 0) + 1)
    // Decrements this persist's slot; true when it was the last one in flight.
    const settle = () => {
      const n = (pending.get(id) ?? 1) - 1
      if (n <= 0) pending.delete(id)
      else pending.set(id, n)
      return n <= 0
    }
    try {
      const res = await fetch(`/api/admin/deals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) {
        settle()
        revertToServer(id)
        setErr(j.error || 'Could not save that change.')
        return
      }
      const serverRow = j.deal as Deal | undefined
      if (serverRow && serverRow.id === id) {
        serverDeals.current.set(id, serverRow)
        if (settle()) patchLocal(id, serverRow)
      } else {
        // Response without the row (older API shape) — fold the patch instead.
        const prior = serverDeals.current.get(id)
        if (prior) serverDeals.current.set(id, { ...prior, ...(patch as Partial<Deal>) })
        settle()
      }
      setErr(null)
    } catch {
      settle()
      revertToServer(id)
      setErr('Network error — that change was not saved.')
    }
  }

  const setStatus = (id: string, status: 'Won' | 'Lost' | null) => {
    // Optimistically mirror the server's stage sync for closes; reopening
    // (status null) leaves stage to the server, which restores the last open
    // stage from history and hands the row back via the persist fold.
    const patch: Partial<Deal> = { status }
    if (status === 'Won') patch.stage = 'won'
    if (status === 'Lost') patch.stage = 'lost'
    patchLocal(id, patch)
    persist(id, { status })
  }

  // Stage move (Board drag, modal stepper) — same optimistic machinery.
  const setStage = (id: string, stage: DealStage, closedReason?: string) => {
    const cur = deals.find((d) => d.id === id)
    if (cur && cur.stage === stage && !closedReason) return
    patchLocal(id, {
      stage,
      status: statusForStage(stage),
      stage_changed_at: new Date().toISOString(),
      ...(closedReason ? { closed_reason: closedReason } : {}),
    })
    persist(id, { stage, ...(closedReason ? { closed_reason: closedReason } : {}) })
  }

  // ★ Focused toggle — same optimistic machinery as any inline edit.
  const toggleFocus = (id: string, next: boolean) => {
    patchLocal(id, { focused: next })
    persist(id, { focused: next })
  }

  const removeDeal = async (id: string) => {
    const removed = deals.find((d) => d.id === id)
    setDeals((p) => p.filter((d) => d.id !== id))
    try {
      const res = await fetch(`/api/admin/deals/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      serverDeals.current.delete(id)
      setFollowUps((p) => p.filter((f) => f.deal_id !== id)) // cascade-deleted server-side
      setErr(null)
    } catch {
      // Re-insert just this deal (not a full snapshot restore, which would
      // clobber other edits made while the DELETE was in flight).
      if (removed) setDeals((p) => (p.some((d) => d.id === id) ? p : [removed, ...p]))
      setErr('Could not delete that deal.')
    }
  }

  // ── Follow-up handlers (optimistic; temp ids until the POST resolves) ──
  const addFollowUp = async (dealId: string, dueDate: string, note: string) => {
    const tmp = `temp-${++tmpId.current}`
    const optimistic: DealFollowUp = {
      id: tmp, deal_id: dealId, due_date: dueDate, note: note.trim() || null,
      done: false, auto_generated: false, created_at: new Date().toISOString(),
    }
    setFollowUps((prev) => [...prev, optimistic])
    try {
      const res = await fetch('/api/admin/deals/follow-ups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deal_id: dealId, due_date: dueDate, note }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setFollowUps((prev) => prev.filter((f) => f.id !== tmp))
        pendingFollowUp.current.delete(tmp)
        setErr(json.error || 'Could not schedule that follow-up.')
        return
      }
      // Reconcile any delete/toggle the user did while this POST was in flight.
      const real = json.followUp as DealFollowUp
      const intent = pendingFollowUp.current.get(tmp)
      pendingFollowUp.current.delete(tmp)
      if (intent === 'delete') {
        // Row was removed from state already; delete the now-persisted server row.
        fetch(`/api/admin/deals/follow-ups/${real.id}`, { method: 'DELETE' }).catch(() => {})
      } else if (intent) {
        setFollowUps((prev) => prev.map((f) => (f.id === tmp ? { ...real, done: intent.done } : f)))
        fetch(`/api/admin/deals/follow-ups/${real.id}`, {
          method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: intent.done }),
        }).catch(() => {})
      } else {
        setFollowUps((prev) => prev.map((f) => (f.id === tmp ? real : f)))
      }
      setErr(null)
    } catch {
      setFollowUps((prev) => prev.filter((f) => f.id !== tmp))
      pendingFollowUp.current.delete(tmp)
      setErr('Network error — the follow-up was not saved.')
    }
  }

  const toggleFollowUpDone = async (id: string) => {
    const cur = followUps.find((f) => f.id === id)
    if (!cur) return
    const next = !cur.done
    setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, done: next } : f)))
    if (id.startsWith('temp-')) { pendingFollowUp.current.set(id, { done: next }); return } // reconciled when the POST resolves
    try {
      const res = await fetch(`/api/admin/deals/follow-ups/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ done: next }),
      })
      if (!res.ok) throw new Error()
      setErr(null)
    } catch {
      setFollowUps((prev) => prev.map((f) => (f.id === id ? { ...f, done: cur.done } : f)))
      setErr('Could not update that follow-up.')
    }
  }

  const removeFollowUp = async (id: string) => {
    const removed = followUps.find((f) => f.id === id)
    setFollowUps((prev) => prev.filter((f) => f.id !== id))
    if (id.startsWith('temp-')) { pendingFollowUp.current.set(id, 'delete'); return } // reconciled when the POST resolves
    try {
      const res = await fetch(`/api/admin/deals/follow-ups/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setErr(null)
    } catch {
      if (removed) setFollowUps((prev) => (prev.some((f) => f.id === id) ? prev : [...prev, removed]))
      setErr('Could not delete that follow-up.')
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
          // Only send project_type when set: omitting it keeps New Deal working
          // before migration 048 exists (an always-present column reference
          // would make the whole insert fail pre-048).
          ...(form.project_type ? { project_type: form.project_type } : {}),
          total_cost: Number(form.total_cost) || 0,
          confidence: Math.round(Math.max(0, Math.min(100, Number(form.confidence) || 0))),
          // Compute the auto-reminder date in the browser's timezone (the server
          // runs UTC — see the auto-follow-up note in the POST route).
          auto_follow_up_date: followUpDateFrom(new Date(), AUTO_FOLLOW_UP_DAYS),
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setCreateError(json.error || 'Could not create that deal.'); return }
      serverDeals.current.set(json.deal.id, json.deal)
      setDeals((prev) => [json.deal, ...prev])
      // The auto 2-week reminder the API created alongside the deal (if the
      // follow-ups table exists) — surface it on the calendar immediately.
      if (json.followUp) setFollowUps((prev) => [...prev, json.followUp as DealFollowUp])
      setShowNew(false)
    } catch {
      setCreateError('Network error — the deal was not created.')
    } finally {
      setCreating(false)
    }
  }

  // Resolve the open detail deal against live state; deals deleted (or
  // replaced by an import) since the snapshot silently drop out of the
  // prev/next order rather than 404ing mid-browse.
  const dealIdSet = new Set(deals.map((d) => d.id))
  const detailDeal = detail ? deals.find((d) => d.id === detail.id) ?? null : null
  const detailIds = detail && detailDeal ? detail.ids.filter((id) => dealIdSet.has(id)) : []
  const detailIndex = detailDeal ? detailIds.indexOf(detailDeal.id) : -1
  const detailFollowUps = detailDeal ? followUps.filter((f) => f.deal_id === detailDeal.id) : []

  return (
    <div className="flex-1 overflow-auto bg-canvas">
      {/* Header */}
      <ListPageHeader
        overline="Sales"
        title="Deals"
        count={`${formatCurrency(summary.totalCost)} total · ${formatCurrency(summary.totalWeighted)} weighted · ${deals.length} ${deals.length === 1 ? 'deal' : 'deals'}`}
        actions={
          <button
            onClick={openNew}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Plus size={15} />
            New Deal
          </button>
        }
      >
        {/* View tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map(({ value, label, blurb }) => {
            const active = tab === value
            return (
              <button key={value} onClick={() => setTab(value)} className={tabCx(active)}>
                {label}
                <span className="text-[11px] font-normal text-zinc-300 dark:text-zinc-600 hidden sm:inline">{blurb}</span>
              </button>
            )
          })}
        </div>
      </ListPageHeader>

      <div className="p-4 sm:p-8">

        {err && (
          <div className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-500/10 px-3 py-2 text-[12.5px] text-rose-600 dark:text-rose-400">
            {err}
            <button onClick={() => setErr(null)} className="text-rose-400 hover:text-rose-600 flex-shrink-0"><X size={13} /></button>
          </div>
        )}

        {/* All views stay mounted so switching tabs never resets a view's
            own filter/sort state — see the module comment above. */}
        <div className={tab === 'dashboard' ? '' : 'hidden'}>
          <SalesDashboard deals={deals} onImported={applyImported} />
        </div>
        <div className={tab === 'board' ? '' : 'hidden'}>
          <BoardView deals={deals} onStage={setStage} onView={openDetail} onToggleFocus={toggleFocus} />
        </div>
        <div className={tab === 'pipeline' ? '' : 'hidden'}>
          <PipelineView deals={deals} onStatusChange={setStatus} onView={openDetail} onToggleFocus={toggleFocus} />
        </div>
        <div className={tab === 'crm' ? '' : 'hidden'}>
          <CRMView deals={deals} onView={openDetail} />
        </div>
        <div className={tab === 'focused' ? '' : 'hidden'}>
          <FocusedView deals={deals} onPatchLocal={patchLocal} onPersist={persist} onDelete={removeDeal} onView={openDetail} onToggleFocus={toggleFocus} />
        </div>
        <div className={tab === 'calendar' ? '' : 'hidden'}>
          <CalendarView
            deals={deals}
            followUps={followUps}
            onToggleDone={toggleFollowUpDone}
            onRemove={removeFollowUp}
            onOpenDeal={(id) => openDetail(id, deals.map((d) => d.id))}
          />
        </div>
      </div>

      {/* Deal detail modal */}
      {detailDeal && (
        <DealDetailModal
          deal={detailDeal}
          index={detailIndex}
          total={detailIds.length}
          prevId={detailIndex > 0 ? detailIds[detailIndex - 1] : null}
          nextId={detailIndex >= 0 && detailIndex < detailIds.length - 1 ? detailIds[detailIndex + 1] : null}
          followUps={detailFollowUps}
          onOpen={(id) => setDetail((cur) => (cur ? { ...cur, id } : cur))}
          onClose={() => setDetail(null)}
          onPatchLocal={patchLocal}
          onPersist={persist}
          onStatus={setStatus}
          onStage={setStage}
          onDelete={removeDeal}
          onToggleFocus={toggleFocus}
          onScheduleFollowUp={addFollowUp}
          onToggleFollowUpDone={toggleFollowUpDone}
          onRemoveFollowUp={removeFollowUp}
        />
      )}

      {/* New deal modal */}
      {showNew && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onMouseDown={() => setShowNew(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <form
            onSubmit={submitNew}
            onMouseDown={(e) => e.stopPropagation()}
            className="relative w-full max-w-lg rounded-2xl border border-hairline bg-surface p-5 max-h-[85vh] overflow-y-auto"
            style={{ boxShadow: '0 8px 24px rgba(31,30,27,.10), 0 2px 6px rgba(31,30,27,.05)' }}
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[16px] font-semibold text-ink">New Deal</h2>
              <button type="button" onClick={() => setShowNew(false)} className="text-ink-faint hover:text-ink-secondary transition-colors">
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
              <div className="col-span-2">
                <label className={lbl}>Project Type</label>
                <select className={inp} value={form.project_type} onChange={(e) => set('project_type', e.target.value)}>
                  <option value="">— Select industry —</option>
                  {PROJECT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
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

            <p className="mt-3 text-[11px] text-ink-faint">
              A follow-up reminder is auto-scheduled 2 weeks out — find it on the Calendar tab.
            </p>

            <div className="flex justify-end gap-2 mt-4">
              <button type="button" onClick={() => setShowNew(false)} className="px-4 py-2 rounded-xl text-[13px] font-medium text-ink-secondary hover:bg-surface-soft transition-colors">
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
