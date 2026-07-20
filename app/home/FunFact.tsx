'use client'

import { useState } from 'react'
import { Sparkles, Shuffle } from 'lucide-react'

/* "Did you know?" — a compact glassy chip that sits in the home header on the
   gradient band. A shuffle button pulls another fact; it never auto-rotates
   (nothing loops, per DESIGN.md). */

export function FunFact({ facts, initialIndex }: { facts: string[]; initialIndex: number }) {
  const [i, setI] = useState(((initialIndex % facts.length) + facts.length) % facts.length)

  const shuffle = () => {
    if (facts.length < 2) return
    setI((prev) => (prev + 1 + Math.floor(Math.random() * (facts.length - 1))) % facts.length)
  }

  return (
    <div className="flex max-w-[220px] items-center gap-2 rounded-lg border border-hairline bg-white/70 px-2.5 py-1.5 dark:bg-white/10 sm:max-w-[300px] xl:max-w-[420px]">
      <Sparkles size={13} className="flex-shrink-0 text-amber-500" />
      <span className="truncate text-[11.5px] text-ink-secondary" title={facts[i]}>{facts[i]}</span>
      {facts.length > 1 && (
        <button
          onClick={shuffle}
          aria-label="Show another fact"
          title="Another fact"
          className="flex-shrink-0 text-ink-muted transition-colors hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <Shuffle size={12} />
        </button>
      )}
    </div>
  )
}
