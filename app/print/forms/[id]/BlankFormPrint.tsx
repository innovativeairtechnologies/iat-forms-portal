'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft } from 'lucide-react'
import type { FormField } from '@/lib/supabase'
import { visibleFields } from '@/lib/forms'
import { cn } from '@/lib/utils'
import PrintFrame from '@/components/PrintFrame'
import PrintButton from '@/components/PrintButton'

// The IAT mark's intrinsic aspect (width / height); see components/Logo.tsx.
const LOGO_ASPECT = 3020 / 3857

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

// ── Rating matrix ─────────────────────────────────────────────────────────────
// A run of consecutive choice fields that all share the same options (e.g. every
// Superstar/Rockstar/Star/Performer rating) is rendered as ONE table: the scale
// prints once as a column header, one row per question. This is the single biggest
// space saving vs. relisting the four-option scale under all ~26 questions. Each
// rating keeps its own comment line — the "— Brief Explanation" box that follows it
// is folded in as that row's comment, so no comment is lost, just compacted.

type MatrixRow = { rating: FormField; comment: FormField | null }
type Block =
  | { kind: 'matrix'; options: string[]; rows: MatrixRow[] }
  | { kind: 'single'; field: FormField }

const EXPLANATION_RE = /explanation|comment|note|why|—/i
const sameOptions = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])

// Single-line field types that read well two-per-row on paper.
const SHORT_TYPES = new Set<FormField['field_type']>(['text', 'email', 'number', 'date', 'file'])
const isShortSingle = (b: Block) => b.kind === 'single' && SHORT_TYPES.has(b.field.field_type)

function partitionSection(fields: FormField[], controllingLabel: string | null): Block[] {
  const blocks: Block[] = []
  let run: { options: string[]; rows: MatrixRow[] } | null = null
  // Only a run of 2+ questions sharing a scale is worth a matrix (the shared column
  // header pays off). A lone choice field renders the classic way, so one-off
  // questions on other forms are untouched.
  const flush = () => {
    if (run && run.rows.length >= 2) {
      blocks.push({ kind: 'matrix', options: run.options, rows: run.rows })
    } else if (run) {
      for (const r of run.rows) {
        blocks.push({ kind: 'single', field: r.rating })
        if (r.comment) blocks.push({ kind: 'single', field: r.comment })
      }
    }
    run = null
  }

  const isScale = (f: FormField) =>
    (f.field_type === 'radio' || f.field_type === 'select') &&
    !!f.options?.length &&
    f.label !== controllingLabel // never fold the department controller into a matrix

  for (const f of fields) {
    if (isScale(f)) {
      const opts = f.options as string[]
      if (run && !sameOptions(run.options, opts)) flush()
      if (!run) run = { options: opts, rows: [] }
      run.rows.push({ rating: f, comment: null })
    } else if (
      f.field_type === 'textarea' &&
      run && run.rows.length &&
      run.rows[run.rows.length - 1].comment === null &&
      EXPLANATION_RE.test(f.label)
    ) {
      run.rows[run.rows.length - 1].comment = f // this rating's explanation box
    } else {
      flush()
      blocks.push({ kind: 'single', field: f })
    }
  }
  flush()
  return blocks
}

/** Render a section's blocks; pack consecutive short single-line fields (name,
 *  date, …) two-per-row so they share a line instead of each taking a whole line. */
function SectionBody({ blocks, controllingLabel, dept }: { blocks: Block[]; controllingLabel: string | null; dept: string }) {
  const out: ReactNode[] = []
  for (let i = 0; i < blocks.length; ) {
    if (isShortSingle(blocks[i])) {
      const run: FormField[] = []
      while (i < blocks.length && isShortSingle(blocks[i])) {
        run.push((blocks[i] as Extract<Block, { kind: 'single' }>).field)
        i++
      }
      for (let k = 0; k < run.length; k += 2) {
        out.push(
          <div key={`pair-${k}-${i}`} className="grid grid-cols-2 gap-x-6 gap-y-3">
            {run.slice(k, k + 2).map((f) => (
              <BlankField key={f.id} field={f} controllingLabel={controllingLabel} dept={dept} />
            ))}
          </div>,
        )
      }
    } else {
      const b = blocks[i]
      out.push(
        b.kind === 'matrix' ? (
          <RatingMatrix key={`m-${i}`} options={b.options} rows={b.rows} />
        ) : (
          <BlankField key={b.field.id} field={b.field} controllingLabel={controllingLabel} dept={dept} />
        ),
      )
      i++
    }
  }
  return <div className="space-y-3">{out}</div>
}

export default function BlankFormPrint({ formId, title, fields, controllingLabel, departments }: Props) {
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
        <span className="hidden text-[11px] text-zinc-400 sm:inline print:hidden">Choose “Save as PDF” in the print dialog</span>
        <PrintButton label="Download PDF" />
      </div>
    </>
  )

  return (
    <PrintFrame toolbar={toolbar}>
      <header className="mb-5 flex items-center gap-4 border-b border-zinc-200 pb-4">
        <Image
          src="/iat-logo-transparent.png"
          alt="Innovative Air Technologies"
          width={Math.round(48 * LOGO_ASPECT)}
          height={48}
          priority
          className="flex-shrink-0"
        />
        <div className="min-w-0">
          <p className="text-[12px] font-semibold uppercase tracking-widest text-emerald-700">Innovative Air Technologies</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-zinc-900">
            {title}
            {hasDepts && <span className="font-semibold text-zinc-400"> — {dept}</span>}
          </h1>
        </div>
      </header>

      {sections.length === 0 ? (
        <p className="text-[14px] text-zinc-400">This form has no questions{hasDepts ? ` for ${dept}` : ''}.</p>
      ) : (
        sections.map((sec, i) => {
          const blocks = partitionSection(sec.fields, controllingLabel)
          return (
            <section key={i} className="mb-5">
              {sec.title && (
                <h2 className="mb-2.5 break-after-avoid border-b border-zinc-200 pb-1 text-[12px] font-bold uppercase tracking-widest text-zinc-500">{sec.title}</h2>
              )}
              <SectionBody blocks={blocks} controllingLabel={controllingLabel} dept={dept} />
            </section>
          )
        })
      )}
    </PrintFrame>
  )
}

/** The four-column rating table: scale printed once in the header, one row per
 *  competency, a compact comment line under each row it has an explanation for. */
function RatingMatrix({ options, rows }: { options: string[]; rows: MatrixRow[] }) {
  return (
    <table className="w-full border-collapse">
      <thead className="table-header-group">
        <tr>
          <th className="w-auto" />
          {options.map((o) => (
            <th
              key={o}
              className="w-[15%] border-b border-zinc-300 px-1 pb-1 text-center align-bottom text-[9.5px] font-bold uppercase tracking-wide text-zinc-500"
            >
              {o}
            </th>
          ))}
        </tr>
      </thead>
      {rows.map((r, i) => (
        <tbody key={i} className="break-inside-avoid">
          <tr className="border-b border-zinc-100">
            <td className="py-1.5 pr-3 align-top text-[13px] leading-snug text-zinc-800">
              {r.rating.label}
              {r.rating.is_required && <span className="text-red-500"> *</span>}
            </td>
            {options.map((o) => (
              <td key={o} className="py-1.5 text-center align-middle">
                <span className="inline-block h-3.5 w-3.5 rounded-full border border-zinc-400" />
              </td>
            ))}
          </tr>
          {r.comment && (
            <tr>
              <td colSpan={1 + options.length} className="pb-2 pt-0.5">
                <div className="flex items-baseline gap-2">
                  <span className="text-[9.5px] font-semibold uppercase tracking-wide text-zinc-400">Comments</span>
                  <span className="h-[18px] flex-1 border-b border-zinc-300" />
                </div>
              </td>
            </tr>
          )}
        </tbody>
      ))}
    </table>
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

/** A single blank question (used for anything not folded into a rating matrix). */
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
        <div className="mt-1.5 h-16 rounded-md border border-zinc-300" />
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
