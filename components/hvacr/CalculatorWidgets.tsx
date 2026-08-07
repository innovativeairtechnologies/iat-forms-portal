'use client'

/* The working tools: type readings in, see what they mean.
 *
 * These are teaching instruments, not engineering ones. Where a number could
 * plausibly be carried into real work — the psychrometric chart especially —
 * the widget says on its face what it is and is not for, and points at the tool
 * that does the real job.
 */

import { useMemo, useState } from 'react'
import { DIAGNOSTIC_QUADRANTS, PM_TASKS } from '@/lib/hvacr/exercises'
import { SVG } from '@/lib/hvacr/palette'
import { fToC, humidityRatioFromPwHpa, psychrometrics, satPressHPa } from '@/lib/hvacr/psychrometrics'
import { cn } from '@/lib/utils'
import {
  GhostButton,
  NumberField,
  Overline,
  ResultNote,
  SelectField,
  Slider,
  WidgetBody,
  WidgetFrame,
} from './WidgetFrame'

const num = (v: string): number | null => {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : null
}

/* ── Temperature converter ────────────────────────────────────────────────── */

export function TempConverter() {
  const [f, setF] = useState('55')
  const [c, setC] = useState('12.78')

  const onF = (v: string) => {
    setF(v)
    const n = num(v)
    setC(n === null ? '' : String(Math.round(((n - 32) * 5) / 9 / 0.01) * 0.01))
  }
  const onC = (v: string) => {
    setC(v)
    const n = num(v)
    setF(n === null ? '' : String(Math.round(((n * 9) / 5 + 32) / 0.01) * 0.01))
  }

  const fv = num(f)
  const cv = num(c)

  return (
    <WidgetFrame caption="Type into either field. Rankine and Kelvin are the absolute scales — they start at absolute zero, which is why thermodynamic formulas need them.">
      <WidgetBody>
        <div className="flex flex-wrap gap-4">
          <NumberField label="Fahrenheit" value={f} onChange={onF} suffix="°F" />
          <NumberField label="Celsius" value={c} onChange={onC} suffix="°C" />
        </div>
        <div className="mt-4">
          <ResultNote>
            {fv === null || cv === null ? (
              'Enter a value in either field.'
            ) : (
              <span className="tabular-nums">
                {fv}°F = {cv}°C = {(fv + 459.67).toFixed(2)}°R = {(cv + 273.15).toFixed(2)} K
              </span>
            )}
          </ResultNote>
        </div>
      </WidgetBody>
    </WidgetFrame>
  )
}

/* ── Superheat / subcooling diagnostic quadrant ───────────────────────────── */

/** Which corner a pair of readings lands in, or null when both are normal.
 *  Normal is 6–14°F for both; the source course's simplification, kept. */
function quadrantFor(sh: number, sc: number): string | null {
  const shHigh = sh > 14
  const shLow = sh < 6
  const scHigh = sc > 14
  const scLow = sc < 6
  if (shHigh && !scHigh) return 'highSH-lowSC'
  if (!shHigh && scHigh) return 'lowSH-highSC'
  if (shHigh && scHigh) return 'highSH-highSC'
  if (shLow && scLow) return 'lowSH-lowSC'
  return null
}

const QUADRANT_POSITION: Record<string, { left: string; top: string }> = {
  'lowSH-highSC': { left: '0%', top: '0%' },
  'highSH-highSC': { left: '50%', top: '0%' },
  'lowSH-lowSC': { left: '0%', top: '50%' },
  'highSH-lowSC': { left: '50%', top: '50%' },
}

export function DiagnosticQuadrant() {
  const [sh, setSh] = useState('10')
  const [sc, setSc] = useState('10')

  const shv = num(sh)
  const scv = num(sc)
  const active = shv !== null && scv !== null ? quadrantFor(shv, scv) : null

  const marker =
    shv !== null && scv !== null
      ? {
          left: `${(Math.max(0, Math.min(20, scv)) / 20) * 100}%`,
          top: `${100 - (Math.max(0, Math.min(20, shv)) / 20) * 100}%`,
        }
      : null

  return (
    <WidgetFrame caption="Enter readings and see where they land on the classic charge/airflow diagnostic quadrant.">
      <WidgetBody>
        <div className="flex flex-wrap gap-4">
          <NumberField label="Superheat" value={sh} onChange={setSh} suffix="°F" />
          <NumberField label="Subcooling" value={sc} onChange={setSc} suffix="°F" />
        </div>

        <div className="mt-5 flex flex-wrap items-start gap-8">
          <div className="ml-7 mb-6">
            <div className="relative h-[240px] w-[240px] overflow-hidden rounded-lg border border-hairline">
              {DIAGNOSTIC_QUADRANTS.map((qd) => {
                const pos = QUADRANT_POSITION[qd.id]
                const isActive = qd.id === active
                return (
                  <div
                    key={qd.id}
                    style={{ left: pos.left, top: pos.top }}
                    className={cn(
                      'absolute flex h-1/2 w-1/2 flex-col items-center justify-center border border-hairline-soft p-2 text-center transition-colors duration-150',
                      isActive ? 'bg-brand-soft' : 'bg-surface',
                    )}
                  >
                    <span
                      className={cn(
                        'text-[10px] font-semibold',
                        isActive ? 'text-brand-ink' : 'text-ink-muted',
                      )}
                    >
                      {qd.title}
                    </span>
                    <span
                      className={cn(
                        'mt-1 text-[10px] leading-tight',
                        isActive ? 'text-brand-ink' : 'text-ink-faint',
                      )}
                    >
                      {qd.body}
                    </span>
                  </div>
                )
              })}

              {marker ? (
                <span
                  aria-hidden="true"
                  style={{ left: marker.left, top: marker.top, background: SVG.compressor }}
                  className="absolute z-10 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface transition-all duration-150"
                />
              ) : null}

              <span className="absolute -bottom-6 left-0 right-0 text-center text-[10.5px] font-medium text-ink-muted">
                Subcooling: low → high
              </span>
              <span className="absolute -left-7 bottom-0 top-0 flex items-center text-[10.5px] font-medium text-ink-muted [writing-mode:vertical-rl] rotate-180">
                Superheat: high → low
              </span>
            </div>
          </div>

          <div className="max-w-[280px] flex-1">
            <ResultNote tone={active ? 'incorrect' : 'correct'}>
              {active
                ? `${DIAGNOSTIC_QUADRANTS.find((qd) => qd.id === active)?.body}.`
                : 'Both readings are inside the normal 6–14°F band — nothing here points at a charge or airflow fault.'}
            </ResultNote>
            <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
              A simplified teaching tool. The quadrant narrows the search; it never closes it. Always
              confirm against airflow and a visual inspection before you touch the charge.
            </p>
          </div>
        </div>
      </WidgetBody>
    </WidgetFrame>
  )
}

/* ── Psychrometric chart ──────────────────────────────────────────────────── */

const MIN_F = 40
const MAX_F = 100
const MAX_W = 0.03
const xFor = (f: number) => 20 + ((f - MIN_F) / (MAX_F - MIN_F)) * 430
const yFor = (w: number) => 230 - (w / MAX_W) * 210

export function PsychrometricChart() {
  const [dbt, setDbt] = useState('75')
  const [rh, setRh] = useState('50')

  /* Each label sits at the END OF ITS OWN CURVE, not at max temperature.
     The 80% and 100% lines run off the top of the chart well before 100°F, so
     anchoring their labels to the right-hand edge stacked them both at y≈20 and
     they rendered on top of each other as "8100%". */
  const curves = useMemo(
    () =>
      [20, 40, 60, 80, 100].map((rhPct) => {
        const pts: string[] = []
        let lastX = xFor(MIN_F)
        let lastY = yFor(0)
        for (let f = MIN_F; f <= MAX_F; f += 2) {
          const w = humidityRatioFromPwHpa(satPressHPa(fToC(f)) * (rhPct / 100))
          if (w > MAX_W) break
          lastX = xFor(f)
          lastY = yFor(w)
          pts.push(`${lastX.toFixed(1)},${lastY.toFixed(1)}`)
        }
        // A curve that ran the full width gets its label outside the plot;
        // one that exited through the top gets it just left of where it left.
        const ranToEdge = lastX >= xFor(MAX_F) - 1
        return {
          rhPct,
          d: `M${pts.join('L')}`,
          labelX: ranToEdge ? 452 : lastX + 4,
          labelY: ranToEdge ? lastY + 3 : Math.max(10, lastY - 4),
          anchor: ranToEdge ? ('start' as const) : ('middle' as const),
        }
      }),
    [],
  )

  const dbtv = num(dbt)
  const rhv = num(rh)
  const point = dbtv !== null && rhv !== null ? psychrometrics(dbtv, rhv) : null

  return (
    <WidgetFrame caption="A simplified psychrometric chart. Move the numbers and watch the state point move — the curves are lines of constant relative humidity.">
      <WidgetBody>
        <div className="flex flex-wrap gap-4">
          <NumberField label="Dry-bulb temperature" value={dbt} onChange={setDbt} suffix="°F" />
          <NumberField label="Relative humidity" value={rh} onChange={setRh} suffix="%" />
        </div>

        <div className="mt-4 overflow-hidden rounded-lg border border-hairline bg-surface-soft">
          <svg viewBox="0 0 480 260" xmlns="http://www.w3.org/2000/svg" className="block w-full">
            <title>Psychrometric chart</title>
            {curves.map((c) => (
              <g key={c.rhPct}>
                <path
                  d={c.d}
                  fill="none"
                  stroke={c.rhPct === 100 ? SVG.wireLive : SVG.neutral}
                  strokeWidth={c.rhPct === 100 ? 2 : 1}
                />
                <text
                  x={c.labelX}
                  y={c.labelY}
                  fontSize="9"
                  fill={SVG.wire}
                  textAnchor={c.anchor}
                >
                  {c.rhPct}%
                </text>
              </g>
            ))}
            <text x="240" y="252" fontSize="10" textAnchor="middle" fill={SVG.wire}>
              Dry-bulb temperature (°F)
            </text>
            {point && dbtv !== null ? (
              <circle
                cx={xFor(dbtv)}
                cy={yFor(Math.min(point.humidityRatio, MAX_W))}
                r="6"
                fill={SVG.compressor}
                stroke="var(--surface)"
                strokeWidth="2"
              />
            ) : null}
          </svg>
        </div>

        <div className="mt-4">
          <ResultNote>
            {point ? (
              <span className="tabular-nums">
                Humidity ratio <span className="font-medium text-ink">{point.grainsPerLb.toFixed(0)} gr/lb</span>{' '}
                · dew point <span className="font-medium text-ink">{point.dewPointF.toFixed(1)}°F</span>
              </span>
            ) : (
              'Enter a dry-bulb temperature and relative humidity.'
            )}
          </ResultNote>
          <p className="mt-3 text-[12px] leading-relaxed text-ink-muted">
            Approximate, for teaching only — it assumes sea-level pressure and a simplified saturation
            curve. Never size equipment from this. Real selection work goes through the{' '}
            <a
              href="/admin/sizing-studio"
              className="font-medium text-ink underline decoration-hairline-strong underline-offset-2 hover:text-brand-ink"
            >
              Sizing Studio
            </a>
            .
          </p>
        </div>
      </WidgetBody>
    </WidgetFrame>
  )
}

/* ── Micron gauge ─────────────────────────────────────────────────────────── */

export function MicronGauge() {
  const [microns, setMicrons] = useState(10000)

  // Log scale — the interesting range is 100–1000 and a linear track would
  // squash all of it into the first 9% of the bar.
  const pct = Math.min(
    100,
    Math.max(0, ((Math.log(microns) - Math.log(100)) / (Math.log(10000) - Math.log(100))) * 100),
  )

  const verdict =
    microns <= 500
      ? { tone: 'correct' as const, label: 'PASS', text: 'System is dry. Safe to break vacuum and charge.' }
      : microns <= 1000
        ? {
            tone: 'neutral' as const,
            label: 'MARGINAL',
            text: 'Keep pumping — moisture or a small leak may still be present.',
          }
        : {
            tone: 'incorrect' as const,
            label: 'FAIL',
            text: 'Too wet or leaking. Do not charge yet.',
          }

  return (
    <WidgetFrame caption="Drag the gauge reading and see whether the system is actually ready to charge.">
      <WidgetBody>
        <Overline>Micron gauge — is the vacuum deep enough?</Overline>

        <div className="relative mt-4 h-6 rounded-full bg-surface-strong">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-emerald-500"
            style={{ width: '5%' }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 bg-amber-500"
            style={{ left: '5%', width: '5%' }}
            aria-hidden="true"
          />
          <div
            className="absolute inset-y-0 right-0 rounded-r-full bg-rose-500"
            style={{ left: '10%' }}
            aria-hidden="true"
          />
          <div
            className="absolute -top-1.5 h-9 w-1 rounded-full bg-ink transition-[left] duration-150"
            style={{ left: `calc(${pct}% - 2px)` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex justify-between text-[10px] tabular-nums text-ink-muted">
          <span>100 microns</span>
          <span>500</span>
          <span>1,000</span>
          <span>10,000</span>
        </div>

        <div className="mt-4">
          <Slider
            label="Gauge reading"
            min={100}
            max={10000}
            step={50}
            value={microns}
            onChange={setMicrons}
            readout={`${microns.toLocaleString()} µ`}
          />
        </div>

        <div className="mt-4">
          <ResultNote tone={verdict.tone}>
            <span className="font-semibold">{verdict.label}</span> — {microns.toLocaleString()} microns.{' '}
            {verdict.text}
          </ResultNote>
        </div>
      </WidgetBody>
    </WidgetFrame>
  )
}

/* ── Seasonal PM checklist ────────────────────────────────────────────────── */

export function PmChecklist() {
  const [done, setDone] = useState<Set<number>>(new Set())

  const toggle = (i: number) =>
    setDone((prev) => {
      const next = new Set(prev)
      if (next.has(i)) next.delete(i)
      else next.add(i)
      return next
    })

  const pct = Math.round((done.size / PM_TASKS.length) * 100)

  return (
    <WidgetFrame caption="Work through a seasonal PM checklist. Nothing here is recorded — it is a rehearsal of the order you would actually do it in.">
      <WidgetBody>
        <div className="flex items-center justify-between text-[12px] text-ink-muted">
          <span className="tabular-nums">
            {done.size} / {PM_TASKS.length} complete
          </span>
          <span className="tabular-nums">{pct}%</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-strong">
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-150"
            style={{ width: `${pct}%` }}
          />
        </div>

        <ul className="mt-4 space-y-1">
          {PM_TASKS.map((task, i) => (
            <li key={task}>
              <label className="flex cursor-pointer items-start gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-ink-secondary transition-colors duration-150 hover:bg-surface-soft">
                <input
                  type="checkbox"
                  checked={done.has(i)}
                  onChange={() => toggle(i)}
                  className="mt-0.5 h-4 w-4 accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                />
                <span className={cn(done.has(i) && 'text-ink-muted line-through')}>{task}</span>
              </label>
            </li>
          ))}
        </ul>

        <div className="mt-3">
          <GhostButton onClick={() => setDone(new Set())} disabled={done.size === 0}>
            Reset checklist
          </GhostButton>
        </div>
      </WidgetBody>
    </WidgetFrame>
  )
}

/* ── EPA 608: certification picker + leak rate ────────────────────────────── */

export function EpaTools() {
  const [certType, setCertType] = useState('small')
  const [charge, setCharge] = useState('120')
  const [added, setAdded] = useState('18')
  const [threshold, setThreshold] = useState('10')

  const cert =
    certType === 'high'
      ? 'Type II — high- and very-high-pressure appliances, at any charge size.'
      : certType === 'low'
        ? 'Type III — low-pressure chillers.'
        : 'Type I — small appliances with 5 lbs or less of charge.'

  const chargeV = num(charge)
  const addedV = num(added)
  const thresholdV = num(threshold) ?? 10

  let leak: { tone: 'correct' | 'incorrect' | 'neutral'; body: React.ReactNode } | null = null
  if (chargeV !== null && addedV !== null && chargeV > 0) {
    const rate = (addedV / chargeV) * 100
    const rateText = (
      <>
        Leak rate <span className="font-medium text-ink tabular-nums">{rate.toFixed(1)}%</span> against a{' '}
        {thresholdV}% threshold.{' '}
      </>
    )
    if (chargeV < 50) {
      leak = {
        tone: 'neutral',
        body: (
          <>
            {rateText}
            The federal leak-rate and repair requirement only applies to appliances holding 50 lbs or more —
            at {chargeV} lbs it does not apply. Good practice is still to find the leak.
          </>
        ),
      }
    } else if (rate > thresholdV) {
      leak = {
        tone: 'incorrect',
        body: (
          <>
            {rateText}
            <span className="font-semibold">Over the threshold</span> — a mandatory repair within 30 days is
            triggered.
          </>
        ),
      }
    } else {
      leak = {
        tone: 'correct',
        body: (
          <>
            {rateText}
            <span className="font-semibold">Within the threshold</span> — no mandatory repair deadline is
            triggered by this reading.
          </>
        ),
      }
    }
  }

  return (
    <WidgetFrame caption="Two things the 608 exam asks in every form it can: which certification covers the work, and whether a leak rate has crossed a reporting threshold.">
      <WidgetBody>
        <Overline>Which certification do you need?</Overline>
        <div className="mt-2.5">
          <SelectField
            label="Appliance type"
            value={certType}
            onChange={setCertType}
            options={[
              { value: 'small', label: 'Small appliance (≤5 lbs, e.g. a fridge)' },
              { value: 'high', label: 'High / very-high pressure (e.g. R-410A, R-404A)' },
              { value: 'low', label: 'Low-pressure chiller (e.g. R-11, R-123)' },
            ]}
          />
        </div>
        <div className="mt-3">
          <ResultNote>
            <span className="font-medium text-ink">{cert}</span> Servicing more than one category? Take the{' '}
            <span className="font-medium text-ink">Universal</span> certification instead — it covers all
            three and never expires.
          </ResultNote>
        </div>

        <div className="mt-6 border-t border-hairline pt-5">
          <Overline>Leak rate calculator</Overline>
          <div className="mt-2.5 flex flex-wrap gap-4">
            <NumberField label="System charge" value={charge} onChange={setCharge} suffix="lb" />
            <NumberField label="Added this year" value={added} onChange={setAdded} suffix="lb" />
            <SelectField
              label="Appliance category"
              value={threshold}
              onChange={setThreshold}
              options={[
                { value: '10', label: 'Comfort cooling (10%)' },
                { value: '20', label: 'Commercial refrigeration (20%)' },
                { value: '30', label: 'Industrial process refrigeration (30%)' },
              ]}
            />
          </div>
          <div className="mt-3">
            {leak ? (
              <ResultNote tone={leak.tone}>{leak.body}</ResultNote>
            ) : (
              <ResultNote>Enter a system charge and the amount added this year.</ResultNote>
            )}
          </div>
        </div>
      </WidgetBody>
    </WidgetFrame>
  )
}
