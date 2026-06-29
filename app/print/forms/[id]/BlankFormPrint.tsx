'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { FormField } from '@/lib/supabase'
import { visibleFields } from '@/lib/forms'
import { cn } from '@/lib/utils'
import PrintFrame from '@/components/PrintFrame'
import PrintButton from '@/components/PrintButton'

interface Props {
  formId: string
  title: string
  description: string | null
  fields: FormField[]
  controllingLabel: string | null
  departments: string[]
}

/** Split fields into sections by `section_header`; drop empty sections. */
function groupIntoSections(fields: FormField[]) {
  const out: { title: string | null; fields: FormField[] }[] = []
  let current: { title: string | null; fields: FormField[] } | null = null
  for (const f of fields) {
    if (f.field_type === 'section_header') {
      current = { title: f.label, fields: [] }
      out.push(current)
    } else {
      if (!current) { current = { title: null, fields: [] }; out.push(current) }
      current.fields.push(f)
    }
  }
  return out.filter((s) => s.fields.length > 0)
}

export default function BlankFormPrint({ formId, title, description, fields, controllingLabel, departments }: Props) {
  const hasDepts = !!controllingLabel && departments.length > 0
  const [dept, setDept] = useState<string>(hasDepts ? departments[0] : '')

  const answers = hasDepts ? { [controllingLabel as string]: dept } : {}
  const sections = groupIntoSections(visibleFields(fields, answers))

  const toolbar = (
    <>
      <Link
        href={`/admin/forms/${formId}/edit`}
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900"
      >
        <ArrowLeft size={15} /> Back to form
      </Link>
      <div className="flex flex-wrap items-center gap-2">
        {hasDepts && (
          <div className="flex flex-wrap gap-1">
            {departments.map((d) => (
              <button
                key={d}
                onClick={() => setDept(d)}
                className={cn(
                  'rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors',
                  d === dept ? 'bg-emerald-600 text-white' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200',
                )}
              >
                {d}
              </button>
            ))}
          </div>
        )}
        <PrintButton label="Print" />
      </div>
    </>
  )

  return (
    <PrintFrame toolbar={toolbar}>
      <header className="mb-6 border-b border-zinc-200 pb-5">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-emerald-700">Innovative Air Technologies</p>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-zinc-900">
          {title}
          {hasDepts && <span className="font-semibold text-zinc-400"> — {dept}</span>}
        </h1>
        {description && <p className="mt-1 text-[13px] text-zinc-500">{description}</p>}
        <div className="mt-3 flex flex-wrap gap-x-8 gap-y-2 text-[13px] text-zinc-500">
          <span>Employee:&nbsp;<span className="inline-block w-48 border-b border-zinc-300">&nbsp;</span></span>
          <span>Reviewer:&nbsp;<span className="inline-block w-48 border-b border-zinc-300">&nbsp;</span></span>
          <span>Date:&nbsp;<span className="inline-block w-28 border-b border-zinc-300">&nbsp;</span></span>
        </div>
      </header>

      {sections.length === 0 ? (
        <p className="text-[14px] text-zinc-400">This form has no questions{hasDepts ? ` for ${dept}` : ''}.</p>
      ) : (
        sections.map((sec, i) => (
          <section key={i} className="mb-6">
            {sec.title && (
              <h2 className="mb-3 break-after-avoid border-b border-zinc-200 pb-1 text-[12px] font-bold uppercase tracking-widest text-zinc-500">{sec.title}</h2>
            )}
            <div className="space-y-4">
              {sec.fields.map((f) => (
                <BlankField key={f.id} field={f} controllingLabel={controllingLabel} dept={dept} />
              ))}
            </div>
          </section>
        ))
      )}
    </PrintFrame>
  )
}

function FieldLabel({ field }: { field: FormField }) {
  return (
    <p className="text-[13px] font-semibold text-zinc-800">
      {field.label}
      {field.is_required && <span className="text-red-500"> *</span>}
    </p>
  )
}

/** A single blank question, rendered for filling in by hand (or reviewing). */
function BlankField({ field, controllingLabel, dept }: { field: FormField; controllingLabel: string | null; dept: string }) {
  const isController = !!controllingLabel && field.label === controllingLabel

  if ((field.field_type === 'radio' || field.field_type === 'select') && field.options?.length) {
    return (
      <div className="break-inside-avoid">
        <FieldLabel field={field} />
        <ul className="mt-1.5 space-y-1">
          {field.options.map((opt) => {
            const marked = isController && opt === dept
            return (
              <li key={opt} className="flex items-center gap-2 text-[13px] text-zinc-700">
                <span className={cn('inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border', marked ? 'border-emerald-600 bg-emerald-600' : 'border-zinc-400')}>
                  {marked && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
                {opt}
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  if (field.field_type === 'checkbox' && field.options?.length) {
    return (
      <div className="break-inside-avoid">
        <FieldLabel field={field} />
        <ul className="mt-1.5 space-y-1">
          {field.options.map((opt) => (
            <li key={opt} className="flex items-center gap-2 text-[13px] text-zinc-700">
              <span className="inline-block h-3.5 w-3.5 rounded-[3px] border border-zinc-400" /> {opt}
            </li>
          ))}
        </ul>
      </div>
    )
  }

  if (field.field_type === 'textarea') {
    return (
      <div className="break-inside-avoid">
        <FieldLabel field={field} />
        <div className="mt-1.5 h-20 rounded-md border border-zinc-300" />
      </div>
    )
  }

  if (field.field_type === 'signature') {
    return (
      <div className="break-inside-avoid">
        <FieldLabel field={field} />
        <div className="mt-6 flex items-end gap-6">
          <span className="flex-1 border-b border-zinc-400" />
          <span className="w-32 border-b border-zinc-400" />
        </div>
        <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wide text-zinc-400">
          <span>Signature</span><span className="w-32 text-left">Date</span>
        </div>
      </div>
    )
  }

  // text / email / number / date / file → single blank line
  return (
    <div className="break-inside-avoid">
      <FieldLabel field={field} />
      <div className="mt-2 h-6 border-b border-zinc-300" />
    </div>
  )
}
