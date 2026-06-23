'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from '@/components/Logo'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, CheckCircle, Check, Lightbulb,
  RotateCcw, Upload, X, Loader2, ImageIcon, ChevronDown, Info,
} from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// ─── Types ───────────────────────────────────────────────────────────────────

type Tri = 'yes' | 'no' | 'unsure' | ''
type Onset = 'sudden' | 'gradual' | 'unsure' | ''

type FormData = {
  customer_name: string
  customer_company: string
  customer_email: string
  customer_phone: string
  serial_number: string
  model_number: string
  voltage: string
  problem_description: string
  problem_started: string
  onset: Onset
  what_changed: string
  unit_running: boolean | null
  has_alarms: boolean | null
  alarm_details: string
  process_airflow_cfm: string
  react_airflow_cfm: string
  react_temp_f: string
  wheel_rotating: Tri
  seal_light_leakage: Tri
  external_factors: string[]
}

const EMPTY: FormData = {
  customer_name: '', customer_company: '', customer_email: '', customer_phone: '',
  serial_number: '', model_number: '', voltage: '',
  problem_description: '', problem_started: '',
  onset: '', what_changed: '',
  unit_running: null, has_alarms: null, alarm_details: '',
  process_airflow_cfm: '', react_airflow_cfm: '', react_temp_f: '',
  wheel_rotating: '', seal_light_leakage: '',
  external_factors: [],
}

// Must match the whitelist in app/api/troubleshooting/route.ts exactly, or
// unrecognized values get dropped server-side.
const EXTERNAL_FACTORS = [
  'Room construction changes',
  'Door openings',
  'People load change',
  'Process moisture load change',
  'Building pressure',
  'New equipment / process changes',
  'Weather changes',
]

const STEP_LABELS = ['Contact', 'Serial', 'Problem', 'Onset', 'Status', 'Airflow', 'Seals', 'Factors', 'Photos', 'Tips']
const TOTAL_STEPS = STEP_LABELS.length

// ─── Field sub-components ──────────────────────────────────────────────────────

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
        className="w-full text-[13px] bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all"
      />
    </div>
  )
}

function TextareaField({
  label, value, onChange, placeholder, required, hint, rows = 5, autoFocus,
}: {
  label: string; value: string; onChange: (v: string) => void
  placeholder?: string; required?: boolean; hint?: string; rows?: number; autoFocus?: boolean
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
        autoFocus={autoFocus}
        className="w-full text-[13px] bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 text-gray-800 dark:text-gray-100 placeholder-gray-300 dark:placeholder-gray-600 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all resize-none leading-relaxed"
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
      <div className="flex gap-2" role="radiogroup" aria-label={label}>
        {([true, false] as const).map(v => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            onClick={() => onChange(value === v ? null : v)}
            className={`px-5 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
              value === v
                ? v
                  ? 'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700'
                  : 'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-300 dark:border-red-700'
                : 'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'
            }`}
          >
            {v ? 'Yes' : 'No'}
          </button>
        ))}
      </div>
    </div>
  )
}

type Tone = 'good' | 'bad' | 'unsure' | 'neutral'

const TONE_SELECTED: Record<Tone, string> = {
  good:    'bg-green-50 dark:bg-green-950/40 text-green-600 dark:text-green-400 border-green-300 dark:border-green-700',
  bad:     'bg-red-50 dark:bg-red-950/40 text-red-500 dark:text-red-400 border-red-300 dark:border-red-700',
  unsure:  'bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700',
  neutral: 'bg-[#089447]/10 dark:bg-[#089447]/20 text-[#089447] border-[#089447]/50',
}
const TONE_IDLE =
  'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-400 hover:border-gray-300 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-200'

// Single-select button group. Click the active option again to clear it.
function ChoiceField({
  label, hint, value, options, onChange,
}: {
  label: string; hint?: string; value: string
  options: { value: string; label: string; tone?: Tone }[]
  onChange: (v: string) => void
}) {
  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
      {hint && <p className="text-[12px] text-gray-400 mb-2 leading-relaxed">{hint}</p>}
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={label}>
        {options.map(opt => {
          const selected = value === opt.value
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(selected ? '' : opt.value)}
              className={`px-5 py-2 rounded-xl text-[13px] font-semibold border transition-all ${
                selected ? TONE_SELECTED[opt.tone ?? 'neutral'] : TONE_IDLE
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Multi-select checklist.
function MultiChoiceField({
  label, hint, values, options, onChange,
}: {
  label: string; hint?: string; values: string[]; options: string[]; onChange: (v: string[]) => void
}) {
  const toggle = (opt: string) =>
    onChange(values.includes(opt) ? values.filter(v => v !== opt) : [...values, opt])

  return (
    <div>
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-200 mb-1.5">{label}</label>
      {hint && <p className="text-[12px] text-gray-400 mb-2 leading-relaxed">{hint}</p>}
      <div className="flex flex-col gap-2" role="group" aria-label={label}>
        {options.map(opt => {
          const checked = values.includes(opt)
          return (
            <button
              key={opt}
              type="button"
              role="checkbox"
              aria-checked={checked}
              onClick={() => toggle(opt)}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-[13px] font-medium border text-left transition-all ${
                checked
                  ? 'bg-[#089447]/8 dark:bg-[#089447]/15 border-[#089447]/40 text-gray-800 dark:text-gray-100'
                  : 'bg-white dark:bg-zinc-800/50 border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center flex-shrink-0 transition-all ${
                checked ? 'bg-[#089447] border-[#089447]' : 'border-gray-300 dark:border-zinc-600'
              }`}>
                {checked && <Check size={11} strokeWidth={3} className="text-white" />}
              </span>
              {opt}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── In-flow desiccant coaching (rule-based, opt-in) ───────────────────────────

// Collapsed "learn more" disclosure — expert guidance is there when wanted but
// doesn't lengthen the flow.
function Coaching({ label, children }: { label: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50/70 dark:bg-zinc-800/30">
      <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
        className="w-full flex items-center gap-2 px-3.5 py-2.5 text-left">
        <Lightbulb size={14} className="text-amber-500 flex-shrink-0" />
        <span className="text-[12px] font-semibold text-gray-600 dark:text-gray-300 flex-1">{label}</span>
        <ChevronDown size={14} className={`text-gray-400 flex-shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-3.5 pb-3.5 pt-0.5 text-[12px] text-gray-500 dark:text-gray-400 leading-relaxed space-y-2">
          {children}
        </div>
      )}
    </div>
  )
}

// Short, auto-shown note that reacts to an entered value.
function CoachNote({ tone = 'amber', children }: { tone?: 'amber' | 'sky'; children: React.ReactNode }) {
  const cls = tone === 'sky'
    ? 'text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/30 border-sky-100 dark:border-sky-900/40'
    : 'text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/30 border-amber-100 dark:border-amber-900/40'
  return (
    <div className={`flex items-start gap-2 text-[12px] rounded-xl border px-3 py-2 leading-relaxed ${cls}`}>
      <Info size={13} className="flex-shrink-0 mt-0.5" />
      <span>{children}</span>
    </div>
  )
}

// Process:react airflow ratio + which application band it falls in.
function airflowRatio(processStr: string, reactStr: string): { label: string; band: string } | null {
  const p = parseFloat(processStr), r = parseFloat(reactStr)
  if (!isFinite(p) || !isFinite(r) || p <= 0 || r <= 0) return null
  const ratio = p / r
  const rounded = Math.round(ratio * 10) / 10
  let band: string
  if (ratio < 2.5)       band = 'lower than the usual ~3:1 — worth double-checking the readings'
  else if (ratio <= 3.5) band = 'right in the typical ~3:1 range for most applications'
  else if (ratio <= 5.5) band = 'typical for lower-grain applications (4–5:1)'
  else if (ratio <= 7.5) band = 'typical only for very low-grain applications (6–7:1)'
  else                   band = 'higher than usual (>7:1) — worth double-checking the readings'
  return { label: `${rounded}:1`, band }
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Stage = 'form' | 'loading' | 'success'

export default function TroubleshootingChecklistForm() {
  const [step, setStep] = useState(1)
  const [dir, setDir] = useState(1)
  const [form, setForm] = useState<FormData>(EMPTY)
  const [photos, setPhotos] = useState<File[]>([])
  const [stage, setStage] = useState<Stage>('form')
  const [reference, setReference] = useState('')
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [recommendations, setRecommendations] = useState<string[]>([])
  const [analyzing, setAnalyzing] = useState(false)
  const [analyzed, setAnalyzed] = useState(false)
  const [analyzeError, setAnalyzeError] = useState<string | null>(null)

  const set = useCallback(<K extends keyof FormData>(key: K, val: FormData[K]) => {
    setForm(f => ({ ...f, [key]: val }))
  }, [])

  // In-form AI: generate tips from the answers so far when the customer reaches
  // the final "AI Analysis" card. Stateless; the submit reuses these tips.
  const analyze = useCallback(async () => {
    setAnalyzing(true)
    setAnalyzeError(null)
    try {
      const res = await fetch('/api/troubleshooting/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const json = await res.json()
      setRecommendations(Array.isArray(json.recommendations) ? json.recommendations : [])
      setAnalyzed(true)
    } catch {
      setAnalyzeError('We could not generate suggestions right now — you can still submit and our team will follow up.')
    } finally {
      setAnalyzing(false)
    }
  }, [form])

  // Auto-run once when they land on the AI Analysis card. The analyzeError guard
  // prevents an auto-retry loop on persistent failure (manual retry clears it).
  useEffect(() => {
    if (step === TOTAL_STEPS && !analyzed && !analyzing && !analyzeError) analyze()
  }, [step, analyzed, analyzing, analyzeError, analyze])

  const canAdvance = () => {
    if (step === 1) {
      const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.customer_email.trim())
      return !!form.customer_name.trim() && emailOk
    }
    if (step === 2) return !!form.serial_number.trim()
    if (step === 3) return !!form.problem_description.trim()
    return true
  }

  const go = (next: number) => {
    setDir(next > step ? 1 : -1)
    setStep(next)
  }

  const handleNext = () => { if (canAdvance() && step < TOTAL_STEPS) go(step + 1) }
  const handleBack = () => { if (step > 1) go(step - 1) }

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const valid = Array.from(files).filter(f => f.type.startsWith('image/'))
    setPhotos(prev => [...prev, ...valid].slice(0, 8))
  }

  const handleSubmit = async () => {
    if (!canAdvance()) return
    setStage('loading')
    setError(null)

    try {
      const photo_urls: string[] = []
      if (photos.length > 0) {
        const sb = createSupabaseBrowser()
        for (const file of photos) {
          const ext = file.name.split('.').pop() ?? 'jpg'
          const filename = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
          const { data, error: upErr } = await sb.storage.from('ticket-photos').upload(filename, file, { upsert: false })
          if (upErr) throw new Error('We could not upload your photos. Please try again, or remove them and resubmit.')
          if (data) {
            const { data: pub } = sb.storage.from('ticket-photos').getPublicUrl(data.path)
            if (pub?.publicUrl) photo_urls.push(pub.publicUrl)
          }
        }
      }

      const res = await fetch('/api/troubleshooting', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, photo_urls, ai_recommendations: recommendations }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Submission failed')
      if (Array.isArray(json.ai_recommendations)) setRecommendations(json.ai_recommendations)
      setReference(json.reference_number)
      setStage('success')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setStage('form')
    }
  }

  // ── Loading ──────────────────────────────────────────────────────────────
  if (stage === 'loading') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 size={36} className="text-[#089447] animate-spin" />
          <p className="text-[15px] font-semibold text-gray-700 dark:text-gray-200">Submitting your checklist…</p>
          <p className="text-[13px] text-gray-400">Saving your case and alerting our team</p>
        </div>
      </div>
    )
  }

  // ── Success ──────────────────────────────────────────────────────────────
  if (stage === 'success') {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">
        <header className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3">
          <Logo size={28} className="flex-shrink-0" />
          <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">IAT Support</span>
        </header>

        <div className="flex-1 flex items-start justify-center py-12 px-4">
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-2xl bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden"
            style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 24px 64px rgba(0,0,0,0.10)' }}
          >
            <div className="bg-gradient-to-r from-[#089447]/10 to-[#089447]/5 dark:from-[#089447]/20 dark:to-[#089447]/5 px-8 py-8 border-b border-[#089447]/10 dark:border-[#089447]/20">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-[#089447]/10 dark:bg-[#089447]/20 flex items-center justify-center flex-shrink-0">
                  <CheckCircle size={24} className="text-[#089447]" strokeWidth={2.5} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-[#089447]/70 uppercase tracking-widest mb-0.5">Checklist Submitted</p>
                  <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">Thanks — we have your data.</h1>
                </div>
              </div>
              <div className="bg-white/60 dark:bg-zinc-900/60 rounded-xl px-4 py-3 border border-[#089447]/15">
                <p className="text-[11px] text-gray-400 mb-0.5">For your records</p>
                <p className="text-[20px] font-bold font-mono text-[#089447] tracking-wider">{reference}</p>
              </div>
              <p className="text-[13px] text-gray-500 dark:text-gray-400 mt-3 leading-relaxed">
                Our service team will review your checklist and reach out to <strong className="text-gray-700 dark:text-gray-200">{form.customer_email}</strong> shortly.
              </p>
              <Link
                href={`/support/status?ticket=${encodeURIComponent(reference)}`}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#089447] hover:text-[#077a3c] mt-3 transition-colors"
              >
                Track this request&apos;s status
                <ArrowRight size={14} />
              </Link>
            </div>

            {/* AI tips (same set shown on the pre-submit card) */}
            {recommendations.length > 0 && (
              <div className="px-8 py-6 border-b border-gray-100 dark:border-zinc-800">
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

            <div className="px-8 py-5 flex items-center justify-between gap-4">
              <button
                onClick={() => { setForm(EMPTY); setPhotos([]); setStep(1); setStage('form'); setRecommendations([]); setAnalyzed(false); setAnalyzeError(null) }}
                className="flex items-center gap-2 text-[13px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <RotateCcw size={14} />
                Submit another checklist
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
    <div className="min-h-screen bg-gray-50 dark:bg-zinc-950 flex flex-col">

      {/* Header */}
      <header className="px-6 py-4 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3">
        <Logo size={28} className="flex-shrink-0" />
        <span className="text-[14px] font-semibold text-gray-700 dark:text-gray-200">IAT Support</span>
        <span className="text-gray-200 dark:text-gray-700 mx-1">/</span>
        <span className="text-[14px] text-gray-400">Troubleshooting Checklist</span>
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
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-300 dark:text-gray-600'
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
          <div className="h-1 bg-gray-100 dark:bg-zinc-800 rounded-full mt-1">
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
              className="w-full bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-7"
              style={{ boxShadow: '0 0 0 1px rgba(0,0,0,0.04), 0 8px 32px rgba(0,0,0,0.06)' }}
            >
              {step === 1 && <StepContact form={form} set={set} />}
              {step === 2 && <StepEquipment form={form} set={set} />}
              {step === 3 && <StepProblem form={form} set={set} />}
              {step === 4 && <StepOnset form={form} set={set} />}
              {step === 5 && <StepStatus form={form} set={set} />}
              {step === 6 && <StepAirflow form={form} set={set} />}
              {step === 7 && <StepSeals form={form} set={set} />}
              {step === 8 && <StepFactors form={form} set={set} />}
              {step === 9 && <StepPhotos photos={photos} setPhotos={setPhotos} fileInputRef={fileInputRef} handleFiles={handleFiles} />}
              {step === 10 && <StepAiAnalysis recommendations={recommendations} analyzing={analyzing} analyzed={analyzed} error={analyzeError} onRetry={analyze} />}
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
              Submit Checklist <ArrowRight size={15} />
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

function StepHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-5">
      <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1">{title}</h2>
      <p className="text-[13px] text-gray-400">{sub}</p>
    </div>
  )
}

function StepContact({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-4">
      <StepHeader title="Contact Information" sub="We'll use this to follow up on your request." />
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
      <StepHeader title="Serial Number" sub="Found on the label affixed to your unit." />
      <div className="flex items-start gap-2 text-[12px] text-[#067838] dark:text-[#34d873] bg-[#089447]/8 dark:bg-[#089447]/15 border border-[#089447]/20 rounded-xl px-3.5 py-2.5 leading-relaxed">
        <span className="font-bold">Why first?</span>
        <span>The serial number lets us pull your unit&apos;s drawings, airflow data, and history — so we can troubleshoot accurately.</span>
      </div>
      <InputField label="Serial Number" value={form.serial_number} onChange={v => set('serial_number', v)} placeholder="e.g. SN-2024-00123" required autoFocus />
      <div className="grid grid-cols-2 gap-4">
        <InputField label="Model Number" value={form.model_number} onChange={v => set('model_number', v)} placeholder="e.g. IAT-5000" />
        <InputField label="Operating Voltage" value={form.voltage} onChange={v => set('voltage', v)} placeholder="e.g. 460V / 3-phase" />
      </div>
    </div>
  )
}

function StepProblem({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-4">
      <StepHeader title="Describe the Problem" sub="Be specific — what exactly is happening, and any error codes or unusual behavior." />
      <TextareaField
        label="What's happening?"
        value={form.problem_description}
        onChange={v => set('problem_description', v)}
        placeholder="e.g. Humidity in the room has climbed to 60% RH over the past week and the unit isn't keeping up…"
        required
        rows={6}
        autoFocus
      />
      <InputField label="When did it start?" value={form.problem_started} onChange={v => set('problem_started', v)} placeholder="e.g. Last Tuesday, about 3 days ago" hint="A rough date or timeframe is fine." />
    </div>
  )
}

function StepOnset({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <StepHeader title="Sudden or Gradual?" sub="This is the single most useful clue — it points us at very different causes." />
      <ChoiceField
        label="Did performance drop suddenly, or fade gradually?"
        value={form.onset}
        onChange={v => set('onset', v as Onset)}
        options={[
          { value: 'sudden', label: 'Suddenly' },
          { value: 'gradual', label: 'Gradually' },
          { value: 'unsure', label: 'Not sure', tone: 'unsure' },
        ]}
      />
      <InputField label="Anything change right before it started?" value={form.what_changed} onChange={v => set('what_changed', v)} placeholder="e.g. New process line, power outage, weather, filter change…" hint="Optional — even small changes can matter." />
      <Coaching label="What sudden vs. gradual usually points to">
        <p><strong className="text-gray-600 dark:text-gray-300">Sudden</strong> → heater failure · fan failure · power outage · control or sensor issue · VFD fault.</p>
        <p><strong className="text-gray-600 dark:text-gray-300">Gradual</strong> → dirty filters · desiccant wheel aging · airflow drift · seal wear · coil fouling · a changed room/process load.</p>
      </Coaching>
    </div>
  )
}

function StepStatus({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <StepHeader title="Current Status" sub="What's the unit doing right now?" />
      <BoolField label="Is the unit currently running?" value={form.unit_running} onChange={v => set('unit_running', v)} />
      <BoolField label="Any active alarms or fault messages?" value={form.has_alarms} onChange={v => set('has_alarms', v)} />
      {form.has_alarms === true && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pt-1">
          <InputField label="Alarm / fault details" value={form.alarm_details} onChange={v => set('alarm_details', v)} placeholder="e.g. E04 high-temp fault on the controller" hint="Include any codes shown on the display." />
        </motion.div>
      )}
    </div>
  )
}

function StepAirflow({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-4">
      <StepHeader title="Airflow & Reactivation" sub="If you have these readings, they help a lot. Skip any you don't — a technician can verify on-site." />
      <div className="grid grid-cols-2 gap-4">
        <InputField label="Process airflow (CFM)" value={form.process_airflow_cfm} onChange={v => set('process_airflow_cfm', v)} placeholder="e.g. 1200" type="number" />
        <InputField label="React airflow (CFM)" value={form.react_airflow_cfm} onChange={v => set('react_airflow_cfm', v)} placeholder="e.g. 350" type="number" />
      </div>
      <InputField label="Reactivation temperature (°F)" value={form.react_temp_f} onChange={v => set('react_temp_f', v)} placeholder="e.g. 285" type="number" hint="Usually shown on the controller display." />
      {(() => {
        const r = airflowRatio(form.process_airflow_cfm, form.react_airflow_cfm)
        return r ? <CoachNote tone="sky">Process : React airflow ≈ <strong>{r.label}</strong> — {r.band}.</CoachNote> : null
      })()}
      {Number(form.react_temp_f) > 320 && (
        <CoachNote>A reactivation temp above ~320°F often points to an airflow restriction — worth checking filters and process airflow.</CoachNote>
      )}
      <Coaching label="What good airflow & reactivation look like">
        <p><strong className="text-gray-600 dark:text-gray-300">Airflow ratio (process : react):</strong> ≈3:1 for most applications, 4–5:1 for lower grain, 6–7:1 for very low grain.</p>
        <p><strong className="text-gray-600 dark:text-gray-300">Reactivation temp:</strong> ~285°F is the usual design target. More airflow runs cooler, less airflow runs hotter; sustained readings above ~320°F usually signal an airflow problem.</p>
      </Coaching>
    </div>
  )
}

function StepSeals({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <StepHeader title="Wheel & Seals" sub="A quick visual check of the desiccant wheel and its seals." />
      <ChoiceField
        label="Is the desiccant wheel rotating?"
        value={form.wheel_rotating}
        onChange={v => set('wheel_rotating', v as Tri)}
        options={[
          { value: 'yes', label: 'Yes', tone: 'good' },
          { value: 'no', label: 'No', tone: 'bad' },
          { value: 'unsure', label: 'Not sure', tone: 'unsure' },
        ]}
      />
      <ChoiceField
        label="Any visible light leakage at the seals?"
        hint="Look along the seal edges with the unit lit from the other side. Visible light means air is bypassing the wheel."
        value={form.seal_light_leakage}
        onChange={v => set('seal_light_leakage', v as Tri)}
        options={[
          { value: 'yes', label: 'Yes — light visible', tone: 'bad' },
          { value: 'no', label: 'No leakage', tone: 'good' },
          { value: 'unsure', label: 'Not sure', tone: 'unsure' },
        ]}
      />
      {form.wheel_rotating === 'no' && (
        <CoachNote>If the wheel isn&apos;t turning, the unit can&apos;t dry the air — the drive motor, belt, and chain/coupling are the first things to check.</CoachNote>
      )}
      {form.seal_light_leakage === 'yes' && (
        <CoachNote>Visible light means process air is bypassing the wheel instead of being dried — the seals likely need adjustment or replacement.</CoachNote>
      )}
      <Coaching label="Wheel & seal health — what to look for">
        <p><strong className="text-gray-600 dark:text-gray-300">Rotation:</strong> the wheel should turn steadily without slipping, ideally at the speed on your submittal/design data.</p>
        <p><strong className="text-gray-600 dark:text-gray-300">Desiccant age:</strong> wheels are the opposite of fine wine — the media slowly degrades with age, which gradually cuts drying capacity.</p>
        <p><strong className="text-gray-600 dark:text-gray-300">Seals (business-card test):</strong> a card should <em>barely</em> slide through — too loose means leakage. Standard units have 6 seals; purge units have 8.</p>
      </Coaching>
    </div>
  )
}

function StepFactors({ form, set }: { form: FormData; set: SetFn }) {
  return (
    <div className="space-y-4">
      <StepHeader title="External Factors" sub="Sometimes the unit is fine and the load changed. Select anything that applies." />
      <MultiChoiceField
        label="Has anything changed in the space or process?"
        values={form.external_factors}
        options={EXTERNAL_FACTORS}
        onChange={v => set('external_factors', v)}
      />
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
        <p className="text-[13px] text-gray-400">Photos of the unit, the control panel, and any error displays help our team a lot.</p>
      </div>

      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); handleFiles(e.dataTransfer.files) }}
        className="border-2 border-dashed border-gray-200 dark:border-zinc-700 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-[#089447] hover:bg-[#089447]/3 transition-all mb-4"
      >
        <Upload size={22} className="text-gray-300 dark:text-gray-600" />
        <p className="text-[13px] font-medium text-gray-500 dark:text-gray-400">Click to upload or drag &amp; drop</p>
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

      {photos.length > 0 && (
        <div className="grid grid-cols-4 gap-2">
          {photos.map((file, i) => (
            <div key={i} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-100 dark:border-zinc-800">
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
              className="aspect-square rounded-xl border-2 border-dashed border-gray-200 dark:border-zinc-700 flex flex-col items-center justify-center gap-1 text-gray-300 dark:text-gray-600 hover:border-[#089447] hover:text-[#089447] transition-all"
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

function StepAiAnalysis({
  recommendations, analyzing, analyzed, error, onRetry,
}: {
  recommendations: string[]
  analyzing: boolean
  analyzed: boolean
  error: string | null
  onRetry: () => void
}) {
  return (
    <div>
      <div className="mb-5">
        <h2 className="text-[18px] font-bold text-gray-900 dark:text-white mb-1 flex items-center gap-2">
          <Lightbulb size={18} className="text-amber-500" /> AI Quick Analysis
        </h2>
        <p className="text-[13px] text-gray-400">Based on your answers — a few safe things you can check now while our team reviews your case.</p>
      </div>

      {analyzing && (
        <div className="flex items-center gap-3 bg-gray-50 dark:bg-zinc-800/40 rounded-xl px-4 py-5 border border-gray-100 dark:border-zinc-800">
          <Loader2 size={18} className="text-[#089447] animate-spin flex-shrink-0" />
          <p className="text-[13px] text-gray-500 dark:text-gray-400">Analyzing your answers…</p>
        </div>
      )}

      {!analyzing && error && (
        <div className="text-[13px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-4">
          <p className="mb-2">{error}</p>
          <button type="button" onClick={onRetry} className="text-[13px] font-semibold text-[#089447] hover:text-[#077a3c]">Try again</button>
        </div>
      )}

      {!analyzing && !error && recommendations.length > 0 && (
        <div className="space-y-3">
          {recommendations.map((rec, i) => (
            <div key={i} className="flex gap-3 bg-amber-50/50 dark:bg-amber-950/20 rounded-xl px-4 py-3 border border-amber-100 dark:border-amber-900/30">
              <span className="flex-shrink-0 w-5 h-5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-400 text-[11px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
              <p className="text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed">{rec}</p>
            </div>
          ))}
          <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">AI-generated suggestions — if unsure, wait for your service technician. Submit below and our team will follow up.</p>
        </div>
      )}

      {!analyzing && !error && analyzed && recommendations.length === 0 && (
        <div className="text-[13px] text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-zinc-800/40 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-4">
          No specific automated suggestions for this combination — our team will review your details and follow up. Go ahead and submit.
        </div>
      )}
    </div>
  )
}
