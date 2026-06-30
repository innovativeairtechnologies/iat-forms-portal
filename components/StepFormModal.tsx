'use client'

import { useEffect, useMemo, useState, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, ChevronLeft, ChevronRight, CheckCircle,
  AlertCircle, Loader2, ArrowLeft, Zap, RotateCcw, Check,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '@/lib/supabase'
import type { Form, FormField } from '@/lib/supabase'
import { visibleFields, stripHiddenAnswers } from '@/lib/forms'
import SelectChipField from './fields/SelectChipField'
import FileField from './fields/FileField'
import SignatureField from './fields/SignatureField'

type Step = { title: string | null; fields: FormField[] }

// Weight of each field type when deciding how much a step can hold.
// Heavier fields are taller on screen and fill the viewport faster.
const FIELD_WEIGHT: Record<string, number> = {
  text: 1, email: 1, number: 1, date: 1, select: 1, file: 1,
  radio: 2, checkbox: 2, textarea: 2,
  signature: 6,
}
const MAX_STEP_WEIGHT = 8

function groupFieldsIntoSteps(fields: FormField[]): Step[] {
  const steps: Step[] = []
  let pending: FormField[] = []
  let weight = 0
  let sectionTitle: string | null = null
  let contIndex = 0  // how many steps we've flushed for the current section

  const flush = () => {
    if (pending.length === 0) return
    const title = contIndex === 0 ? sectionTitle : `${sectionTitle} (Cont.)`
    steps.push({ title, fields: pending })
    pending = []
    weight = 0
    contIndex++
  }

  for (const field of fields) {
    if (field.field_type === 'section_header') {
      flush()
      sectionTitle = field.label
      contIndex = 0
    } else {
      const w = FIELD_WEIGHT[field.field_type] ?? 1
      if (pending.length > 0 && weight + w > MAX_STEP_WEIGHT) flush()
      pending.push(field)
      weight += w
    }
  }

  flush()
  return steps
}

// ── Draft autosave (stop mid-form, resume later) ─────────────────────────────
// Two modes. Logged-in portal fills (serverDrafts) save to the user's ACCOUNT via
// /api/drafts, so a draft started on one device can be resumed on another. Anon
// public-link fills fall back to this browser's localStorage. Either way an
// accidental close / refresh / crash never loses progress; cleared on submit.

const DRAFT_PREFIX = 'iat-form-draft:'
const localKey = (slug: string) => `${DRAFT_PREFIX}${slug}`

type LocalDraft = { answers: Record<string, unknown>; currentStep: number; savedAt: number }

// Keep only serializable answers — File/Blob values exist transiently before upload
// and can't be stored in a draft.
function serializableAnswers(answers: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(answers)) {
    if (v instanceof File || v instanceof Blob) continue
    if (Array.isArray(v) && v.some((x) => x instanceof File || x instanceof Blob)) continue
    out[k] = v
  }
  return out
}

function readLocalDraft(slug: string): LocalDraft | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(localKey(slug))
    if (!raw) return null
    const d = JSON.parse(raw) as LocalDraft
    if (d?.answers && typeof d.answers === 'object' && Object.keys(d.answers).length > 0) return d
  } catch { /* corrupt / unavailable */ }
  return null
}

function writeLocalDraft(slug: string, draft: LocalDraft) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(localKey(slug), JSON.stringify({ ...draft, answers: serializableAnswers(draft.answers) }))
  } catch { /* quota / unavailable */ }
}

function clearLocalDraft(slug: string) {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(localKey(slug)) } catch { /* ignore */ }
}

// A short label for the Resume list — who the form is about, if present.
function deriveDraftLabel(answers: Record<string, unknown>): string | null {
  for (const k of ['Employee Name', 'Full Name', 'Name']) {
    const v = answers[k]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return null
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)} min ago`
  if (s < 86400) return `${Math.floor(s / 3600)} hr ago`
  const d = Math.floor(s / 86400)
  return `${d} day${d === 1 ? '' : 's'} ago`
}

type ResumeDraft = { id: string; data: Record<string, unknown>; currentStep: number; updatedAt?: string }

interface Props {
  slug: string
  onClose?: () => void          // omit for standalone page mode
  serverDrafts?: boolean        // save/resume drafts on the logged-in user's account (cross-device)
  resumeDraft?: ResumeDraft     // open a specific saved draft from the "Resume" list
}

export default function StepFormModal({ slug, onClose, serverDrafts = false, resumeDraft }: Props) {
  const standalone = !onClose
  const router = useRouter()

  const [form, setForm]       = useState<Form | null>(null)
  const [fields, setFields]   = useState<FormField[]>([])
  const [loading, setLoading] = useState(true)

  const [currentStep, setCurrentStep]   = useState(0)
  const [direction, setDirection]       = useState(1)
  const [answers, setAnswers]           = useState<Record<string, unknown>>({})
  const [errors, setErrors]             = useState<Record<string, string>>({})
  const [submitting, setSubmitting]     = useState(false)
  const [submitted, setSubmitted]       = useState(false)
  const [submitError, setSubmitError]   = useState<string | null>(null)
  // Autosave/resume: `draftIdRef` is the server draft's id (set when resuming, or
  // minted on first save); `draftRestoredAt` drives the resume banner; `lastSavedAt`
  // drives the "Saved" cue.
  const draftIdRef = useRef<string | null>(null)
  const [draftRestoredAt, setDraftRestoredAt] = useState<number | null>(null)
  const [lastSavedAt, setLastSavedAt]         = useState<number | null>(null)

  // Steps are derived from the *visible* fields, so department-conditional fields
  // appear/disappear as answers change and empty sections collapse to no step.
  const steps = useMemo(() => groupFieldsIntoSteps(visibleFields(fields, answers)), [fields, answers])

  // Ref so keyboard handler always calls the latest next/submit without stale closure
  const advanceRef = useRef<() => void>(() => {})

  // ── Data loading ────────────────────────────────────────────────────────────
  useEffect(() => {
    let cancelled = false
    setLoading(true); setCurrentStep(0); setAnswers({}); setErrors({}); setSubmitted(false)
    setDraftRestoredAt(null); setLastSavedAt(null)
    draftIdRef.current = resumeDraft?.id ?? null

    async function load() {
      const { data: formData } = await supabase
        .from('forms').select('*').eq('slug', slug).eq('is_active', true).single()
      if (cancelled || !formData) { setLoading(false); return }

      const { data: fieldsData } = await supabase
        .from('form_fields').select('*').eq('form_id', formData.id).order('sort_order')

      if (!cancelled) {
        setForm(formData)
        setFields(fieldsData || [])
        // Restore progress: a specific account draft (from the Resume list), else
        // this browser's local draft for anon public-link fills.
        if (resumeDraft) {
          setAnswers(resumeDraft.data || {})
          setCurrentStep(resumeDraft.currentStep || 0)   // clamped by the steps effect below
          setDraftRestoredAt(resumeDraft.updatedAt ? Date.parse(resumeDraft.updatedAt) : Date.now())
        } else if (!serverDrafts) {
          const local = readLocalDraft(slug)
          if (local) {
            setAnswers(local.answers)
            setCurrentStep(local.currentStep || 0)
            setDraftRestoredAt(local.savedAt || Date.now())
          }
        }
        setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [slug, serverDrafts, resumeDraft])

  // If conditional fields collapse steps (e.g. a department change), keep the index valid.
  useEffect(() => {
    if (currentStep > steps.length - 1) setCurrentStep(Math.max(0, steps.length - 1))
  }, [steps.length, currentStep])

  // ── Autosave the in-progress form so it can be resumed ──────────────────────
  // serverDrafts → the user's account (cross-device) via /api/drafts; otherwise →
  // this browser's localStorage. Debounced; skips the empty initial state so it
  // never overwrites a real draft with nothing.
  useEffect(() => {
    if (loading || submitted) return
    if (Object.keys(answers).length === 0) return
    const t = setTimeout(() => {
      if (serverDrafts) {
        if (!form) return
        if (!draftIdRef.current) {
          draftIdRef.current = (typeof crypto !== 'undefined' && crypto.randomUUID)
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.round(Math.random() * 1e9)}`
        }
        fetch('/api/drafts', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            id: draftIdRef.current,
            form_id: form.id,
            data: serializableAnswers(answers),
            current_step: currentStep,
            label: deriveDraftLabel(answers),
          }),
        }).then((r) => { if (r.ok) setLastSavedAt(Date.now()) }).catch(() => { /* offline — keep trying on next change */ })
      } else {
        writeLocalDraft(slug, { answers, currentStep, savedAt: Date.now() })
        setLastSavedAt(Date.now())
      }
    }, 600)
    return () => clearTimeout(t)
  }, [answers, currentStep, loading, submitted, serverDrafts, slug, form])

  // ── Body scroll lock (overlay mode only) ───────────────────────────────────
  useEffect(() => {
    if (standalone) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [standalone])

  // ── Escape → close (overlay mode only) ─────────────────────────────────────
  useEffect(() => {
    if (standalone) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [standalone, onClose])

  // ── Enter → advance step (skip textarea / button) ──────────────────────────
  useEffect(() => {
    if (loading || submitted) return
    const h = (e: KeyboardEvent) => {
      if (e.key !== 'Enter') return
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'TEXTAREA' || tag === 'BUTTON') return
      e.preventDefault()
      advanceRef.current()
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [loading, submitted])

  // ── Field change ────────────────────────────────────────────────────────────
  const handleChange = useCallback((label: string, value: unknown) => {
    setAnswers(p => ({ ...p, [label]: value }))
    setErrors(p => { const n = { ...p }; delete n[label]; return n })
  }, [])

  // Discard the saved draft and start the form over.
  const discardDraft = useCallback(() => {
    if (serverDrafts) {
      if (draftIdRef.current) fetch(`/api/drafts?id=${encodeURIComponent(draftIdRef.current)}`, { method: 'DELETE' }).catch(() => {})
      draftIdRef.current = null
    } else {
      clearLocalDraft(slug)
    }
    setAnswers({}); setCurrentStep(0); setErrors({})
    setDraftRestoredAt(null); setLastSavedAt(null); setSubmitError(null)
  }, [serverDrafts, slug])

  // ── Auto-fill (test helper) ─────────────────────────────────────────────────
  const autofill = useCallback(() => {
    const today = new Date().toISOString().split('T')[0]
    const filled: Record<string, unknown> = { ...answers }
    for (const step of steps) {
      for (const f of step.fields) {
        if (f.field_type === 'section_header') continue
        if (f.field_type === 'file' || f.field_type === 'signature') continue
        if (filled[f.label] !== undefined && filled[f.label] !== '' && filled[f.label] !== null) continue
        switch (f.field_type) {
          case 'text':
          case 'number':
          case 'textarea':
            filled[f.label] = f.placeholder || 'Test value'
            break
          case 'email':
            filled[f.label] = f.placeholder || 'test@example.com'
            break
          case 'date':
            filled[f.label] = today
            break
          case 'radio':
          case 'select':
            filled[f.label] = f.options?.[0] ?? ''
            break
          case 'checkbox':
            filled[f.label] = f.options ? [f.options[0]] : []
            break
        }
      }
    }
    setAnswers(filled)
    setErrors({})
  }, [steps, answers])

  // ── Per-step validation ─────────────────────────────────────────────────────
  const validateStep = (idx: number): boolean => {
    const errs: Record<string, string> = {}
    for (const field of steps[idx]?.fields ?? []) {
      if (!field.is_required) continue
      const val = answers[field.label]
      if (val === undefined || val === null || val === '') {
        errs[field.label] = 'This field is required.'
      } else if (Array.isArray(val) && val.length === 0) {
        errs[field.label] = 'Please select at least one option.'
      } else if (field.field_type === 'email') {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val)))
          errs[field.label] = 'Please enter a valid email address.'
      }
    }
    setErrors(errs)
    return Object.keys(errs).length === 0
  }

  const next = () => {
    if (!validateStep(currentStep)) return
    setDirection(1); setCurrentStep(s => s + 1); setSubmitError(null)
  }

  const back = () => {
    setDirection(-1); setCurrentStep(s => s - 1); setErrors({}); setSubmitError(null)
  }

  const submit = async () => {
    if (!validateStep(currentStep) || !form) return
    setSubmitting(true); setSubmitError(null)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id: form.id, data: stripHiddenAnswers(fields, answers) }),
      })
      if (!res.ok) throw new Error()
      // submitted → drop the saved draft so it doesn't linger in "Resume"
      if (serverDrafts) {
        if (draftIdRef.current) fetch(`/api/drafts?id=${encodeURIComponent(draftIdRef.current)}`, { method: 'DELETE' }).catch(() => {})
      } else {
        clearLocalDraft(slug)
      }
      setSubmitted(true)
    } catch {
      setSubmitError('Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const isLastStep = currentStep === steps.length - 1

  // Keep advanceRef pointing at the latest action
  advanceRef.current = isLastStep ? submit : next

  const handleClose = () => standalone ? router.push('/forms') : onClose?.()

  // ── Progress calculation ────────────────────────────────────────────────────
  const progressPct = submitted
    ? 100
    : steps.length <= 1
    ? 0
    : (currentStep / (steps.length - 1)) * 100

  // ── Progress bar (dots only when ≤10 steps, bar-only for longer forms) ──────
  const showDots = steps.length <= 10
  const progressBar = !loading && form && !submitted && (
    <div className="px-6 pt-5 pb-1">
      <div className="relative flex items-center" style={{ height: showDots ? 16 : 6 }}>
        <div className="absolute inset-x-0 h-[3px] bg-gray-100 dark:bg-zinc-800 rounded-full" />
        <motion.div
          className="absolute left-0 h-[3px] bg-[#089447] rounded-full"
          animate={{ width: `${progressPct}%` }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        />
        {showDots && steps.map((_, i) => {
          const pct   = steps.length <= 1 ? 0 : (i / (steps.length - 1)) * 100
          const done  = i < currentStep
          const active = i === currentStep
          return (
            <motion.div
              key={i}
              className={`absolute -translate-x-1/2 rounded-full border-2 z-10 ${
                done   ? 'bg-[#089447] border-[#089447]'
                : active ? 'bg-white dark:bg-zinc-900 border-[#089447]'
                :          'bg-white dark:bg-zinc-800 border-gray-200 dark:border-gray-600'
              }`}
              style={{ left: `${pct}%` }}
              animate={{ width: active ? 14 : 10, height: active ? 14 : 10 }}
              transition={{ duration: 0.2 }}
            />
          )
        })}
      </div>
    </div>
  )

  // ── Card ────────────────────────────────────────────────────────────────────
  const card = (
    <motion.div
      initial={standalone ? { opacity: 0, y: 16 } : { opacity: 0, scale: 0.96, y: 12 }}
      animate={standalone ? { opacity: 1, y: 0 }  : { opacity: 1,  scale: 1,    y: 0  }}
      exit={{ opacity: 0, scale: 0.97, y: 8 }}
      transition={{ duration: 0.2, ease: [0.25, 1, 0.35, 1] }}
      className="w-full max-w-xl bg-white dark:bg-zinc-900 overflow-visible"
      style={{
        borderRadius: 20,
        boxShadow: standalone
          ? '0 0 0 1px rgba(0,0,0,0.05), 0 20px 60px rgba(0,0,0,0.1),  0 6px 20px rgba(0,0,0,0.06)'
          : '0 0 0 1px rgba(0,0,0,0.07), 0 24px 60px rgba(0,0,0,0.32), 0 8px 24px rgba(0,0,0,0.16)',
      }}
      onClick={e => e.stopPropagation()}
    >
      {/* ── Loading ── */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={22} className="animate-spin text-gray-300 dark:text-gray-600" />
        </div>
      )}

      {/* ── Not found ── */}
      {!loading && !form && (
        <div className="py-16 px-8 text-center">
          <p className="text-[14px] text-gray-400 mb-4">This form is not available.</p>
          <button onClick={handleClose} className="text-[13px] font-medium text-[#089447] hover:underline">
            ← Back to forms
          </button>
        </div>
      )}

      {/* ── Success ── */}
      {!loading && form && submitted && (
        <div className="px-8 py-14 text-center">
          {/* Full bar at 100% */}
          <div className="h-[3px] bg-gray-100 dark:bg-zinc-800 rounded-full mb-8 mx-0 overflow-hidden">
            <motion.div
              className="h-full bg-[#089447] rounded-full"
              initial={{ width: `${progressPct}%` }}
              animate={{ width: '100%' }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
            />
          </div>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 280, damping: 20 }}
            className="w-16 h-16 rounded-full bg-[#f0faf4] dark:bg-[#089447]/20 flex items-center justify-center mx-auto mb-5"
          >
            <CheckCircle size={28} className="text-[#089447]" />
          </motion.div>
          <h2 className="text-[20px] font-bold text-gray-900 dark:text-white tracking-tight mb-2">
            Submitted!
          </h2>
          <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed max-w-xs mx-auto mb-7">
            {form.success_message || 'Your submission has been received.'}
          </p>
          <button
            onClick={handleClose}
            className="text-[13px] font-semibold text-[#089447] hover:text-[#077a3c] transition-colors"
          >
            {standalone ? '← Back to forms' : 'Close'}
          </button>
        </div>
      )}

      {/* ── Active form ── */}
      {!loading && form && !submitted && (
        <>
          {progressBar}

          {/* Header */}
          <div className="flex items-center justify-between px-6 pt-3 pb-4 border-b border-gray-100 dark:border-zinc-800">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-7 h-7 rounded-lg bg-[#f0faf4] dark:bg-[#089447]/20 flex items-center justify-center flex-shrink-0">
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path d="M2 4h12M2 8h8M2 12h10" stroke="#089447" strokeWidth="2" strokeLinecap="round" />
                </svg>
              </div>
              <h2 className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight truncate">
                {form.title}
              </h2>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0 ml-3">
              {lastSavedAt && (
                <span
                  className="hidden sm:flex items-center gap-1 text-[10px] font-medium text-emerald-500/80 dark:text-emerald-400/70"
                  title={serverDrafts ? 'Saved to your account — resume on any device' : 'Saved automatically on this device'}
                >
                  <Check size={11} /> Saved
                </span>
              )}
              <button
                onClick={autofill}
                title="Auto-fill required fields with test data"
                className="flex items-center gap-1 text-[10px] font-semibold text-gray-300 dark:text-gray-600 hover:text-amber-500 dark:hover:text-amber-400 transition-colors"
              >
                <Zap size={10} />
                Fill
              </button>
              <span className="text-[11px] font-semibold text-gray-400 tabular-nums">
                {currentStep + 1}
                <span className="text-gray-300 dark:text-gray-600 mx-0.5">/</span>
                {steps.length}
              </span>
              <button
                onClick={handleClose}
                className="w-7 h-7 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-all"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Resume banner — a saved draft was restored on open */}
          {draftRestoredAt !== null && (
            <div className="mx-6 mt-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 dark:border-amber-900/40 bg-amber-50 dark:bg-amber-950/30 px-3.5 py-2.5">
              <div className="flex items-center gap-2 min-w-0 text-[12px] text-amber-700 dark:text-amber-300">
                <RotateCcw size={13} className="flex-shrink-0" />
                <span className="truncate">
                  Resumed your saved progress from {timeAgo(draftRestoredAt)}{serverDrafts ? '' : ' (this device)'}.
                </span>
              </div>
              <button
                onClick={discardDraft}
                className="flex-shrink-0 text-[12px] font-semibold text-amber-700 dark:text-amber-300 hover:underline"
              >
                Start over
              </button>
            </div>
          )}

          {/* Fields */}
          <div className="px-6 py-5 min-h-[200px] overflow-hidden">
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentStep}
                custom={direction}
                initial={{ x: direction > 0 ? 40 : -40, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction > 0 ? -40 : 40, opacity: 0 }}
                transition={{ duration: 0.2, ease: [0.25, 1, 0.35, 1] }}
              >
                {/* Section label */}
                {steps[currentStep]?.title && (
                  <p className="text-[10px] font-bold text-[#089447] uppercase tracking-[0.12em] mb-4">
                    {steps[currentStep].title}
                  </p>
                )}

                {/* 1 field → full width; multiple → 2-col grid (wide types always span both cols) */}
                {(steps[currentStep]?.fields.length ?? 0) === 1 ? (
                  <FieldInput
                    field={steps[currentStep].fields[0]}
                    value={answers[steps[currentStep].fields[0].label]}
                    error={errors[steps[currentStep].fields[0].label]}
                    onChange={v => handleChange(steps[currentStep].fields[0].label, v)}
                  />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-4">
                    {steps[currentStep]?.fields.map(field => (
                      <div key={field.id} className={
                        ['textarea', 'file', 'signature', 'checkbox', 'radio'].includes(field.field_type)
                          ? 'sm:col-span-2'
                          : ''
                      }>
                        <FieldInput
                          field={field}
                          value={answers[field.label]}
                          error={errors[field.label]}
                          onChange={v => handleChange(field.label, v)}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Submit error */}
          {submitError && (
            <div className="mx-6 mb-3 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-red-600 dark:text-red-400 text-[13px]">
              <AlertCircle size={13} className="flex-shrink-0" />
              {submitError}
            </div>
          )}

          {/* Footer */}
          <div className="px-6 pb-5 pt-3 border-t border-gray-50 dark:border-zinc-800 flex items-center justify-between">
            {currentStep > 0 ? (
              <button
                onClick={back}
                className="flex items-center gap-1 text-[13px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
              >
                <ChevronLeft size={15} />
                Back
              </button>
            ) : (
              <p className="text-[11px] text-gray-300 dark:text-gray-700">
                Fields marked <span className="text-[#089447]">*</span> are required
              </p>
            )}

            {isLastStep ? (
              <button
                onClick={submit}
                disabled={submitting}
                className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                {submitting
                  ? <><Loader2 size={13} className="animate-spin" />Submitting…</>
                  : <><CheckCircle size={13} />Submit</>}
              </button>
            ) : (
              <button
                onClick={next}
                className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[13px] font-semibold px-6 py-2.5 rounded-xl transition-colors shadow-sm"
              >
                Next
                <ChevronRight size={14} />
              </button>
            )}
          </div>
        </>
      )}
    </motion.div>
  )

  // ── Standalone page ─────────────────────────────────────────────────────────
  if (standalone) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0f0f2] dark:bg-zinc-950 px-4 py-8">
        <div className="w-full max-w-xl mb-3">
          <button
            onClick={() => router.push('/forms')}
            className="flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors"
          >
            <ArrowLeft size={13} />
            All Forms
          </button>
        </div>
        {card}
      </div>
    )
  }

  // ── Overlay modal ───────────────────────────────────────────────────────────
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-8"
      style={{ background: 'rgba(0,0,0,0.38)', backdropFilter: 'blur(10px) saturate(1.1)' }}
      onClick={e => { if (e.target === e.currentTarget) handleClose() }}
    >
      {card}
    </div>
  )
}

// ── Shared field renderer ────────────────────────────────────────────────────
function FieldInput({
  field, value, error, onChange,
}: {
  field: FormField
  value: unknown
  error?: string
  onChange: (v: unknown) => void
}) {
  const cls = (err: boolean) =>
    `w-full border rounded-xl px-4 py-2.5 text-[14px] text-[#0a0a0b] dark:text-gray-100 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-white dark:bg-zinc-800 ${
      err
        ? 'border-red-300 dark:border-red-700 bg-red-50/40 focus:border-red-400 focus:ring-2 focus:ring-red-400/10'
        : 'border-gray-200 dark:border-zinc-700 focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10'
    }`

  return (
    <div data-field-error={error ? 'true' : undefined} className="space-y-1.5">
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300">
        {field.label}
        {field.is_required && <span className="text-[#089447] ml-1">*</span>}
      </label>

      {field.field_type === 'text' &&
        <input type="text" value={String(value ?? '')} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''} className={cls(!!error)} />}
      {field.field_type === 'email' &&
        <input type="email" value={String(value ?? '')} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder ?? 'name@company.com'} className={cls(!!error)} />}
      {field.field_type === 'number' &&
        <input type="number" value={String(value ?? '')} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder ?? '0'} className={cls(!!error)} />}
      {field.field_type === 'textarea' &&
        <textarea value={String(value ?? '')} onChange={e => onChange(e.target.value)}
          placeholder={field.placeholder ?? ''} rows={5}
          className={`${cls(!!error)} resize-none`} />}
      {field.field_type === 'date' &&
        <input type="date" value={String(value ?? '')} onChange={e => onChange(e.target.value)}
          className={cls(!!error)} />}
      {(field.field_type === 'select' || field.field_type === 'radio') &&
        <SelectChipField field={field} value={value as string} onChange={onChange} multi={false} />}
      {field.field_type === 'checkbox' &&
        <SelectChipField field={field} value={value as string[]} onChange={onChange} multi={true} />}
      {field.field_type === 'file' &&
        <FileField field={field} value={value as string} onChange={onChange} />}
      {field.field_type === 'signature' &&
        <SignatureField field={field} value={value as string} onChange={onChange} />}

      {error &&
        <p className="text-[12px] text-red-500 flex items-center gap-1">
          <AlertCircle size={12} className="flex-shrink-0" />{error}
        </p>}
    </div>
  )
}
