export const dynamic = 'force-dynamic'

import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { visibleFields } from '@/lib/forms'
import { formatDateTime } from '@/lib/utils'
import type { FormField } from '@/lib/supabase'
import PrintFrame from '@/components/PrintFrame'
import PrintButton from '@/components/PrintButton'

async function getData(id: string) {
  const { data: submission } = await supabaseAdmin.from('submissions').select('*').eq('id', id).single()
  if (!submission) return null
  const { data: fields } = await supabaseAdmin
    .from('form_fields')
    .select('*')
    .eq('form_id', submission.form_id)
    .order('sort_order')
  return { submission, fields: (fields || []) as FormField[] }
}

/** Split visible fields into sections by `section_header`; drop empty sections. */
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

function AnswerValue({ value, fieldType, label }: { value: unknown; fieldType: string; label: string }) {
  if (value === undefined || value === null || value === '') return <span className="text-zinc-300">—</span>
  if (fieldType === 'signature' && typeof value === 'string' && value.startsWith('data:image')) {
    return <img src={value} alt="Signature" className="max-h-24 rounded border border-zinc-200 bg-white" />
  }
  if (fieldType === 'file' && typeof value === 'string' && value.startsWith('http')) {
    return <a href={value} className="break-all text-emerald-700 underline">{value}</a>
  }
  if (Array.isArray(value)) {
    return (
      <div className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <span key={i} className="rounded-md border border-zinc-300 px-2 py-0.5 text-[12px] font-medium text-zinc-700">{String(v)}</span>
        ))}
      </div>
    )
  }
  return <span className="whitespace-pre-wrap break-words">{String(value)}</span>
}

export default async function SubmissionPrintPage(props: { params: Promise<{ id: string }> }) {
  if (!(await getAdminUser())) redirect('/login')
  const { id } = await props.params
  const data = await getData(id)
  if (!data) notFound()

  const { submission, fields } = data
  const answers = (submission.data || {}) as Record<string, unknown>
  // Only the fields actually visible for this submission (respects the Department conditions).
  const sections = groupIntoSections(visibleFields(fields, answers))
  const employeeName = answers['Employee Name'] || answers['Full Name'] || answers['Name'] || null

  return (
    <PrintFrame
      toolbar={
        <>
          <Link
            href={`/admin/submissions/${submission.id}`}
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 hover:text-zinc-900"
          >
            <ArrowLeft size={15} /> Back to submission
          </Link>
          <PrintButton label="Print / Save as PDF" />
        </>
      }
    >
      <header className="mb-6 border-b border-zinc-200 pb-5">
        <p className="text-[12px] font-semibold uppercase tracking-widest text-emerald-700">Innovative Air Technologies</p>
        <h1 className="mt-1 text-[24px] font-bold tracking-tight text-zinc-900">{submission.form_title}</h1>
        <div className="mt-2 flex flex-wrap gap-x-8 gap-y-1 text-[13px] text-zinc-600">
          {employeeName != null && (
            <span><span className="text-zinc-400">Employee:</span> <strong className="font-semibold text-zinc-800">{String(employeeName)}</strong></span>
          )}
          <span><span className="text-zinc-400">Submitted:</span> {formatDateTime(submission.submitted_at)}</span>
        </div>
      </header>

      {sections.length === 0 ? (
        <p className="text-[14px] text-zinc-400">No responses.</p>
      ) : (
        <div className="space-y-6">
          {sections.map((sec, i) => (
            <section key={i}>
              {sec.title && (
                <h2 className="mb-3 break-after-avoid border-b border-zinc-200 pb-1 text-[12px] font-bold uppercase tracking-widest text-zinc-500">{sec.title}</h2>
              )}
              <div className="space-y-3.5">
                {sec.fields.map((f) => (
                  <div key={f.id} className="break-inside-avoid">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-zinc-500">{f.label}</p>
                    <div className="mt-1 text-[14px] text-zinc-900"><AnswerValue value={answers[f.label]} fieldType={f.field_type} label={f.label} /></div>
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <footer className="mt-10 border-t border-zinc-200 pt-3 text-[11px] text-zinc-400">
        IAT Forms Portal · {submission.form_title} · Submitted {formatDateTime(submission.submitted_at)}
      </footer>
    </PrintFrame>
  )
}
