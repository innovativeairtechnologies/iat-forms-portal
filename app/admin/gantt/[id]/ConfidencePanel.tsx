'use client'

import { Zap } from 'lucide-react'
import { addWeeks, fmtDate, fmtShort, type GanttChart, type MonteCarloResult } from '@/lib/gantt'

/* Monte Carlo confidence: P50/P80/P90 ship dates + a CSS-bar histogram.
   The simulation itself runs in the shell (useMemo, seeded rng) and is passed in. */

export default function ConfidencePanel({ chart, mc }: { chart: GanttChart; mc: MonteCarloResult }) {
  const maxCount = Math.max(1, ...mc.histogram.map((b) => b.count))
  // nearest histogram bucket to P80 (buckets may span several weeks for wide spreads)
  const p80Bucket = mc.histogram.reduce(
    (best, b) => (Math.abs(b.week - mc.ship.p80) < Math.abs(best - mc.ship.p80) ? b.week : best),
    mc.histogram[0]?.week ?? 0,
  )
  const date = (w: number) => fmtDate(addWeeks(chart.start_date, w))

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <h3 className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">Confidence</h3>
          <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
            {mc.iterations.toLocaleString()} simulations of your duration ranges and risk rules.
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 tabular-nums">P50 {date(mc.ship.p50)}</span>
          <span className="px-2 py-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-medium tabular-nums">P80 {date(mc.ship.p80)}</span>
          <span className="px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 tabular-nums">P90 {date(mc.ship.p90)}</span>
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <div className="flex items-end gap-[2px] h-[64px]">
          {mc.histogram.map((b) => (
            <div key={b.week} className="flex-1 flex flex-col justify-end" title={`week ${b.week} (${fmtShort(addWeeks(chart.start_date, b.week))}): ${b.count} runs`}>
              <div
                className={`w-full rounded-t-[3px] ${b.week === p80Bucket ? 'bg-emerald-500/80' : 'bg-zinc-300 dark:bg-zinc-700'}`}
                style={{ height: `${Math.max(2, (b.count / maxCount) * 100)}%` }}
              />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10.5px] text-zinc-400 dark:text-zinc-600 mt-1 tabular-nums">
          <span>{fmtShort(addWeeks(chart.start_date, mc.histogram[0]?.week ?? 0))}</span>
          <span className="text-emerald-600 dark:text-emerald-400">▲ P80</span>
          <span>{fmtShort(addWeeks(chart.start_date, mc.histogram[mc.histogram.length - 1]?.week ?? 0))}</span>
        </div>
      </div>

      {mc.risks.length > 0 && (
        <div className="px-4 pb-3 pt-1 space-y-1">
          {mc.risks.map((r) => (
            <div key={r.riskId} className="flex items-center gap-2 text-[12px] text-zinc-500 dark:text-zinc-400">
              <Zap size={11} className="text-amber-500 flex-none" />
              <span className="truncate">
                <span className="text-zinc-700 dark:text-zinc-200">{r.taskName}</span>
                {r.note ? ` — ${r.note}` : ''}: fires in {Math.round(r.hitRate * 100)}% of runs
                {r.avgImpact > 0.05 ? `, avg +${Math.round(r.avgImpact * 10) / 10} wks when it does` : ''}
              </span>
            </div>
          ))}
        </div>
      )}

      <div className="px-4 py-2 border-t border-zinc-100 dark:border-zinc-800/60 text-[11.5px] text-zinc-400 dark:text-zinc-500">
        P80 = 8-in-10 odds of shipping on or before that date. Commit externally to P80, not the plan date.
        {chart.tasks.some((t) => t.status === 'done') && ' Completed tasks are pinned to their actual dates — the window narrows as work finishes.'}
      </div>
    </div>
  )
}
