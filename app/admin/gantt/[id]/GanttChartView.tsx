'use client'

import { MoveHorizontal } from 'lucide-react'
import { addWeeks, fmtShort, parseDate, anchorTask, firedDelay, layoutRange, type GanttChart } from '@/lib/gantt'
import { AXIS_H, ROW_H, BAR_CLS, DOT_CLS, Legend } from './ui'

/* Render-only chart: axis, bars + range extensions, milestone whiskers,
   baseline ghosts, the arrival pill. All state/drag logic stays in the shell. */

interface Props {
  chart: GanttChart
  R: ReturnType<typeof layoutRange>
  H: number
  tlRef?: React.RefObject<HTMLDivElement>
  onArrivalPointerDown?: (e: React.PointerEvent) => void
  interactive?: boolean
  showLegend?: boolean
}

export default function GanttChartView({ chart, R, H, tlRef, onArrivalPointerDown, interactive = true, showLegend = true }: Props) {
  const x = (w: number) => (Math.max(0, Math.min(w, H)) / H) * 100
  const a = anchorTask(chart)
  const n = chart.tasks.length
  // legend counts only live tasks' fired risks — a done task's risks are history
  const anyFired = chart.tasks.some((t) => t.status !== 'done' && t.risks?.some((r) => r.fired))
  const ticks: number[] = []
  for (let w = 0; w <= H; w += 4) ticks.push(w)

  return (
    <div>
      <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden">
        <div className="flex">
          {/* labels */}
          <div className="w-[210px] flex-none border-r border-zinc-200 dark:border-zinc-800">
            <div style={{ height: AXIS_H }} />
            {R.rows.map((r) => {
              const t = r.t
              const dot = t.kind === 'milestone' ? DOT_CLS.milestone : DOT_CLS[t.cat]
              const spread = t.durMax > t.durMin
              const done = t.status === 'done'
              // done label shows the RECORDED fact (t.actualEnd), even if the bar
              // position clamps to the chain — the table and chart must agree
              const note = done
                ? `✓ done ${fmtShort(t.actualEnd ? parseDate(t.actualEnd) : addWeeks(chart.start_date, r.end))}`
                : t.kind === 'milestone'
                  ? 'milestone'
                  : `${t.durMin}${spread ? `–${t.durMax}` : ''} wks${t.anchor ? ' · TBD' : ''}${r.extra > 0 ? ` · +${r.extra} risk` : ''}${t.status === 'in_progress' ? ' · underway' : ''}`
              // health: only deviations speak (calm) — on-plan stays quiet
              const slipTxt =
                r.health && r.health !== 'on_track' && r.baseEnd != null
                  ? ` · +${Math.round((r.end - r.baseEnd) * 10) / 10} wks vs baseline`
                  : ''
              const slipCls = r.health === 'slipped' ? 'text-rose-500 dark:text-rose-400' : 'text-amber-600 dark:text-amber-400'
              return (
                <div key={t.id} style={{ height: ROW_H }} className="px-3 flex flex-col justify-center">
                  <div className={`text-[12.5px] truncate flex items-center gap-1.5 ${done ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-800 dark:text-zinc-200'}`}>
                    <span className={`w-[7px] h-[7px] rounded-sm flex-none ${dot}`} />
                    {t.name}
                  </div>
                  <div className="text-[11px] text-zinc-400 dark:text-zinc-500 pl-[13px] truncate">
                    <span className={done ? 'text-emerald-600 dark:text-emerald-400' : undefined}>{note}</span>
                    {slipTxt && <span className={slipCls}>{slipTxt}</span>}
                    {t.owner ? ` · ${t.owner}` : ''}
                  </div>
                </div>
              )
            })}
          </div>

          {/* timeline */}
          <div ref={tlRef} className="relative flex-1 min-w-0" style={{ height: AXIS_H + n * ROW_H }}>
            {ticks.map((w) => (
              <div key={`g${w}`}>
                <div className="absolute w-px bg-zinc-200 dark:bg-zinc-800" style={{ left: `${x(w)}%`, top: AXIS_H, bottom: 0 }} />
                <div
                  className="absolute text-[11px] text-zinc-400 dark:text-zinc-600 whitespace-nowrap"
                  style={w === 0 ? { left: 3, top: 5 } : { left: `${x(w)}%`, top: 5, transform: 'translateX(-50%)' }}
                >
                  {fmtShort(addWeeks(chart.start_date, w))}
                </div>
              </div>
            ))}

            {R.rows.map((r, i) => {
              const t = r.t
              const rowTop = AXIS_H + i * ROW_H
              const barTop = rowTop + 7

              /* baseline ghost — thin bar under the live bar */
              const ghost =
                r.baseStart != null && r.baseEnd != null ? (
                  <div
                    title="baseline"
                    className="absolute h-[4px] rounded-full bg-zinc-400/50 dark:bg-zinc-500/50"
                    style={{
                      left: `${x(r.baseStart)}%`,
                      width: `${Math.max(0.4, x(Math.min(r.baseEnd, H)) - x(r.baseStart))}%`,
                      top: barTop + 20,
                    }}
                  />
                ) : null
              const clampMark = r.baseClamped ? (
                <div className="absolute text-[9px] text-zinc-400" style={{ left: 2, top: barTop + 15 }} title="baseline began before the current start date">
                  ◀
                </div>
              ) : null

              if (t.kind === 'milestone') {
                const hasWhisker = r.endWorst - r.endBest > 0.05
                return (
                  <div key={t.id}>
                    {hasWhisker && (
                      <div
                        title={`window ${fmtShort(addWeeks(chart.start_date, r.endBest))} – ${fmtShort(addWeeks(chart.start_date, r.endWorst))}`}
                        className="absolute h-[2px] bg-zinc-400/60 dark:bg-zinc-500/60"
                        style={{ left: `${x(r.endBest)}%`, width: `${x(r.endWorst) - x(r.endBest)}%`, top: barTop + 5 }}
                      >
                        <span className="absolute left-0 -top-[3px] w-[2px] h-[8px] bg-zinc-400/60 dark:bg-zinc-500/60" />
                        <span className="absolute right-0 -top-[3px] w-[2px] h-[8px] bg-zinc-400/60 dark:bg-zinc-500/60" />
                      </div>
                    )}
                    <div
                      title={t.name}
                      className="absolute w-[13px] h-[13px] bg-zinc-900 dark:bg-zinc-100 rounded-sm"
                      style={{ left: `${x(r.end)}%`, top: barTop - 1, transform: 'translateX(-50%) rotate(45deg)' }}
                    />
                    {ghost}
                    {clampMark}
                  </div>
                )
              }

              const cat = BAR_CLS[t.cat]
              const done = t.status === 'done'
              const dashed = t.anchor && r.extra === 0 && !done ? 'border-dashed' : ''
              return (
                <div key={t.id}>
                  {/* solid = plan (likely); done = fact (muted, no range) */}
                  <div
                    title={done ? `${t.name} — done` : t.name}
                    className={`absolute h-[18px] rounded-[5px] border ${cat} ${dashed} ${done ? 'opacity-60' : ''}`}
                    style={{
                      left: `${x(r.start)}%`,
                      // a done task clamped to the chain (actual ≤ start) still gets a visible sliver
                      width: `${Math.max(done ? 0.4 : 0, x(r.start + r.base) - x(r.start))}%`,
                      top: barTop,
                    }}
                  />
                  {/* fired-risk segment */}
                  {r.extra > 0 && (
                    <div
                      title="risk fired (what-if)"
                      className="absolute h-[18px] rounded-[5px] border bg-rose-100 dark:bg-rose-500/20 border-rose-400 dark:border-rose-500/50"
                      style={{ left: `${x(r.start + r.base)}%`, width: `${x(r.end) - x(r.start + r.base)}%`, top: barTop }}
                    />
                  )}
                  {/* faded extension to this task's own worst case */}
                  {r.ownWorstEnd - r.end > 0.05 && (
                    <div
                      title={`range: up to ${fmtShort(addWeeks(chart.start_date, r.ownWorstEnd))}`}
                      className={`absolute h-[18px] rounded-[5px] border border-dashed opacity-45 ${cat}`}
                      style={{ left: `${x(r.end)}%`, width: `${x(r.ownWorstEnd) - x(r.end)}%`, top: barTop }}
                    />
                  )}
                  {ghost}
                  {clampMark}
                </div>
              )
            })}

            {/* arrival marker + drag pill (pill hidden once arrival is fact) */}
            {a && (
              <>
                <div className="absolute bg-amber-500" style={{ left: `${x(R.anchorEnd)}%`, top: AXIS_H, bottom: 0, width: 2, transform: 'translateX(-1px)' }} />
                {interactive && a.status !== 'done' && (
                  <div
                    onPointerDown={onArrivalPointerDown}
                    className="absolute z-10 flex items-center gap-1 cursor-grab select-none rounded-full border border-amber-400 dark:border-amber-500/50 bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-medium px-2 py-[2px]"
                    style={{ left: `${x(R.anchorEnd)}%`, top: 1, transform: 'translateX(-50%)', touchAction: 'none' }}
                  >
                    <MoveHorizontal size={12} /> arrival
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {showLegend && (
        <div className="flex flex-wrap gap-4 mt-3 text-[12px] text-zinc-500 dark:text-zinc-400">
          {interactive && <span className="text-zinc-400 dark:text-zinc-600">drag the arrival pill to reschedule ·</span>}
          <Legend cls="bg-amber-500" label="critical path" />
          <Legend cls="bg-emerald-500" label="production build" />
          <Legend cls="bg-zinc-400" label="routine step" />
          <Legend cls="bg-zinc-200 dark:bg-zinc-700 border border-dashed border-zinc-400" label="range (to worst case)" />
          <Legend cls="bg-zinc-400/60 rounded-full" label="baseline" />
          <Legend cls="bg-zinc-900 dark:bg-zinc-100" label="milestone (whisker = window)" />
          {anyFired && <Legend cls="bg-rose-500" label="fired risk (what-if)" />}
        </div>
      )}
    </div>
  )
}
