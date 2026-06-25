export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { FileText, Calendar, ClipboardList, Info } from 'lucide-react'
import { DetailShell, DetailTopBar, Card, CardHead, MetaRow } from '@/components/admin/detail-ui'
import SubmissionDetailClient from './SubmissionDetailClient'
import SubmissionNotes from './SubmissionNotes'
import SubmissionStatus from './SubmissionStatus'
import MarkAsRead from './MarkAsRead'

async function getData(id: string) {
  const { data: submission } = await supabaseAdmin
    .from('submissions')
    .select('*')
    .eq('id', id)
    .single()

  if (!submission) return null

  const { data: fields } = await supabaseAdmin
    .from('form_fields')
    .select('*')
    .eq('form_id', submission.form_id)
    .order('sort_order')

  return { submission, fields: fields || [] }
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open', in_progress: 'In Progress', resolved: 'Resolved',
}

type SubField = { id: string; label: string; field_type: string }

/** Split form fields into sections by `section_header`, so the submission renders as a
 *  card per section (mirroring the ticket detail) instead of one endless list. Fields
 *  before the first header fall under a generic "Responses" card; empty sections drop. */
function groupIntoSections(fields: SubField[]): { title: string; fields: SubField[] }[] {
  const out: { title: string; fields: SubField[] }[] = []
  let current: { title: string; fields: SubField[] } | null = null
  for (const f of fields) {
    if (f.field_type === 'section_header') {
      current = { title: f.label, fields: [] }
      out.push(current)
    } else {
      if (!current) { current = { title: 'Responses', fields: [] }; out.push(current) }
      current.fields.push(f)
    }
  }
  return out.filter((s) => s.fields.length > 0)
}

export default async function SubmissionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const result = await getData(params.id)
  if (!result) notFound()

  const { submission, fields } = result
  const submitterName =
    submission.data?.['Employee Name'] || submission.data?.['Full Name'] || submission.data?.['Name'] || null
  const initials = submitterName
    ? String(submitterName).split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'
  const status = (submission.status as 'open' | 'in_progress' | 'resolved') || 'open'
  const answered = fields.filter((f: { label: string; field_type: string }) =>
    f.field_type !== 'section_header' &&
    submission.data[f.label] !== undefined && submission.data[f.label] !== null && submission.data[f.label] !== ''
  ).length
  const questionCount = fields.filter((f: { field_type: string }) => f.field_type !== 'section_header').length
  const sections = groupIntoSections(fields)

  return (
    <DetailShell>
      <MarkAsRead submissionId={submission.id} isRead={submission.is_read} />

      <DetailTopBar
        crumbs={[
          { label: 'Submissions', href: '/admin/submissions' },
          { label: submitterName || 'Submission' },
        ]}
      >
        <SubmissionStatus submissionId={submission.id} initialStatus={status} />
        <SubmissionDetailClient submission={submission} fields={fields} />
      </DetailTopBar>

      <div className="p-5 space-y-4">
        {/* Hero */}
        <div className="flex items-center gap-3.5">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center flex-shrink-0 text-[15px] font-bold text-emerald-600 dark:text-emerald-400">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight truncate">
              {submitterName || 'Anonymous Submission'}
            </h1>
            <div className="flex items-center gap-3 mt-0.5 flex-wrap">
              <span className="flex items-center gap-1.5 text-[12px] text-zinc-500 dark:text-zinc-400">
                <FileText size={12} /> {submission.form_title}
              </span>
              <span className="flex items-center gap-1.5 text-[12px] text-zinc-400 dark:text-zinc-500">
                <Calendar size={12} /> {formatDateTime(submission.submitted_at)}
              </span>
            </div>
          </div>
        </div>

        {/* Two-column */}
        <div className="flex flex-col xl:flex-row gap-4 items-start">
          {/* Main — responses, split into a card per form section (mirrors the ticket
              detail) so long submissions read as digestible sections, not one endless list. */}
          <main className="flex-1 min-w-0 w-full space-y-4">
            {fields.length === 0 ? (
              <Card>
                <div className="py-14 text-center text-[13px] text-zinc-400 dark:text-zinc-600">No field data</div>
              </Card>
            ) : (
              sections.map((sec, i) => (
                <Card key={i}>
                  <CardHead
                    title={sec.title}
                    icon={<ClipboardList size={14} />}
                    action={
                      i === 0 && questionCount > 0 ? (
                        <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 tabular-nums">
                          {answered}/{questionCount} answered
                        </span>
                      ) : undefined
                    }
                  />
                  <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                    {sec.fields.map((field) => (
                      <FieldRow
                        key={field.id}
                        label={field.label}
                        value={submission.data[field.label]}
                        fieldType={field.field_type}
                      />
                    ))}
                  </div>
                </Card>
              ))
            )}
          </main>

          {/* Right rail — details + notes */}
          <aside className="w-full xl:w-[340px] flex-shrink-0 xl:sticky xl:top-[72px] space-y-4">
            <Card>
              <CardHead title="Details" icon={<Info size={14} />} />
              <div className="divide-y divide-zinc-100 dark:divide-zinc-800/50">
                <MetaRow label="Form">{submission.form_title}</MetaRow>
                <MetaRow label="Submitted">{formatDateTime(submission.submitted_at)}</MetaRow>
                <MetaRow label="Status">{STATUS_LABEL[status]}</MetaRow>
                <MetaRow label="Read">{submission.is_read ? 'Yes' : 'No'}</MetaRow>
                <MetaRow label="Submission ID">
                  <span className="font-mono text-[11px] text-zinc-400 dark:text-zinc-500">{submission.id.slice(0, 8)}</span>
                </MetaRow>
              </div>
            </Card>

            <SubmissionNotes submissionId={submission.id} />
          </aside>
        </div>
      </div>
    </DetailShell>
  )
}

function FieldRow({ label, value, fieldType }: { label: string; value: unknown; fieldType: string }) {
  // Section headers become subheading bands rather than label/value rows.
  if (fieldType === 'section_header') {
    return (
      <div className="px-5 py-2.5 bg-zinc-50/70 dark:bg-zinc-900/40">
        <span className="text-[11px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{label}</span>
      </div>
    )
  }

  const isEmpty = value === undefined || value === null || value === ''
  let display: React.ReactNode = <span className="text-zinc-300 dark:text-zinc-600 text-[13px]">—</span>

  if (!isEmpty) {
    if (fieldType === 'signature' && typeof value === 'string' && value.startsWith('data:image')) {
      display = (
        <img src={value} alt="Signature" className="max-w-[280px] border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white" />
      )
    } else if (fieldType === 'file' && typeof value === 'string' && value.startsWith('http')) {
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(value)
      display = isImage ? (
        <div>
          <img src={value} alt={label} className="max-w-[280px] max-h-48 object-contain border border-zinc-200 dark:border-zinc-800 rounded-lg mb-2" />
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-[13px] text-emerald-600 dark:text-emerald-400 hover:underline">
            View full file
          </a>
        </div>
      ) : (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-[13px] text-emerald-600 dark:text-emerald-400 hover:underline break-all">
          {value}
        </a>
      )
    } else if (Array.isArray(value)) {
      display = (
        <div className="flex flex-wrap gap-1.5">
          {value.map((v, i) => (
            <span key={i} className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2.5 py-1 rounded-lg">
              {String(v)}
            </span>
          ))}
        </div>
      )
    } else {
      display = <span className="text-[14px] text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap break-words">{String(value)}</span>
    }
  }

  return (
    <div className="px-5 py-3.5">
      <dt className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">{label}</dt>
      <dd>{display}</dd>
    </div>
  )
}
