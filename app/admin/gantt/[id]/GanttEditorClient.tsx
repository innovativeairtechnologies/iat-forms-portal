'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Printer, Copy, Trash2, Check, Loader2, Flag, FlagOff, Zap, Info,
} from 'lucide-react'
import {
  layoutRange, firedDelay, anchorTask, addWeeks, fmtDate, fmtShort, fmtDelta, nid,
  normalizeChart, makeBaseline, baselineVariance, monteCarlo, mulberry32, hashChartInputs, stripFired,
  type GanttChart, type GanttTask, type ChartStatus,
} from '@/lib/gantt'
import { updateChart, duplicateChart, deleteChart, saveBaseline } from '../actions'
import { MAX_ANCHOR, fieldCls, toolBtn, Stat, InfoTip } from './ui'
import GanttChartView from './GanttChartView'
import TaskTable from './TaskTable'
import AssumptionsCard from './AssumptionsCard'
import ConfidencePanel from './ConfidencePanel'
import PrintSheet from './PrintSheet'

export default function GanttEditorClient({ initial }: { initial: GanttChart }) {
  const router = useRouter()
  // Normalize on mount: legacy failure/reset_weeks materialize as an anchor risk;
  // the next autosave persists them. Client state is the single source of truth.
  const [chart, setChart] = useState<GanttChart>(() => {
    const n = normalizeChart(initial)
    return { ...n, assumptions: n.assumptions ?? [] }
  })
  const [saved, setSaved] = useState(true)
  const [dragging, setDragging] = useState(false)
  const [pending, setPending] = useState<'dup' | 'del' | null>(null)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const tlRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ H: number } | null>(null)

  const queueSave = useCallback((next: GanttChart) => {
    setSaved(false)
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => {
      updateChart(next.id, {
        name: next.name, customer: next.customer, status: next.status, start_date: next.start_date,
        tasks: next.tasks, assumptions: next.assumptions ?? [],
      }).then(() => setSaved(true)).catch(() => setSaved(false))
    }, 600)
  }, [])

  const patch = useCallback((p: Partial<GanttChart>) => {
    setChart((prev) => { const next = { ...prev, ...p }; queueSave(next); return next })
  }, [queueSave])

  const setTasks = useCallback((tasks: GanttTask[]) => patch({ tasks }), [patch])
  const editTask = useCallback((id: string, p: Partial<GanttTask>) => {
    setChart((prev) => {
      const next = { ...prev, tasks: prev.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)) }
      queueSave(next)
      return next
    })
  }, [queueSave])

  // ── Drag the arrival handle → set the anchor's duration (spread-preserving) ──
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    const a = anchorTask(chart)
    if (!a || a.status === 'done') return // arrival is fact — nothing to drag
    // Freeze the axis wide enough for the anchor at MAX (replacing durMin→MAX
    // shifts the worst-lane ship by exactly that delta, spread preserved).
    const R0 = layoutRange(chart)
    dragRef.current = { H: Math.ceil(R0.shipWorst + (MAX_ANCHOR - a.durMin)) + 2 }
    setDragging(true)
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const a = anchorTask(chart); const tl = tlRef.current; const d = dragRef.current
      if (!a || !tl || !d) return
      const rect = tl.getBoundingClientRect()
      // The anchor row's start already accounts for everything upstream — incl.
      // done tasks pinned to actuals — so read it from the layout, not a re-sum.
      const row = layoutRange(chart).rows.find((r) => r.t.anchor)
      const before = row ? row.start : 0
      const wk = ((e.clientX - rect.left) / rect.width) * d.H
      let dur = Math.round(wk - before - firedDelay(a, 'likely'))
      dur = Math.max(1, Math.min(MAX_ANCHOR, dur))
      if (dur !== a.durMin) {
        const spread = Math.max(0, a.durMax - a.durMin) // preserve user-entered range
        setTasks(chart.tasks.map((t) => (t.anchor ? { ...t, durMin: dur, durMax: dur + spread } : t)))
      }
    }
    const onUp = () => setDragging(false)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp) }
  }, [dragging, chart, setTasks])

  const duplicate = async () => {
    setPending('dup')
    try {
      // Flush any pending debounced save first — duplicateChart copies the DB row,
      // not client state, so an edit made <600ms ago must land before the copy.
      if (timer.current) { clearTimeout(timer.current); timer.current = null }
      if (!saved) {
        await updateChart(chart.id, {
          name: chart.name, customer: chart.customer, status: chart.status,
          start_date: chart.start_date, tasks: chart.tasks, assumptions: chart.assumptions ?? [],
        })
        setSaved(true)
      }
      const { id } = await duplicateChart(chart.id)
      router.push(`/admin/gantt/${id}`)
    } finally { setPending(null) }
  }
  const remove = async () => {
    if (!confirm('Delete this chart? This can’t be undone.')) return
    setPending('del')
    try { await deleteChart(chart.id); router.push('/admin/gantt') } finally { setPending(null) }
  }

  const setBaselineNow = async () => {
    if (chart.baseline && !confirm('Replace the existing baseline? The old one is kept only in the audit log.')) return
    const bl = makeBaseline(chart)
    setChart((prev) => ({ ...prev, baseline: bl }))
    try { await saveBaseline(chart.id, bl) } catch { /* transient — retried on next explicit save */ }
  }
  const clearBaseline = async () => {
    if (!confirm('Clear the baseline? Variance tracking stops until a new one is set.')) return
    setChart((prev) => ({ ...prev, baseline: null }))
    try { await saveBaseline(chart.id, null) } catch { /* transient */ }
  }

  // ── Derived ──────────────────────────────────────────────────────────────────
  const R = useMemo(() => layoutRange(chart), [chart])
  const a = anchorTask(chart)
  const H = dragging && dragRef.current ? dragRef.current.H : Math.max(16, Math.ceil(R.shipWorst) + 2)
  const mc = useMemo(
    () => monteCarlo(chart, { iterations: 5000, rng: mulberry32(hashChartInputs(chart)) }),
    [chart],
  )
  const variance = useMemo(() => baselineVariance(chart), [chart])

  // Fired-risk surfaces count only NON-done tasks — the engines ignore a done
  // task's risks (they're history), so the banner/chips must not claim them.
  const liveTasks = chart.tasks.filter((t) => t.status !== 'done')
  const firedList = liveTasks.flatMap((t) => (t.risks ?? []).filter((r) => r.fired).map((r) => ({ t, r })))
  const firedTotal = liveTasks.reduce((s, t) => s + firedDelay(t, 'likely'), 0)
  const allRiskChips = liveTasks.flatMap((t) => (t.risks ?? []).map((r) => ({ t, r })))

  const dt = (w: number) => fmtDate(addWeeks(chart.start_date, w))
  const anchorDone = a?.status === 'done'
  const arrDate = dt(anchorDone ? R.anchorEnd : R.anchorEnd - (a ? firedDelay(a, 'likely') : 0))
  const deltaTone = variance ? (variance.shipDeltaWeeks <= 0 ? 'emerald' : variance.shipDeltaWeeks > 2 ? 'rose' : 'amber') : undefined
  // "Done" seeds the actual from the PLAN (what-ifs stripped) — a fired scenario
  // must never be baked into a recorded fact.
  const Rplan = useMemo(() => layoutRange(stripFired(chart)), [chart])
  const plannedEnd = Object.fromEntries(Rplan.rows.map((r) => [r.t.id, r.end]))
  const doneCount = chart.tasks.filter((t) => t.status === 'done').length

  const toggleRisk = (taskId: string, riskId: string) => {
    const t = chart.tasks.find((x) => x.id === taskId)
    if (!t) return
    editTask(taskId, { risks: (t.risks ?? []).map((r) => (r.id === riskId ? { ...r, fired: !r.fired } : r)) })
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300 min-h-0">
      <style dangerouslySetInnerHTML={{ __html: '@media print { aside, .no-print { display: none !important; } }' }} />

      <div className="print:hidden">
        {/* toolbar */}
        <div className="flex items-center gap-2 px-6 pt-5 pb-3">
          <Link href="/admin/gantt" className="text-[13px] text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 inline-flex items-center gap-1">
            <ArrowLeft size={15} /> All charts
          </Link>
          <div className="flex-1" />
          <span className="text-[12px] text-zinc-400 dark:text-zinc-500 inline-flex items-center gap-1 mr-1">
            {saved ? <><Check size={13} className="text-emerald-500" /> Saved</> : <><Loader2 size={12} className="animate-spin" /> Saving…</>}
          </span>
          <button onClick={() => window.print()} className={toolBtn}><Printer size={14} /> Print / PDF</button>
          <button onClick={duplicate} disabled={!!pending} className={toolBtn}>{pending === 'dup' ? <Loader2 size={14} className="animate-spin" /> : <Copy size={14} />} Duplicate</button>
          <button onClick={remove} disabled={!!pending} className={`${toolBtn} hover:text-rose-600 hover:border-rose-300`}>{pending === 'del' ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />} Delete</button>
        </div>

        {/* meta */}
        <div className="px-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4">
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1">Project name</span>
              <input className={fieldCls} value={chart.name} onChange={(e) => patch({ name: e.target.value })} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1">Customer</span>
              <input className={fieldCls} value={chart.customer ?? ''} onChange={(e) => patch({ customer: e.target.value })} />
            </label>
            <label className="block">
              <span className="text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1 flex items-center gap-1">
                Start date
                <InfoTip text={<>Day one of the schedule. Every date on the chart is measured from here — change it and the <b>whole timeline slides</b>, including any dates you’ve already quoted a customer.</>} />
              </span>
              <input type="date" className={fieldCls} value={chart.start_date} onChange={(e) => { if (e.target.value) patch({ start_date: e.target.value }) }} />
            </label>
            <label className="block">
              <span className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1">Status</span>
              <select className={fieldCls} value={chart.status} onChange={(e) => patch({ status: e.target.value as ChartStatus })}>
                <option value="active">Active</option>
                <option value="complete">Complete</option>
                <option value="draft">Draft</option>
              </select>
            </label>
          </div>
        </div>

        {/* title */}
        <div className="px-6 pt-4 pb-1">
          <h1 className="text-[20px] font-semibold text-zinc-900 dark:text-zinc-100">{chart.name}</h1>
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500">{chart.customer || '—'} · start {fmtDate(addWeeks(chart.start_date, 0))}</p>
        </div>

        {/* controls */}
        <div className="px-6 pt-3 flex flex-wrap items-end gap-5">
          {a && (
            <div className="flex-1 min-w-[240px]">
              {anchorDone ? (
                <div className="text-[13px] text-emerald-700 dark:text-emerald-400 pb-1">
                  ✓ {a.name} arrived {arrDate} — the schedule now runs from actuals.
                </div>
              ) : (
                <>
                  <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 mb-1.5 flex items-center gap-1">
                    <span className="truncate">{a.name} · <span className="text-zinc-600 dark:text-zinc-300">{a.durMin}{a.durMax > a.durMin ? `–${a.durMax}` : ''} wks → arrives {arrDate}</span></span>
                    <InfoTip className="flex-none" text={<>The <b>anchor</b> — your longest-lead item (the big purchased part everything waits on). Drag this slider, or the “arrival” tag on the chart, to try an earlier/later arrival and watch the whole timeline shift. Changes save to the live plan instantly — there’s no undo, so drag it back, or <b>Duplicate</b> the chart first to experiment safely.</>} />
                  </div>
                  <input
                    type="range" min={1} max={MAX_ANCHOR} step={1} value={a.durMin}
                    onChange={(e) => {
                      const dur = +e.target.value
                      const spread = Math.max(0, a.durMax - a.durMin)
                      setTasks(chart.tasks.map((t) => (t.anchor ? { ...t, durMin: dur, durMax: dur + spread } : t)))
                    }}
                    className="w-full accent-emerald-600"
                  />
                </>
              )}
            </div>
          )}
          <div>
            <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 mb-1.5 flex items-center gap-1">
              Baseline
              <InfoTip text={<>A saved snapshot of the plan — your <b>“original promise.”</b> Set it once the schedule is agreed. From then on the chart shows how far you’ve drifted from it (the “Vs baseline” number). Re-baseline only when the plan is officially re-agreed.</>} />
            </div>
            {chart.baseline ? (
              <div className="flex items-center gap-2">
                <span className="text-[12px] px-2 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300 inline-flex items-center gap-1.5">
                  <Flag size={12} /> {fmtDate(new Date(chart.baseline.taken_at))} · ship {fmtShort(new Date(chart.baseline.ship.likely + 'T00:00:00'))}
                </span>
                <button onClick={setBaselineNow} className={toolBtn}>Re-baseline</button>
                <button onClick={clearBaseline} className={`${toolBtn} hover:text-rose-600 hover:border-rose-300`} title="Clear baseline"><FlagOff size={13} /></button>
              </div>
            ) : (
              <button onClick={setBaselineNow} className={toolBtn}><Flag size={13} /> Set baseline</button>
            )}
          </div>
        </div>

        {/* risk what-if chips */}
        {allRiskChips.length > 0 && (
          <div className="px-6 pt-3 flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 inline-flex items-center gap-1">
              What-if:
              <InfoTip text={<>Each chip is a “what could go wrong.” Click one to <b>pretend it happened</b> — the schedule stretches and a red banner appears. It’s safe and private (nothing is sent to anyone); click again to switch it off. If a chart shows a red banner the moment you open it, someone left a what-if on — switch it off before you quote anything.</>} />
            </span>
            {allRiskChips.map(({ t, r }) => (
              <button
                key={r.id}
                onClick={() => toggleRisk(t.id, r.id)}
                title={`${r.prob}% chance · +${r.delayMin}${r.delayMax > r.delayMin ? `–${r.delayMax}` : ''} wks if it happens`}
                className={`inline-flex items-center gap-1.5 text-[12px] px-2.5 py-1 rounded-full border transition-colors ${
                  r.fired
                    ? 'border-rose-400 dark:border-rose-500/50 bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300'
                    : 'border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-500 dark:text-zinc-400 hover:border-amber-300 dark:hover:border-amber-500/40'
                }`}
              >
                <Zap size={11} className={r.fired ? 'text-rose-500' : 'text-amber-500'} />
                {t.name}{r.note ? `: ${r.note}` : ''} · {r.prob}%
              </button>
            ))}
          </div>
        )}

        {/* what-if banner */}
        {firedList.length > 0 && (
          <div className="mx-6 mt-3 rounded-lg border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 px-3.5 py-2.5 text-[13px] text-rose-700 dark:text-rose-300">
            <b>What-if active:</b> {firedList.length} risk{firedList.length > 1 ? 's' : ''} assumed fired (+{firedTotal} wks on the plan). This is a scenario, not the plan — it prints with this label.
          </div>
        )}

        {/* stats */}
        <div className="px-6 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl">
          <Stat
            label="Ship window"
            value={`${fmtShort(addWeeks(chart.start_date, R.shipBest))} – ${dt(R.shipWorst)}`}
            sub={`plan ${dt(R.ship)}`}
            tip="The realistic range for shipping — earliest to latest, not a single date. “Plan” is the middle-of-the-road guess. If everything goes perfectly you hit the early end; if a few things run long, the late end."
          />
          <Stat
            label="80% confident by"
            value={dt(mc.ship.p80)}
            sub={`P50 ${dt(mc.ship.p50)} · P90 ${dt(mc.ship.p90)}`}
            tone="emerald"
            tip="This is the date to quote a customer — you ship on or before it about 8 times out of 10. The plan date is only a middle guess (around 50/50), so never quote that one. Confirm the quote date with the project lead before committing to a customer."
          />
          <Stat
            label="Vs baseline"
            value={variance ? fmtDelta(variance.shipDeltaWeeks) : '—'}
            sub={chart.baseline ? `set ${fmtDate(new Date(chart.baseline.taken_at))}` : 'no baseline set'}
            tone={deltaTone}
            tip="How much the plan has moved (later or earlier) since you saved your baseline. Green = on time or better, amber = slipping, red = well behind. Shows “—” until you set a baseline."
          />
        </div>

        {/* callout */}
        <div className="px-6 pt-4">
          <div className="rounded-lg border px-3.5 py-2.5 text-[13.5px] flex items-start gap-2 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300">
            <Info size={16} className="mt-[2px] flex-shrink-0" />
            <span>
              {anchorDone ? <>Long-lead items arrived <b className="font-semibold text-zinc-900 dark:text-zinc-100">{arrDate}</b>; the shipment window is </>
                : <>If long-lead items arrive by <b className="font-semibold text-zinc-900 dark:text-zinc-100">{arrDate}</b>, the shipment window is </>}
              <b className="font-semibold text-zinc-900 dark:text-zinc-100">{fmtShort(addWeeks(chart.start_date, R.shipBest))} – {dt(R.shipWorst)}</b>{' '}
              — 80% confident by <b className="font-semibold text-zinc-900 dark:text-zinc-100">{dt(mc.ship.p80)}</b>.
              {doneCount > 0 && <span className="text-emerald-700/80 dark:text-emerald-400/80"> {doneCount} of {chart.tasks.length} steps complete.</span>}
            </span>
          </div>
        </div>

        {/* chart */}
        <div className="px-6 pt-4">
          <GanttChartView chart={chart} R={R} H={H} tlRef={tlRef} onArrivalPointerDown={startDrag} interactive />
        </div>

        {/* confidence + assumptions */}
        <div className="px-6 pt-5 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <ConfidencePanel chart={chart} mc={mc} />
          <AssumptionsCard assumptions={chart.assumptions ?? []} onChange={(next) => patch({ assumptions: next })} />
        </div>

        {/* tasks */}
        <div className="px-6 py-6">
          <TaskTable
            tasks={chart.tasks}
            startDate={chart.start_date}
            plannedEnd={plannedEnd}
            onEditTask={editTask}
            onSetTasks={setTasks}
            onAdd={() => { if (chart.tasks.length >= 60) return; setTasks([...chart.tasks, { id: nid(), name: 'New task', kind: 'task', cat: 'routine', owner: '', durMin: 1, durMax: 1 }]) }}
            onMove={(i, dir) => {
              const j = i + dir
              if (j < 0 || j >= chart.tasks.length) return
              const next = chart.tasks.slice()
              ;[next[i], next[j]] = [next[j], next[i]]
              setTasks(next)
            }}
            onDelete={(id) => setTasks(chart.tasks.filter((x) => x.id !== id))}
            onSetAnchor={(id) => setTasks(chart.tasks.map((x) => ({ ...x, anchor: x.id === id })))}
          />
        </div>
      </div>

      <PrintSheet chart={chart} R={R} H={H} mc={mc} variance={variance} />
    </div>
  )
}
