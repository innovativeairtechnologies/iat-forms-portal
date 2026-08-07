'use client'

/* Read the scenario, pick the answer, get the reasoning.
 *
 * Ungraded drill, so the explanation shows on a wrong answer too — that is the
 * whole value of a rehearsal. The graded knowledge check at the end of the
 * subject behaves the opposite way and never reveals its key on a fail
 * (docs/learn.md); these two are deliberately different instruments.
 */

import { useMemo, useState } from 'react'
import { CLASSIFY_SETS } from '@/lib/hvacr/exercises'
import { cn } from '@/lib/utils'
import { ExerciseCard, GhostButton, ResultNote } from './WidgetFrame'
import { useShuffled } from './use-shuffle'

const optionCx =
  'rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

export default function ClassifyExercise({ set }: { set?: string }) {
  const data = set ? CLASSIFY_SETS[set] : undefined
  const indices = useMemo(() => data?.scenarios.map((_, i) => i) ?? [], [data])
  const { order } = useShuffled(indices)

  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<number | null>(null)

  if (!data) {
    return (
      <ExerciseCard title="Exercise unavailable" description="">
        <p className="text-[13px] text-ink-muted">
          This lesson refers to a classification exercise (<code>{set ?? 'unnamed'}</code>) that isn’t
          defined.
        </p>
      </ExerciseCard>
    )
  }

  const position = step % order.length
  const scenario = data.scenarios[order[position]]
  const answered = picked !== null
  const isCorrect = picked === scenario.correct

  return (
    <ExerciseCard title={data.title} description={data.description}>
      <p className="text-[14px] leading-relaxed text-ink">{scenario.prompt}</p>

      <div className="mt-4 flex flex-wrap gap-2">
        {scenario.options.map((opt, oi) => {
          const state = !answered
            ? 'idle'
            : oi === scenario.correct
              ? 'correct'
              : oi === picked
                ? 'incorrect'
                : 'idle'
          return (
            <button
              key={opt}
              type="button"
              onClick={() => !answered && setPicked(oi)}
              disabled={answered}
              className={cn(
                optionCx,
                state === 'idle' &&
                  'border-hairline-strong bg-surface text-ink-secondary hover:bg-surface-soft hover:text-ink disabled:hover:bg-surface',
                state === 'correct' &&
                  'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
                state === 'incorrect' &&
                  'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
              )}
            >
              {opt}
            </button>
          )
        })}
      </div>

      {answered ? (
        <div className="mt-4">
          <ResultNote tone={isCorrect ? 'correct' : 'incorrect'}>
            <span className="font-semibold">{isCorrect ? 'Correct.' : 'Not quite.'}</span>{' '}
            {scenario.explain}
          </ResultNote>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <GhostButton
          onClick={() => {
            setStep((s) => s + 1)
            setPicked(null)
          }}
        >
          Next scenario →
        </GhostButton>
        <span className="text-[12px] tabular-nums text-ink-muted">
          {position + 1} / {order.length}
        </span>
      </div>
    </ExerciseCard>
  )
}
