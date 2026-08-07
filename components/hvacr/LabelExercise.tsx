'use client'

/* Label the diagram.
 *
 * Pick a chip, click a target. Click a placed chip to take it back. Deliberately
 * click-to-place rather than HTML5 drag-and-drop: drag events do not fire on
 * touch, and half this course's audience is on a phone in a van.
 */

import { useMemo, useState } from 'react'
import { LABEL_SETS } from '@/lib/hvacr/exercises'
import { DiagramCanvas, DiagramChip, DiagramSpot } from './Diagram'
import { ExerciseCard, GhostButton, PrimaryButton, ScorePill } from './WidgetFrame'
import { useShuffled } from './use-shuffle'

export default function LabelExercise({ set }: { set?: string }) {
  const data = set ? LABEL_SETS[set] : undefined
  const chips = useMemo(() => data?.chips ?? [], [data])
  const { order } = useShuffled(chips)

  /** spot id → chip id placed in it. */
  const [placed, setPlaced] = useState<Record<string, string>>({})
  const [selected, setSelected] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  if (!data) {
    return (
      <ExerciseCard title="Exercise unavailable" description="">
        <p className="text-[13px] text-ink-muted">
          This lesson refers to a labelling exercise (<code>{set ?? 'unnamed'}</code>) that isn’t defined.
        </p>
      </ExerciseCard>
    )
  }

  const placedChipIds = new Set(Object.values(placed))
  const pool = order.filter((c) => !placedChipIds.has(c.id))

  const placeAt = (spotId: string) => {
    if (placed[spotId]) {
      // Clicking a filled spot returns its chip to the pool.
      setPlaced(({ [spotId]: _removed, ...rest }) => rest)
      setChecked(false)
      return
    }
    if (!selected) return
    setPlaced((prev) => ({ ...prev, [spotId]: selected }))
    setSelected(null)
    setChecked(false)
  }

  const reset = () => {
    setPlaced({})
    setSelected(null)
    setChecked(false)
  }

  const correctCount = data.spots.filter((s) => placed[s.id] === s.id).length
  const allPlaced = Object.keys(placed).length === data.spots.length

  const chipText = (id: string) => chips.find((c) => c.id === id)?.text ?? id

  return (
    <ExerciseCard title={data.title} description={data.description}>
      <DiagramCanvas viewBox={data.viewBox} svg={data.svg} maxWidth={data.maxWidth}>
        {data.spots.map((spot) => {
          const chipId = placed[spot.id]
          const state = !chipId
            ? 'empty'
            : !checked
              ? 'filled'
              : chipId === spot.id
                ? 'correct'
                : 'incorrect'
          return (
            <DiagramSpot
              key={spot.id}
              x={spot.x}
              y={spot.y}
              state={state}
              onClick={() => placeAt(spot.id)}
              label={chipId ? `${chipText(chipId)} — click to remove` : 'Empty label position'}
            >
              {chipId ? chipText(chipId) : null}
            </DiagramSpot>
          )
        })}
      </DiagramCanvas>

      <div className="mt-5 flex min-h-[2.5rem] flex-wrap justify-center gap-2">
        {pool.map((chip) => (
          <DiagramChip
            key={chip.id}
            selected={selected === chip.id}
            onClick={() => setSelected((s) => (s === chip.id ? null : chip.id))}
          >
            {chip.text}
          </DiagramChip>
        ))}
        {pool.length === 0 ? (
          <span className="self-center text-[12px] text-ink-muted">
            All labels placed — check your answers.
          </span>
        ) : null}
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <PrimaryButton onClick={() => setChecked(true)} disabled={!allPlaced}>
          Check answers
        </PrimaryButton>
        <GhostButton onClick={reset} disabled={Object.keys(placed).length === 0}>
          Reset
        </GhostButton>
        {checked ? <ScorePill correct={correctCount} total={data.spots.length} /> : null}
      </div>
    </ExerciseCard>
  )
}
