'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Save, Boxes, ShieldCheck, ShieldAlert, ShieldQuestion, Ticket as TicketIcon, Wrench } from 'lucide-react'
import { motion } from 'framer-motion'
import type { Equipment } from '@/lib/supabase'
import { effectiveWarrantyEnd, warrantyState, daysUntilWarrantyEnd, nextPmDue, pmState } from '@/lib/equipment'

type TicketLite = {
  id: string
  ticket_number: string
  status: string
  priority: string | null
  problem_description: string | null
  resolved_reason: string | null
  created_at: string
}

const inp = 'w-full text-[14px] text-gray-800 dark:text-gray-100 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300'

const STATUS_CLS: Record<string, string> = {
  open: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  in_progress: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  resolved: 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-200 dark:border-green-800',
  closed: 'bg-gray-50 dark:bg-zinc-800 text-gray-500 dark:text-gray-400 border-gray-200 dark:border-zinc-700',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function EquipmentDetailClient({ equipment, tickets }: { equipment: Equipment; tickets: TicketLite[] }) {
  const router = useRouter()
  const [form, setForm] = useState({
    serial_number: equipment.serial_number || '',
    model_number: equipment.model_number || '',
    voltage: equipment.voltage || '',
    customer_company: equipment.customer_company || '',
    customer_name: equipment.customer_name || '',
    customer_email: equipment.customer_email || '',
    customer_phone: equipment.customer_phone || '',
    location: equipment.location || '',
    ship_date: equipment.ship_date || '',
    install_date: equipment.install_date || '',
    warranty_months: String(equipment.warranty_months ?? 12),
    warranty_end: equipment.warranty_end || '',
    pm_interval_months: equipment.pm_interval_months != null ? String(equipment.pm_interval_months) : '',
    status: equipment.status || 'active',
    notes: equipment.notes || '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  // Live warranty preview from the current form values
  const previewEnd = effectiveWarrantyEnd({
    warranty_end: form.warranty_end || null,
    ship_date: form.ship_date || null,
    warranty_months: parseInt(form.warranty_months) || 12,
  })
  const wState = warrantyState({
    warranty_end: form.warranty_end || null,
    ship_date: form.ship_date || null,
    warranty_months: parseInt(form.warranty_months) || 12,
  })
  const daysLeft = daysUntilWarrantyEnd({
    warranty_end: form.warranty_end || null,
    ship_date: form.ship_date || null,
    warranty_months: parseInt(form.warranty_months) || 12,
  })

  // Maintenance: last service = most recent ticket for this serial
  const lastService = tickets[0]?.created_at ?? null
  const pmInput = {
    pm_interval_months: form.pm_interval_months === '' ? null : (parseInt(form.pm_interval_months) || null),
    install_date: form.install_date || null,
    ship_date: form.ship_date || null,
  }
  const pmDue = nextPmDue(pmInput, lastService)
  const pmS = pmState(pmInput, lastService)

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true); setError('')
    const res = await fetch(`/api/equipment/${equipment.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        warranty_months: parseInt(form.warranty_months) || 12,
        pm_interval_months: form.pm_interval_months === '' ? null : (parseInt(form.pm_interval_months) || null),
        ship_date: form.ship_date || null,
        install_date: form.install_date || null,
        warranty_end: form.warranty_end || null,
      }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) { setError(data.error || 'Save failed'); return }
    setSaved(true)
    setTimeout(() => { setSaved(false); router.refresh() }, 1500)
  }

  return (
    <div className="flex-1 overflow-auto">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <Link href="/admin/equipment" className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-5">
          <ArrowLeft size={13} />Equipment
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <Boxes size={22} className="text-gray-500 dark:text-gray-400" />
          </div>
          <div>
            <h1 className="text-[24px] font-bold text-gray-900 dark:text-white tracking-tight font-mono leading-none">{equipment.serial_number}</h1>
            <p className="text-[13px] text-gray-400 mt-1">
              {equipment.model_number || 'Unknown model'}{equipment.customer_company ? ` · ${equipment.customer_company}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Edit form */}
          <div className="lg:col-span-2 space-y-5">
            <form onSubmit={save} className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40 flex items-center justify-between">
                <h2 className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Unit Details</h2>
                <div className="flex items-center gap-3">
                  {saved && <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[12px] text-[#089447] font-medium">Saved ✓</motion.span>}
                  <button type="submit" disabled={saving}
                    className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[12px] font-semibold px-3.5 py-2 rounded-xl transition-all disabled:opacity-40">
                    <Save size={13} />{saving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
              <div className="p-6 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  {[
                    { key: 'serial_number', label: 'Serial Number' },
                    { key: 'model_number', label: 'Model' },
                    { key: 'voltage', label: 'Voltage' },
                    { key: 'location', label: 'Location / Site' },
                    { key: 'customer_company', label: 'Customer Company' },
                    { key: 'customer_name', label: 'Contact Name' },
                    { key: 'customer_email', label: 'Contact Email' },
                    { key: 'customer_phone', label: 'Contact Phone' },
                  ].map(({ key, label }) => (
                    <div key={key}>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">{label}</label>
                      <input value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className={inp} />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Ship Date</label>
                    <input type="date" value={form.ship_date} onChange={e => setForm(f => ({ ...f, ship_date: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Install Date</label>
                    <input type="date" value={form.install_date} onChange={e => setForm(f => ({ ...f, install_date: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Warranty (months)</label>
                    <input type="number" min="0" value={form.warranty_months} onChange={e => setForm(f => ({ ...f, warranty_months: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Warranty End <span className="normal-case text-gray-300">(override)</span></label>
                    <input type="date" value={form.warranty_end} onChange={e => setForm(f => ({ ...f, warranty_end: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">PM interval <span className="normal-case text-gray-300">(months)</span></label>
                    <input type="number" min="0" value={form.pm_interval_months} onChange={e => setForm(f => ({ ...f, pm_interval_months: e.target.value }))} className={inp} placeholder="blank = none" />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'decommissioned' }))} className={inp}>
                    <option value="active">Active</option>
                    <option value="decommissioned">Decommissioned</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={`${inp} resize-none`} />
                </div>

                {error && <p className="text-[13px] text-red-500">{error}</p>}
              </div>
            </form>
          </div>

          {/* Right rail */}
          <div className="space-y-5">
            {/* Warranty */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
                <h2 className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Warranty</h2>
              </div>
              <div className="p-5">
                {wState === 'in' && <div className="flex items-center gap-2 text-green-600 dark:text-green-400 mb-2"><ShieldCheck size={18} /><span className="text-[14px] font-semibold">In warranty</span></div>}
                {wState === 'out' && <div className="flex items-center gap-2 text-red-500 dark:text-red-400 mb-2"><ShieldAlert size={18} /><span className="text-[14px] font-semibold">Out of warranty</span></div>}
                {wState === 'unknown' && <div className="flex items-center gap-2 text-gray-400 mb-2"><ShieldQuestion size={18} /><span className="text-[14px] font-semibold">Unknown</span></div>}
                <p className="text-[12px] text-gray-400">
                  {wState === 'unknown'
                    ? 'Add a ship date to compute coverage.'
                    : `Coverage through ${fmt(previewEnd)}${daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft}d left` : ''}`}
                </p>

                {/* Preventive maintenance */}
                <div className="mt-4 pt-4 border-t border-gray-50 dark:border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench size={14} className="text-gray-400" />
                    <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-300">Preventive maintenance</span>
                    {pmS === 'due' && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-rose-500">Due</span>}
                    {pmS === 'soon' && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-amber-500">Soon</span>}
                  </div>
                  <div className="space-y-1 text-[12px] text-gray-400">
                    <div className="flex justify-between"><span>Interval</span><span className="text-gray-600 dark:text-gray-300">{form.pm_interval_months ? `${form.pm_interval_months} mo` : 'None'}</span></div>
                    <div className="flex justify-between"><span>Last service</span><span className="text-gray-600 dark:text-gray-300">{fmt(lastService)}</span></div>
                    <div className="flex justify-between"><span>Next PM</span><span className={`font-medium ${pmS === 'due' ? 'text-rose-500' : pmS === 'soon' ? 'text-amber-500' : 'text-gray-600 dark:text-gray-300'}`}>{pmDue ? fmt(pmDue) : '—'}</span></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Service history */}
            <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
              <div className="px-5 py-4 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40 flex items-center justify-between">
                <h2 className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Service History</h2>
                <span className="text-[11px] text-gray-400">{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</span>
              </div>
              <div className="p-3">
                {tickets.length === 0 ? (
                  <p className="text-[13px] text-gray-400 px-2 py-3">No tickets for this serial yet.</p>
                ) : (
                  <div className="space-y-1">
                    {tickets.map(t => (
                      <Link key={t.id} href={`/admin/tickets/${t.id}`}
                        className="block px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors group">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-mono font-semibold text-gray-700 dark:text-gray-200 group-hover:text-[#089447] flex items-center gap-1.5">
                            <TicketIcon size={11} />{t.ticket_number}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLS[t.status] || STATUS_CLS.closed}`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        {t.problem_description && (
                          <p className="text-[11px] text-gray-400 mt-1 line-clamp-2">{t.problem_description}</p>
                        )}
                        <p className="text-[10px] text-gray-300 dark:text-gray-600 mt-1">{fmt(t.created_at)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Photos */}
            {equipment.photo_urls && equipment.photo_urls.length > 0 && (
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
                <div className="px-5 py-4 border-b border-gray-50 dark:border-zinc-800 bg-gray-50/60 dark:bg-zinc-800/40">
                  <h2 className="text-[13px] font-bold text-gray-700 dark:text-gray-200">Photos</h2>
                </div>
                <div className="p-4 grid grid-cols-3 gap-2">
                  {equipment.photo_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-gray-100 dark:border-zinc-700">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
