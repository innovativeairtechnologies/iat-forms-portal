'use client'

import { useMemo } from 'react'
import {
  type AirState,
  GRAINS_PER_LB,
  humidityRatioFromRH,
  satHumidityRatio,
} from '@/lib/psychro'
import type { SizingResult } from '@/lib/sizing'

/* The psychrometric chart — the Sizing Studio's centrepiece.
 *
 * Drawn from lib/psychro.ts rather than a background image, so the saturation and
 * relative-humidity curves are the SAME physics the sizing engine ran, at the SAME
 * barometric pressure. At altitude the curves genuinely shift, and this chart shifts
 * with them.
 *
 * What it shows, in process order:
 *   Return + Outside  →  Entering (their mixture)  →  Leaving (through the wheel)
 *   with the Target condition marked as a goal.
 *
 * The Entering → Leaving line runs up and to the RIGHT along a line of constant
 * enthalpy: a desiccant wheel trades latent heat for sensible heat, so the air leaves
 * much drier and much hotter. The faint dashed enthalpy line through the entering
 * point makes that visible — the process line should lie right along it.
 */

const W = 760
const H = 480
const M = { top: 24, right: 66, bottom: 44, left: 50 }
const PLOT_W = W - M.left - M.right
const PLOT_H = H - M.top - M.bottom

const RH_CURVES = [10, 20, 30, 40, 50, 60, 70, 80, 90]

type Marker = {
  key: string
  label: string
  state: AirState
  /** Filled brand dot for the result, solid ink for inputs, hollow for the goal. */
  kind: 'primary' | 'input' | 'goal' | 'faint'
}

export default function PsychroChart({ result }: { result: SizingResult }) {
  const { pressure, returnAir, outsideAir, entering, leaving, target } = result

  const markers: Marker[] = useMemo(() => {
    const list: Marker[] = [
      { key: 'return', label: 'Return', state: returnAir, kind: 'faint' },
    ]
    // Only worth plotting outside air (and the mixture as distinct) when there is some.
    if (result.airflow.freshAirCfm > 0) {
      list.push({ key: 'outside', label: 'Outside', state: outsideAir, kind: 'faint' })
    }
    list.push(
      { key: 'entering', label: 'Entering', state: entering, kind: 'input' },
      { key: 'leaving', label: 'Leaving', state: leaving, kind: 'primary' },
      { key: 'target', label: 'Target', state: target, kind: 'goal' },
    )
    return list
  }, [returnAir, outsideAir, entering, leaving, target, result.airflow.freshAirCfm])

  // Domain adapts to the job: desiccant discharge routinely exceeds 120 °F, and a wet
  // outdoor design condition can exceed 200 gr/lb, so a fixed domain would clip them.
  const { tMin, tMax, gMax } = useMemo(() => {
    const temps = markers.map((m) => m.state.tempF)
    const grains = markers.map((m) => m.state.grains)
    return {
      tMin: Math.min(35, Math.floor((Math.min(...temps) - 10) / 10) * 10),
      tMax: Math.max(140, Math.ceil((Math.max(...temps) + 10) / 10) * 10),
      gMax: Math.max(180, Math.ceil((Math.max(...grains) * 1.25) / 20) * 20),
    }
  }, [markers])

  const x = (t: number) => M.left + ((t - tMin) / (tMax - tMin)) * PLOT_W
  const y = (g: number) => M.top + PLOT_H - (Math.min(g, gMax) / gMax) * PLOT_H

  // Saturation (100% RH) and the RH family, sampled from the real physics.
  const curves = useMemo(() => {
    const step = 1
    const build = (rh: number) => {
      const pts: string[] = []
      for (let t = tMin; t <= tMax; t += step) {
        const gr =
          (rh >= 100 ? satHumidityRatio(t, pressure) : humidityRatioFromRH(t, rh / 100, pressure)) *
          GRAINS_PER_LB
        if (gr > gMax) break // Leaves the top of the plot — stop drawing.
        pts.push(`${x(t).toFixed(1)},${y(gr).toFixed(1)}`)
      }
      return pts.length > 1 ? `M${pts.join('L')}` : ''
    }
    return { saturation: build(100), rh: RH_CURVES.map((rh) => ({ rh, d: build(rh) })) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tMin, tMax, gMax, pressure])

  // A constant-enthalpy line through the entering state. The dehumidification process
  // should track it — that's the adiabatic assumption made visible.
  const enthalpyLine = useMemo(() => {
    const h = entering.enthalpy
    const pts: string[] = []
    for (let t = tMin; t <= tMax; t += 2) {
      const Wr = (h - 0.24 * t) / (1061 + 0.444 * t)
      const gr = Wr * GRAINS_PER_LB
      if (gr < 0) break
      if (gr <= gMax) pts.push(`${x(t).toFixed(1)},${y(gr).toFixed(1)}`)
    }
    return pts.length > 1 ? `M${pts.join('L')}` : ''
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entering.enthalpy, tMin, tMax, gMax])

  // Jobs with little outside air put Return and Entering almost on top of each other,
  // and a tight target puts Target and Leaving together — so labels get placed by a
  // small collision pass rather than a fixed offset, or they overprint each other.
  const placements = useMemo(
    () => placeLabels(markers.map((m) => ({ marker: m, cx: x(m.state.tempF), cy: y(m.state.grains) }))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [markers, tMin, tMax, gMax],
  )

  const tTicks = ticks(tMin, tMax, 10)
  const gTicks = ticks(0, gMax, gMax > 240 ? 40 : 20)

  const find = (k: string) => markers.find((m) => m.key === k)
  const mReturn = find('return')!
  const mOutside = find('outside')
  const mEntering = find('entering')!
  const mLeaving = find('leaving')!

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full h-auto"
        role="img"
        aria-label={`Psychrometric chart. Entering air ${entering.tempF.toFixed(0)} degrees at ${entering.grains.toFixed(0)} grains per pound, leaving at ${leaving.tempF.toFixed(0)} degrees and ${leaving.grains.toFixed(0)} grains per pound.`}
      >
        <defs>
          <clipPath id="psychro-plot">
            <rect x={M.left} y={M.top} width={PLOT_W} height={PLOT_H} />
          </clipPath>
          <marker
            id="psychro-arrow"
            viewBox="0 0 10 10"
            refX="8"
            refY="5"
            markerWidth="6"
            markerHeight="6"
            orient="auto-start-reverse"
          >
            <path d="M0,0 L10,5 L0,10 z" fill="var(--brand)" />
          </marker>
        </defs>

        {/* Plot field */}
        <rect
          x={M.left}
          y={M.top}
          width={PLOT_W}
          height={PLOT_H}
          fill="var(--surface-soft)"
          stroke="var(--hairline)"
        />

        {/* Grid */}
        <g clipPath="url(#psychro-plot)">
          {tTicks.map((t) => (
            <line
              key={`gx${t}`}
              x1={x(t)}
              y1={M.top}
              x2={x(t)}
              y2={M.top + PLOT_H}
              stroke="var(--hairline-soft)"
            />
          ))}
          {gTicks.map((g) => (
            <line
              key={`gy${g}`}
              x1={M.left}
              y1={y(g)}
              x2={M.left + PLOT_W}
              y2={y(g)}
              stroke="var(--hairline-soft)"
            />
          ))}

          {/* Constant-enthalpy reference through the entering point */}
          {enthalpyLine && (
            <path
              d={enthalpyLine}
              fill="none"
              stroke="var(--ink-faint)"
              strokeWidth={1}
              strokeDasharray="2 4"
            />
          )}

          {/* Relative-humidity family */}
          {curves.rh.map(({ rh, d }) =>
            d ? (
              <path key={rh} d={d} fill="none" stroke="var(--hairline-strong)" strokeWidth={1} />
            ) : null,
          )}

          {/* Saturation */}
          {curves.saturation && (
            <path
              d={curves.saturation}
              fill="none"
              stroke="var(--ink-muted)"
              strokeWidth={1.75}
            />
          )}

          {/* Mixing line: return + outside → entering */}
          {mOutside && (
            <line
              x1={x(mReturn.state.tempF)}
              y1={y(mReturn.state.grains)}
              x2={x(mOutside.state.tempF)}
              y2={y(mOutside.state.grains)}
              stroke="var(--ink-faint)"
              strokeWidth={1.25}
              strokeDasharray="4 3"
            />
          )}

          {/* The dehumidification process itself */}
          <line
            x1={x(mEntering.state.tempF)}
            y1={y(mEntering.state.grains)}
            x2={x(mLeaving.state.tempF)}
            y2={y(mLeaving.state.grains)}
            stroke="var(--brand)"
            strokeWidth={2}
            markerEnd="url(#psychro-arrow)"
          />
        </g>

        {/* RH curve labels, riding just inside the top of each curve */}
        <g clipPath="url(#psychro-plot)">
          {curves.rh.map(({ rh }) => {
            const label = labelPoint(rh, pressure, gMax, tMin, tMax)
            if (!label) return null
            return (
              <text
                key={`l${rh}`}
                x={x(label.t)}
                y={y(label.g) - 3}
                fill="var(--ink-faint)"
                fontSize={9}
                textAnchor="middle"
              >
                {rh}%
              </text>
            )
          })}
        </g>

        {/* Axes */}
        {tTicks.map((t) => (
          <text
            key={`tx${t}`}
            x={x(t)}
            y={M.top + PLOT_H + 16}
            fill="var(--ink-muted)"
            fontSize={10}
            textAnchor="middle"
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {t}
          </text>
        ))}
        {gTicks.map((g) => (
          <text
            key={`ty${g}`}
            x={M.left + PLOT_W + 8}
            y={y(g) + 3}
            fill="var(--ink-muted)"
            fontSize={10}
            style={{ fontVariantNumeric: 'tabular-nums' }}
          >
            {g}
          </text>
        ))}

        <text
          x={M.left + PLOT_W / 2}
          y={H - 8}
          fill="var(--ink-muted)"
          fontSize={10}
          textAnchor="middle"
          letterSpacing="0.06em"
        >
          DRY-BULB TEMPERATURE °F
        </text>
        <text
          x={W - 8}
          y={M.top + PLOT_H / 2}
          fill="var(--ink-muted)"
          fontSize={10}
          textAnchor="middle"
          letterSpacing="0.06em"
          transform={`rotate(90 ${W - 8} ${M.top + PLOT_H / 2})`}
        >
          GRAINS OF MOISTURE PER LB DRY AIR
        </text>

        {/* State markers, drawn last so they sit above every line */}
        <g clipPath="url(#psychro-plot)">
          {placements.map((pl) => (
            <StateMarker key={pl.marker.key} marker={pl.marker} cx={pl.cx} cy={pl.cy} label={pl.label} />
          ))}
        </g>
      </svg>

      <figcaption className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-ink-muted">
        <LegendSwatch kind="input" label="Entering (after mixing)" />
        <LegendSwatch kind="primary" label="Leaving the unit" />
        <LegendSwatch kind="goal" label="Target condition" />
        <LegendSwatch kind="faint" label="Return / outside air" />
        <span className="flex items-center gap-1.5">
          <svg width="16" height="6" aria-hidden="true">
            <line x1="0" y1="3" x2="16" y2="3" stroke="var(--ink-faint)" strokeDasharray="2 3" />
          </svg>
          Constant enthalpy
        </span>
      </figcaption>
    </figure>
  )
}

function StateMarker({
  marker,
  cx,
  cy,
  label: pos,
}: {
  marker: Marker
  cx: number
  cy: number
  label: LabelPos
}) {
  const { kind, label } = marker
  const fill =
    kind === 'primary' ? 'var(--brand)' : kind === 'input' ? 'var(--ink)' : 'var(--surface)'
  const stroke =
    kind === 'primary' ? 'var(--brand)' : kind === 'faint' ? 'var(--ink-faint)' : 'var(--ink)'
  const r = kind === 'faint' ? 3 : 4.5

  return (
    <g>
      {kind === 'goal' && (
        // A goal, not a state the air actually reaches — drawn as a crosshair.
        <>
          <line x1={cx - 8} y1={cy} x2={cx + 8} y2={cy} stroke="var(--ink)" strokeWidth={1} />
          <line x1={cx} y1={cy - 8} x2={cx} y2={cy + 8} stroke="var(--ink)" strokeWidth={1} />
        </>
      )}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill={fill}
        stroke={stroke}
        strokeWidth={kind === 'goal' ? 1.5 : 1}
      />
      <text
        x={pos.x}
        y={pos.y}
        textAnchor={pos.anchor}
        fill={kind === 'faint' ? 'var(--ink-muted)' : 'var(--ink)'}
        fontSize={10}
        fontWeight={kind === 'faint' ? 400 : 600}
        // A hairline halo keeps the label readable where it crosses a curve.
        stroke="var(--surface-soft)"
        strokeWidth={2.5}
        paintOrder="stroke"
      >
        {label}
      </text>
    </g>
  )
}

function LegendSwatch({ kind, label }: { kind: Marker['kind']; label: string }) {
  const fill =
    kind === 'primary' ? 'var(--brand)' : kind === 'input' ? 'var(--ink)' : 'var(--surface)'
  const stroke =
    kind === 'primary' ? 'var(--brand)' : kind === 'faint' ? 'var(--ink-faint)' : 'var(--ink)'
  return (
    <span className="flex items-center gap-1.5">
      <svg width="10" height="10" aria-hidden="true">
        <circle cx="5" cy="5" r="4" fill={fill} stroke={stroke} strokeWidth="1" />
      </svg>
      {label}
    </span>
  )
}

/**
 * Where to park an RH curve's label: normally the point where it exits the top of
 * the plot. The dry curves (10–20%) never get that high — they run off the right
 * edge instead — so those are labelled just inside that edge rather than dropped.
 */
function labelPoint(
  rh: number,
  p: number,
  gMax: number,
  tMin: number,
  tMax: number,
): { t: number; g: number } | null {
  let last: { t: number; g: number } | null = null
  for (let t = tMin; t <= tMax; t += 1) {
    const g = humidityRatioFromRH(t, rh / 100, p) * GRAINS_PER_LB
    if (g > gMax * 0.94) break
    last = { t, g }
  }
  if (!last) return null
  if (last.t >= tMax - 2) {
    const t = tMax - 6
    return { t, g: humidityRatioFromRH(t, rh / 100, p) * GRAINS_PER_LB }
  }
  return last
}

type LabelPos = { x: number; y: number; anchor: 'start' | 'end' }

/**
 * Place each marker's label in the first candidate slot that doesn't collide with a
 * label already placed, or run outside the plot. Deterministic (fixed candidate
 * order, no randomness) so the same job always renders identically.
 */
function placeLabels(
  items: { marker: Marker; cx: number; cy: number }[],
): { marker: Marker; cx: number; cy: number; label: LabelPos }[] {
  const CHAR_W = 5.5 // ~10px sans
  const LINE_H = 11
  const placed: { x1: number; y1: number; x2: number; y2: number }[] = []

  // Clockwise from upper-right, then progressively further out.
  const CANDIDATES: { dx: number; dy: number; anchor: 'start' | 'end' }[] = [
    { dx: 9, dy: -7, anchor: 'start' },
    { dx: -9, dy: -7, anchor: 'end' },
    { dx: 9, dy: 15, anchor: 'start' },
    { dx: -9, dy: 15, anchor: 'end' },
    { dx: 9, dy: -20, anchor: 'start' },
    { dx: -9, dy: -20, anchor: 'end' },
    { dx: 9, dy: 27, anchor: 'start' },
    { dx: -9, dy: 27, anchor: 'end' },
  ]

  // The result marker matters most, so it claims its slot first and the faint
  // reference points shuffle around it.
  const priority = { primary: 0, goal: 1, input: 2, faint: 3 } as const
  const order = items
    .map((it, i) => ({ it, i }))
    .sort((a, b) => priority[a.it.marker.kind] - priority[b.it.marker.kind])

  const out = new Array<{ marker: Marker; cx: number; cy: number; label: LabelPos }>(items.length)

  for (const { it, i } of order) {
    const w = it.marker.label.length * CHAR_W
    let chosen: LabelPos | null = null

    // Reference points try the left side first, so they step aside from the process
    // line (which always leaves the entering point heading right).
    const candidates =
      it.marker.kind === 'faint'
        ? CANDIDATES.filter((c) => c.anchor === 'end').concat(
            CANDIDATES.filter((c) => c.anchor === 'start'),
          )
        : CANDIDATES

    for (const c of candidates) {
      const x = it.cx + c.dx
      const y = it.cy + c.dy
      const x1 = c.anchor === 'start' ? x : x - w
      const box = { x1, y1: y - LINE_H, x2: x1 + w, y2: y }

      const insidePlot =
        box.x1 >= M.left + 2 &&
        box.x2 <= M.left + PLOT_W - 2 &&
        box.y1 >= M.top + 2 &&
        box.y2 <= M.top + PLOT_H - 2
      if (!insidePlot) continue
      if (placed.some((b) => b.x1 < box.x2 && box.x1 < b.x2 && b.y1 < box.y2 && box.y1 < b.y2)) {
        continue
      }
      placed.push(box)
      chosen = { x, y, anchor: c.anchor }
      break
    }

    // Every slot collided or fell outside — take the default and let it overlap
    // rather than dropping the label entirely.
    if (!chosen) chosen = { x: it.cx + 9, y: it.cy - 7, anchor: 'start' }
    out[i] = { ...it, label: chosen }
  }

  return out
}

function ticks(min: number, max: number, step: number): number[] {
  const out: number[] = []
  for (let v = Math.ceil(min / step) * step; v <= max; v += step) out.push(v)
  return out
}
