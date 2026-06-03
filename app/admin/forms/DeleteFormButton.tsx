'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Trash2, Loader2 } from 'lucide-react'

interface Props {
  formId: string
  formTitle: string
  submissionCount: number
}

export default function DeleteFormButton({ formId, formTitle, submissionCount }: Props) {
  const router = useRouter()
  const [confirming, setConfirming] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleDelete = async () => {
    setLoading(true)
    await fetch(`/api/forms/${formId}`, { method: 'DELETE' })
    router.refresh()
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-1.5 pl-1">
        <div className="text-right">
          <p className="text-[11px] font-bold text-red-500 whitespace-nowrap leading-none">Delete form?</p>
          {submissionCount > 0 && (
            <p className="text-[10px] text-red-400 whitespace-nowrap mt-0.5 leading-none">
              {submissionCount} submission{submissionCount !== 1 ? 's' : ''} will remain
            </p>
          )}
        </div>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="flex items-center justify-center h-7 px-2.5 rounded-lg text-[11px] font-bold text-white bg-red-500 hover:bg-red-600 transition-colors disabled:opacity-50 flex-shrink-0"
        >
          {loading ? <Loader2 size={11} className="animate-spin" /> : 'Delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="h-7 px-2.5 rounded-lg text-[11px] font-bold text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-all flex-shrink-0"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      title={`Delete "${formTitle}"`}
      className="p-2 rounded-lg text-gray-300 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
    >
      <Trash2 size={14} />
    </button>
  )
}
