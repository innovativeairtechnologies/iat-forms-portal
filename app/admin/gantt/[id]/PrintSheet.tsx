'use client'

import {
  addWeeks, fmtDate, fmtDelta, layoutRange, normalizeChart,
  type GanttChart, type MonteCarloResult,
} from '@/lib/gantt'
import GanttChartView from './GanttChartView'

/* The print-designed sheet (hidden on screen). A printed/PDF'd chart must carry
   its own caveats: the window headline, what-if labeling, baseline variance,
   the risk register, assumptions, and the forecast-not-commitment footer. */

interface Props {
  chart: GanttChart
  R: ReturnType<typeof layoutRange>
  H: number
  mc: MonteCarloResult
  variance: { shipDeltaWeeks: number; windowGrowthWeeks: number; startMovedWeeks: number } | null
}

export default function PrintSheet({ chart, R, H, mc, variance }: Props) {
  const d = (w: number) => fmtDate(addWeeks(chart.start_date, w))
  const norm = normalizeChart(chart)
  // the what-if banner counts only LIVE tasks' fired risks — done tasks' risks are
  // history and contribute nothing to the printed schedule
  const firedRisks = norm.tasks.flatMap((t) =>
    t.status === 'done' ? [] : (t.risks ?? []).filter((r) => r.fired).map((r) => ({ task: t.name, r })),
  )
  const allRisks = norm.tasks.flatMap((t) => (t.risks ?? []).map((r) => ({ task: t.name, taskDone: t.status === 'done', r })))
  const assumptions = chart.assumptions ?? []

  return (
    <div className="hidden print:block px-6 py-4 text-zinc-900" style={{ printColorAdjust: 'exact', WebkitPrintColorAdjust: 'exact' }}>
      {/* header */}
      <div className="flex items-baseline justify-between border-b border-zinc-300 pb-2 mb-3">
        <div>
          <div className="text-[18px] font-semibold">{chart.name}</div>
          <div className="text-[12px] text-zinc-500">
            {chart.customer || '—'} · start {fmtDate(addWeeks(chart.start_date, 0))} · {chart.status}
          </div>
        </div>
        <div className="text-[11px] text-zinc-500">printed {new Date().toLocaleDateString('en-US')}</div>
      </div>

      {/* headline: the window IS the biggest type on the page */}
      <div className="mb-3">
        <span className="text-[22px] font-semibold tabular-nums">
          Ship window {d(R.shipBest)} – {d(R.shipWorst)}
        </span>
        <span className="text-[14px] text-zinc-600 ml-3 tabular-nums">
          plan {d(R.ship)} · P80 {d(mc.ship.p80)}
        </span>
        {norm.tasks.some((t) => t.status) && (
          <span className="text-[12px] text-zinc-500 ml-3">
            {norm.tasks.filter((t) => t.status === 'done').length} of {norm.tasks.length} steps complete
          </span>
        )}
      </div>

      {/* what-if banner */}
      {firedRisks.length > 0 && (
        <div className="mb-3 rounded-md border border-rose-400 bg-rose-50 px-3 py-2 text-[12.5px] text-rose-800">
          <b>What-if view:</b> this schedule assumes {firedRisks.length} risk{firedRisks.length > 1 ? 's' : ''} fired —{' '}
          {firedRisks.map(({ task, r }) => `${task}${r.note ? ` (${r.note})` : ''} +${r.delayMin}${r.delayMax > r.delayMin ? `–${r.delayMax}` : ''} wks`).join('; ')}.
        </div>
      )}

      {/* chart */}
      <GanttChartView chart={chart} R={R} H={H} interactive={false} showLegend={true} />

      {/* baseline variance */}
      {chart.baseline && variance && (
        <div className="mt-4">
          <div className="text-[13px] font-semibold mb-1">Vs baseline ({fmtDate(new Date(chart.baseline.taken_at))}{chart.baseline.label ? ` · ${chart.baseline.label}` : ''})</div>
          <table className="text-[12px] border-collapse">
            <tbody>
              <tr>
                <td className="pr-6 py-0.5 text-zinc-500">Plan ship</td>
                <td className="pr-6 py-0.5 tabular-nums">{chart.baseline.ship.likely} → {d(R.ship)}</td>
                <td className="py-0.5 tabular-nums font-medium">{fmtDelta(variance.shipDeltaWeeks)}</td>
              </tr>
              {Math.abs(variance.startMovedWeeks) >= 0.05 && (
                <tr>
                  <td className="pr-6 py-0.5 text-zinc-500">Start date moved</td>
                  <td className="pr-6 py-0.5" />
                  <td className="py-0.5 tabular-nums font-medium">{fmtDelta(variance.startMovedWeeks)}</td>
                </tr>
              )}
              {Math.abs(variance.windowGrowthWeeks) >= 0.05 && (
                <tr>
                  <td className="pr-6 py-0.5 text-zinc-500">Window width</td>
                  <td className="pr-6 py-0.5" />
                  <td className="py-0.5 tabular-nums font-medium">{fmtDelta(variance.windowGrowthWeeks)}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* risk register */}
      {allRisks.length > 0 && (
        <div className="mt-4">
          <div className="text-[13px] font-semibold mb-1">Risk register</div>
          <table className="w-full text-[12px] border-collapse">
            <thead>
              <tr className="text-left text-zinc-500 border-b border-zinc-300">
                <th className="py-1 pr-4 font-medium">Task</th>
                <th className="py-1 pr-4 font-medium">Risk</th>
                <th className="py-1 pr-4 font-medium">Chance</th>
                <th className="py-1 pr-4 font-medium">Impact</th>
                <th className="py-1 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {allRisks.map(({ task, taskDone, r }) => (
                <tr key={r.id} className="border-b border-zinc-200">
                  <td className="py-1 pr-4">{task}</td>
                  <td className="py-1 pr-4">{r.note || '—'}</td>
                  <td className="py-1 pr-4 tabular-nums">{r.prob}%</td>
                  <td className="py-1 pr-4 tabular-nums">+{r.delayMin}{r.delayMax > r.delayMin ? `–${r.delayMax}` : ''} wks</td>
                  <td className="py-1">{taskDone ? 'closed — task complete' : r.fired ? 'assumed fired (what-if)' : 'open'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* assumptions */}
      {assumptions.filter((a) => a.text.trim()).length > 0 && (
        <div className="mt-4">
          <div className="text-[13px] font-semibold mb-1">Assumptions</div>
          <ol className="list-decimal list-inside text-[12px] space-y-0.5">
            {assumptions.filter((a) => a.text.trim()).map((a) => (
              <li key={a.id}>{a.text}</li>
            ))}
          </ol>
        </div>
      )}

      {/* confidence summary */}
      <div className="mt-4 text-[12px] tabular-nums">
        <span className="font-semibold">Confidence:</span> P50 {d(mc.ship.p50)} · P80 {d(mc.ship.p80)} · P90 {d(mc.ship.p90)}
      </div>

      {/* footer */}
      <div className="mt-5 pt-2 border-t border-zinc-300 text-[10.5px] text-zinc-500">
        Forecast, not a commitment — dates shown are ranges; P80 = 8-in-10 confidence based on {mc.iterations.toLocaleString()} simulations
        of the stated duration ranges and risk rules. IAT internal.
      </div>
    </div>
  )
}
