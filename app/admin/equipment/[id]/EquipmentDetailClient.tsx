'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Save, Boxes, ShieldCheck, ShieldAlert, ShieldQuestion, Ticket as TicketIcon, Wrench, ClipboardList, Image as ImageIcon } from 'lucide-react'
import type { Equipment, Customer, EquipmentMilestone } from '@/lib/supabase'
import { effectiveWarrantyEnd, warrantyState, daysUntilWarrantyEnd, nextPmDue, pmState } from '@/lib/equipment'
import { DetailShell, DetailTopBar, Card, CardHead } from '@/components/admin/detail-ui'
import CustomerPortalCard from '@/components/admin/CustomerPortalCard'

type TicketLite = {
  id: string
  ticket_number: string
  status: string
  priority: string | null
  problem_description: string | null
  resolved_reason: string | null
  created_at: string
}

// Dashboard-language form control: zinc surfaces, emerald focus ring.
const inp = 'w-full text-[14px] text-zinc-800 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3.5 py-2.5 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600'
const lbl = 'text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1.5'

const STATUS_CLS: Record<string, string> = {
  open: 'bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  in_progress: 'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  resolved: 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  closed: 'bg-zinc-50 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700',
}

function fmt(d: string | null) {
  if (!d) return '—'
  return new Date(d.length <= 10 ? d + 'T00:00:00' : d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function EquipmentDetailClient({ equipment, tickets, customer, milestones }: { equipment: Equipment; tickets: TicketLite[]; customer: Customer | null; milestones: EquipmentMilestone[] }) {
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
  const warrantyInput = {
    warranty_end: form.warranty_end || null,
    ship_date: form.ship_date || null,
    warranty_months: parseInt(form.warranty_months) || 12,
  }
  const previewEnd = effectiveWarrantyEnd(warrantyInput)
  const wState = warrantyState(warrantyInput)
  const daysLeft = daysUntilWarrantyEnd(warrantyInput)

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
    <DetailShell>
      <DetailTopBar
        crumbs={[
          { label: 'Equipment', href: '/admin/equipment' },
          { label: equipment.serial_number || 'Unit' },
        ]}
      >
        {saved && <span className="text-[12px] text-emerald-600 dark:text-emerald-400 font-medium">Saved ✓</span>}
        <button
          type="submit"
          form="equip-form"
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[12px] font-semibold px-3.5 py-2 rounded-lg transition-all disabled:opacity-40"
        >
          <Save size={13} />{saving ? 'Saving…' : 'Save'}
        </button>
      </DetailTopBar>

      <div className="p-5 space-y-4">
        {/* Hero */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-emerald-600 dark:text-emerald-400">
            <Boxes size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight font-mono leading-none truncate">{equipment.serial_number}</h1>
            <p className="text-[12px] text-zinc-500 dark:text-zinc-400 mt-1 truncate">
              {equipment.model_number || 'Unknown model'}{equipment.customer_company ? ` · ${equipment.customer_company}` : ''}
            </p>
          </div>
        </div>

        {/* Two-column */}
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          {/* Main — edit form */}
          <main className="flex-1 min-w-0 w-full">
            <Card>
              <CardHead title="Unit Details" icon={<ClipboardList size={14} />} />
              <form id="equip-form" onSubmit={save} className="p-5 space-y-4">
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
                      <label className={lbl}>{label}</label>
                      <input value={(form as Record<string, string>)[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} className={inp} />
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className={lbl}>Ship Date</label>
                    <input type="date" value={form.ship_date} onChange={e => setForm(f => ({ ...f, ship_date: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Install Date</label>
                    <input type="date" value={form.install_date} onChange={e => setForm(f => ({ ...f, install_date: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Warranty (months)</label>
                    <input type="number" min="0" value={form.warranty_months} onChange={e => setForm(f => ({ ...f, warranty_months: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>Warranty End <span className="normal-case text-zinc-300 dark:text-zinc-600">(override)</span></label>
                    <input type="date" value={form.warranty_end} onChange={e => setForm(f => ({ ...f, warranty_end: e.target.value }))} className={inp} />
                  </div>
                  <div>
                    <label className={lbl}>PM interval <span className="normal-case text-zinc-300 dark:text-zinc-600">(months)</span></label>
                    <input type="number" min="0" value={form.pm_interval_months} onChange={e => setForm(f => ({ ...f, pm_interval_months: e.target.value }))} className={inp} placeholder="blank = none" />
                  </div>
                </div>

                <div>
                  <label className={lbl}>Status</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value as 'active' | 'decommissioned' }))} className={inp}>
                    <option value="active">Active</option>
                    <option value="decommissioned">Decommissioned</option>
                  </select>
                </div>

                <div>
                  <label className={lbl}>Notes</label>
                  <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={`${inp} resize-none`} />
                </div>

                {error && <p className="text-[13px] text-rose-500">{error}</p>}
              </form>
            </Card>

            <CustomerPortalCard equipment={equipment} customer={customer} milestones={milestones} />
          </main>

          {/* Right rail */}
          <aside className="w-full xl:w-[340px] flex-shrink-0 xl:sticky xl:top-[72px] space-y-4">
            {/* Warranty + PM */}
            <Card>
              <CardHead title="Warranty" icon={<ShieldCheck size={14} />} />
              <div className="p-5">
                {wState === 'in' && <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 mb-2"><ShieldCheck size={18} /><span className="text-[14px] font-semibold">In warranty</span></div>}
                {wState === 'out' && <div className="flex items-center gap-2 text-rose-500 dark:text-rose-400 mb-2"><ShieldAlert size={18} /><span className="text-[14px] font-semibold">Out of warranty</span></div>}
                {wState === 'unknown' && <div className="flex items-center gap-2 text-zinc-400 mb-2"><ShieldQuestion size={18} /><span className="text-[14px] font-semibold">Unknown</span></div>}
                <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
                  {wState === 'unknown'
                    ? 'Add a ship date to compute coverage.'
                    : `Coverage through ${fmt(previewEnd)}${daysLeft !== null && daysLeft >= 0 ? ` · ${daysLeft}d left` : ''}`}
                </p>

                {/* Preventive maintenance */}
                <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Wrench size={14} className="text-zinc-400" />
                    <span className="text-[12px] font-semibold text-zinc-600 dark:text-zinc-300">Preventive maintenance</span>
                    {pmS === 'due' && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-rose-500">Due</span>}
                    {pmS === 'soon' && <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-amber-500">Soon</span>}
                  </div>
                  <div className="space-y-1 text-[12px] text-zinc-400 dark:text-zinc-500">
                    <div className="flex justify-between"><span>Interval</span><span className="text-zinc-600 dark:text-zinc-300">{form.pm_interval_months ? `${form.pm_interval_months} mo` : 'None'}</span></div>
                    <div className="flex justify-between"><span>Last service</span><span className="text-zinc-600 dark:text-zinc-300">{fmt(lastService)}</span></div>
                    <div className="flex justify-between"><span>Next PM</span><span className={`font-medium ${pmS === 'due' ? 'text-rose-500' : pmS === 'soon' ? 'text-amber-500' : 'text-zinc-600 dark:text-zinc-300'}`}>{pmDue ? fmt(pmDue) : '—'}</span></div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Service history */}
            <Card>
              <CardHead
                title="Service History"
                icon={<TicketIcon size={14} />}
                action={<span className="text-[11px] text-zinc-400 dark:text-zinc-500">{tickets.length} ticket{tickets.length === 1 ? '' : 's'}</span>}
              />
              <div className="p-3">
                {tickets.length === 0 ? (
                  <p className="text-[13px] text-zinc-400 dark:text-zinc-500 px-2 py-3">No tickets for this serial yet.</p>
                ) : (
                  <div className="space-y-1">
                    {tickets.map(t => (
                      <Link key={t.id} href={`/admin/tickets/${t.id}`}
                        className="block px-3 py-2.5 rounded-lg hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors group">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[12px] font-mono font-semibold text-zinc-700 dark:text-zinc-200 group-hover:text-emerald-600 dark:group-hover:text-emerald-400 flex items-center gap-1.5">
                            <TicketIcon size={11} />{t.ticket_number}
                          </span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_CLS[t.status] || STATUS_CLS.closed}`}>
                            {t.status.replace('_', ' ')}
                          </span>
                        </div>
                        {t.problem_description && (
                          <p className="text-[11px] text-zinc-400 dark:text-zinc-500 mt-1 line-clamp-2">{t.problem_description}</p>
                        )}
                        <p className="text-[10px] text-zinc-300 dark:text-zinc-600 mt-1">{fmt(t.created_at)}</p>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </Card>

            {/* Photos */}
            {equipment.photo_urls && equipment.photo_urls.length > 0 && (
              <Card>
                <CardHead title="Photos" icon={<ImageIcon size={14} />} />
                <div className="p-4 grid grid-cols-3 gap-2">
                  {equipment.photo_urls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
                      <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </Card>
            )}
          </aside>
        </div>
      </div>
    </DetailShell>
  )
}
