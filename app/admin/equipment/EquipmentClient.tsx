'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Boxes, Search, Plus, X, ChevronRight, ShieldCheck, ShieldAlert, ShieldQuestion } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Equipment } from '@/lib/supabase'
import { warrantyState, effectiveWarrantyEnd } from '@/lib/equipment'

type Filter = 'all' | 'in' | 'out' | 'unknown'

const EMPTY = { serial_number: '', model_number: '', voltage: '', customer_company: '', customer_name: '', customer_email: '', ship_date: '' }

function WarrantyPill({ eq }: { eq: Equipment }) {
  const s = warrantyState(eq)
  if (s === 'in') return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800"><ShieldCheck size={9} />In warranty</span>
  if (s === 'out') return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-200 dark:border-red-800"><ShieldAlert size={9} />Out of warranty</span>
  return <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700"><ShieldQuestion size={9} />No ship date</span>
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
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Operations</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Equipment</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">{equipment.length} {equipment.length === 1 ? 'unit' : 'units'} in the installed base</p>
          </div>
          <button onClick={() => { setForm(EMPTY); setError(''); setShowModal(true) }}
            className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm">
            <Plus size={15} />Add Unit
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* Filter tabs */}
        <div className="flex items-center gap-1 mb-4 border-b border-gray-100 dark:border-zinc-800">
          {([['all', 'All'], ['in', 'In warranty'], ['out', 'Out of warranty'], ['unknown', 'No date']] as [Filter, string][]).map(([f, label]) => {
            const count = f === 'all' ? equipment.length : equipment.filter(e => warrantyState(e) === f).length
            return (
              <button key={f} onClick={() => setFilter(f)}
                className={`px-4 py-2.5 text-[13px] font-medium whitespace-nowrap border-b-2 transition-all ${
                  filter === f ? 'border-[#089447] text-[#089447]' : 'border-transparent text-gray-400 hover:text-gray-600 hover:border-gray-200'
                }`}>
                {label} <span className={`text-[11px] tabular-nums ${filter === f ? 'text-gray-500' : 'text-gray-300'}`}>{count}</span>
              </button>
            )
          })}
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-300 pointer-events-none" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by serial, model, or customer…"
            className="w-full bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-[13px] text-gray-800 dark:text-gray-200 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 shadow-card" />
        </div>

        {/* List */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
          {filtered.length === 0 ? (
            <div className="py-12 text-center">
              <Boxes size={28} className="text-gray-200 dark:text-gray-700 mx-auto mb-2" />
              <p className="text-[14px] text-gray-400">{equipment.length === 0 ? 'No units yet. They’ll appear here as tickets come in, or add one manually.' : 'No units match.'}</p>
            </div>
          ) : (
            filtered.map((eq, i) => (
              <Link key={eq.id} href={`/admin/equipment/${eq.id}`}
                className={`flex items-center gap-4 px-5 py-4 hover:bg-gray-50 dark:hover:bg-zinc-800/40 transition-colors group ${i < filtered.length - 1 ? 'border-b border-gray-100 dark:border-zinc-800' : ''} ${eq.status === 'decommissioned' ? 'opacity-60' : ''}`}>
                <div className="w-9 h-9 rounded-xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                  <Boxes size={16} className="text-gray-500 dark:text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[14px] font-semibold text-gray-800 dark:text-gray-100 group-hover:text-[#089447] transition-colors font-mono">{eq.serial_number}</p>
                    <WarrantyPill eq={eq} />
                    {eq.status === 'decommissioned' && (
                      <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-gray-200 dark:border-zinc-700">Decommissioned</span>
                    )}
                  </div>
                  <p className="text-[12px] text-gray-400 mt-0.5 truncate">
                    {eq.model_number || 'Unknown model'}{eq.customer_company ? ` · ${eq.customer_company}` : ''}
                  </p>
                </div>
                <ChevronRight size={15} className="text-gray-300 group-hover:text-[#089447] transition-colors flex-shrink-0" />
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
