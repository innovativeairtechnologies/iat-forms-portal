'use client'

import { useState } from 'react'
import { FileText, Loader2 } from 'lucide-react'

interface Props {
  formId: string
  formTitle: string
}

export default function PullReportButton({ formId, formTitle }: Props) {
  const [loading, setLoading] = useState(false)

  const handleReport = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ form_id: formId, limit: '2000' })
      const res = await fetch(`/api/submissions?${params}`)
      const { data } = await res.json()
      if (!data?.length) { setLoading(false); return }

      const allKeys = new Set<string>()
      data.forEach((sub: { data: Record<string, unknown> }) => {
        Object.keys(sub.data || {}).forEach((k) => allKeys.add(k))
      })
      const fieldKeys = Array.from(allKeys)

      const rows = data.map((sub: { id: string; submitted_at: string; is_read: boolean; data: Record<string, unknown>; status?: string }) => {
        const fields = fieldKeys.map((k) => {
          const val = sub.data?.[k]
          if (val === undefined || val === null) return '<span class="text-gray-300">—</span>'
          if (typeof val === 'string' && val.startsWith('data:image')) return '<em class="text-gray-400">Signature</em>'
          if (Array.isArray(val)) return val.join(', ')
          return String(val)
        })
        const dateStr = new Date(sub.submitted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
        const status = sub.status || 'open'
        const statusCls = status === 'resolved' ? 'color:#089447' : status === 'in_progress' ? 'color:#d97706' : 'color:#6b7280'
        return `<tr>
          <td style="padding:8px 12px;font-size:12px;color:#6b7280;border-bottom:1px solid #f3f4f6;white-space:nowrap">${dateStr}</td>
          <td style="padding:8px 12px;font-size:12px;${statusCls};border-bottom:1px solid #f3f4f6;text-transform:capitalize">${status.replace('_', ' ')}</td>
          ${fields.map((f) => `<td style="padding:8px 12px;font-size:12px;color:#374151;border-bottom:1px solid #f3f4f6;max-width:220px;overflow:hidden;text-overflow:ellipsis">${f}</td>`).join('')}
        </tr>`
      }).join('')

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${formTitle} — Report</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 32px; color: #111; }
    h1 { font-size: 22px; font-weight: 700; margin: 0 0 4px; }
    p.meta { font-size: 12px; color: #6b7280; margin: 0 0 24px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; }
    thead th { padding: 8px 12px; text-align: left; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; border-bottom: 2px solid #e5e7eb; white-space: nowrap; }
    tbody tr:hover { background: #f9fafb; }
    @media print { body { padding: 16px; } @page { margin: 12mm; } }
  </style>
</head>
<body>
  <h1>${formTitle}</h1>
  <p class="meta">Generated ${new Date().toLocaleString()} · ${data.length} submission${data.length !== 1 ? 's' : ''}</p>
  <table>
    <thead><tr>
      <th>Date</th><th>Status</th>
      ${fieldKeys.map((k) => `<th>${k}</th>`).join('')}
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <script>window.onload = () => { window.print() }</script>
</body>
</html>`

      const win = window.open('', '_blank')
      if (win) {
        win.document.write(html)
        win.document.close()
      }
    } catch (e) {
      console.error('Report failed:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <button
      onClick={handleReport}
      disabled={loading}
      className="flex items-center gap-2 px-3 py-1.5 border border-[#089447] rounded-lg text-[13px] font-medium text-[#089447] hover:bg-[#f0faf4] dark:hover:bg-[#089447]/10 transition-all disabled:opacity-50"
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : <FileText size={13} />}
      Pull Report
    </button>
  )
}
