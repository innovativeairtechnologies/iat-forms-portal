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
    <div className="mt-10 border-t border-hairline pt-6">
      <div className="flex items-center justify-between gap-3">
        {prevHref ? (
          <Link
            href={prevHref}
            className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3.5 py-2.5 text-[13px] font-medium text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink"
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
              ? 'border border-brand bg-brand-soft text-brand-ink'
              : 'border border-hairline bg-surface text-ink-secondary hover:border-brand hover:text-brand',
          ].join(' ')}
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
          {completed ? 'Completed' : 'Mark complete'}
        </button>

        {nextHref ? (
          <Link
            href={nextHref}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Next <ChevronRight size={15} />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-lg border border-hairline bg-surface px-4 py-2.5 text-[13px] font-medium text-ink-muted">
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
            className="fixed bottom-5 right-5 z-50 w-[300px] overflow-hidden rounded-xl border border-hairline bg-surface shadow-[0_8px_24px_rgba(31,30,27,.10),0_2px_6px_rgba(31,30,27,.05)] dark:shadow-none dark:ring-1 dark:ring-white/10"
          >
            <div className="flex items-start gap-3 p-4">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-brand-soft text-brand-ink">
                <Sparkles size={19} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[14px] font-[650] text-ink">
                  +{award.xpAwarded} XP
                </p>
                <p className="text-[12px] text-ink-secondary">Lesson complete · {award.totalXp.toLocaleString()} XP total</p>
                {award.leveledUp && (
                  <p className="mt-1.5 inline-flex items-center gap-1 rounded-md bg-brand px-1.5 py-0.5 text-[11px] font-semibold text-white">
                    <ArrowUp size={11} /> Level {award.level} · {award.levelTitle}
                  </p>
                )}
              </div>
              <button onClick={() => setAward(null)} className="text-ink-faint transition-colors hover:text-ink-secondary">
                <X size={15} />
              </button>
            </div>

            {award.newBadges.length > 0 && (
              <div className="border-t border-hairline bg-surface-soft px-4 py-3">
                <p className="mb-2 text-[10px] font-[650] uppercase tracking-widest text-ink-muted">
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
                        <span className="text-[12.5px] font-semibold text-ink-secondary">{b.label}</span>
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
