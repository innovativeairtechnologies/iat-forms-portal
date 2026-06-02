import { supabaseAdmin } from '@/lib/supabase-admin'
import { notFound } from 'next/navigation'
import { formatDateTime } from '@/lib/utils'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import SubmissionDetailClient from './SubmissionDetailClient'

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

  // Mark as read
  if (!submission.is_read) {
    await supabaseAdmin.from('submissions').update({ is_read: true }).eq('id', id)
  }

  return { submission, fields: fields || [] }
}

export default async function SubmissionDetailPage({ params }: { params: { id: string } }) {
  const result = await getData(params.id)
  if (!result) notFound()

  const { submission, fields } = result

  return (
    <div className="p-8 max-w-3xl">
      <div className="mb-6">
        <Link href="/admin/submissions" className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4">
          <ArrowLeft size={15} />
          Back to Submissions
        </Link>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#1a1a2e]">{submission.form_title}</h1>
            <p className="text-sm text-gray-500 mt-1">Submitted {formatDateTime(submission.submitted_at)}</p>
          </div>
          <SubmissionDetailClient submission={submission} fields={fields} />
        </div>
      </div>

      {/* Field values */}
      <div className="bg-white border border-gray-200 rounded-[8px] divide-y divide-gray-100">
        {fields.map((field: { id: string; label: string; field_type: string }) => {
          const value = submission.data[field.label]
          return (
            <FieldRow key={field.id} label={field.label} value={value} fieldType={field.field_type} />
          )
        })}
        {fields.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">No field data</div>
        )}
      </div>

      <p className="mt-4 text-xs text-gray-400">Submission ID: {submission.id}</p>
    </div>
  )
}

function FieldRow({ label, value, fieldType }: { label: string; value: unknown; fieldType: string }) {
  const isEmpty = value === undefined || value === null || value === ''

  let display: React.ReactNode = <span className="text-gray-300 italic">—</span>

  if (!isEmpty) {
    if (fieldType === 'signature' && typeof value === 'string' && value.startsWith('data:image')) {
      display = (
        <img src={value} alt="Signature" className="max-w-[300px] border border-gray-100 rounded" />
      )
    } else if (fieldType === 'file' && typeof value === 'string' && value.startsWith('http')) {
      const isImage = /\.(jpg|jpeg|png|gif|webp)$/i.test(value)
      display = isImage ? (
        <div>
          <img src={value} alt={label} className="max-w-[300px] max-h-48 object-contain border border-gray-100 rounded mb-2" />
          <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0a7cff] hover:underline">
            View file
          </a>
        </div>
      ) : (
        <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-[#0a7cff] hover:underline">
          {value}
        </a>
      )
    } else if (Array.isArray(value)) {
      display = <span>{value.join(', ')}</span>
    } else {
      display = <span className="whitespace-pre-wrap">{String(value)}</span>
    }
  }

  return (
    <div className="px-5 py-4 grid grid-cols-[180px_1fr] gap-4">
      <dt className="text-xs font-semibold text-gray-400 uppercase tracking-wide pt-0.5">{label}</dt>
      <dd className="text-sm text-[#1a1a2e]">{display}</dd>
    </div>
  )
}
