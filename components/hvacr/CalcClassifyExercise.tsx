'use client'

/* Two-step drill: work the number out, then say what it means.
 *
 * Separate from the plain classifier because the arithmetic is the point.
 * Superheat is a subtraction and total load is an addition — trivial sums that
 * technicians still get backwards under pressure, so step 1 shows its working
 * before step 2 asks for the judgement.
 */

import { useMemo, useState } from 'react'
import { CALC_SETS } from '@/lib/hvacr/exercises'
import { cn } from '@/lib/utils'
import { ExerciseCard, GhostButton, Overline, ResultNote } from './WidgetFrame'
import { useShuffled } from './use-shuffle'

export default function CalcClassifyExercise({ set }: { set?: string }) {
  const data = set ? CALC_SETS[set] : undefined
  const indices = useMemo(() => data?.scenarios.map((_, i) => i) ?? [], [data])
  const { order } = useShuffled(indices)

  const [step, setStep] = useState(0)
  const [picked, setPicked] = useState<string | null>(null)

  if (!data) {
    return (
      <ExerciseCard title="Exercise unavailable" description="">
        <p className="text-[13px] text-ink-muted">
          This lesson refers to a calculation exercise (<code>{set ?? 'unnamed'}</code>) that isn’t defined.
        </p>
      </ExerciseCard>
    )
  }

  const position = step % order.length
  const scenario = data.scenarios[order[position]]
  const answered = picked !== null
  const isCorrect = picked === scenario.correct
  const correctLabel = data.options.find((o) => o.value === scenario.correct)?.label ?? scenario.correct

  return (
    <ExerciseCard title={data.title} description={data.description}>
      <dl className="space-y-1.5">
        {scenario.givens.map((g) => (
          <div key={g.label} className="flex flex-wrap justify-between gap-2 text-[13px]">
            <dt className="text-ink-secondary">{g.label}</dt>
            <dd className="font-medium tabular-nums text-ink">{g.value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 rounded-lg border border-hairline bg-surface-soft px-3.5 py-3">
        <Overline>Step 1 — {scenario.workedLabel}</Overline>
        <p className="mt-1 text-[14px] font-medium tabular-nums text-ink">{scenario.worked}</p>

        <div className="mt-4">
          <Overline>Step 2 — {data.step2}</Overline>
          <div className="mt-2 flex flex-wrap gap-2">
            {data.options.map((opt) => {
              const state = !answered
                ? 'idle'
                : opt.value === scenario.correct
                  ? 'correct'
                  : opt.value === picked
                    ? 'incorrect'
                    : 'idle'
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => !answered && setPicked(opt.value)}
                  disabled={answered}
                  className={cn(
                    'rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-colors duration-150',
                    'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                    state === 'idle' &&
                      'border-hairline-strong bg-surface text-ink-secondary hover:bg-surface-strong hover:text-ink disabled:hover:bg-surface',
                    state === 'correct' &&
                      'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300',
                    state === 'incorrect' &&
                      'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-300',
                  )}
                >
                  {opt.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {answered ? (
        <div className="mt-4">
          <ResultNote tone={isCorrect ? 'correct' : 'incorrect'}>
            <span className="font-semibold">{isCorrect ? 'Correct.' : 'Not quite.'}</span>{' '}
            {isCorrect ? scenario.detail : `The answer is “${correctLabel}”. ${scenario.detail}`}
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
