'use client'

import { useState } from 'react'
import { Download, Loader2 } from 'lucide-react'

interface Props {
  formId?: string
  isRead?: string
  search?: string
  formTitle?: string
}

export default function ExportButton({ formId, isRead, search, formTitle }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('limit', '2000')
      if (formId) params.set('form_id', formId)
      if (isRead !== undefined) params.set('is_read', isRead)
      if (search) params.set('search', search)

      const res = await fetch(`/api/submissions?${params.toString()}`)
      const { data } = await res.json()
      if (!data?.length) return

      // Collect all unique field keys across submissions
      const allKeys = new Set<string>()
      data.forEach((sub: { data: Record<string, unknown> }) => {
        Object.keys(sub.data || {}).forEach((k) => allKeys.add(k))
      })
      const fieldKeys = Array.from(allKeys)

      // Build CSV rows
      const headers = ['Submission ID', 'Form', 'Submitted At', 'Read', ...fieldKeys]
      const rows = data.map((sub: { id: string; form_title: string; submitted_at: string; is_read: boolean; data: Record<string, unknown> }) => {
        const base = [
          sub.id,
          sub.form_title || '',
          new Date(sub.submitted_at).toLocaleString(),
          sub.is_read ? 'Yes' : 'No',
        ]
        const fields = fieldKeys.map((k) => {
          const val = sub.data?.[k]
          if (val === undefined || val === null) return ''
          if (Array.isArray(val)) return val.join('; ')
          if (typeof val === 'string' && val.startsWith('data:image')) return '[Signature]'
          if (typeof val === 'string' && val.startsWith('http')) return val
          return String(val)
        })
        return [...base, ...fields]
      })

      const csvContent = [headers, ...rows]
        .map((row) => row.map((cell: unknown) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${formTitle ? formTitle.replace(/[^a-z0-9]/gi, '-').toLowerCase() : 'submissions'}-export.csv`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 dark:border-zinc-700 rounded-lg text-[13px] font-medium text-gray-600 dark:text-gray-300 hover:border-gray-300 dark:hover:border-zinc-600 hover:bg-gray-50 dark:hover:bg-zinc-800 hover:text-gray-900 dark:hover:text-white transition-all disabled:opacity-50"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
      Export CSV
    </button>
  )
}
