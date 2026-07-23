'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Boxes, Plus, X, ChevronRight, ShieldCheck, ShieldAlert, ShieldQuestion, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils'
import type { Equipment } from '@/lib/supabase'
import { warrantyState, isExpiringSoon, daysUntilWarrantyEnd, pmState } from '@/lib/equipment'
import { StatusPill } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, Toolbar, CardTable, Row, EmptyRow,
  Pagination, usePagedList, ListSearch, ToneAvatar,
} from '@/components/admin/list-card'
import { useBulkSelect, SelectBox, BulkBar, BulkDeleteButton } from '@/components/admin/bulk-select'
import NewCustomerWizard from '@/components/admin/NewCustomerWizard'

type EquipmentRow = Equipment & { last_service_at: string | null }
type Filter = 'all' | 'in' | 'expiring' | 'out' | 'pm_due' | 'unknown'

const EMPTY = { serial_number: '', model_number: '', voltage: '', customer_company: '', customer_name: '', customer_email: '', ship_date: '' }

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['in', 'In warranty'],
  ['expiring', 'Expiring soon'],
  ['out', 'Out of warranty'],
  ['pm_due', 'PM due'],
  ['unknown', 'No date'],
]

// Select · Serial · Customer · Warranty · State · chevron. Mobile keeps just the
// serial identity (which folds customer into its subtitle) + warranty; the rest
// return at sm+ and the table scrolls sideways if it can't fit.
const COLS = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[34px_minmax(200px,2fr)_minmax(160px,1.4fr)_160px_140px_28px]'

function WarrantyPill({ eq }: { eq: Equipment }) {
  const s = warrantyState(eq)
  if (s === 'in') {
    if (isExpiringSoon(eq)) {
      const d = daysUntilWarrantyEnd(eq)
      return <StatusPill tone="amber" icon={<ShieldAlert size={10} />}>{d === 0 ? 'Expires today' : `Expires ${d}d`}</StatusPill>
    }
    return <StatusPill tone="emerald" icon={<ShieldCheck size={10} />}>In warranty</StatusPill>
  }
  if (s === 'out') return <StatusPill tone="rose" icon={<ShieldAlert size={10} />}>Out of warranty</StatusPill>
  return <StatusPill tone="slate" icon={<ShieldQuestion size={10} />}>No date</StatusPill>
}

export default function EquipmentClient({ equipment }: { equipment: EquipmentRow[] }) {
  const router = useRouter()
  const sel = useBulkSelect()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [showWizard, setShowWizard] = useState(false)

  const matchesTab = (e: EquipmentRow, f: Filter) =>
    f === 'all' ? true
    : f === 'expiring' ? isExpiringSoon(e)
    : f === 'pm_due' ? pmState(e, e.last_service_at) === 'due'
    : warrantyState(e) === f

  // Per-filter counts for the tab pills (one pass, matches matchesTab semantics).
  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: 0, in: 0, expiring: 0, out: 0, pm_due: 0, unknown: 0 }
    for (const e of equipment) {
      c.all++
      if (isExpiringSoon(e)) c.expiring++
      if (pmState(e, e.last_service_at) === 'due') c.pm_due++
      const w = warrantyState(e)
      if (w === 'in') c.in++
      else if (w === 'out') c.out++
      else c.unknown++
    }
    return c
  }, [equipment])

  const q = search.toLowerCase()
  const filtered = equipment.filter(e => {
    const matchesSearch = !q ||
      e.serial_number.toLowerCase().includes(q) ||
      (e.model_number || '').toLowerCase().includes(q) ||
      (e.customer_company || '').toLowerCase().includes(q) ||
      (e.customer_name || '').toLowerCase().includes(q)
    return matchesSearch && matchesTab(e, filter)
  })

  const allSelected = filtered.length > 0 && filtered.every(e => sel.has(e.id))

  // Clear the selection when the visible set changes so a bulk delete can never
  // touch rows outside the current filter/search.
  useEffect(() => { sel.clear() }, [filter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side pagination over the filtered set (reset to page 1 on filter/search).
  const paged = usePagedList(filtered.length, { initialPerPage: 10, resetKey: `${filter}|${search}` })
  const pageRows = filtered.slice(paged.start, paged.end)

  const submit = async (ev: React.FormEvent) => {
    ev.preventDefault()
    setCreating(true)
    setError('')
    const res = await fetch('/api/equipment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, ship_date: form.ship_date || null }),
    })
    const data = await res.json().catch(() => ({}))
    setCreating(false)
    if (!res.ok) { setError(data.error || 'Failed to add unit'); return }
    setShowModal(false)
    setForm(EMPTY)
    router.push(`/admin/equipment/${data.id}`)
  }

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Operations"
          title="Equipment"
          count={`${equipment.length} ${equipment.length === 1 ? 'unit' : 'units'} in the installed base`}
          actions={
            <>
              <button type="button" onClick={() => setShowWizard(true)}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-surface-soft border border-hairline hover:border-hairline-strong text-ink-secondary text-[13px] font-medium transition-colors">
                <Sparkles size={15} />New from Submittal
              </button>
              <button type="button" onClick={() => { setForm(EMPTY); setError(''); setShowModal(true) }}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-[13px] font-medium transition-colors">
                <Plus size={15} />Add Unit
              </button>
            </>
          }
        />

        {/* Filter tabs (with counts) + search */}
        <Toolbar>
          <div className="flex items-center gap-1 flex-wrap">
            {FILTERS.map(([f, label]) => {
              const active = filter === f
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={cn(
                    'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-[13px] font-medium transition-colors',
                    active ? 'bg-brand-soft text-brand-ink' : 'text-ink-secondary hover:bg-surface-soft',
                  )}
                >
                  {label}
                  <span className={cn(
                    'text-[11px] tabular-nums px-1.5 py-0.5 rounded-full',
                    active ? 'bg-surface text-brand-ink' : 'bg-surface-strong text-ink-muted',
                  )}>{counts[f]}</span>
                </button>
              )
            })}
          </div>
          <div className="flex-1" />
          <ListSearch value={search} onChange={setSearch} placeholder="Search…" width={220} />
        </Toolbar>

        {/* Table */}
        <CardTable
          cols={COLS}
          minWidth={900}
          head={
            <>
              <SelectBox className="hidden sm:flex" checked={allSelected} onChange={() => sel.setAll(filtered.map(e => e.id), !allSelected)} />
              <span>Serial</span>
              <span className="hidden sm:block">Customer</span>
              <span>Warranty</span>
              <span className="hidden sm:block">State</span>
              <span className="hidden sm:block" />
            </>
          }
        >
          {pageRows.length === 0 ? (
            <EmptyRow>
              <Boxes size={28} className="text-ink-faint mx-auto mb-3" />
              <p>{equipment.length === 0 ? 'No units yet. They’ll appear here as tickets come in, or add one manually.' : 'No units match.'}</p>
            </EmptyRow>
          ) : (
            pageRows.map((eq) => {
              const company = eq.customer_company || eq.customer_name || ''
              const model = eq.model_number || ''
              // Decommissioned units read dimmed (the State pill also says so).
              const dim = eq.status === 'decommissioned' ? 'opacity-60' : ''
              return (
                <Row key={eq.id} cols={COLS} href={`/admin/equipment/${eq.id}`} selected={sel.has(eq.id)}>
                  {/* Select — stops the click from following the row link */}
                  <SelectBox className="hidden sm:flex" checked={sel.has(eq.id)} onChange={() => sel.toggle(eq.id)} />

                  {/* Serial identity — serial over model (· customer on mobile) */}
                  <div className={cn('flex items-center gap-2.5 min-w-0', dim)}>
                    <span className="w-7 h-7 rounded-lg bg-surface-strong flex items-center justify-center flex-shrink-0 text-ink-muted">
                      <Boxes size={13} />
                    </span>
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{eq.serial_number}</p>
                      <p className="text-[11.5px] text-ink-muted truncate">
                        <span className="sm:hidden">{[model, company].filter(Boolean).join(' · ') || '—'}</span>
                        <span className="hidden sm:inline">{model || '—'}</span>
                      </p>
                    </div>
                  </div>

                  {/* Customer */}
                  <div className={cn('hidden sm:flex items-center gap-2 min-w-0', dim)}>
                    {company ? (
                      <>
                        <ToneAvatar name={company} size={26} />
                        <span className="text-[12.5px] text-ink-secondary truncate">{company}</span>
                      </>
                    ) : <span className="text-[12.5px] text-ink-faint">—</span>}
                  </div>

                  {/* Warranty */}
                  <div className={dim}><WarrantyPill eq={eq} /></div>

                  {/* State */}
                  <div className={cn('hidden sm:block', dim)}>
                    {eq.status === 'decommissioned'
                      ? <StatusPill tone="slate">Decommissioned</StatusPill>
                      : <StatusPill tone="emerald">Active</StatusPill>}
                  </div>

                  {/* Chevron */}
                  <div className={cn('hidden sm:flex justify-center', dim)}>
                    <ChevronRight size={14} className="text-ink-faint group-hover:text-brand-ink transition-colors" />
                  </div>
                </Row>
              )
            })
          )}
        </CardTable>

        <Pagination
          page={paged.page}
          perPage={paged.perPage}
          total={filtered.length}
          totalPages={paged.totalPages}
          onPage={paged.setPage}
          onPerPage={paged.setPerPage}
          unit="units"
        />
      </ListCard>

      <BulkBar count={sel.count} onClear={sel.clear}>
        <BulkDeleteButton entity="equipment" ids={sel.ids} onDone={sel.clear} />
      </BulkBar>

      {/* Add modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
            onClick={() => setShowModal(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 12 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.2 }}
              className="bg-surface rounded-2xl shadow-xl dark:shadow-none dark:ring-1 dark:ring-white/10 w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[16px] font-semibold text-ink">Add Unit</h2>
                <button type="button" onClick={() => setShowModal(false)} className="text-ink-faint hover:text-ink-secondary transition-colors"><X size={18} /></button>
              </div>
              <form onSubmit={submit} className="space-y-4">
                {[
                  { key: 'serial_number', label: 'Serial Number', required: true, placeholder: 'e.g. USR-2024-0142' },
                  { key: 'model_number', label: 'Model', required: false, placeholder: 'Model number' },
                  { key: 'voltage', label: 'Voltage', required: false, placeholder: 'e.g. 460V' },
                  { key: 'customer_company', label: 'Customer Company', required: false, placeholder: 'Company name' },
                  { key: 'customer_name', label: 'Contact Name', required: false, placeholder: 'Contact' },
                  { key: 'customer_email', label: 'Contact Email', required: false, placeholder: 'name@company.com' },
                ].map(({ key, label, required, placeholder }) => (
                  <div key={key}>
                    <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-widest block mb-1.5">{label}</label>
                    <input value={(form as Record<string, string>)[key]} required={required} placeholder={placeholder}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full text-[14px] text-ink-secondary bg-surface-soft border border-hairline rounded-xl px-4 py-2.5 outline-none focus:border-brand transition-colors placeholder:text-ink-faint" />
                  </div>
                ))}
                <div>
                  <label className="text-[11px] font-semibold text-ink-muted uppercase tracking-widest block mb-1.5">Ship Date <span className="normal-case text-ink-faint">(sets warranty)</span></label>
                  <input type="date" value={form.ship_date}
                    onChange={e => setForm(f => ({ ...f, ship_date: e.target.value }))}
                    className="w-full text-[14px] text-ink-secondary bg-surface-soft border border-hairline rounded-xl px-4 py-2.5 outline-none focus:border-brand transition-colors" />
                </div>
                {error && <p className="text-[13px] text-rose-500 dark:text-rose-400">{error}</p>}
                <button type="submit" disabled={creating || !form.serial_number.trim()}
                  className="w-full bg-brand hover:bg-brand-hover text-white text-[14px] font-semibold py-3 rounded-xl transition-colors disabled:opacity-40">
                  {creating ? 'Adding…' : 'Add Unit'}
                </button>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {showWizard && (
        <NewCustomerWizard onClose={() => setShowWizard(false)} onCreated={() => router.refresh()} />
      )}
    </ListCardPage>
  )
}
