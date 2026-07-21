'use client'

import { useState } from 'react'
import { Sparkles, Shuffle } from 'lucide-react'

/* "Did you know?" — a compact fun-fact chip in the home footer. The shuffle
   button pulls another fact; it never auto-rotates (nothing loops). The text
   WRAPS to show the whole fact — no truncation — so longer facts aren't cut off. */

export function FunFact({ facts, initialIndex }: { facts: string[]; initialIndex: number }) {
  const [i, setI] = useState(((initialIndex % facts.length) + facts.length) % facts.length)

  const shuffle = () => {
    if (facts.length < 2) return
    setI((prev) => (prev + 1 + Math.floor(Math.random() * (facts.length - 1))) % facts.length)
  }

  return (
    <div className="flex min-w-0 max-w-[620px] items-start gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40">
      <Sparkles size={13} className="mt-0.5 flex-shrink-0 text-amber-500" />
      <span className="text-[11.5px] leading-relaxed text-zinc-500 dark:text-zinc-400">{facts[i]}</span>
      {facts.length > 1 && (
        <button
          onClick={shuffle}
          aria-label="Show another fact"
          title="Another fact"
          className="mt-0.5 flex-shrink-0 text-zinc-400 transition-colors hover:text-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-600 dark:hover:text-zinc-200"
        >
          <Shuffle size={12} />
        </button>
      )}
    </div>
  )
}
