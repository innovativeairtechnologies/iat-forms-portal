'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Printer, Copy, Trash2, Check, Loader2, MoveHorizontal, Plus, ArrowUp, ArrowDown, X, Info,
} from 'lucide-react'
import {
  layout, effDur, anchorTask, addWeeks, fmtDate, fmtShort, nid, CAT_META,
  type GanttChart, type GanttTask, type TaskCat, type TaskKind, type Scenario, type ChartStatus,
} from '@/lib/gantt'
import { updateChart, duplicateChart, deleteChart } from '../actions'

const AXIS_H = 26
const ROW_H = 34
const MAX_ANCHOR = 40

const BAR_CLS: Record<TaskCat, string> = {
  routine: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600',
  uncertain: 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500/50',
  build: 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500/50',
}
const DOT_CLS: Record<string, string> = {
  routine: 'bg-zinc-400', uncertain: 'bg-amber-500', build: 'bg-emerald-500', milestone: 'bg-zinc-900 dark:bg-zinc-100',
}

const fieldCls =
  'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'
const toolBtn =
  'text-[12.5px] px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 inline-flex items-center gap-1.5'

export default function GanttEditorClient({ initial }: { initial: GanttChart }) {
  const router = useRouter()
  const [chart, setChart] = useState<GanttChart>(initial)
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
        scenario: next.scenario, failure: next.failure, reset_weeks: next.reset_weeks, tasks: next.tasks,
      }).then(() => setSaved(true)).catch(() => setSaved(false))
    }, 600)
  }, [])

  const patch = useCallback((p: Partial<GanttChart>) => {
    setChart((prev) => { const next = { ...prev, ...p }; queueSave(next); return next })
  }, [queueSave])

  const setTasks = useCallback((tasks: GanttTask[]) => patch({ tasks }), [patch])
  const editTask = (id: string, p: Partial<GanttTask>) =>
    setTasks(chart.tasks.map((t) => (t.id === id ? { ...t, ...p } : t)))

  // ── Drag the arrival handle → set the anchor task's duration ────────────────
  const startDrag = (e: React.PointerEvent) => {
    e.preventDefault()
    const a = anchorTask(chart)
    if (!a) return
    let sumOther = 0
    for (const t of chart.tasks) if (!t.anchor) sumOther += effDur(t, chart.scenario)
    dragRef.current = { H: Math.ceil(sumOther + MAX_ANCHOR + (chart.failure ? Number(chart.reset_weeks) || 0 : 0)) + 2 }
    setDragging(true)
  }
  useEffect(() => {
    if (!dragging) return
    const onMove = (e: PointerEvent) => {
      const a = anchorTask(chart); const tl = tlRef.current; const d = dragRef.current
      if (!a || !tl || !d) return
      const rect = tl.getBoundingClientRect()
      let before = 0
      for (const t of chart.tasks) { if (t.anchor) break; before += effDur(t, chart.scenario) }
      const wk = ((e.clientX - rect.left) / rect.width) * d.H
      let dur = Math.round(wk - before - (chart.failure ? Number(chart.reset_weeks) || 0 : 0))
      dur = Math.max(1, Math.min(MAX_ANCHOR, dur))
      if (dur !== a.durMin) setTasks(chart.tasks.map((t) => (t.anchor ? { ...t, durMin: dur, durMax: dur } : t)))
    }
    const onUp = () => setDragging(false)
    document.addEventListener('pointermove', onMove)
    document.addEventListener('pointerup', onUp)
    return () => { document.removeEventListener('pointermove', onMove); document.removeEventListener('pointerup', onUp) }
  }, [dragging, chart, setTasks])

  const duplicate = async () => { setPending('dup'); try { const { id } = await duplicateChart(chart.id); router.push(`/admin/gantt/${id}`) } finally { setPending(null) } }
  const remove = async () => {
    if (!confirm('Delete this chart? This can’t be undone.')) return
    setPending('del')
    try { await deleteChart(chart.id); router.push('/admin/gantt') } finally { setPending(null) }
  }

  // ── Derived layout ──────────────────────────────────────────────────────────
  const L = layout(chart)
  const a = anchorTask(chart)
  const H = dragging && dragRef.current ? dragRef.current.H : Math.max(16, Math.ceil(L.ship) + 2)
  const n = chart.tasks.length
  const x = (w: number) => (w / H) * 100
  const ticks: number[] = []
  for (let w = 0; w <= H; w += 4) ticks.push(w)

  const fromArr = Math.round(L.ship - L.anchorEnd)
  const arrDate = fmtDate(addWeeks(chart.start_date, L.anchorEnd - (chart.failure ? Number(chart.reset_weeks) || 0 : 0)))
  const shipDate = fmtDate(addWeeks(chart.start_date, L.ship))

  const SCENARIOS: Scenario[] = ['best', 'likely', 'worst']

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300 min-h-0">
      <style dangerouslySetInnerHTML={{ __html: '@media print { aside, .no-print { display: none !important; } }' }} />

      {/* toolbar */}
      <div className="no-print flex items-center gap-2 px-6 pt-5 pb-3">
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
      <div className="no-print px-6">
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
            <span className="block text-[11px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500 mb-1">Start date</span>
            <input type="date" className={fieldCls} value={chart.start_date} onChange={(e) => patch({ start_date: e.target.value })} />
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
      <div className="no-print px-6 pt-3 flex flex-wrap items-end gap-5">
        <div>
          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 mb-1.5">Scenario</div>
          <div className="inline-flex rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-700">
            {SCENARIOS.map((s) => (
              <button
                key={s}
                onClick={() => patch({ scenario: s })}
                className={`text-[12.5px] px-3 py-1.5 ${s !== 'best' ? 'border-l border-zinc-200 dark:border-zinc-700' : ''} ${chart.scenario === s ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900' : 'bg-white dark:bg-zinc-900 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
              >
                {s[0].toUpperCase() + s.slice(1)} case
              </button>
            ))}
          </div>
        </div>

        {a && (
          <div className="flex-1 min-w-[240px]">
            <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 mb-1.5 truncate">
              {a.name} · <span className="text-zinc-600 dark:text-zinc-300">{a.durMin} wks → arrives {arrDate}</span>
            </div>
            <input
              type="range" min={1} max={MAX_ANCHOR} step={1} value={a.durMin}
              onChange={(e) => setTasks(chart.tasks.map((t) => (t.anchor ? { ...t, durMin: +e.target.value, durMax: +e.target.value } : t)))}
              className="w-full accent-emerald-600"
            />
          </div>
        )}

        <div>
          <div className="text-[11px] font-semibold text-zinc-400 dark:text-zinc-500 mb-1.5">Contingency</div>
          <button
            onClick={() => patch({ failure: !chart.failure })}
            className={`text-[12.5px] px-3 py-1.5 rounded-lg border ${chart.failure ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-300 dark:border-rose-500/40 text-rose-700 dark:text-rose-300' : 'bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
          >
            {chart.failure ? 'Clear test failure' : 'Simulate test failure'}
          </button>
        </div>
      </div>

      {/* stats */}
      <div className="px-6 pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-3xl">
        <Stat label="Estimated ship" value={shipDate} />
        <Stat label="From arrival to ship" value={`${fromArr} wks`} sub="testing + build + FAT" />
        <Stat label="Total from start" value={`${Math.round(L.ship)} wks`} />
      </div>

      {/* callout */}
      <div className="px-6 pt-4">
        <div className={`rounded-lg border px-3.5 py-2.5 text-[13.5px] flex items-start gap-2 ${chart.failure ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300' : 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-300'}`}>
          <Info size={16} className="mt-[2px] flex-shrink-0" />
          <span>
            If long-lead items arrive by <b className="font-semibold text-zinc-900 dark:text-zinc-100">{arrDate}</b>, first shipment lands around{' '}
            <b className="font-semibold text-zinc-900 dark:text-zinc-100">{shipDate}</b>
            {chart.failure ? ` — a simulated test failure has reset the schedule by ${Number(chart.reset_weeks) || 0} weeks.` : '.'}
          </span>
        </div>
      </div>

      {/* gantt */}
      <div className="px-6 pt-4">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden">
          <div className="flex">
            {/* labels */}
            <div className="w-[210px] flex-none border-r border-zinc-200 dark:border-zinc-800">
              <div style={{ height: AXIS_H }} />
              {L.rows.map((r) => {
                const t = r.t
                const dot = t.kind === 'milestone' ? DOT_CLS.milestone : DOT_CLS[t.cat]
                const note = t.kind === 'milestone'
                  ? 'milestone'
                  : t.anchor
                    ? (chart.failure ? `${r.base}+${r.extra} wks` : `${r.base} wks · TBD`)
                    : `${r.base} wks`
                return (
                  <div key={t.id} style={{ height: ROW_H }} className="px-3 flex flex-col justify-center">
                    <div className="text-[12.5px] text-zinc-800 dark:text-zinc-200 truncate flex items-center gap-1.5">
                      <span className={`w-[7px] h-[7px] rounded-sm flex-none ${dot}`} />{t.name}
                    </div>
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 pl-[13px] truncate">
                      {note}{t.owner ? ` · ${t.owner}` : ''}
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
              {L.rows.map((r, i) => {
                const t = r.t
                const top = AXIS_H + i * ROW_H + 8
                if (t.kind === 'milestone') {
                  return (
                    <div
                      key={t.id} title={t.name}
                      className="absolute w-[13px] h-[13px] bg-zinc-900 dark:bg-zinc-100 rounded-sm"
                      style={{ left: `${x(r.end)}%`, top: top - 1, transform: 'translateX(-50%) rotate(45deg)' }}
                    />
                  )
                }
                const dashed = t.anchor && !chart.failure ? 'border-dashed' : ''
                return (
                  <div key={t.id}>
                    <div
                      title={t.name}
                      className={`absolute h-[18px] rounded-[5px] border ${BAR_CLS[t.cat]} ${dashed}`}
                      style={{ left: `${x(r.start)}%`, width: `${(r.base / H) * 100}%`, top }}
                    />
                    {r.extra > 0 && (
                      <div
                        title="schedule reset"
                        className="absolute h-[18px] rounded-[5px] border bg-rose-100 dark:bg-rose-500/20 border-rose-400 dark:border-rose-500/50"
                        style={{ left: `${x(r.start + r.base)}%`, width: `${(r.extra / H) * 100}%`, top }}
                      />
                    )}
                  </div>
                )
              })}
              {a && (
                <>
                  <div className="absolute bg-amber-500" style={{ left: `${x(L.anchorEnd)}%`, top: AXIS_H, bottom: 0, width: 2, transform: 'translateX(-1px)' }} />
                  <div
                    onPointerDown={startDrag}
                    className="no-print absolute z-10 flex items-center gap-1 cursor-grab select-none rounded-full border border-amber-400 dark:border-amber-500/50 bg-amber-100 dark:bg-amber-500/20 text-amber-800 dark:text-amber-300 text-[11px] font-medium px-2 py-[2px]"
                    style={{ left: `${x(L.anchorEnd)}%`, top: 1, transform: 'translateX(-50%)', touchAction: 'none' }}
                  >
                    <MoveHorizontal size={12} /> arrival
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {/* legend */}
        <div className="flex flex-wrap gap-4 mt-3 text-[12px] text-zinc-500 dark:text-zinc-400">
          <span className="no-print text-zinc-400 dark:text-zinc-600">drag the arrival pill to reschedule ·</span>
          <Legend cls="bg-amber-500" label="critical path (uncertain)" />
          <Legend cls="bg-emerald-500" label="production build" />
          <Legend cls="bg-zinc-400" label="routine step" />
          <Legend cls="bg-zinc-900 dark:bg-zinc-100" label="milestone" />
          {chart.failure && <Legend cls="bg-rose-500" label="failure reset" />}
        </div>
      </div>

      {/* task table */}
      <div className="no-print px-6 py-6">
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
            <h3 className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">Tasks</h3>
            <button
              onClick={() => setTasks([...chart.tasks, { id: nid(), name: 'New task', kind: 'task', cat: 'routine', owner: '', durMin: 1, durMax: 1 }])}
              className={toolBtn}
            >
              <Plus size={14} /> Add task
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-zinc-400 dark:text-zinc-500 bg-zinc-50 dark:bg-zinc-900/60">
                  <th className="text-left font-semibold px-3 py-2 w-8"></th>
                  <th className="text-left font-semibold px-3 py-2">Name</th>
                  <th className="text-left font-semibold px-3 py-2 w-28">Type</th>
                  <th className="text-left font-semibold px-3 py-2 w-32">Weeks (min–max)</th>
                  <th className="text-left font-semibold px-3 py-2 w-44">Category</th>
                  <th className="text-left font-semibold px-3 py-2 w-32">Owner</th>
                  <th className="text-center font-semibold px-3 py-2 w-16">Anchor</th>
                  <th className="px-3 py-2 w-20"></th>
                </tr>
              </thead>
              <tbody>
                {chart.tasks.map((t, i) => {
                  const isM = t.kind === 'milestone'
                  return (
                    <tr key={t.id} className="border-t border-zinc-100 dark:border-zinc-800/60">
                      <td className="px-3 py-1.5 text-zinc-300 dark:text-zinc-600 tabular-nums">{i + 1}</td>
                      <td className="px-3 py-1.5">
                        <input className={fieldCls} value={t.name} onChange={(e) => editTask(t.id, { name: e.target.value })} />
                      </td>
                      <td className="px-3 py-1.5">
                        <select
                          className={fieldCls} value={t.kind}
                          onChange={(e) => {
                            const kind = e.target.value as TaskKind
                            editTask(t.id, kind === 'milestone' ? { kind, durMin: 0, durMax: 0, anchor: false } : { kind })
                          }}
                        >
                          <option value="task">Task</option>
                          <option value="milestone">Milestone</option>
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        {isM ? (
                          <span className="text-zinc-300 dark:text-zinc-600">—</span>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <input type="number" min={0} step={1} className={`${fieldCls} w-14`} value={t.durMin} onChange={(e) => editTask(t.id, { durMin: +e.target.value })} />
                            <span className="text-zinc-300 dark:text-zinc-600">–</span>
                            <input type="number" min={0} step={1} className={`${fieldCls} w-14`} value={t.durMax} onChange={(e) => editTask(t.id, { durMax: +e.target.value })} />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <select className={fieldCls} value={t.cat} onChange={(e) => editTask(t.id, { cat: e.target.value as TaskCat })}>
                          {(Object.keys(CAT_META) as TaskCat[]).map((k) => (
                            <option key={k} value={k}>{CAT_META[k].label}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-3 py-1.5">
                        <input className={fieldCls} value={t.owner ?? ''} onChange={(e) => editTask(t.id, { owner: e.target.value })} />
                      </td>
                      <td className="px-3 py-1.5 text-center">
                        {!isM && (
                          <input
                            type="radio" name="anchor" checked={!!t.anchor}
                            title="This is the long-lead / critical-path driver"
                            onChange={() => setTasks(chart.tasks.map((x) => ({ ...x, anchor: x.id === t.id })))}
                            className="accent-amber-500 w-4 h-4"
                          />
                        )}
                      </td>
                      <td className="px-3 py-1.5">
                        <div className="flex items-center justify-end gap-0.5">
                          <IconBtn label="Move up" disabled={i === 0} onClick={() => move(chart, i, -1, setTasks)}><ArrowUp size={14} /></IconBtn>
                          <IconBtn label="Move down" disabled={i === n - 1} onClick={() => move(chart, i, 1, setTasks)}><ArrowDown size={14} /></IconBtn>
                          <IconBtn label="Delete" danger onClick={() => setTasks(chart.tasks.filter((x) => x.id !== t.id))}><X size={14} /></IconBtn>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 text-[12px] text-zinc-500 dark:text-zinc-400">
            The <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-1.5 py-[1px] rounded">anchor</span>{' '}
            task is the long-lead / critical-path driver — its arrival date drives everything downstream. Min–max weeks feed the Best/Likely/Worst scenarios.
          </div>
        </div>
      </div>
    </div>
  )
}

function move(chart: GanttChart, i: number, dir: number, setTasks: (t: GanttTask[]) => void) {
  const j = i + dir
  if (j < 0 || j >= chart.tasks.length) return
  const next = chart.tasks.slice()
  ;[next[i], next[j]] = [next[j], next[i]]
  setTasks(next)
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-3.5 py-3">
      <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{label}</div>
      <div className="text-[22px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums mt-0.5">{value}</div>
      {sub && <div className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  )
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-[9px] h-[9px] rounded-sm ${cls}`} />{label}
    </span>
  )
}

function IconBtn({ children, label, onClick, disabled, danger }: { children: React.ReactNode; label: string; onClick: () => void; disabled?: boolean; danger?: boolean }) {
  return (
    <button
      aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`p-1 rounded-md text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed ${danger ? 'hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
    >
      {children}
    </button>
  )
}
