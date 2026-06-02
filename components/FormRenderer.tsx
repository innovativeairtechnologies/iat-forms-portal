'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import type { Form, FormField } from '@/lib/supabase'
import TextField from './fields/TextField'
import TextareaField from './fields/TextareaField'
import SelectChipField from './fields/SelectChipField'
import DateField from './fields/DateField'
import FileField from './fields/FileField'
import SignatureField from './fields/SignatureField'
import NumberField from './fields/NumberField'
import { ChevronDown, ArrowLeft } from 'lucide-react'

interface Props {
  form: Form
  fields: FormField[]
}

export default function FormRenderer({ form, fields }: Props) {
  const router = useRouter()
  const [currentStep, setCurrentStep] = useState(0)
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [direction, setDirection] = useState(1)
  const containerRef = useRef<HTMLDivElement>(null)

  const currentField = fields[currentStep]
  const isLastStep = currentStep === fields.length - 1
  const progress = fields.length > 0 ? ((currentStep + 1) / fields.length) * 100 : 0

  const handleAnswer = useCallback((value: unknown) => {
    setAnswers((prev) => ({ ...prev, [currentField.label]: value }))
    setError(null)
  }, [currentField])

  const validate = useCallback(() => {
    if (!currentField) return true
    const val = answers[currentField.label]
    if (currentField.is_required) {
      if (val === undefined || val === null || val === '') return false
      if (Array.isArray(val) && val.length === 0) return false
    }
    if (currentField.field_type === 'email' && val) {
      const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRe.test(String(val))) {
        setError('Please enter a valid email address.')
        return false
      }
    }
    return true
  }, [currentField, answers])

  const goNext = useCallback(async () => {
    if (!validate()) {
      if (!error) setError('This field is required.')
      return
    }
    setError(null)
    if (isLastStep) {
      await handleSubmit()
    } else {
      setDirection(1)
      setCurrentStep((s) => s + 1)
    }
  }, [validate, isLastStep, error])

  const goBack = useCallback(() => {
    if (currentStep > 0) {
      setDirection(-1)
      setCurrentStep((s) => s - 1)
      setError(null)
    }
  }, [currentStep])

  const handleSubmit = async () => {
    setSubmitting(true)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id: form.id, data: answers }),
      })
      if (!res.ok) throw new Error('Submission failed')
      router.push(`/forms/${form.slug}/success`)
    } catch {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const tag = (e.target as HTMLElement).tagName
        if (tag === 'TEXTAREA') return
        if (['INPUT', 'BUTTON', 'A'].includes(tag) || (e.target as HTMLElement).contentEditable === 'true') {
          if (tag !== 'BUTTON') {
            e.preventDefault()
            goNext()
          }
        } else {
          e.preventDefault()
          goNext()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goNext])

  // Auto-advance for single-select chips
  const handleChipSelect = useCallback((value: unknown) => {
    setAnswers((prev) => ({ ...prev, [currentField.label]: value }))
    setError(null)
    if (currentField.field_type === 'radio' || currentField.field_type === 'select') {
      setTimeout(() => {
        if (!isLastStep) {
          setDirection(1)
          setCurrentStep((s) => s + 1)
        }
      }, 350)
    }
  }, [currentField, isLastStep])

  if (!currentField) return null

  const variants = {
    enter: (d: number) => ({ opacity: 0, y: d > 0 ? 40 : -40 }),
    center: { opacity: 1, y: 0 },
    exit: (d: number) => ({ opacity: 0, y: d > 0 ? -40 : 40 }),
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" ref={containerRef}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <span className="text-sm font-semibold text-[#1a1a2e]">{form.title}</span>
        <span className="text-xs text-gray-400">
          {currentStep + 1} / {fields.length}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-0.5 bg-gray-100">
        <motion.div
          className="h-full bg-[#0a7cff]"
          animate={{ width: `${progress}%` }}
          transition={{ duration: 0.3 }}
        />
      </div>

      {/* Question area */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
        <div className="w-full max-w-2xl">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
            >
              {/* Step number */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs font-semibold text-[#0a7cff] bg-[#e8f2ff] px-2 py-0.5 rounded">
                  {currentStep + 1}
                </span>
                {currentField.is_required && (
                  <span className="text-xs text-gray-400">Required</span>
                )}
              </div>

              {/* Question label */}
              <h2 className="text-2xl font-bold text-[#1a1a2e] mb-1 leading-snug">
                {currentField.label}
                {currentField.is_required && <span className="text-[#0a7cff] ml-1">*</span>}
              </h2>

              {/* Field */}
              <div className="mt-6">
                {renderField(currentField, answers[currentField.label], handleAnswer, handleChipSelect)}
              </div>

              {/* Error */}
              {error && (
                <p className="mt-3 text-sm text-red-500">{error}</p>
              )}

              {/* Actions */}
              <div className="flex items-center gap-3 mt-8">
                {currentStep > 0 && (
                  <button
                    onClick={goBack}
                    className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <ArrowLeft size={16} />
                    Back
                  </button>
                )}
                <button
                  onClick={goNext}
                  disabled={submitting}
                  className="flex items-center gap-2 bg-[#1a1a2e] hover:bg-[#0f0f20] text-white text-sm font-semibold px-6 py-3 rounded-[8px] transition-colors disabled:opacity-60"
                >
                  {submitting ? 'Submitting…' : isLastStep ? 'Submit' : 'OK'}
                  {!isLastStep && !submitting && (
                    <ChevronDown size={16} className="rotate-[-90deg]" />
                  )}
                </button>
              </div>

              {!isLastStep && (
                <p className="mt-3 text-xs text-gray-400">
                  Press <kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-500 font-mono text-[11px]">Enter ↵</kbd> to continue
                </p>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* Bottom progress dots */}
      <div className="flex justify-center gap-1.5 pb-6">
        {fields.map((_, i) => (
          <div
            key={i}
            className={`w-1.5 h-1.5 rounded-full transition-all ${
              i === currentStep ? 'bg-[#0a7cff] w-4' : i < currentStep ? 'bg-[#0a7cff] opacity-40' : 'bg-gray-200'
            }`}
          />
        ))}
      </div>
    </div>
  )
}

function renderField(
  field: FormField,
  value: unknown,
  onChange: (v: unknown) => void,
  onChipSelect: (v: unknown) => void
) {
  switch (field.field_type) {
    case 'text':
      return <TextField field={field} value={value as string} onChange={onChange} />
    case 'email':
      return <TextField field={field} value={value as string} onChange={onChange} type="email" />
    case 'number':
      return <NumberField field={field} value={value as string} onChange={onChange} />
    case 'textarea':
      return <TextareaField field={field} value={value as string} onChange={onChange} />
    case 'select':
    case 'radio':
      return <SelectChipField field={field} value={value as string} onChange={onChipSelect} multi={false} />
    case 'checkbox':
      return <SelectChipField field={field} value={value as string[]} onChange={onChange} multi={true} />
    case 'date':
      return <DateField field={field} value={value as string} onChange={onChange} />
    case 'file':
      return <FileField field={field} value={value as string} onChange={onChange} />
    case 'signature':
      return <SignatureField field={field} value={value as string} onChange={onChange} />
    default:
      return <TextField field={field} value={value as string} onChange={onChange} />
  }
}
