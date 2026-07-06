export const dynamic = 'force-dynamic'

import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import { FileText, Calendar, ClipboardList, Info, BarChart3, Printer, ChevronDown } from 'lucide-react'
import Link from 'next/link'
import { DetailShell, DetailTopBar, Card, CardHead, MetaRow, Field } from '@/components/admin/detail-ui'
import SubmissionDetailClient from './SubmissionDetailClient'
import SubmissionNotes from './SubmissionNotes'
import SubmissionStatus from './SubmissionStatus'
import MarkAsRead from './MarkAsRead'
import DeleteRecordButton from '@/components/admin/DeleteRecordButton'

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

// Performance-review rating scale. When a submission contains radio answers on this
// scale, the detail page shows a per-review tally (mirrors the form-wide tally page,
// but scoped to this one person/position). Other forms simply won't trigger it.
const RATINGS = ['Superstar', 'Rockstar', 'Star', 'Performer'] as const
type Rating = (typeof RATINGS)[number]
const RATING_SET = new Set<string>(RATINGS)
const RATING_COLOR: Record<Rating, string> = {
  Superstar: 'text-emerald-600 dark:text-emerald-400',
  Rockstar: 'text-sky-600 dark:text-sky-400',
  Star: 'text-amber-600 dark:text-amber-400',
  Performer: 'text-zinc-500 dark:text-zinc-400',
}

type SubField = { id: string; label: string; field_type: string }

/** Count how many of each rating tier this one submission contains, looking only at
 *  radio answers whose value is on the scale (so free-text never counts). */
function ratingTally(fields: SubField[], data: Record<string, unknown>) {
  const ratingLabels = new Set(fields.filter((f) => f.field_type === 'radio').map((f) => f.label))
  const counts: Record<Rating, number> = { Superstar: 0, Rockstar: 0, Star: 0, Performer: 0 }
  let total = 0
  for (const [label, v] of Object.entries(data || {})) {
    if (ratingLabels.has(label) && typeof v === 'string' && RATING_SET.has(v)) {
      counts[v as Rating]++
      total++
    }
  }
  return { counts, total }
}

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
  const tally = ratingTally(fields as SubField[], submission.data)

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
        <Link
          href={`/print/submissions/${submission.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 h-9 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 text-[12px] font-semibold transition-colors flex-shrink-0"
        >
          <Printer size={14} /> Print
        </Link>
        <SubmissionDetailClient submission={submission} fields={fields} />
        <DeleteRecordButton
          endpoint={`/api/submissions/${submission.id}`}
          entityLabel="submission"
          redirectTo="/admin/submissions"
        />
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
            {tally.total > 0 && (
              <Card>
                <CardHead
                  title="Rating tally"
                  icon={<BarChart3 size={14} />}
                  action={
                    <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 tabular-nums">
                      {tally.total} rating{tally.total === 1 ? '' : 's'}
                    </span>
                  }
                />
                <div className="grid grid-cols-2 divide-x divide-y divide-zinc-100 dark:divide-zinc-800/50 sm:grid-cols-4 sm:divide-y-0">
                  {RATINGS.map((r) => (
                    <div key={r} className="px-4 py-4 text-center">
                      <div className={`text-[24px] font-bold tabular-nums ${tally.counts[r] ? RATING_COLOR[r] : 'text-zinc-300 dark:text-zinc-700'}`}>
                        {tally.counts[r]}
                      </div>
                      <div className="mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">
                        {r}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            )}
            {fields.length === 0 ? (
              <Card>
                <div className="py-14 text-center text-[13px] text-zinc-400 dark:text-zinc-600">No field data</div>
              </Card>
            ) : (
              <>
                {/* Primary section — always open, so the page reads as focused
                    content up top instead of the whole form dumping down the
                    screen at once (mirrors the ticket detail's rhythm). */}
                {sections[0] && (
                  <Card>
                    <CardHead
                      title={sections[0].title}
                      icon={<ClipboardList size={14} />}
                      action={
                        questionCount > 0 ? (
                          <span className="text-[11px] font-medium text-zinc-400 dark:text-zinc-500 tabular-nums">
                            {answered}/{questionCount} answered
                          </span>
                        ) : undefined
                      }
                    />
                    <div className="px-5 py-1">
                      {sections[0].fields.map((field) => (
                        <FieldRow key={field.id} label={field.label} value={submission.data[field.label]} fieldType={field.field_type} />
                      ))}
                    </div>
                  </Card>
                )}

                {/* Remaining sections — folded into one collapsed accordion
                    (mirrors the ticket detail's "Intake details") so a long,
                    multi-section form doesn't read as an endless scroll. */}
                {sections.length > 1 && (
                  <Card>
                    <details className="group">
                      <summary className="flex items-center gap-2 px-5 py-3.5 cursor-pointer select-none list-none marker:content-none [&::-webkit-details-marker]:hidden">
                        <ClipboardList size={14} className="text-zinc-400 dark:text-zinc-500 flex-shrink-0" />
                        <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100">More responses</h3>
                        <span className="text-[11px] text-zinc-400 dark:text-zinc-500">
                          {sections.length - 1} more section{sections.length - 1 === 1 ? '' : 's'}
                        </span>
                        <ChevronDown size={14} className="ml-auto text-zinc-400 transition-transform group-open:rotate-180" />
                      </summary>
                      <div className="border-t border-zinc-200/70 dark:border-zinc-800/80 pb-2">
                        {sections.slice(1).map((sec, i) => (
                          <div key={i} className="border-t border-zinc-100 dark:border-zinc-800/50 first:border-0">
                            <div className="px-5 pt-4 pb-1">
                              <h4 className="text-[12px] font-semibold text-zinc-700 dark:text-zinc-200">{sec.title}</h4>
                            </div>
                            <div className="px-5 pb-2.5">
                              {sec.fields.map((field) => (
                                <FieldRow key={field.id} label={field.label} value={submission.data[field.label]} fieldType={field.field_type} />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </details>
                  </Card>
                )}
              </>
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

/** A field whose value needs real width — its own full-width block (label
 *  eyebrow above, content below) rather than squeezed into the compact
 *  label/value row. Used for images, signatures, and long free text. */
function WideField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-zinc-100 dark:border-zinc-800/50 last:border-0">
      <p className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1.5">{label}</p>
      {children}
    </div>
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

  if (!isEmpty && fieldType === 'signature' && typeof value === 'string' && value.startsWith('data:image')) {
    return (
      <WideField label={label}>
        <img src={value} alt="Signature" className="max-w-[280px] border border-zinc-200 dark:border-zinc-800 rounded-lg bg-white" />
      </WideField>
    )
  }

  if (!isEmpty && fieldType === 'file' && typeof value === 'string' && value.startsWith('http')) {
    const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(value)
    return (
      <WideField label={label}>
        {isImage ? (
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
        )}
      </WideField>
    )
  }

  // Long free text reads better full-width (fewer wrapped lines) than
  // squeezed into the fixed-width label column.
  if (!isEmpty && typeof value === 'string' && value.length > 90) {
    return (
      <WideField label={label}>
        <p className="text-[13px] text-zinc-700 dark:text-zinc-200 whitespace-pre-wrap break-words leading-relaxed">{value}</p>
      </WideField>
    )
  }

  let display: React.ReactNode
  if (isEmpty) {
    display = <span className="text-zinc-300 dark:text-zinc-600">—</span>
  } else if (Array.isArray(value)) {
    display = (
      <div className="flex flex-wrap gap-1.5">
        {value.map((v, i) => (
          <span key={i} className="text-[12px] font-medium text-zinc-700 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-md">
            {String(v)}
          </span>
        ))}
      </div>
    )
  } else {
    display = <span className="whitespace-pre-wrap break-words">{String(value)}</span>
  }

  return <Field label={label}>{display}</Field>
}
