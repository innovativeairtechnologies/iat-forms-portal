'use client'

import { useState } from 'react'
import { Sparkles, Shuffle } from 'lucide-react'

/* "Did you know?" strip. The fact is chosen server-side per day (stable across a
   render); a shuffle button lets the reader pull another. Deliberately does NOT
   auto-rotate — per DESIGN.md, nothing loops (the Jerry orb is the sole exception). */

export function FunFact({ facts, initialIndex }: { facts: string[]; initialIndex: number }) {
  const [i, setI] = useState(((initialIndex % facts.length) + facts.length) % facts.length)

  const shuffle = () => {
    if (facts.length < 2) return
    // advance by a random non-zero step so it always changes
    setI((prev) => (prev + 1 + Math.floor(Math.random() * (facts.length - 1))) % facts.length)
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-surface-strong text-ink-muted">
        <Sparkles size={15} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Did you know?</p>
        <p className="mt-0.5 text-[13px] leading-relaxed text-ink-secondary">{facts[i]}</p>
      </div>
      {facts.length > 1 && (
        <button
          onClick={shuffle}
          title="Another fact"
          aria-label="Show another fact"
          className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Shuffle size={14} />
        </button>
      )}
    </div>
  )
}
