'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import type { Form, FormField } from '@/lib/supabase'
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import SelectChipField from './fields/SelectChipField'
import FileField from './fields/FileField'
import SignatureField from './fields/SignatureField'
import PublicHeader from './PublicHeader'

// Forms at or below this field count use the compact floating modal layout.
// Forms above it fall through to the standard long-form layout.
const COMPACT_LAYOUT_MAX_FIELDS = 15

// These field types always span both columns in the 2-col grid.
const FULL_WIDTH_TYPES = new Set(['textarea', 'file', 'signature', 'checkbox'])

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

  // ── Compact floating modal layout (≤ COMPACT_LAYOUT_MAX_FIELDS fields) ────────
  if (!embedded && fields.length <= COMPACT_LAYOUT_MAX_FIELDS) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 sm:p-8 bg-[#f0f0f2] dark:bg-zinc-950">

        {/* Floating card */}
        <div
          className="relative w-full max-w-2xl"
          style={{
            borderRadius: '20px',
            boxShadow:
              '0 0 0 1px rgba(0,0,0,0.05), ' +
              '0 24px 64px rgba(0,0,0,0.13), ' +
              '0 8px 24px rgba(0,0,0,0.08), ' +
              '0 2px 8px rgba(0,0,0,0.05)',
          }}
        >
          <div
            className="bg-white dark:bg-zinc-900 overflow-hidden"
            style={{ borderRadius: '20px', backdropFilter: 'blur(40px) saturate(1.4)' }}
          >
            {/* Card header */}
            <div className="px-7 pt-7 pb-5 border-b border-black/[0.06] dark:border-white/[0.05]">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-xl bg-[#f0faf4] dark:bg-[#089447]/20 flex items-center justify-center flex-shrink-0">
                    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                      <path d="M2 4h12M2 8h8M2 12h10" stroke="#089447" strokeWidth="1.8" strokeLinecap="round" />
                    </svg>
                  </div>
                  <h1 className="text-[19px] font-bold text-[#0a0a0b] dark:text-white tracking-tight leading-tight">
                    {form.title}
                  </h1>
                </div>

                {/* IAT logo — subtle top-right watermark */}
                <div className="flex-shrink-0 w-7 h-7 rounded-lg bg-white dark:bg-white/10 flex items-center justify-center opacity-40 mt-0.5">
                  <Image
                    src="/iat-logo.png"
                    alt="IAT"
                    width={18}
                    height={18}
                    style={{ mixBlendMode: 'multiply' }}
                  />
                </div>
              </div>

              {form.description && (
                <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed mt-2.5 pl-11">
                  {form.description}
                </p>
              )}
            </div>

            {/* 2-column field grid */}
            <div className="px-7 py-6">
              <form onSubmit={handleSubmit} noValidate>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">
                  {fields.map((field) => (
                    <div
                      key={field.id}
                      className={
                        FULL_WIDTH_TYPES.has(field.field_type)
                          ? 'col-span-1 sm:col-span-2'
                          : 'col-span-1'
                      }
                    >
                      <FieldRow
                        field={field}
                        value={answers[field.label]}
                        error={errors[field.label]}
                        onChange={(v) => handleChange(field.label, v)}
                      />
                    </div>
                  ))}
                </div>

                {submitError && (
                  <div className="mt-4 flex items-center gap-2 p-3 bg-red-50 dark:bg-red-950/30 rounded-xl text-red-600 dark:text-red-400 text-[13px]">
                    <AlertCircle size={14} className="flex-shrink-0" />
                    {submitError}
                  </div>
                )}

                {/* Footer */}
                <div className="mt-5 pt-4 border-t border-gray-100 dark:border-white/[0.05] flex items-center justify-between gap-4">
                  <p className="text-[12px] text-gray-400">
                    Fields marked <span className="text-[#089447] font-semibold">*</span> are required
                  </p>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] active:bg-[#066832] text-white text-[13px] font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm flex-shrink-0"
                  >
                    {submitting ? (
                      <><Loader2 size={14} className="animate-spin" />Submitting…</>
                    ) : (
                      <><CheckCircle size={14} />Submit</>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Standard long-form layout (embedded or > COMPACT_LAYOUT_MAX_FIELDS) ───────

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
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-card px-7 py-7">
            {formBody}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#f5f5f7] dark:bg-zinc-950">
      <PublicHeader formTitle={form.title} />
      <div className="py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-black/[0.06] dark:border-white/10 shadow-card overflow-hidden">
            <div className="px-7 pt-7 pb-6 border-b border-gray-100 dark:border-zinc-800">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-8 h-8 rounded-lg bg-[#f0faf4] dark:bg-[#089447]/20 flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4h12M2 8h8M2 12h10" stroke="#089447" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </div>
                <h1 className="text-[20px] font-bold text-[#0a0a0b] dark:text-white tracking-tight leading-tight">
                  {form.title}
                </h1>
              </div>
              {form.description && (
                <p className="text-[14px] text-gray-500 dark:text-gray-400 leading-relaxed mt-2 pl-11">
                  {form.description}
                </p>
              )}
            </div>
            <div className="px-7 py-7">
              {formBody}
            </div>
          </div>
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
    `w-full border rounded-xl px-4 py-2.5 text-[14px] text-[#0a0a0b] dark:text-gray-100 outline-none transition-all placeholder:text-gray-300 dark:placeholder:text-gray-600 bg-white dark:bg-zinc-800 ${
      hasError
        ? 'border-red-300 dark:border-red-700 bg-red-50/40 dark:bg-red-950/20 focus:border-red-400 focus:ring-2 focus:ring-red-400/10'
        : 'border-gray-200 dark:border-zinc-700 focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10'
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
          className={inputClass(!!error)} />
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
