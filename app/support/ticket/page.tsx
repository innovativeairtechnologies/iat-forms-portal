'use client'

import { useState, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, CheckCircle, Lightbulb,
  RotateCcw, Upload, X, Loader2, ImageIcon,
} from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// ─── Types ───────────────────────────────────────────────────────────────────

type FormData = {
  customer_name: string
  customer_company: string
  customer_email: string
  customer_phone: string
  serial_number: string
  model_number: string
  voltage: string
  problem_description: string
  pre_cooling: boolean | null
  pre_cooling_type: string
  pre_cooling_working: boolean | null
  post_cooling: boolean | null
  post_cooling_type: string
  post_cooling_working: boolean | null
  airflow_balanced: boolean | null
  process_airflow_cfm: string
  react_airflow_cfm: string
  react_heat_working: boolean | null
  react_heat_setpoint: boolean | null
  seals_good: boolean | null
}

const EMPTY: FormData = {
  customer_name: '', customer_company: '', customer_email: '', customer_phone: '',
  serial_number: '', model_number: '', voltage: '',
  problem_description: '',
  pre_cooling: null, pre_cooling_type: '', pre_cooling_working: null,
  post_cooling: null, post_cooling_type: '', post_cooling_working: null,
  airflow_balanced: null, process_airflow_cfm: '', react_airflow_cfm: '',
  react_heat_working: null, react_heat_setpoint: null,
  seals_good: null,
}

const TOTAL_STEPS = 7

// ─── Sub-components ──────────────────────────────────────────────────────────

function InputField({
  label, value, onChange, placeholder, type = 'text', required, hint, autoFocus,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; required?: boolean; hint?: string; autoFocus?: boolean
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[12px] text-gray-400 mb-1.5 leading-relaxed">{hint}</p>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full text-[13px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all"
      />
    </div>
  )
}

function TextareaField({
  label, value, onChange, placeholder, required, hint, rows = 5,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; hint?: string; rows?: number
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {hint && <p className="text-[12px] text-gray-400 mb-1.5 leading-relaxed">{hint}</p>}
      <textarea
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full text-[13px] bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl px-3.5 py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all resize-none leading-relaxed"
      />
    </div>
  )
}

function BoolField({
  label, value, onChange, hint,
}: {
  label: string; value: boolean | null; onChange: (v: boolean | null) => void; hint?: string
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
      {hint && <p className="text-[12px] text-gray-400 mb-2 leading-relaxed">{hint}</p>}
      <div className="flex gap-2">
        {([true, false] as const).map(v => (
          <button
            key={String(v)}
            type="button"
            onClick={() => onChange(value === v ? null : v)}
            className={`px-5 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
              value === v
                ? v
                  ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-300 dark:border-red-700'
                : 'bg-white dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Step definitions ─────────────────────────────────────────────────────────

const STEP_LABELS = ['Contact', 'Equipment', 'Problem', 'Pre-Cooling', 'Post-Cooling', 'System', 'Photos']

// ─── Main page ────────────────────────────────────────────────────────────────

type Stage = 'form' | 'loading' | 'success'

export default function SupportPage() {
  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [photos, setPhotos] = useState<File[]>([])
  const [stage, setStage] = useState<Stage>('form')
  const [ticketNumber, setTicketNumber] = useState('')
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm(f => ({ ...f, [key]: val }))
  }, [])

  const canAdvance = () => {
    if (step === 1) return !!form.customer_name.trim() && !!form.customer_email.trim()
    if (step === 2) return !!form.serial_number.trim() && !!form.model_number.trim() && !!form.voltage.trim()
    if (step === 3) return !!form.problem_description.trim()
    return true
  }

  const go = (next: number) => {
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

  const handleNext = () => { if (canAdvance() && step < TOTAL_STEPS) go(step + 1) }
  const handleBack = () => { if (step > 1) go(step - 1) }

  const handleSubmit = async () => {
    if (!canAdvance()) return
    setStage('loading')
    setError(null)

    let photo_urls: string[] = []

    if (photos.length > 0) {
      const sb = createSupabaseBrowser()
      for (const file of photos) {
        const ext = file.name.split('.').pop() ?? 'jpg'
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
        const { data } = await sb.storage.from('ticket-photos').upload(filename, file, { upsert: false })
        if (data) {
          const { data: pub } = sb.storage.from('ticket-photos').getPublicUrl(data.path)
          if (pub?.publicUrl) photo_urls.push(pub.publicUrl)
        }
      }
    }

    try {
      const res = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, photo_urls }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Submission failed')
      setTicketNumber(json.ticket_number)
      setRecommendations(json.ai_recommendations ?? [])
      setStage('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('form')
    }
  }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    setPhotos(prev => [...prev, ...valid].slice(0, 8))
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="text-[#089447] animate-spin" />
          <p className="text-[15px] font-semibold text-gray-700 dark:text-gray-200">Submitting your ticket…</p>
          <p className="text-[13px] text-gray-400">Analyzing your system for troubleshooting steps</p>
        </div>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
        <header className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3">
          <Image src="/iat-logo.png" alt="IAT" width={28} height={28} className="rounded-md" />
          <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">IAT Support</span>
        </header>

        <div className="flex-1 flex items-start justify-center py-12 px-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-2xl bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 24px 64px rgba(0,0,0,0.10)' }}
          >
            {/* Top success bar */}
            <div className="bg-gradient-to-r from-[#089447]/10 to-[#089447]/5 dark:from-[#089447]/20 dark:to-[#089447]/5 px-8 py-8 border-b border-[#089447]/10 dark:border-[#089447]/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#089447]/10 dark:bg-[#089447]/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={24} className="text-[#089447]" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#089447]/70 uppercase tracking-widest mb-0.5">Ticket Submitted</p>
                  <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">You&apos;re all set!</h1>
                </div>
              </div>
              <div className="bg-white/60 dark:bg-gray-900/60 rounded-xl px-4 py-3 border border-[#089447]/15">
                <p className="text-[11px] text-gray-400 mb-0.5">Your ticket number</p>
                <p className="text-[20px] font-bold font-mono text-[#089447] tracking-wider">{ticketNumber}</p>
              </div>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
                Our service team will reach out to <strong className="text-gray-700 dark:text-gray-200">{form.customer_email}</strong> shortly.
              </p>
            </div>

            {/* AI Recommendations */}
            {recommendations.length > 0 && (
              <div className="px-8 py-6 border-b border-gray-100 dark:border-gray-800">
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-7 h-7 rounded-lg bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                    <Lightbulb size={14} className="text-amber-500" />
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100">While you wait, try these steps</p>
                    <p className="text-[11px] text-gray-400">Based on the information you provided</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {recommendations.map((rec, i) => (
                    <div key={i} className="flex gap-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl px-4 py-3 border border-amber-100 dark:border-amber-900/30">
                      <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center justify-center mt-0.5">
                        {i + 1}
                      </span>
                      <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">{rec}</p>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-3">
                  These are AI-generated suggestions. If unsure, wait for your service technician.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="px-8 py-5 flex items-center justify-between gap-4">
              <button
                onClick={() => { setForm(EMPTY); setPhotos([]); setStep(1); setStage('form') }}
                className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <RotateCcw size={14} />
                Submit another ticket
              </button>
              <Link
                href="/support"
                className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] px-5 py-2.5 rounded-xl transition-all"
              >
                Back to support
                <ArrowRight size={14} />
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    )
  }

  // ── Form ─────────────────────────────────────────────────────────────────

  const variants = {
    enter: (d: number) => ({ x: d > 0 ? 32 : -32, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (d: number) => ({ x: d > 0 ? -32 : 32, opacity: 0 }),
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">

      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900 flex items-center gap-3">
        <Image src="/iat-logo.png" alt="IAT" width={28} height={28} className="rounded-md" />
        <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">IAT Support</span>
        <span className="text-gray-200 dark:text-gray-700 mx-1">/</span>
        <span className="text-[14px] text-gray-400">Submit a Ticket</span>
      </header>

      <div className="flex-1 flex flex-col items-center py-10 px-4">

        {/* Progress */}
        <div className="w-full max-w-xl mb-8">
          <div className="flex items-center justify-between mb-2">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1
              const done = n < step
              const active = n === step
              return (
                <div key={n} className="flex flex-col items-center gap-1.5 flex-1">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold transition-all ${
                    done
                      ? 'bg-[#089447] text-white'
                      : active
                        ? 'bg-[#089447]/10 dark:bg-[#089447]/20 text-[#089447] border-2 border-[#089447]'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-300 dark:text-gray-600'
                  }`}>
                    {done ? <CheckCircle size={12} strokeWidth={3} /> : n}
                  </div>
                  <span className={`text-[10px] font-medium hidden sm:block transition-colors ${
                    active ? 'text-[#089447]' : done ? 'text-gray-400' : 'text-gray-300 dark:text-gray-600'
                  }`}>{label}</span>
                </div>
              )
            })}
          </div>
          {/* Progress bar */}
          <div className="h-1 bg-gray-100 dark:bg-gray-800 rounded-full mt-1">
            <div
              className="h-full bg-[#089447] rounded-full transition-all duration-500"
              style={{ width: `${((step - 1) / (TOTAL_STEPS - 1)) * 100}%` }}
            />
          </div>
        </div>

        {/* Step card */}
        <div className="w-full max-w-xl">
          <AnimatePresence mode="wait" custom={dir}>
            <motion.div
              key={step}
              custom={dir}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
              className="w-full bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 p-7"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)' }}
            >
              {step === 1 && <StepContact form={form} set={set} />}
              {step === 2 && <StepEquipment form={form} set={set} />}
              {step === 3 && <StepProblem form={form} set={set} />}
              {step === 4 && <StepPreCooling form={form} set={set} />}
              {step === 5 && <StepPostCooling form={form} set={set} />}
              {step === 6 && <StepSystemChecks form={form} set={set} />}
              {step === 7 && <StepPhotos photos={photos} setPhotos={setPhotos} fileInputRef={fileInputRef} handleFiles={handleFiles} />}
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Error */}
        {error && (
          <div className="w-full max-w-xl mt-3 text-[13px] text-red-500 bg-red-50 dark:bg-red-950/30 border border-red-100 dark:border-red-900 rounded-xl px-4 py-3">
            {error}
          </div>
        )}

        {/* Navigation */}
        <div className="w-full max-w-xl flex items-center justify-between mt-4">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className="flex items-center gap-2 text-[13px] font-medium text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-0 transition-all"
          >
            <ArrowLeft size={15} /> Back
          </button>

          {step < TOTAL_STEPS ? (
            <button
              onClick={handleNext}
              disabled={!canAdvance()}
              className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] disabled:opacity-40 px-5 py-2.5 rounded-xl transition-all"
            >
              Next <ArrowRight size={15} />
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              className="flex items-center gap-2 text-[13px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] px-5 py-2.5 rounded-xl transition-all"
            >
              Submit Ticket <ArrowRight size={15} />
            </button>
          )}
        </div>

        <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-6">
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>
    </div>
  )
}

// ─── Step Components ──────────────────────────────────────────────────────────

type SetFn = <K extends keyof FormData>(key: K, val: FormData[K]) => void

function StepContact({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-4">
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">Contact Information</h2>
        <p className="text-[13px] text-gray-400">We&apos;ll use this to follow up on your ticket.</p>
      </div>
      <InputField label="Full Name" value={form.customer_name} onChange={v => set('customer_name', v)} placeholder="Jane Smith" required autoFocus />
      <InputField label="Company / Organization" value={form.customer_company} onChange={v => set('customer_company', v)} placeholder="Acme Corp" />
      <div className="grid grid-cols-2 gap-4">
        <InputField label="Email Address" value={form.customer_email} onChange={v => set('customer_email', v)} placeholder="jane@acme.com" type="email" required />
        <InputField label="Phone Number" value={form.customer_phone} onChange={v => set('customer_phone', v)} placeholder="(555) 000-0000" type="tel" />
      </div>
    </div>
  )
}

function StepEquipment({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-4">
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">Equipment Details</h2>
        <p className="text-[13px] text-gray-400">Found on the label affixed to your unit.</p>
      </div>
      <InputField label="Serial Number" value={form.serial_number} onChange={v => set('serial_number', v)} placeholder="e.g. SN-2024-00123" required autoFocus />
      <div className="grid grid-cols-2 gap-4">
        <InputField label="Model Number" value={form.model_number} onChange={v => set('model_number', v)} placeholder="e.g. IAT-5000" required />
        <InputField label="Operating Voltage" value={form.voltage} onChange={v => set('voltage', v)} placeholder="e.g. 460V / 3-phase" required />
      </div>
    </div>
  )
}

function StepProblem({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-4">
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">Describe the Problem</h2>
        <p className="text-[13px] text-gray-400">Be as specific as possible — include when it started and any error codes or unusual behavior.</p>
      </div>
      <TextareaField
        label="Problem Description"
        value={form.problem_description}
        onChange={v => set('problem_description', v)}
        placeholder="Describe what's happening with your unit…"
        required
        rows={7}
      />
    </div>
  )
}

function StepPreCooling({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">Pre-Cooling System</h2>
        <p className="text-[13px] text-gray-400">Located on the incoming process air side of the unit.</p>
      </div>
      <BoolField label="Is a pre-cooling system installed?" value={form.pre_cooling} onChange={v => set('pre_cooling', v)} />
      {form.pre_cooling === true && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 pt-1"
        >
          <InputField label="Pre-cooling type" value={form.pre_cooling_type} onChange={v => set('pre_cooling_type', v)} placeholder="e.g. Chilled water, DX coil…" hint="Describe the type of pre-cooling installed." />
          <BoolField label="Is the pre-cooling system currently operational?" value={form.pre_cooling_working} onChange={v => set('pre_cooling_working', v)} />
        </motion.div>
      )}
    </div>
  )
}

function StepPostCooling({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">Post-Cooling System</h2>
        <p className="text-[13px] text-gray-400">Located on the outgoing process air side of the unit.</p>
      </div>
      <BoolField label="Is a post-cooling system installed?" value={form.post_cooling} onChange={v => set('post_cooling', v)} />
      {form.post_cooling === true && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-4 pt-1"
        >
          <InputField label="Post-cooling type" value={form.post_cooling_type} onChange={v => set('post_cooling_type', v)} placeholder="e.g. Chilled water, DX coil…" hint="Describe the type of post-cooling installed." />
          <BoolField label="Is the post-cooling system currently operational?" value={form.post_cooling_working} onChange={v => set('post_cooling_working', v)} />
        </motion.div>
      )}
    </div>
  )
}

function StepSystemChecks({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">System Checks</h2>
        <p className="text-[13px] text-gray-400">Record current readings and conditions where possible.</p>
      </div>
      <BoolField label="Are the process and react airflows balanced?" value={form.airflow_balanced} onChange={v => set('airflow_balanced', v)} />
      {form.airflow_balanced === false && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-2 gap-4 pt-1">
          <InputField label="Process airflow (CFM)" value={form.process_airflow_cfm} onChange={v => set('process_airflow_cfm', v)} placeholder="e.g. 1200" type="number" />
          <InputField label="React airflow (CFM)" value={form.react_airflow_cfm} onChange={v => set('react_airflow_cfm', v)} placeholder="e.g. 1200" type="number" />
        </motion.div>
      )}
      <BoolField label="Is the react heat zone working?" value={form.react_heat_working} onChange={v => set('react_heat_working', v)} />
      {form.react_heat_working === true && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-1">
          <BoolField label="Is it maintaining the 285°F setpoint?" value={form.react_heat_setpoint} onChange={v => set('react_heat_setpoint', v)} />
        </motion.div>
      )}
      <BoolField label="Are all seals in good condition?" value={form.seals_good} onChange={v => set('seals_good', v)} />
    </div>
  )
}

function StepPhotos({
  photos, setPhotos, fileInputRef, handleFiles,
}: {
  photos: File[]
  setPhotos: React.Dispatch<React.SetStateAction<File[]>>
  fileInputRef: React.RefObject<HTMLInputElement>
  handleFiles: (files: FileList | null) => void
}) {
  const removePhoto = (i: number) => setPhotos(prev => prev.filter((_, idx) => idx !== i))

  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">Photos <span className="text-gray-300 dark:text-gray-600 font-normal text-[15px]">(optional)</span></h2>
        <p className="text-[13px] text-gray-400">Upload up to 8 photos of your unit, error displays, or anything relevant.</p>
      </div>

      {/* Drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-[#089447] hover:bg-[#089447]/3 transition-all mb-4"
      >
        <Upload size={22} className="text-gray-300 dark:text-gray-600" />
        <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">Click to upload or drag & drop</p>
        <p className="text-[11px] text-gray-300 dark:text-gray-600">PNG, JPG, HEIC up to 8 files</p>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={e => handleFiles(e.target.files)}
      />

      {/* Previews */}
      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((file, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100 dark:border-gray-800">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                <button
                  onClick={e => { e.stopPropagation(); removePhoto(i) }}
                  className="opacity-0 group-hover:opacity-100 w-6 h-6 rounded-full bg-white text-gray-700 flex items-center justify-center transition-all hover:bg-red-50 hover:text-red-500"
                >
                  <X size={12} strokeWidth={3} />
                </button>
              </div>
            </div>
          ))}
          {photos.length < 8 && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 flex flex-col items-center justify-center gap-1 text-gray-300 dark:text-gray-600 hover:border-[#089447] hover:text-[#089447] transition-all"
            >
              <ImageIcon size={16} />
              <span className="text-[10px] font-medium">Add</span>
            </button>
          )}
        </div>
      )}
    </div>
  )
}
