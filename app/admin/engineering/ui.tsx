import Link from 'next/link'
import type { ReactNode } from 'react'
import { StatusPill, type Tone } from '@/components/admin/list'
import {
  PROJECTION_TONE, STREAM_LABELS, STREAM_SHORT, STREAM_TONE,
  TASK_STATUS_LABELS, TASK_STATUS_TONE,
  type Projection, type Stream, type TaskStatus,
} from '@/lib/engineering'

/* ────────────────────────────────────────────────────────────────────────────
   Presentational pieces shared by every Engineering screen. PURE — no hooks, no
   'use client' — so the server-rendered dashboard cards and the interactive
   board can both use them and look identical.

   DESIGN.md: hairline cards, no resting shadows, 13px tables, tabular-nums on
   every number, semantic tokens only. Color is carried by the Tone system and
   earns its place twice here — a stream keeps ONE hue everywhere it appears, and
   schedule health is the one thing on these screens you should be able to read
   from across the room.
   ──────────────────────────────────────────────────────────────────────────── */

const BAR_TONE: Record<Tone, string> = {
  slate: 'bg-slate-400 dark:bg-slate-500',
  emerald: 'bg-emerald-500',
  amber: 'bg-amber-500',
  sky: 'bg-sky-500',
  rose: 'bg-rose-500',
  violet: 'bg-violet-500',
}

export const DOT_TONE: Record<Tone, string> = {
  slate: 'bg-slate-400', emerald: 'bg-emerald-500', amber: 'bg-amber-500',
  sky: 'bg-sky-500', rose: 'bg-rose-500', violet: 'bg-violet-500',
}

/** Stream identity chip — the same hue and the same three letters everywhere. */
export function StreamChip({ stream, full = false }: { stream: Stream; full?: boolean }) {
  return <StatusPill tone={STREAM_TONE[stream]}>{full ? STREAM_LABELS[stream] : STREAM_SHORT[stream]}</StatusPill>
}

export function TaskStatusPill({ status }: { status: TaskStatus }) {
  return <StatusPill tone={TASK_STATUS_TONE[status]}>{TASK_STATUS_LABELS[status]}</StatusPill>
}

/**
 * The ahead/behind badge from the whiteboard: a word and a number of days.
 *
 * `projection.label` is a whole short sentence and is printed as-is, because the
 * number on its own ("−3") tells you nothing about whether that is three days
 * overdue, three days of projected slippage, or three days of slack.
 */
export function ProjectionPill({ projection, compact = false }: { projection: Projection; compact?: boolean }) {
  const tone = PROJECTION_TONE[projection.kind]
  if (compact && projection.varianceDays != null) {
    const v = projection.varianceDays
    return (
      <StatusPill tone={tone}>
        {v === 0 ? 'On the day' : v > 0 ? `+${v}d` : `${v}d`}
      </StatusPill>
    )
  }
  return <StatusPill tone={tone}>{projection.label}</StatusPill>
}

/**
 * A progress bar with the expected-pace mark on it.
 *
 * The tick is the whole point. A bar at 40% means nothing on its own; a bar at
 * 40% with the marker sitting at 70% is the picture of a job running late, and
 * it is readable in the half-second someone glances at a wall display. Hidden
 * when there is no window to compute a pace from, rather than defaulted to zero.
 */
export function ProgressBar({
  value, expected, tone = 'emerald', height = 6, showValue = false,
}: {
  value: number
  expected?: number | null
  tone?: Tone
  height?: number
  showValue?: boolean
}) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div
        className="relative flex-1 min-w-[48px] rounded-full bg-surface-strong overflow-hidden"
        style={{ height }}
        role="progressbar"
        aria-valuenow={v}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div className={`h-full rounded-full transition-[width] duration-200 ease-out ${BAR_TONE[tone]}`} style={{ width: `${v}%` }} />
        {expected != null && expected > 0 && expected < 100 && (
          <span
            aria-hidden="true"
            title={`Expected ${Math.round(expected)}% by now`}
            className="absolute top-0 bottom-0 w-px bg-ink/45 dark:bg-ink/60"
            style={{ left: `${Math.min(100, Math.round(expected))}%` }}
          />
        )}
      </div>
      {showValue && <span className="text-[11px] tabular-nums text-ink-muted w-8 text-right">{v}%</span>}
    </div>
  )
}

/**
 * Completions per week, trailing eight. Oldest on the left.
 *
 * An SVG polyline, not a chart library — this is the "trending" squiggle from
 * the whiteboard, and a dependency for eight numbers would cost more than it
 * explains (the same call every report in this portal makes).
 *
 * All-zero renders a flat line at the baseline rather than nothing: an empty
 * space reads as "no data yet" when what it means is "nothing finished".
 */
export function Sparkline({ points, tone = 'emerald', width = 76, height = 22 }: { points: number[]; tone?: Tone; width?: number; height?: number }) {
  const max = Math.max(1, ...points)
  const n = Math.max(2, points.length)
  const step = width / (n - 1)
  const y = (v: number) => height - 2 - (v / max) * (height - 4)
  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(p).toFixed(1)}`).join(' ')
  const stroke = {
    slate: 'var(--ink-faint)', emerald: '#10b981', amber: '#f59e0b',
    sky: '#0ea5e9', rose: '#f43f5e', violet: '#8b5cf6',
  }[tone]
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="flex-shrink-0 overflow-visible" aria-hidden="true">
      <path d={d} fill="none" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.9} />
      {points.length > 0 && (
        <circle cx={(points.length - 1) * step} cy={y(points[points.length - 1])} r="2" fill={stroke} />
      )}
    </svg>
  )
}

/** A label/number pair for the tile headers and the wall board. */
export function Metric({ label, value, tone, href }: { label: string; value: number | string; tone?: Tone; href?: string }) {
  const body = (
    <>
      <p className="text-[10px] font-semibold uppercase tracking-[0.055em] text-ink-muted">{label}</p>
      <p className={`text-[19px] font-semibold leading-none tabular-nums tracking-[-0.02em] ${
        tone === 'rose' ? 'text-rose-600 dark:text-rose-400'
        : tone === 'amber' ? 'text-amber-700 dark:text-amber-400'
        : tone === 'emerald' ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-ink'
      }`}>{value}</p>
    </>
  )
  const cls = 'rounded-lg border border-hairline bg-surface-soft px-3 py-2.5 flex flex-col gap-1.5 min-w-0'
  return href
    ? <Link href={href} className={`${cls} transition-colors hover:border-hairline-strong`}>{body}</Link>
    : <div className={cls}>{body}</div>
}

/** Empty state that says what would put something here. */
export function Nothing({ children }: { children: ReactNode }) {
  return <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">{children}</p>
}

/**
 * A number the sources do not give us.
 *
 * Rendered wherever target hours or a cycle time is null, and worded so it reads
 * as a gap in the standard rather than a gap in the data — because that is what
 * it is. The workbook says "TBD", "See Master" or nothing at all for these, and
 * printing a plausible number instead would make it the baseline every future
 * variance is measured against with nobody ever knowing it was invented.
 */
export function NotSet({ hint }: { hint?: string }) {
  return <span className="text-ink-faint" title={hint ?? 'No source gives this a value yet — set it in Scheduling Rules.'}>Not set</span>
}
