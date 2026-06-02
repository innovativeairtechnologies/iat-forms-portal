'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'
import type { Submission, FormField } from '@/lib/supabase'

interface Props {
  submission: Submission
  fields: FormField[]
}

export default function SubmissionDetailClient({ submission, fields }: Props) {
  const [downloading, setDownloading] = useState(false)

  const handlePDFDownload = async () => {
    setDownloading(true)
    try {
      const { generateSubmissionPDF } = await import('@/lib/pdf')
      const blob = await generateSubmissionPDF(submission, fields)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `submission-${submission.id.slice(0, 8)}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('PDF generation failed:', e)
    } finally {
      setDownloading(false)
    }
  }

  return (
    <button
      onClick={handlePDFDownload}
      disabled={downloading}
      className="flex items-center gap-2 bg-[#1a1a2e] hover:bg-[#0f0f20] text-white text-sm font-semibold px-4 py-2.5 rounded-[8px] transition-colors disabled:opacity-60 flex-shrink-0"
    >
      {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
      {downloading ? 'Generating…' : 'Download PDF'}
    </button>
  )
}
