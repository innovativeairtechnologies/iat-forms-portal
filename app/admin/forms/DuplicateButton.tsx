'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Copy, Loader2 } from 'lucide-react'

export default function DuplicateButton({ formId }: { formId: string }) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const duplicate = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/forms/${formId}/duplicate`, { method: 'POST' })
      if (!res.ok) throw new Error('Failed')
      const { id } = await res.json()
      router.push(`/admin/forms/${id}/edit`)
      router.refresh()
    } catch {
      alert('Failed to duplicate form. Please try again.')
      setLoading(false)
    }
  }

  return (
    <button
      onClick={duplicate}
      disabled={loading}
      title="Duplicate form"
      className="p-2 rounded-lg text-gray-400 hover:text-indigo-500 hover:bg-indigo-50 transition-all disabled:opacity-40"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />}
    </button>
  )
}
