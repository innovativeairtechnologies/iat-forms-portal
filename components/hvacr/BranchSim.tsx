'use client'

/* Branching service calls — play the technician.
 *
 * The wrong turns are the content. Every scenario contains at least one choice
 * that sounds professional and costs the customer money (recover refrigerant
 * because head pressure is high), and walking into it on a screen is the
 * cheapest place to learn it.
 *
 * The breadcrumb keeps every step you took visible, so a bad ending can be
 * traced back to the decision that caused it rather than feeling arbitrary.
 */

import { useState } from 'react'
import { BRANCH_SCENARIOS, type BranchScenario } from '@/lib/hvacr/branch'
import { cn } from '@/lib/utils'
import { ExerciseCard, GhostButton, Overline, PrimaryButton, ResultNote } from './WidgetFrame'

function Runner({ scenario, onBack }: { scenario: BranchScenario; onBack: () => void }) {
  const [path, setPath] = useState<string[]>([scenario.startNode])
  const node = scenario.nodes[path[path.length - 1]]

  const restart = () => setPath([scenario.startNode])

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <GhostButton onClick={onBack}>← Choose a different scenario</GhostButton>
        <Overline>
          {scenario.title} · step {path.length}
        </Overline>
      </div>

      {node.terminal ? (
        <div className="mt-4">
          <ResultNote tone={node.correct ? 'correct' : 'incorrect'}>
            <p className="font-semibold">{node.prompt}</p>
            <p className="mt-2">{node.resultText}</p>
          </ResultNote>
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton onClick={restart}>Restart this scenario</PrimaryButton>
            {path.length > 1 ? (
              <GhostButton onClick={() => setPath((p) => p.slice(0, -1))}>
                ← Undo that last choice
              </GhostButton>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <p className="mt-4 rounded-lg border-l-2 border-brand bg-surface-soft px-4 py-3 text-[14px] leading-relaxed text-ink">
            {node.prompt}
          </p>
          <div className="mt-3 flex flex-col gap-2">
            {node.choices?.map((choice) => (
              <button
                key={choice.next + choice.label}
                type="button"
                onClick={() => setPath((p) => [...p, choice.next])}
                className={cn(
                  'rounded-lg border border-hairline bg-surface px-3.5 py-3 text-left text-[13px] leading-relaxed text-ink-secondary',
                  'transition-colors duration-150 hover:border-hairline-strong hover:bg-surface-soft hover:text-ink',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                )}
              >
                {choice.label}
              </button>
            ))}
          </div>
          {path.length > 1 ? (
            <div className="mt-3">
              <GhostButton onClick={() => setPath((p) => p.slice(0, -1))}>← Back a step</GhostButton>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}

export default function BranchSim() {
  const [id, setId] = useState<string | null>(null)
  const scenario = BRANCH_SCENARIOS.find((s) => s.id === id)

  return (
    <ExerciseCard
      title="Service call simulator"
      description="Play the technician. Make diagnostic choices and live with the consequences — including the common wrong turns."
    >
      {scenario ? (
        <Runner scenario={scenario} onBack={() => setId(null)} />
      ) : (
        <div className="grid gap-2">
          {BRANCH_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setId(s.id)}
              className={cn(
                'rounded-lg border border-hairline bg-surface px-4 py-3.5 text-left',
                'transition-colors duration-150 hover:border-hairline-strong hover:bg-surface-soft',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              )}
            >
              <span className="block text-[14px] font-medium text-ink">{s.title}</span>
              <span className="mt-1 block text-[13px] leading-relaxed text-ink-muted">{s.intro}</span>
            </button>
          ))}
        </div>
      )}
    </ExerciseCard>
  )
}
