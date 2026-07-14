'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Boxes, Search, Plus, X, ChevronRight, ShieldCheck, ShieldAlert, ShieldQuestion, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Equipment } from '@/lib/supabase'
import { warrantyState, isExpiringSoon, daysUntilWarrantyEnd, pmState } from '@/lib/equipment'
import { HEADER_BOX, BODY_BOX, rowCx, StatusPill, Th, TableScroll, ListPageHeader, IdentityCell, tabCx, tabCountCx } from '@/components/admin/list'
import { useBulkSelect, SelectBox, BulkBar, BulkDeleteButton } from '@/components/admin/bulk-select'
import NewCustomerWizard from '@/components/admin/NewCustomerWizard'

type EquipmentRow = Equipment & { last_service_at: string | null }
type Filter = 'all' | 'in' | 'expiring' | 'out' | 'pm_due' | 'unknown'

const EMPTY = { serial_number: '', model_number: '', voltage: '', customer_company: '', customer_name: '', customer_email: '', ship_date: '' }

// Mobile keeps serial-identity + warranty; select/state/chevron return at sm+.
const COLS = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[34px_2fr_150px_132px_28px]'

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
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Header */}
      <ListPageHeader
        overline="Operations"
        title="Equipment"
        count={`${equipment.length} ${equipment.length === 1 ? 'unit' : 'units'} in the installed base`}
        actions={
          <>
            <button onClick={() => setShowWizard(true)}
              className="flex items-center gap-2 bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-700 text-zinc-700 dark:text-zinc-200 text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
              <Sparkles size={15} />New from Submittal
            </button>
            <button onClick={() => { setForm(EMPTY); setError(''); setShowModal(true) }}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
              <Plus size={15} />Add Unit
            </button>
          </>
        }
      >
        {/* Filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {([['all', 'All'], ['in', 'In warranty'], ['expiring', 'Expiring soon'], ['out', 'Out of warranty'], ['pm_due', 'PM due'], ['unknown', 'No date']] as [Filter, string][]).map(([f, label]) => {
            const count = equipment.filter(e => matchesTab(e, f)).length
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)} className={tabCx(active)}>
                {label}
                <span className={tabCountCx(active)}>{count}</span>
              </button>
            )
          })}
        </div>
      </ListPageHeader>

      <div className="p-4 sm:p-8">
        {/* Search */}
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
              className="pl-8 pr-3 h-9 text-[12.5px] w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all" />
          </div>
          <span className="ml-auto text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'unit' : 'units'}
          </span>
        </div>

        {/* Floating header — hidden on mobile, where the rows read as a plain feed */}
        <TableScroll minWidth={680}>
        <div className={`hidden sm:grid ${COLS} ${HEADER_BOX}`}>
          <SelectBox checked={allSelected} onChange={() => sel.setAll(filtered.map(e => e.id), !allSelected)} />
          <Th>Serial</Th>
          <Th>Warranty</Th>
          <Th>State</Th>
          <Th />
        </div>

        {/* Body */}
        <div className={BODY_BOX}>
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Boxes size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">{equipment.length === 0 ? 'No units yet. They’ll appear here as tickets come in, or add one manually.' : 'No units match.'}</p>
            </div>
          ) : (
            filtered.map((eq, i) => (
              <Link key={eq.id} href={`/admin/equipment/${eq.id}`}
                className={`${rowCx(COLS, { i, selected: sel.has(eq.id) })} group ${eq.status === 'decommissioned' ? 'opacity-60' : ''}`}>
                {/* Select */}
                <SelectBox className="hidden sm:flex" checked={sel.has(eq.id)} onChange={() => sel.toggle(eq.id)} />
                {/* Identity — serial over model · customer */}
                {(() => {
                  const company = eq.customer_company || eq.customer_name || ''
                  const model = eq.model_number || ''
                  return (
                    <IdentityCell
                      icon={<Boxes size={13} />}
                      title={eq.serial_number}
                      subtitle={model && company ? `${model} · ${company}` : model || company || undefined}
                    />
                  )
                })()}
                {/* Warranty */}
                <div><WarrantyPill eq={eq} /></div>
                {/* State */}
                <div className="hidden sm:block">
                  {eq.status === 'decommissioned'
                    ? <StatusPill tone="slate">Decommissioned</StatusPill>
                    : <StatusPill tone="emerald">Active</StatusPill>}
                </div>
                {/* Chevron */}
                <div className="hidden sm:flex justify-center">
                  <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>
        </TableScroll>
      </div>

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
              className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-[16px] font-semibold text-gray-900 dark:text-white">Add Unit</h2>
                <button onClick={() => setShowModal(false)} className="text-gray-300 hover:text-gray-500 transition-colors"><X size={18} /></button>
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
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
                    <input value={(form as Record<string, string>)[key]} required={required} placeholder={placeholder}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-full text-[14px] text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300" />
                  </div>
                ))}
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Ship Date <span className="normal-case text-gray-300">(sets warranty)</span></label>
                  <input type="date" value={form.ship_date}
                    onChange={e => setForm(f => ({ ...f, ship_date: e.target.value }))}
                    className="w-full text-[14px] text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all" />
                </div>
                {error && <p className="text-[13px] text-red-500">{error}</p>}
                <button type="submit" disabled={creating || !form.serial_number.trim()}
                  className="w-full bg-[#089447] hover:bg-[#077a3c] text-white text-[14px] font-semibold py-3 rounded-xl transition-all disabled:opacity-40 shadow-sm">
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
    </div>
  )
}
