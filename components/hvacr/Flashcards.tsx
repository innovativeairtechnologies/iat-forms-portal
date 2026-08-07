'use client'

/* Key-term flashcards.
 *
 * A real 3D flip, but gated on prefers-reduced-motion — with motion reduced the
 * face swaps instantly instead, which is the same information without the
 * rotation. The card is a button so it flips from the keyboard too.
 */

import { useState } from 'react'
import { KEY_TERMS } from '@/lib/hvacr/terms'
import { cn } from '@/lib/utils'
import { ExerciseCard, GhostButton, usePrefersReducedMotion } from './WidgetFrame'

function Card({ term, def, reduced }: { term: string; def: string; reduced: boolean }) {
  const [flipped, setFlipped] = useState(false)

  if (reduced) {
    return (
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        aria-expanded={flipped}
        className={cn(
          'h-[96px] w-full overflow-y-auto rounded-lg border px-3.5 py-3 text-left transition-colors duration-150',
          'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
          flipped
            ? 'border-hairline-strong bg-surface-soft text-[11.5px] leading-relaxed text-ink-secondary'
            : 'border-hairline bg-surface text-[13px] font-medium text-ink hover:border-hairline-strong',
        )}
      >
        {flipped ? def : term}
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={() => setFlipped((f) => !f)}
      aria-expanded={flipped}
      className="h-[96px] w-full [perspective:800px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span
        className={cn(
          'relative block h-full w-full transition-transform duration-500 [transform-style:preserve-3d]',
          flipped && '[transform:rotateY(180deg)]',
        )}
      >
        <span className="absolute inset-0 flex items-center rounded-lg border border-hairline bg-surface px-3.5 py-3 text-left text-[13px] font-medium text-ink [backface-visibility:hidden]">
          {term}
        </span>
        <span className="absolute inset-0 flex items-start overflow-y-auto rounded-lg border border-hairline-strong bg-surface-soft px-3.5 py-3 text-left text-[11.5px] leading-relaxed text-ink-secondary [backface-visibility:hidden] [transform:rotateY(180deg)]">
          {def}
        </span>
      </span>
    </button>
  )
}

export default function Flashcards({ module }: { module?: string }) {
  const terms = module ? KEY_TERMS[module] : undefined
  const reduced = usePrefersReducedMotion()
  // Remounts every card, which resets each one to its term side.
  const [generation, setGeneration] = useState(0)

  if (!terms?.length) {
    return (
      <ExerciseCard title="Key terms unavailable" description="">
        <p className="text-[13px] text-ink-muted">
          No key terms are defined for <code>{module ?? 'this subject'}</code>.
        </p>
      </ExerciseCard>
    )
  }

  return (
    <ExerciseCard
      title="Key terms"
      description="Click a card to reveal the definition, and click again to flip it back."
    >
      <div className="grid gap-2 sm:grid-cols-2">
        {terms.map((t) => (
          <Card key={`${generation}-${t.term}`} term={t.term} def={t.def} reduced={reduced} />
        ))}
      </div>
      <div className="mt-4">
        <GhostButton onClick={() => setGeneration((g) => g + 1)}>Flip all back</GhostButton>
      </div>
    </ExerciseCard>
  )
}
