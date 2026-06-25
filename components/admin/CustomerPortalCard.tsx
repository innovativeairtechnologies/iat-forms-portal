'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  UserPlus, Upload, Copy, Check, Truck, Loader2, Mail, Link2, X,
  CheckCircle2, Clock, Circle, Sparkles, ShieldCheck, AlertCircle,
} from 'lucide-react'
import { Card, CardHead } from '@/components/admin/detail-ui'
import { isMilestoneSequenceValid } from '@/lib/customer'
import type { Equipment, Customer, EquipmentMilestone } from '@/lib/supabase'

const inp = 'w-full text-[13px] text-zinc-800 dark:text-zinc-100 bg-zinc-50 dark:bg-zinc-800/60 border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 py-2 outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/10 transition-all placeholder:text-zinc-300 dark:placeholder:text-zinc-600'
const lbl = 'text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest block mb-1'

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result).split(',')[1] || '')
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export default function CustomerPortalCard({
  equipment, customer, milestones,
}: {
  equipment: Equipment
  customer: Customer | null
  milestones: EquipmentMilestone[]
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [ms, setMs] = useState<EquipmentMilestone[]>(milestones)

  return (
    <>
      {/* ── Customer Portal access ── */}
      <Card>
        <CardHead
          title="Customer Portal"
          icon={<UserPlus size={14} />}
          action={
            customer ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                <ShieldCheck size={12} /> Linked
              </span>
            ) : undefined
          }
        />
        <div className="p-5">
          {customer ? (
            <div className="space-y-1.5">
              <p className="text-[13px] text-zinc-600 dark:text-zinc-300">
                Portal account active for <span className="font-semibold text-zinc-900 dark:text-white">{customer.company_name}</span>.
              </p>
              <p className="text-[12px] text-zinc-400">
                {customer.contact_email} can sign in at <span className="font-mono">/login</span> to view this unit, its build &amp; shipping status, and submit requests.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="text-[13px] text-zinc-500 dark:text-zinc-400">
                Give this customer a login to track build &amp; shipping status, warranty, and support for this unit.
              </p>
              <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12px] font-semibold text-white transition-colors hover:bg-emerald-700"
              >
                <UserPlus size={13} /> Invite to portal
              </button>
            </div>
          )}
        </div>
      </Card>

      {/* ── Build & Shipping tracker editor ── */}
      <Tracker equipmentId={equipment.id} ms={ms} setMs={setMs} />

      {/* ── Invite modal ── */}
      {open && !customer && (
        <InviteModal
          equipment={equipment}
          onClose={() => setOpen(false)}
          onDone={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}

// ── Invite modal ──────────────────────────────────────────────────────────────
function InviteModal({
  equipment, onClose, onDone,
}: {
  equipment: Equipment
  onClose: () => void
  onDone: () => void
}) {
  const [form, setForm] = useState({
    company_name: equipment.customer_company || '',
    primary_contact_name: equipment.customer_name || '',
    contact_email: equipment.customer_email || '',
    phone: equipment.customer_phone || '',
    seed_tracker: true,
  })
  const [scanning, setScanning] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<{ temp_password: string; login_url: string; email_sent: boolean } | null>(null)
  const [copied, setCopied] = useState(false)

  const set = (k: keyof typeof form, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }))

  const scan = async (file: File | undefined) => {
    if (!file) return
    setScanning(true); setError('')
    try {
      const data = await fileToBase64(file)
      const res = await fetch('/api/admin/customers/extract-submittal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ file: { data, media_type: file.type, name: file.name } }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Could not scan that file.'); return }
      const f = json.fields || {}
      setForm((prev) => ({
        ...prev,
        company_name: f.company_name || prev.company_name,
        primary_contact_name: f.primary_contact_name || prev.primary_contact_name,
        contact_email: f.contact_email || prev.contact_email,
        phone: f.phone || prev.phone,
      }))
    } catch {
      setError('Could not read that file.')
    } finally {
      setScanning(false)
    }
  }

  const submit = async () => {
    setSubmitting(true); setError('')
    try {
      const res = await fetch('/api/admin/customers/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          company_name: form.company_name,
          primary_contact_name: form.primary_contact_name,
          contact_email: form.contact_email,
          phone: form.phone,
          equipment_id: equipment.id,
          seed_tracker: form.seed_tracker,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Could not create the account.'); return }
      setResult({ temp_password: json.temp_password, login_url: json.login_url, email_sent: json.email_sent })
    } finally {
      setSubmitting(false)
    }
  }

  const copy = async () => {
    if (!result) return
    await navigator.clipboard.writeText(`${form.contact_email} / ${result.temp_password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
          <div className="flex items-center gap-2">
            <UserPlus size={15} className="text-emerald-600 dark:text-emerald-400" />
            <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white">Invite customer to portal</h3>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-600"><X size={16} /></button>
        </div>

        {result ? (
          <div className="space-y-4 p-5">
            <div className="flex items-start gap-2.5 rounded-xl bg-emerald-50 px-4 py-3 dark:bg-emerald-500/10">
              <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <div>
                <p className="text-[13px] font-semibold text-emerald-800 dark:text-emerald-300">Account created</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-[12px] text-emerald-700/80 dark:text-emerald-400/80">
                  <Mail size={12} />
                  {result.email_sent
                    ? `Login details emailed to ${form.contact_email}`
                    : 'Email not sent — share these credentials:'}
                </p>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-zinc-200 dark:border-zinc-700">
              <div className="flex items-center justify-between gap-3 border-b border-zinc-100 px-3.5 py-2.5 dark:border-zinc-800">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Email</span>
                <span className="truncate font-mono text-[12px] text-zinc-700 dark:text-zinc-200">{form.contact_email}</span>
              </div>
              <div className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400">Temp password</span>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-bold text-emerald-600 dark:text-emerald-400">{result.temp_password}</span>
                  <button onClick={copy} className="flex h-7 shrink-0 items-center gap-1 rounded-md border border-zinc-200 px-2 text-[11px] font-semibold text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300">
                    {copied ? <Check size={12} className="text-emerald-500" /> : <Copy size={12} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            </div>
            <p className="flex items-center gap-1 text-[11px] text-zinc-400"><Link2 size={11} /> They&apos;ll set their own password right after signing in.</p>

            <div className="flex items-center gap-2">
              <a href={result.login_url} target="_blank" rel="noopener noreferrer" className="flex-1 rounded-lg border border-zinc-200 py-2.5 text-center text-[13px] font-semibold text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-200">Open login ↗</a>
              <button onClick={onDone} className="flex-1 rounded-lg bg-emerald-600 py-2.5 text-[13px] font-semibold text-white hover:bg-emerald-700">Done</button>
            </div>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            {/* Submittal scan */}
            <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-zinc-300 bg-zinc-50 px-4 py-3 transition-colors hover:border-emerald-400 hover:bg-emerald-50/40 dark:border-zinc-700 dark:bg-zinc-800/40">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-emerald-600 shadow-sm dark:bg-zinc-900 dark:text-emerald-400">
                {scanning ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
              </span>
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-zinc-700 dark:text-zinc-200">
                  {scanning ? 'Reading Submittal…' : 'Scan a Submittal PDF'}
                </p>
                <p className="text-[11px] text-zinc-400">Auto-fills the fields below — review before sending.</p>
              </div>
              <Upload size={15} className="ml-auto shrink-0 text-zinc-400" />
              <input
                type="file"
                accept="application/pdf,image/*"
                className="hidden"
                disabled={scanning}
                onChange={(e) => scan(e.target.files?.[0])}
              />
            </label>

            <div className="grid grid-cols-1 gap-3">
              <div>
                <label className={lbl}>Company *</label>
                <input value={form.company_name} onChange={(e) => set('company_name', e.target.value)} className={inp} placeholder="Acme Foods" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={lbl}>Contact name</label>
                  <input value={form.primary_contact_name} onChange={(e) => set('primary_contact_name', e.target.value)} className={inp} placeholder="Jane Doe" />
                </div>
                <div>
                  <label className={lbl}>Phone</label>
                  <input value={form.phone} onChange={(e) => set('phone', e.target.value)} className={inp} placeholder="(555) 000-0000" />
                </div>
              </div>
              <div>
                <label className={lbl}>Login email *</label>
                <input type="email" value={form.contact_email} onChange={(e) => set('contact_email', e.target.value)} className={inp} placeholder="jane@acme.com" />
              </div>
            </div>

            <label className="flex items-center gap-2 text-[12.5px] text-zinc-600 dark:text-zinc-300">
              <input type="checkbox" checked={form.seed_tracker} onChange={(e) => set('seed_tracker', e.target.checked)} className="accent-emerald-600" />
              Start the build &amp; shipping tracker for this unit
            </label>

            {error && <p className="text-[12.5px] text-rose-500">{error}</p>}

            <div className="flex items-center gap-2 pt-1">
              <button onClick={onClose} className="rounded-lg px-4 py-2.5 text-[13px] font-medium text-zinc-500 hover:text-zinc-700">Cancel</button>
              <button
                onClick={submit}
                disabled={submitting || !form.company_name.trim() || !form.contact_email.trim()}
                className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-emerald-600 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-emerald-700 disabled:opacity-40"
              >
                {submitting ? <><Loader2 size={14} className="animate-spin" /> Creating…</> : <>Create account &amp; send invite</>}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Tracker editor ──────────────────────────────────────────────────────────
function Tracker({
  equipmentId, ms, setMs,
}: {
  equipmentId: string
  ms: EquipmentMilestone[]
  setMs: React.Dispatch<React.SetStateAction<EquipmentMilestone[]>>
}) {
  const [seeding, setSeeding] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const ordered = [...ms].sort((a, b) => a.sort_order - b.sort_order)
  const doneCount = ordered.filter((m) => m.status === 'complete').length

  const patchLocal = (id: string, patch: Partial<EquipmentMilestone>) =>
    setMs((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)))

  const persist = async (id: string, patch: Record<string, unknown>) => {
    const res = await fetch(`/api/admin/equipment/${equipmentId}/milestones`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneId: id, ...patch }),
    })
    if (!res.ok) {
      const j = await res.json().catch(() => ({}))
      setErr(j.error || 'Could not save that change.')
    }
  }

  const setStatus = (id: string, status: string) => {
    // Enforce in-order progress *before* touching state: no skipping ahead, no gaps.
    const proposed = ordered.map((m) => (m.id === id ? { ...m, status } : m))
    if (!isMilestoneSequenceValid(proposed)) {
      setErr('Steps must go in order — finish the earlier steps before starting or completing a later one.')
      return
    }
    setErr(null)
    const occurred_at = status === 'complete' ? new Date().toISOString() : null
    patchLocal(id, { status: status as EquipmentMilestone['status'], occurred_at })
    persist(id, { status })
  }
  const setDate = (id: string, date: string) => {
    patchLocal(id, { occurred_at: date || null })
    persist(id, { occurred_at: date })
  }

  const seed = async () => {
    setSeeding(true)
    const res = await fetch(`/api/admin/equipment/${equipmentId}/milestones`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setSeeding(false)
    if (res.ok && json.milestones) setMs(json.milestones)
  }

  return (
    <Card>
      <CardHead
        title="Build & Shipping"
        icon={<Truck size={14} />}
        action={ordered.length ? <span className="text-[11px] font-medium text-zinc-400">{doneCount}/{ordered.length} done</span> : undefined}
      />
      <div className="p-5">
        {ordered.length === 0 ? (
          <div className="space-y-3">
            <p className="text-[13px] text-zinc-500 dark:text-zinc-400">No tracker on this unit yet. Start one to show the customer live build &amp; shipping status.</p>
            <button
              onClick={seed}
              disabled={seeding}
              className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3.5 py-2 text-[12px] font-semibold text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-40 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
            >
              {seeding ? <Loader2 size={13} className="animate-spin" /> : <Truck size={13} />} Start tracker
            </button>
          </div>
        ) : (
          <>
            {err && (
              <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-[12px] text-rose-600 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                <AlertCircle size={14} className="mt-px flex-shrink-0" />
                <span>{err}</span>
              </div>
            )}
            <ol>
              {ordered.map((m, i) => {
                const isLast = i === ordered.length - 1
                const done = m.status === 'complete'
                const active = m.status === 'in_progress'
                return (
                  <li key={m.id} className="flex gap-3">
                    {/* stepper rail */}
                    <div className="flex flex-col items-center pt-1">
                      {done ? <CheckCircle2 size={18} className="text-emerald-500" />
                        : active ? <Clock size={18} className="text-amber-500" />
                        : <Circle size={18} className="text-zinc-300 dark:text-zinc-600" />}
                      {!isLast && <div className={`my-1 w-px flex-1 ${done ? 'bg-emerald-300 dark:bg-emerald-500/40' : 'bg-zinc-200 dark:bg-zinc-800'}`} />}
                    </div>
                    {/* content */}
                    <div className={`min-w-0 flex-1 ${isLast ? 'pb-0' : 'pb-5'}`}>
                      <div className="flex items-center justify-between gap-3">
                        <span className={`text-[13px] font-semibold ${done || active ? 'text-zinc-900 dark:text-white' : 'text-zinc-500 dark:text-zinc-400'}`}>{m.stage}</span>
                        <select
                          value={m.status}
                          onChange={(e) => setStatus(m.id, e.target.value)}
                          className="flex-shrink-0 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-600 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        >
                          <option value="pending">Pending</option>
                          <option value="in_progress">In progress</option>
                          <option value="complete">Complete</option>
                        </select>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <input
                          type="date"
                          value={(m.occurred_at || '').slice(0, 10)}
                          onChange={(e) => setDate(m.id, e.target.value)}
                          className="rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] text-zinc-600 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        />
                        <input
                          value={m.note || ''}
                          onChange={(e) => patchLocal(m.id, { note: e.target.value })}
                          onBlur={(e) => persist(m.id, { note: e.target.value })}
                          placeholder="Add a note (optional)"
                          className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] text-zinc-600 outline-none focus:border-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300 placeholder:text-zinc-300 dark:placeholder:text-zinc-600"
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ol>
          </>
        )}
      </div>
    </Card>
  )
}
