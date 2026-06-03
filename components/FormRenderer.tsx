'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import type { Form, FormField } from '@/lib/supabase'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import SelectChipField from './fields/SelectChipField'
import FileField from './fields/FileField'
import SignatureField from './fields/SignatureField'
import ThemeToggle from './ThemeToggle'

interface Props {
  form: Form
  fields: FormField[]
  embedded?: boolean
}

export default function FormRenderer({ form, fields, embedded = false }: Props) {
  const router = useRouter()
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const handleChange = useCallback((label: string, value: unknown) => {
    setAnswers((prev) => ({ ...prev, [label]: value }))
    setErrors((prev) => { const next = { ...prev }; delete next[label]; return next })
  }, [])

  const validate = () => {
    const newErrors: Record<string, string> = {}
    fields.forEach((field) => {
      if (!field.is_required) return
      const val = answers[field.label]
      if (val === undefined || val === null || val === '') {
        newErrors[field.label] = 'This field is required.'
      } else if (Array.isArray(val) && val.length === 0) {
        newErrors[field.label] = 'Please select at least one option.'
      } else if (field.field_type === 'email' && val) {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(val))) {
          newErrors[field.label] = 'Please enter a valid email address.'
        }
      }
    })
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) {
      const firstError = document.querySelector('[data-field-error]')
      firstError?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    setSubmitting(true)
    setSubmitError(null)
    try {
      const res = await fetch('/api/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id: form.id, data: answers }),
      })
      if (!res.ok) throw new Error('Submission failed')
      if (embedded) {
        window.parent.postMessage({ type: 'iat-form-success', slug: form.slug }, '*')
      }
      router.push(`/forms/${form.slug}/success`)
    } catch {
      setSubmitError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  const formBody = (
    <form onSubmit={handleSubmit} noValidate className="space-y-5">
      {fields.map((field) => (
        <FieldRow
          key={field.id}
          field={field}
          value={answers[field.label]}
          error={errors[field.label]}
          onChange={(v) => handleChange(field.label, v)}
        />
      ))}

      {submitError && (
        <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-red-600 dark:text-red-400 text-[13px]">
          <AlertCircle size={15} className="flex-shrink-0" />
          {submitError}
        </div>
      )}

      <div className="pt-2">
        <button
          type="submit"
          disabled={submitting}
          className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[14px] font-semibold px-7 py-3 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
        >
          {submitting ? (
            <><Loader2 size={16} className="animate-spin" />Submitting…</>
          ) : (
            <><CheckCircle size={16} />Submit</>
          )}
        </button>
        <p className="text-[12px] text-gray-400 mt-2">
          Fields marked <span className="text-[#089447]">*</span> are required.
        </p>
      </div>
    </form>
  )

  if (embedded) {
    return (
      <div className="min-h-screen bg-transparent py-6 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="mb-5">
            <h1 className="text-[22px] font-bold text-[#0a0a0b] dark:text-white tracking-tight">{form.title}</h1>
            {form.description && (
              <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed mt-1">{form.description}</p>
            )}
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-card px-7 py-7">
            {formBody}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-gray-950 py-10 px-4">
      {/* Theme toggle — fixed top-right */}
      <div className="fixed top-4 right-4 z-10">
        <ThemeToggle className="bg-white/80 dark:bg-gray-900/80 shadow-card-sm backdrop-blur-sm border border-gray-100 dark:border-gray-800" />
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        {/* Header card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-card px-7 py-6">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#f0faf4] dark:bg-[#089447]/20 flex items-center justify-center flex-shrink-0">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 8h8M2 12h10" stroke="#089447" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <h1 className="text-[20px] font-bold text-[#0a0a0b] dark:text-white tracking-tight">{form.title}</h1>
          </div>
          {form.description && (
            <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed mt-3">{form.description}</p>
          )}
        </div>

        {/* Form card */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-card px-7 py-7">
          {formBody}
        </div>
      </div>
    </div>
  )
}

function FieldRow({
  field, value, error, onChange,
}: {
  field: FormField
  value: unknown
  error?: string
  onChange: (v: unknown) => void
}) {
  const inputClass = (hasError: boolean) =>
    `w-full border rounded-xl px-4 py-2.5 text-[14px] text-[#0a0a0b] dark:text-gray-100 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-white dark:bg-gray-800 ${
      hasError
        ? 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/20 focus:border-red-400 focus:ring-2 focus:ring-red-400/10'
        : 'border-gray-200 dark:border-gray-700 focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10'
    }`

  return (
    <div data-field-error={error ? 'true' : undefined} className="space-y-1.5">
      <label className="block text-[13px] font-semibold text-gray-700 dark:text-gray-300">
        {field.label}
        {field.is_required && <span className="text-[#089447] ml-1">*</span>}
      </label>

      {field.field_type === 'text' && (
        <input type="text" value={String(value || '')} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''} className={inputClass(!!error)} />
      )}
      {field.field_type === 'email' && (
        <input type="email" value={String(value || '')} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || 'name@company.com'} className={inputClass(!!error)} />
      )}
      {field.field_type === 'number' && (
        <input type="number" value={String(value || '')} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || '0'} className={inputClass(!!error)} />
      )}
      {field.field_type === 'textarea' && (
        <textarea value={String(value || '')} onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || ''} rows={4}
          className={`${inputClass(!!error)} resize-none`} />
      )}
      {field.field_type === 'date' && (
        <input type="date" value={String(value || '')} onChange={(e) => onChange(e.target.value)}
          className={`${inputClass(!!error)} w-auto`} />
      )}
      {(field.field_type === 'select' || field.field_type === 'radio') && (
        <SelectChipField field={field} value={value as string} onChange={onChange} multi={false} />
      )}
      {field.field_type === 'checkbox' && (
        <SelectChipField field={field} value={value as string[]} onChange={onChange} multi={true} />
      )}
      {field.field_type === 'file' && (
        <FileField field={field} value={value as string} onChange={onChange} />
      )}
      {field.field_type === 'signature' && (
        <SignatureField field={field} value={value as string} onChange={onChange} />
      )}

      {error && (
        <p className="text-[12px] text-red-500 flex items-center gap-1">
          <AlertCircle size={12} className="flex-shrink-0" />{error}
        </p>
      )}
    </div>
  )
}
