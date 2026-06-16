'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Check, ChevronLeft, ChevronRight, Loader2, Sparkles, ArrowUp, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { BadgeIcon, TIER_STYLE } from './BadgeIcon'

type Award = {
  xpAwarded: number
  totalXp: number
  level: number
  levelTitle: string
  leveledUp: boolean
  newBadges: { key: string; label: string; icon: string; tier: string }[]
}

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
  const [award, setAward] = useState<Award | null>(null)

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
      const data = await res.json().catch(() => ({}))
      if (next && data.award) {
        setAward(data.award)
        window.setTimeout(() => setAward(null), 6000)
      }
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

      {/* Celebration toast */}
      <AnimatePresence>
        {award && (
          <motion.div
            initial={{ opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.96 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="fixed bottom-5 right-5 z-50 w-[300px] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-xl"
          >
            <div className="flex items-start gap-3 p-4">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-[#f0faf4] text-[#089447]">
                <Sparkles size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-bold text-[#0a0a0b]">
                  +{award.xpAwarded} XP
                </p>
                <p className="text-[12px] text-gray-500">Lesson complete · {award.totalXp.toLocaleString()} XP total</p>
                {award.leveledUp && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-[#089447] px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    <ArrowUp size={11} /> Level {award.level} · {award.levelTitle}
                  </p>
                )}
              </div>
              <button onClick={() => setAward(null)} className="text-gray-300 transition-colors hover:text-gray-500">
                <X size={15} />
              </button>
            </div>

            {award.newBadges.length > 0 && (
              <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-3">
                <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-400">
                  {award.newBadges.length === 1 ? 'Badge unlocked' : 'Badges unlocked'}
                </p>
                <div className="space-y-1.5">
                  {award.newBadges.map(b => {
                    const t = TIER_STYLE[b.tier] ?? TIER_STYLE.bronze
                    return (
                      <div key={b.key} className="flex items-center gap-2">
                        <span className={`grid h-7 w-7 place-items-center rounded-lg ${t.bg} ${t.text} ring-1 ${t.ring}`}>
                          <BadgeIcon name={b.icon} size={15} />
                        </span>
                        <span className="text-[12.5px] font-semibold text-gray-700">{b.label}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
