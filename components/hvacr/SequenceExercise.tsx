'use client'

/* Put the steps in order.
 *
 * Arrow buttons are the primary control, not a fallback — a LOTO sequence gets
 * practised on a phone as often as on a laptop, and drag-and-drop is unreliable
 * on touch. Native drag is wired up too for mouse users who reach for it.
 */

import { useMemo, useState } from 'react'
import { SEQUENCE_SETS } from '@/lib/hvacr/exercises'
import { cn } from '@/lib/utils'
import { ExerciseCard, GhostButton, PrimaryButton, ScorePill } from './WidgetFrame'
import { useShuffled } from './use-shuffle'

export default function SequenceExercise({ set }: { set?: string }) {
  const data = set ? SEQUENCE_SETS[set] : undefined
  const ids = useMemo(() => data?.items.map((i) => i.id) ?? [], [data])
  const { order: shuffled, reshuffle } = useShuffled(ids)

  const [order, setOrder] = useState<string[] | null>(null)
  const [checked, setChecked] = useState(false)
  const [dragging, setDragging] = useState<number | null>(null)

  if (!data) {
    return (
      <ExerciseCard title="Exercise unavailable" description="">
        <p className="text-[13px] text-ink-muted">
          This lesson refers to an ordering exercise (<code>{set ?? 'unnamed'}</code>) that isn’t defined.
        </p>
      </ExerciseCard>
    )
  }

  const current = order ?? shuffled

  const move = (from: number, to: number) => {
    if (to < 0 || to >= current.length) return
    const next = [...current]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    setOrder(next)
    setChecked(false)
  }

  const shuffleAgain = () => {
    setOrder(null)
    setChecked(false)
    reshuffle()
  }

  const correctCount = current.filter((id, i) => id === data.answer[i]).length
  const textFor = (id: string) => data.items.find((i) => i.id === id)?.text ?? id

  return (
    <ExerciseCard title={data.title} description={data.description}>
      <ol className="space-y-2">
        {current.map((id, i) => {
          const state = !checked ? 'idle' : id === data.answer[i] ? 'correct' : 'incorrect'
          return (
            <li
              key={id}
              draggable
              onDragStart={() => setDragging(i)}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault()
                if (dragging !== null) move(dragging, i)
                setDragging(null)
              }}
              className={cn(
                'flex items-center gap-3 rounded-lg border px-3 py-2.5 transition-colors duration-150',
                state === 'idle' && 'border-hairline bg-surface-soft',
                state === 'correct' &&
                  'border-emerald-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10',
                state === 'incorrect' &&
                  'border-rose-200 bg-rose-50 dark:border-rose-500/20 dark:bg-rose-500/10',
              )}
            >
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-surface-strong text-[11px] font-semibold tabular-nums text-ink-secondary">
                {i + 1}
              </span>
              <span className="flex-1 text-[13px] leading-relaxed text-ink">{textFor(id)}</span>
              <span className="flex shrink-0 flex-col gap-0.5">
                <button
                  type="button"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move "${textFor(id)}" up`}
                  className="h-[18px] w-6 rounded border border-hairline-strong bg-surface text-[9px] leading-none text-ink-secondary hover:bg-surface-strong disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                >
                  ▲
                </button>
                <button
                  type="button"
                  onClick={() => move(i, i + 1)}
                  disabled={i === current.length - 1}
                  aria-label={`Move "${textFor(id)}" down`}
                  className="h-[18px] w-6 rounded border border-hairline-strong bg-surface text-[9px] leading-none text-ink-secondary hover:bg-surface-strong disabled:opacity-30 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
                >
                  ▼
                </button>
              </span>
            </li>
          )
        })}
      </ol>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={() => setChecked(true)}>Check order</PrimaryButton>
        <GhostButton onClick={shuffleAgain}>Shuffle again</GhostButton>
        {checked ? <ScorePill correct={correctCount} total={current.length} /> : null}
      </div>
    </ExerciseCard>
  )
}
