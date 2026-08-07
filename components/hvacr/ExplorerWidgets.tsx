'use client'

/* Click-to-explore widgets: pick a thing, read what it does.
 *
 * Four subjects need the same interaction with different content, so they share
 * one file and one visual grammar — a chooser, then a detail panel that always
 * appears in the same place.
 */

import { useState } from 'react'
import {
  COMPONENT_MAP_NODES,
  CONTROL_SEQUENCE_STEPS,
  HAZARDS,
  SYSTEM_TYPES,
} from '@/lib/hvacr/exercises'
import { SVG } from '@/lib/hvacr/palette'
import { cn } from '@/lib/utils'
import { DiagramCanvas, DiagramSpot } from './Diagram'
import {
  GhostButton,
  Overline,
  PrimaryButton,
  ResultNote,
  ToggleButton,
  WidgetBody,
  WidgetFrame,
} from './WidgetFrame'

const cardCx =
  'rounded-lg border px-3.5 py-3 text-left text-[13px] transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/* ── Hazard → PPE ─────────────────────────────────────────────────────────── */

export function PpeMatcher() {
  const [id, setId] = useState<string | null>(null)
  const hazard = HAZARDS.find((h) => h.id === id)

  return (
    <WidgetFrame caption="Click a hazard to see the PPE it calls for, and why that PPE and not something else.">
      <WidgetBody>
        <div className="grid gap-2 sm:grid-cols-2">
          {HAZARDS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setId(h.id)}
              aria-pressed={h.id === id}
              className={cn(
                cardCx,
                h.id === id
                  ? 'border-brand bg-brand-soft font-medium text-brand-ink'
                  : 'border-hairline bg-surface text-ink-secondary hover:border-hairline-strong hover:text-ink',
              )}
            >
              {h.label}
            </button>
          ))}
        </div>
        <div className="mt-4">
          {hazard ? (
            <ResultNote>
              <Overline>Required PPE — {hazard.label}</Overline>
              <ul className="mt-2 space-y-1">
                {hazard.ppe.map((p) => (
                  <li key={p} className="text-ink">
                    {p}
                  </li>
                ))}
              </ul>
              <p className="mt-2">{hazard.why}</p>
            </ResultNote>
          ) : (
            <ResultNote>Pick a hazard above to see the PPE it requires.</ResultNote>
          )}
        </div>
      </WidgetBody>
    </WidgetFrame>
  )
}

/* ── The extended system loop ─────────────────────────────────────────────── */

const LOOP_SVG = `<path d="M 60 120 C 60 60, 440 60, 440 120 C 440 260, 440 300, 300 330 C 200 350, 100 340, 60 260 C 40 200, 40 160, 60 120 Z" fill="none" stroke="${SVG.neutral}" stroke-width="3" stroke-dasharray="6 4"/>`

export function ComponentMap() {
  const [id, setId] = useState<string | null>(null)
  const node = COMPONENT_MAP_NODES.find((n) => n.id === id)

  return (
    <WidgetFrame caption="Every accessory on a real system sits somewhere specific on the loop. Click one to see what it does and why it lives there.">
      <WidgetBody>
        <DiagramCanvas viewBox="0 0 500 400" svg={LOOP_SVG} maxWidth={520}>
          {COMPONENT_MAP_NODES.map((n) => (
            <DiagramSpot
              key={n.id}
              x={n.x}
              y={n.y}
              state={n.id === id ? 'correct' : 'filled'}
              onClick={() => setId(n.id)}
              label={n.label}
            >
              {n.label}
            </DiagramSpot>
          ))}
        </DiagramCanvas>
        <div className="mt-4">
          <ResultNote>
            {node ? (
              <>
                <span className="font-medium text-ink">{node.label}.</span> {node.info}
              </>
            ) : (
              'Click a component on the loop to learn its role.'
            )}
          </ResultNote>
        </div>
      </WidgetBody>
    </WidgetFrame>
  )
}

/* ── A call for cooling, step by step ─────────────────────────────────────── */

export function ControlSequence() {
  const [i, setI] = useState(0)
  const step = CONTROL_SEQUENCE_STEPS[i]
  const last = i === CONTROL_SEQUENCE_STEPS.length - 1

  return (
    <WidgetFrame caption="Step through a call for cooling, from the thermostat closing to the compressor pumping down.">
      <WidgetBody>
        <ol className="flex flex-wrap gap-2">
          {CONTROL_SEQUENCE_STEPS.map((s, si) => (
            <li key={s.label} className="min-w-[100px] flex-1">
              <button
                type="button"
                onClick={() => setI(si)}
                aria-current={si === i ? 'step' : undefined}
                className={cn(
                  'w-full rounded-lg border px-2 py-3 text-center text-[11.5px] font-medium transition-colors duration-150',
                  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                  si === i
                    ? 'border-brand bg-brand-soft text-brand-ink'
                    : si < i
                      ? 'border-hairline-strong bg-surface-soft text-ink-secondary'
                      : 'border-hairline bg-surface text-ink-muted hover:text-ink',
                )}
              >
                {s.label}
              </button>
            </li>
          ))}
        </ol>

        <div className="mt-4">
          <ResultNote>
            <span className="font-medium text-ink">
              Step {i + 1} — {step.label}.
            </span>{' '}
            {step.info}
          </ResultNote>
        </div>

        <div className="mt-4 flex items-center gap-2">
          <GhostButton onClick={() => setI((v) => Math.max(0, v - 1))} disabled={i === 0}>
            ← Previous
          </GhostButton>
          <PrimaryButton onClick={() => setI(last ? 0 : i + 1)}>
            {last ? 'Start over' : 'Next →'}
          </PrimaryButton>
          <span className="text-[12px] tabular-nums text-ink-muted">
            {i + 1} / {CONTROL_SEQUENCE_STEPS.length}
          </span>
        </div>
      </WidgetBody>
    </WidgetFrame>
  )
}

/* ── System types side by side ────────────────────────────────────────────── */

export function SystemTypes() {
  const [i, setI] = useState(0)
  const type = SYSTEM_TYPES[i]

  return (
    <WidgetFrame
      caption="Same cycle, six very different machines. Pick one to see its operating range and what it typically runs on."
      tabs={SYSTEM_TYPES.map((t, ti) => (
        <ToggleButton key={t.label} active={ti === i} onClick={() => setI(ti)}>
          {t.label}
        </ToggleButton>
      ))}
    >
      <WidgetBody>
        <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <div>
            <Overline>Typical temperature range</Overline>
            <dd className="mt-1 text-[13px] tabular-nums text-ink">{type.temp}</dd>
          </div>
          <div>
            <Overline>Common refrigerants</Overline>
            <dd className="mt-1 text-[13px] text-ink">{type.refrigerants}</dd>
          </div>
        </dl>
        <p className="mt-4 text-[13px] leading-relaxed text-ink-secondary">{type.note}</p>
      </WidgetBody>
    </WidgetFrame>
  )
}
