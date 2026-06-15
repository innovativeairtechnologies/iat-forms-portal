'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Boxes, Search, Plus, X, ChevronRight, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Equipment } from '@/lib/supabase'
import { warrantyState } from '@/lib/equipment'
import { HEADER_BOX, BODY_BOX, rowCx, StatusPill, Th } from '@/components/admin/list'

type Filter = 'all' | 'in' | 'out' | 'unknown'

const EMPTY = { serial_number: '', model_number: '', voltage: '', customer_company: '', customer_name: '', customer_email: '', ship_date: '' }

const COLS = 'grid-cols-[1.2fr_1fr_1.3fr_148px_104px_92px_28px]'

function WarrantyPill({ eq }: { eq: Equipment }) {
  const s = warrantyState(eq)
  if (s === 'in')  return <StatusPill tone="emerald" icon={<ShieldCheck size={10} />}>In warranty</StatusPill>
  if (s === 'out') return <StatusPill tone="rose" icon={<ShieldAlert size={10} />}>Out of warranty</StatusPill>
  return <StatusPill tone="slate" icon={<ShieldQuestion size={10} />}>No date</StatusPill>
}

function fmtShip(d: string | null) {
  if (!d) return '—'
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
}

export default function EquipmentClient({ equipment }: { equipment: Equipment[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(EMPTY)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')

  const q = search.toLowerCase()
  const filtered = equipment.filter(e => {
    const matchesSearch = !q ||
      e.serial_number.toLowerCase().includes(q) ||
      (e.model_number || '').toLowerCase().includes(q) ||
      (e.customer_company || '').toLowerCase().includes(q) ||
      (e.customer_name || '').toLowerCase().includes(q)
    const matchesFilter = filter === 'all' || warrantyState(e) === filter
    return matchesSearch && matchesFilter
  })

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
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Operations</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Equipment</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">{equipment.length} {equipment.length === 1 ? 'unit' : 'units'} in the installed base</p>
          </div>
          <button onClick={() => { setForm(EMPTY); setError(''); setShowModal(true) }}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
            <Plus size={15} />Add Unit
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* Filter tabs */}
        <div className="flex items-center gap-6 mb-4 border-b border-zinc-200 dark:border-zinc-800">
          {([['all', 'All'], ['in', 'In warranty'], ['out', 'Out of warranty'], ['unknown', 'No date']] as [Filter, string][]).map(([f, label]) => {
            const count = f === 'all' ? equipment.length : equipment.filter(e => warrantyState(e) === f).length
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`relative pb-2.5 text-[13px] whitespace-nowrap transition-colors ${
                  active ? 'font-semibold text-zinc-900 dark:text-white' : 'font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}>
                {label}
                <span className={`ml-1.5 text-[11px] tabular-nums ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600'}`}>{count}</span>
                {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-emerald-500" />}
              </button>
            )
          })}
        </div>

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

        {/* Floating header */}
        <div className={`grid ${COLS} ${HEADER_BOX}`}>
          <Th>Serial</Th>
          <Th>Model</Th>
          <Th>Customer</Th>
          <Th>Warranty</Th>
          <Th>State</Th>
          <Th>Ship date</Th>
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
                className={`${rowCx(COLS, { i })} group ${eq.status === 'decommissioned' ? 'opacity-60' : ''}`}>
                {/* Serial */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Boxes size={13} className="text-zinc-500 dark:text-zinc-400" />
                  </span>
                  <span className="font-mono font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">{eq.serial_number}</span>
                </div>
                {/* Model */}
                <div className="min-w-0 text-zinc-600 dark:text-zinc-300 truncate">{eq.model_number || '—'}</div>
                {/* Customer */}
                <div className="min-w-0 text-zinc-600 dark:text-zinc-300 truncate">{eq.customer_company || eq.customer_name || '—'}</div>
                {/* Warranty */}
                <div><WarrantyPill eq={eq} /></div>
                {/* State */}
                <div>
                  {eq.status === 'decommissioned'
                    ? <StatusPill tone="slate">Decommissioned</StatusPill>
                    : <StatusPill tone="emerald">Active</StatusPill>}
                </div>
                {/* Ship date */}
                <div className="text-zinc-400 dark:text-zinc-500 tabular-nums">{fmtShip(eq.ship_date)}</div>
                {/* Chevron */}
                <div className="flex justify-center">
                  <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

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
    </div>
  )
}
