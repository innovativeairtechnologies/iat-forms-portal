'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

export default function LessonFooterNav({
  lessonId,
  initiallyCompleted,
  prevHref,
  nextHref,
}: {
  lessonId: string
  initiallyCompleted: boolean
  prevHref: string | null
  nextHref: string | null
}) {
  const router = useRouter()
  const [completed, setCompleted] = useState(initiallyCompleted)
  const [saving, setSaving] = useState(false)

  async function toggleComplete() {
    const next = !completed
    setSaving(true)
    setCompleted(next) // optimistic
    try {
      const res = await fetch('/api/learn/progress', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lessonId, completed: next }),
      })
      if (!res.ok) throw new Error('save failed')
      router.refresh()
    } catch {
      setCompleted(!next) // revert on failure
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mt-10 border-t border-gray-100 pt-6">
      <div className="flex items-center justify-between gap-3">
        {prevHref ? (
          <Link
            href={prevHref}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2.5 text-[13px] font-medium text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900"
          >
            <ChevronLeft size={15} /> Previous
          </Link>
        ) : (
          <span />
        )}

        <button
          onClick={toggleComplete}
          disabled={saving}
          className={[
            'inline-flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13px] font-semibold transition-all disabled:opacity-60',
            completed
              ? 'border border-[#089447] bg-[#f0faf4] text-[#077a3c]'
              : 'border border-gray-200 bg-white text-gray-600 hover:border-[#089447] hover:text-[#077a3c]',
          ].join(' ')}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {completed ? 'Completed' : 'Mark complete'}
        </button>

        {nextHref ? (
          <Link
            href={nextHref}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#089447] px-4 py-2.5 text-[13px] font-semibold text-white shadow-card transition-all hover:-translate-y-0.5 hover:bg-[#077a3c] hover:shadow-card-hover"
          >
            Next <ChevronRight size={15} />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-[13px] font-medium text-gray-400">
            End of subject
          </span>
        )}
      </div>
    </div>
  )
}
