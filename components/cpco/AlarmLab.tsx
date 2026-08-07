'use client'

import { useMemo, useState } from 'react'
import { Flame, RefreshCcw, Wind } from 'lucide-react'
import { cn } from '@/lib/utils'
import PanelDisplay from './PanelDisplay'
import {
  iatTree,
  POINTS,
  PROCESS_PATH,
  renderScreen,
  STAGE_LABELS,
  type BacnetPoint,
  type Stage,
} from '@/lib/cpco'

/* Fault injection: break the unit, watch two places light up at once.

   The teaching point is that the panel and the building system are two views of
   the same machine. Toggle "React Overtemp" here and the alarm appears on the
   pGD's alarm mask AND flips BinaryInput 0 (Summary Alarm) plus its own
   BinaryInput on the BACnet side — which is exactly the phone call: "my BAS
   shows an alarm, what does your panel say?"

   The airflow strip is a diagram, not a scale drawing. Process air runs left to
   right through the stages; reactivation runs beneath the wheel. The SOO will
   refine positions; the structure comes from the point list itself (every
   sensor and alarm already knows its stage — lib/cpco/points.ts). */

const ALARMS = POINTS.filter(p => p.group === 'alarm' && p.instance !== 0)

function alarmsForStage(stage: Stage): BacnetPoint[] {
  return ALARMS.filter(a => a.stage === stage)
}

const SENSORS = POINTS.filter(p => p.group === 'sensor')

export default function AlarmLab({ className }: { className?: string }) {
  const [active, setActive] = useState<Set<number>>(new Set())

  const toggle = (instance: number) => {
    setActive(prev => {
      const next = new Set(prev)
      if (next.has(instance)) next.delete(instance)
      else next.add(instance)
      return next
    })
  }

  const summaryOn = active.size > 0

  /* The panel's alarm mask, rendered by the same engine the simulator uses. */
  const panelRows = useMemo(() => {
    const screen = iatTree.screens['iat.alarms']
    const alarms = ALARMS.filter(a => active.has(a.instance)).map(a => ({
      code: `${String(a.instance).padStart(2, '0')}`,
      label: a.description,
    }))
    return renderScreen(screen, { values: {}, cursor: -1, digit: 0, selection: 0, alarms })
  }, [active])

  return (
    <div className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}>
      <div className="border-b border-hairline px-5 py-4">
        {/* Type goes on the span, not the h3: `.learn-prose-interactive h3` in
            globals.css resets font-size/weight/letter-spacing to `inherit` at
            specificity (0,1,1), which beats a Tailwind utility (0,1,0). */}
        <h3>
          <span className="text-[15px] font-medium text-ink">Break the unit</span>
        </h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
          Click a stage’s alarm to make it happen. Watch the panel’s alarm list and the BACnet
          points react together — they are two views of the same machine.
        </p>
      </div>

      {/* ── the airflow strip ─────────────────────────────────────────────── */}
      <div className="overflow-x-auto px-5 py-4">
        <div className="flex min-w-[720px] items-stretch gap-1.5">
          {PROCESS_PATH.map((stage, i) => {
            const stageAlarms = alarmsForStage(stage)
            const stageSensors = SENSORS.filter(s => s.stage === stage)
            const isWheel = stage === 'wheel'
            const lit = stageAlarms.some(a => active.has(a.instance))
            return (
              <div key={stage} className="flex items-center gap-1.5">
                {i > 0 && <span className="text-ink-faint">→</span>}
                <div
                  className={cn(
                    'flex h-full min-w-[86px] flex-col rounded-lg border px-2.5 py-2',
                    isWheel ? 'border-hairline-strong bg-surface-soft' : 'border-hairline',
                    lit && 'border-rose-400 dark:border-rose-500',
                  )}
                >
                  <span className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
                    {isWheel ? <RefreshCcw size={11} /> : <Wind size={11} />}
                    {STAGE_LABELS[stage]}
                  </span>
                  {stageSensors.length > 0 && (
                    <span className="mt-1 text-[10.5px] tabular-nums text-ink-faint">
                      {stageSensors.map(s => `AI${s.instance}`).join(' · ')}
                    </span>
                  )}
                  <span className="mt-auto flex flex-wrap gap-1 pt-1.5">
                    {stageAlarms.map(a => (
                      <FaultChip key={a.instance} point={a} on={active.has(a.instance)} toggle={toggle} />
                    ))}
                  </span>
                </div>
              </div>
            )
          })}
        </div>

        {/* reactivation runs the other way, under the wheel */}
        <div className="mt-2 flex min-w-[720px] items-center gap-2 rounded-lg border border-dashed border-hairline px-3 py-2">
          <Flame size={12} className="shrink-0 text-ink-muted" />
          <span className="text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Reactivation
          </span>
          <span className="text-[10.5px] tabular-nums text-ink-faint">
            {SENSORS.filter(s => s.stage === 'react')
              .map(s => `AI${s.instance}`)
              .join(' · ')}
          </span>
          <span className="ml-auto flex flex-wrap justify-end gap-1">
            {alarmsForStage('react').map(a => (
              <FaultChip key={a.instance} point={a} on={active.has(a.instance)} toggle={toggle} />
            ))}
          </span>
        </div>

        {/* unit-level faults (fans, wheel drive) that aren't tied to one stage */}
        <div className="mt-2 flex min-w-[720px] flex-wrap items-center gap-1 px-1">
          <span className="mr-1 text-[11px] font-medium uppercase tracking-wide text-ink-muted">
            Unit
          </span>
          {alarmsForStage('unit').map(a => (
            <FaultChip key={a.instance} point={a} on={active.has(a.instance)} toggle={toggle} />
          ))}
        </div>
      </div>

      {/* ── the two views of the same fault ──────────────────────────────── */}
      <div className="grid gap-4 border-t border-hairline px-5 py-4 md:grid-cols-2">
        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-faint">
            What the panel shows
          </p>
          <PanelDisplay rows={panelRows} />
        </div>

        <div>
          <p className="mb-2 text-[11px] uppercase tracking-wider text-ink-faint">
            What the building system sees
          </p>
          <ul className="overflow-hidden rounded-lg border border-hairline text-[12.5px]">
            <li
              className={cn(
                'flex items-center justify-between border-b border-hairline-soft px-3 py-2',
                summaryOn && 'bg-rose-50 dark:bg-rose-950',
              )}
            >
              <span className="text-ink">
                <span className="tabular-nums text-ink-muted">BI 0</span> Summary Alarm
              </span>
              <Value on={summaryOn} />
            </li>
            {ALARMS.filter(a => active.has(a.instance)).map(a => (
              <li
                key={a.instance}
                className="flex items-center justify-between border-b border-hairline-soft bg-rose-50 px-3 py-2 last:border-b-0 dark:bg-rose-950"
              >
                <span className="text-ink">
                  <span className="tabular-nums text-ink-muted">BI {a.instance}</span> {a.description}
                </span>
                <Value on />
              </li>
            ))}
            {!summaryOn && (
              <li className="px-3 py-2 text-ink-muted">
                Everything healthy — every BinaryInput reads 0.
              </li>
            )}
          </ul>
          {summaryOn && (
            <p className="mt-2 text-[12px] leading-relaxed text-ink-secondary">
              Most integrators map only BI 0 and call us when it flips. The per-alarm points are
              what let their graphics say <em>which</em> alarm without a phone call.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function FaultChip({
  point,
  on,
  toggle,
}: {
  point: BacnetPoint
  on: boolean
  toggle: (instance: number) => void
}) {
  return (
    <button
      type="button"
      onClick={() => toggle(point.instance)}
      aria-pressed={on}
      title={point.note ?? point.description}
      className={cn(
        'rounded-full border px-2 py-0.5 text-[10.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        on
          ? 'border-rose-400 bg-rose-50 text-rose-700 dark:border-rose-500 dark:bg-rose-950 dark:text-rose-300'
          : 'border-hairline text-ink-muted hover:border-hairline-strong hover:text-ink',
      )}
    >
      {point.description}
    </button>
  )
}

function Value({ on }: { on?: boolean }) {
  return (
    <span
      className={cn(
        'tabular-nums text-[12px] font-medium',
        on ? 'text-rose-700 dark:text-rose-300' : 'text-ink-muted',
      )}
    >
      {on ? '1 · ALARM' : '0 · OK'}
    </span>
  )
}
