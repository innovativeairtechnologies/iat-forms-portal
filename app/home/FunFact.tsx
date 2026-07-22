'use client'

import { useState } from 'react'
import { Sparkles, Shuffle } from 'lucide-react'

/* "Did you know?" — a subtle fun-fact line that sits at the base of the gradient
   greeting hero (light text on green). The shuffle button pulls another fact; it
   never auto-rotates (nothing loops). The text WRAPS — no truncation — so long
   facts are never cut off. */

export function FunFact({ facts, initialIndex }: { facts: string[]; initialIndex: number }) {
  const [i, setI] = useState(((initialIndex % facts.length) + facts.length) % facts.length)

  const shuffle = () => {
    if (facts.length < 2) return
    setI((prev) => (prev + 1 + Math.floor(Math.random() * (facts.length - 1))) % facts.length)
  }

  return (
    <div className="flex max-w-[62ch] items-start gap-2 text-emerald-50/80">
      <Sparkles size={13} className="mt-0.5 flex-shrink-0 text-emerald-200/90" />
      <span className="text-[11.5px] leading-relaxed">{facts[i]}</span>
      {facts.length > 1 && (
        <button
          onClick={shuffle}
          aria-label="Show another fact"
          title="Another fact"
          className="mt-0.5 flex-shrink-0 text-emerald-100/70 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/60"
        >
          <Shuffle size={12} />
        </button>
      )}
    </div>
  )
}
