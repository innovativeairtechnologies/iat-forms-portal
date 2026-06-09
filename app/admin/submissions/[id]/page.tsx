import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft, Calendar, User } from 'lucide-react'
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

export default async function SubmissionDetailPage({ params }: { params: { id: string } }) {
  const result = await getData(params.id)
  if (!result) notFound()

  const { submission, fields } = result
  const submitterName = submission.data?.['Employee Name'] || submission.data?.['Full Name'] || submission.data?.['Name'] || null
  const initials = submitterName
    ? String(submitterName).split(' ').map((n: string) => n[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div className="flex-1 overflow-auto">
      <MarkAsRead submissionId={submission.id} isRead={submission.is_read} />
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <Link
          href="/admin/submissions"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-5"
        >
          <ArrowLeft size={13} />
          All Submissions
        </Link>
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-[#f0faf4] dark:bg-[#089447]/20 flex items-center justify-center flex-shrink-0 text-[15px] font-bold text-[#089447]">
              {initials}
            </div>
            <div>
              <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight">
                {submitterName || 'Anonymous Submission'}
              </h1>
              <div className="flex items-center gap-4 mt-1">
                <span className="flex items-center gap-1.5 text-[12px] text-gray-400">
                  <User size={12} />
                  {submission.form_title}
                </span>
                <span className="flex items-center gap-1.5 text-[12px] text-gray-400">
                  <Calendar size={12} />
                  {formatDateTime(submission.submitted_at)}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <SubmissionStatus
              submissionId={submission.id}
              initialStatus={(submission.status as 'open' | 'in_progress' | 'resolved') || 'open'}
            />
            <SubmissionDetailClient submission={submission} fields={fields} />
          </div>
        </div>
      </div>

      <div className="p-8 max-w-5xl">
        <div className="grid gap-4">
          {/* Field values */}
          <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card overflow-hidden">
            {fields.map((field: { id: string; label: string; field_type: string }, index: number) => {
              const value = submission.data[field.label]
              return (
                <FieldRow
                  key={field.id}
                  label={field.label}
                  value={value}
                  fieldType={field.field_type}
                  isLast={index === fields.length - 1}
                />
              )
            })}
            {fields.length === 0 && (
              <div className="py-12 text-center text-[13px] text-gray-400">No field data</div>
            )}
          </div>

          {/* Notes */}
          <SubmissionNotes submissionId={submission.id} />
        </div>

        <p className="mt-4 text-[11px] text-gray-300 dark:text-gray-700 font-mono">ID: {submission.id}</p>
      </div>
    </div>
  )
}

function FieldRow({
  label, value, fieldType, isLast
}: {
  label: string; value: unknown; fieldType: string; isLast: boolean
}) {
  const isEmpty = value === undefined || value === null || value === ''

  let display: React.ReactNode = <span className="text-gray-300 dark:text-gray-700 text-[13px]">—</span>

  if (!isEmpty) {
    if (fieldType === 'signature' && typeof value === 'string' && value.startsWith('data:image')) {
      display = (
        <div className="mt-1">
          <img src={value} alt="Signature" className="max-w-[280px] border border-gray-100 dark:border-gray-800 rounded-xl" />
        </div>
      )
    } else if (fieldType === 'file' && typeof value === 'string' && value.startsWith('http')) {
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(value)
      display = isImage ? (
        <div className="mt-1">
          <img src={value} alt={label} className="max-w-[280px] max-h-48 object-contain border border-gray-100 dark:border-gray-800 rounded-xl mb-2" />
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#089447] hover:underline">
            View full file
          </a>
        </div>
      ) : (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-[13px] text-[#089447] hover:underline">
          {value}
        </a>
      )
    } else if (Array.isArray(value)) {
      display = (
        <div className="flex flex-wrap gap-1.5 mt-1">
          {value.map((v, i) => (
            <span key={i} className="text-[12px] font-medium text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700 px-2.5 py-1 rounded-lg">
              {String(v)}
            </span>
          ))}
        </div>
      )
    } else {
      display = <span className="text-[14px] text-gray-800 dark:text-gray-200 whitespace-pre-wrap">{String(value)}</span>
    }
  }

  return (
    <div className={`px-6 py-5 grid grid-cols-[180px_1fr] gap-6 ${!isLast ? 'border-b border-gray-50 dark:border-gray-800' : ''}`}>
      <dt>
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest leading-none">
          {label}
        </span>
      </dt>
      <dd>{display}</dd>
    </div>
  )
}
