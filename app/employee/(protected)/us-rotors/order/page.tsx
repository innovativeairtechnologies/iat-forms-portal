'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, ArrowRight, CheckCircle, Loader2 } from 'lucide-react'

type Config = 'A' | 'B' | 'C' | 'D' | 'E' | 'F'
type MotorVoltage = '120/1/60' | '230/3/60'

type OrderForm = {
  company: string
  po_number: string
  contact_name: string
  contact_email: string
  model: string
  quantity: string
  rph: string
  hz: string
  sprocket: string
  motor_voltage: MotorVoltage
  config: Config
  notes: string
}

const CONFIG_LABELS: Record<Config, string> = {
  A: '75/25 — Airflows Opposite (Variant A)',
  B: '75/25 — Airflows Opposite (Variant B)',
  C: '50/50 — Airflows Opposite (Variant C)',
  D: '50/50 — Airflows Opposite (Variant D)',
  E: '50/25/25 Purge — Airflows Opposite (Variant E)',
  F: '50/25/25 Purge — Airflows Opposite (Variant F)',
}

const EMPTY: OrderForm = {
  company: '', po_number: '', contact_name: '', contact_email: '',
  model: '', quantity: '1', rph: '', hz: '', sprocket: '',
  motor_voltage: '120/1/60', config: 'A', notes: '',
}

function Field({ label, required, hint, children }: {
  label: string; required?: boolean; hint?: string; children: React.ReactNode
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[12px] text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

const inputCls = 'w-full text-[13px] bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-[#0274db] focus:ring-2 focus:ring-[#0274db]/10 transition-all'

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="pt-2">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-600 mb-4 pb-2 border-b border-gray-100 dark:border-zinc-800">
        {children}
      </p>
    </div>
  )
}

export default function USRotorsOrderPage() {
  const [form, setForm] = useState<OrderForm>(EMPTY)
  const [stage, setStage] = useState<'form' | 'loading' | 'success'>('form')
  const [orderRef, setOrderRef] = useState('')
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof OrderForm>(key: K, val: OrderForm[K]) =>
    setForm(f => ({ ...f, [key]: val }))

  const isValid = () => {
    const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contact_email.trim())
    return !!form.company.trim() && !!form.contact_name.trim() && emailOk && !!form.model.trim()
  }

  const handleSubmit = async () => {
    if (!isValid()) return
    setStage('loading')
    setError(null)
    try {
      const res = await fetch('/api/us-rotors/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, quantity: parseInt(form.quantity) || 1 }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Submission failed')
      setOrderRef(json.order_ref)
      setStage('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setStage('loading')
      setTimeout(() => setStage('form'), 100)
    }
  }

  if (stage === 'loading') {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-[#0274db]" />
          <p className="text-[14px] text-gray-500 dark:text-gray-400">Submitting order…</p>
        </div>
      </div>
    )
  }

  if (stage === 'success') {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
          style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 16px 48px rgba(0,0,0,0.08)' }}>
          <div className="bg-[#0274db]/5 dark:bg-[#0274db]/10 px-8 py-8 border-b border-[#0274db]/10">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#0274db]/10 flex items-center justify-center">
                <CheckCircle size={20} className="text-[#0274db]" strokeWidth={2.5} />
              </div>
              <div>
                <p className="text-[11px] font-bold text-[#0274db]/70 uppercase tracking-widest mb-0.5">Order Submitted</p>
                <h1 className="text-[20px] font-bold text-gray-900 dark:text-white">You&apos;re all set!</h1>
              </div>
            </div>
            <div className="bg-white/60 dark:bg-zinc-900/60 rounded-xl px-4 py-3 border border-[#0274db]/15">
              <p className="text-[11px] text-gray-400 mb-0.5">Order reference</p>
              <p className="text-[18px] font-bold font-mono text-[#0274db] tracking-wider">{orderRef}</p>
            </div>
          </div>
          <div className="px-8 py-5 flex items-center justify-between">
            <button
              onClick={() => { setForm(EMPTY); setStage('form') }}
              className="text-[13px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              Submit another
            </button>
            <Link
              href="/employee/us-rotors"
              className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#0274db] hover:bg-[#0260b8] px-5 py-2.5 rounded-xl transition-all"
            >
              Back to US Rotors <ArrowRight size={14} />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-center gap-2 mb-2">
          <Link href="/employee/us-rotors" className="text-[12px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center gap-1 transition-colors">
            <ArrowLeft size={13} /> US Rotors
          </Link>
        </div>
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">US Rotors</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">C-Series Order</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Submit a new C-Series rotor or cassette order.</p>
      </div>

      <div className="p-8">
        <div className="max-w-2xl space-y-6">

          {/* Customer Information */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 space-y-4">
            <SectionLabel>Customer Information</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2">
                <Field label="Company Name" required>
                  <input className={inputCls} value={form.company} onChange={e => set('company', e.target.value)} placeholder="Acme Industries" autoFocus />
                </Field>
              </div>
              <Field label="PO Number">
                <input className={inputCls} value={form.po_number} onChange={e => set('po_number', e.target.value)} placeholder="PO-12345" />
              </Field>
              <div />
              <Field label="Contact Name" required>
                <input className={inputCls} value={form.contact_name} onChange={e => set('contact_name', e.target.value)} placeholder="Jane Smith" />
              </Field>
              <Field label="Contact Email" required>
                <input className={inputCls} type="email" value={form.contact_email} onChange={e => set('contact_email', e.target.value)} placeholder="jane@acme.com" />
              </Field>
            </div>
          </div>

          {/* Product Specification */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 space-y-4">
            <SectionLabel>Product Specification</SectionLabel>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Model Number" required hint="e.g. USR-400-965-C">
                <input className={inputCls} value={form.model} onChange={e => set('model', e.target.value)} placeholder="USR-400-965-C" />
              </Field>
              <Field label="Quantity" required>
                <input className={inputCls} type="number" min="1" value={form.quantity} onChange={e => set('quantity', e.target.value)} />
              </Field>
              <Field label="RPH" hint="Rotations per hour — leave blank for standard">
                <input className={inputCls} value={form.rph} onChange={e => set('rph', e.target.value)} placeholder="Standard" />
              </Field>
              <Field label="Hz">
                <select className={inputCls} value={form.hz} onChange={e => set('hz', e.target.value)}>
                  <option value="">Select Hz…</option>
                  <option value="60">60 Hz</option>
                  <option value="50">50 Hz</option>
                </select>
              </Field>
              <Field label="Sprocket">
                <input className={inputCls} value={form.sprocket} onChange={e => set('sprocket', e.target.value)} placeholder="N/A" />
              </Field>
            </div>
          </div>

          {/* Motor & Configuration */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6 space-y-5">
            <SectionLabel>Motor &amp; Configuration</SectionLabel>

            <div>
              <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-2.5">Motor Voltage</p>
              <div className="flex gap-2">
                {(['120/1/60', '230/3/60'] as MotorVoltage[]).map(v => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => set('motor_voltage', v)}
                    className={`px-5 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
                      form.motor_voltage === v
                        ? 'bg-[#0274db] text-white border-[#0274db]'
                        : 'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:border-[#0274db]/40'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-2.5">Configuration</p>
              <div className="grid grid-cols-2 gap-2">
                {(Object.entries(CONFIG_LABELS) as [Config, string][]).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => set('config', key)}
                    className={`flex items-start gap-3 px-4 py-3 rounded-xl border text-left transition-all ${
                      form.config === key
                        ? 'bg-[#0274db]/5 dark:bg-[#0274db]/10 border-[#0274db] text-[#0274db]'
                        : 'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:border-[#0274db]/30'
                    }`}
                  >
                    <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold mt-0.5 ${
                      form.config === key ? 'bg-[#0274db] text-white' : 'bg-gray-100 dark:bg-zinc-700 text-gray-500 dark:text-gray-400'
                    }`}>{key}</span>
                    <span className="text-[12px] font-medium leading-snug">{label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
            <SectionLabel>Additional Notes</SectionLabel>
            <textarea
              className={`${inputCls} resize-none`}
              rows={4}
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Any special requirements, delivery instructions, or other notes…"
            />
          </div>

          {error && (
            <div className="text-[13px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3">
              {error}
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleSubmit}
              disabled={!isValid()}
              className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#0274db] hover:bg-[#0260b8] disabled:opacity-40 px-6 py-3 rounded-xl transition-all"
            >
              Submit Order <ArrowRight size={15} />
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
