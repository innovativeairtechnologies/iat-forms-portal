'use client'

import { useState } from 'react'
import { Plus, ArrowUp, ArrowDown, X, Zap, ChevronDown, ChevronRight } from 'lucide-react'
import { CAT_META, nid, type GanttTask, type TaskCat, type TaskKind, type TaskRisk } from '@/lib/gantt'
import { fieldCls, toolBtn, IconBtn } from './ui'

/* Editable task list + per-task risk rules (the structured IF-THEN layer).
   Pure render + callbacks; all state lives in the shell. */

interface Props {
  tasks: GanttTask[]
  onEditTask: (id: string, patch: Partial<GanttTask>) => void
  onSetTasks: (tasks: GanttTask[]) => void
  onAdd: () => void
  onMove: (i: number, dir: number) => void
  onDelete: (id: string) => void
  onSetAnchor: (id: string) => void
}

export default function TaskTable({ tasks, onEditTask, onSetTasks, onAdd, onMove, onDelete, onSetAnchor }: Props) {
  const [openRisks, setOpenRisks] = useState<string | null>(null)
  const n = tasks.length

  const editRisk = (t: GanttTask, riskId: string, patch: Partial<TaskRisk>) =>
    onEditTask(t.id, { risks: (t.risks ?? []).map((r) => (r.id === riskId ? { ...r, ...patch } : r)) })

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100">Tasks</h3>
        <button onClick={onAdd} className={toolBtn}>
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
              <th className="text-left font-semibold px-3 py-2 w-24">Risks</th>
              <th className="text-center font-semibold px-3 py-2 w-16">Anchor</th>
              <th className="px-3 py-2 w-20"></th>
            </tr>
          </thead>
          <tbody>
            {tasks.map((t, i) => {
              const isM = t.kind === 'milestone'
              const risks = t.risks ?? []
              const open = openRisks === t.id
              return (
                <RowGroup key={t.id}>
                  <tr className="border-t border-zinc-100 dark:border-zinc-800/60">
                    <td className="px-3 py-1.5 text-zinc-300 dark:text-zinc-600 tabular-nums">{i + 1}</td>
                    <td className="px-3 py-1.5">
                      <input className={fieldCls} value={t.name} onChange={(e) => onEditTask(t.id, { name: e.target.value })} />
                    </td>
                    <td className="px-3 py-1.5">
                      <select
                        className={fieldCls}
                        value={t.kind}
                        onChange={(e) => {
                          const kind = e.target.value as TaskKind
                          onEditTask(t.id, kind === 'milestone' ? { kind, durMin: 0, durMax: 0, anchor: false, risks: undefined } : { kind })
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
                          <input type="number" min={0} step={1} className={`${fieldCls} w-14`} value={t.durMin} onChange={(e) => onEditTask(t.id, { durMin: +e.target.value })} />
                          <span className="text-zinc-300 dark:text-zinc-600">–</span>
                          <input type="number" min={0} step={1} className={`${fieldCls} w-14`} value={t.durMax} onChange={(e) => onEditTask(t.id, { durMax: +e.target.value })} />
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <select className={fieldCls} value={t.cat} onChange={(e) => onEditTask(t.id, { cat: e.target.value as TaskCat })}>
                        {(Object.keys(CAT_META) as TaskCat[]).map((k) => (
                          <option key={k} value={k}>
                            {CAT_META[k].label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-1.5">
                      <input className={fieldCls} value={t.owner ?? ''} onChange={(e) => onEditTask(t.id, { owner: e.target.value })} />
                    </td>
                    <td className="px-3 py-1.5">
                      {isM ? (
                        <span className="text-zinc-300 dark:text-zinc-600">—</span>
                      ) : (
                        <button
                          onClick={() => setOpenRisks(open ? null : t.id)}
                          className={`inline-flex items-center gap-1 text-[12px] px-2 py-1 rounded-md border ${
                            risks.length
                              ? 'border-amber-300 dark:border-amber-500/40 bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300'
                              : 'border-zinc-200 dark:border-zinc-700 text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                          }`}
                        >
                          <Zap size={12} />
                          {risks.length || 'add'}
                          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      {!isM && (
                        <input
                          type="radio"
                          name="anchor"
                          checked={!!t.anchor}
                          title="This is the long-lead / critical-path driver"
                          onChange={() => onSetAnchor(t.id)}
                          className="accent-amber-500 w-4 h-4"
                        />
                      )}
                    </td>
                    <td className="px-3 py-1.5">
                      <div className="flex items-center justify-end gap-0.5">
                        <IconBtn label="Move up" disabled={i === 0} onClick={() => onMove(i, -1)}>
                          <ArrowUp size={14} />
                        </IconBtn>
                        <IconBtn label="Move down" disabled={i === n - 1} onClick={() => onMove(i, 1)}>
                          <ArrowDown size={14} />
                        </IconBtn>
                        <IconBtn label="Delete" danger onClick={() => onDelete(t.id)}>
                          <X size={14} />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>

                  {open && !isM && (
                    <tr className="border-t border-zinc-100 dark:border-zinc-800/60 bg-zinc-50/60 dark:bg-zinc-900/40">
                      <td />
                      <td colSpan={8} className="px-3 py-2.5">
                        <div className="space-y-2">
                          {risks.map((r) => (
                            <div key={r.id} className="flex flex-wrap items-center gap-2 text-[12.5px]">
                              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                                <Zap size={12} /> if
                              </span>
                              <input
                                className={`${fieldCls} w-56`}
                                placeholder="what could go wrong (e.g. test failure)"
                                value={r.note ?? ''}
                                onChange={(e) => editRisk(t, r.id, { note: e.target.value })}
                              />
                              <span className="text-zinc-400">chance</span>
                              <div className="flex items-center gap-1">
                                <input type="number" min={0} max={100} step={5} className={`${fieldCls} w-16`} value={r.prob} onChange={(e) => editRisk(t, r.id, { prob: +e.target.value })} />
                                <span className="text-zinc-400">%</span>
                              </div>
                              <span className="text-zinc-400">→ adds</span>
                              <div className="flex items-center gap-1">
                                <input type="number" min={0} step={1} className={`${fieldCls} w-14`} value={r.delayMin} onChange={(e) => editRisk(t, r.id, { delayMin: +e.target.value })} />
                                <span className="text-zinc-300 dark:text-zinc-600">–</span>
                                <input type="number" min={0} step={1} className={`${fieldCls} w-14`} value={r.delayMax} onChange={(e) => editRisk(t, r.id, { delayMax: +e.target.value })} />
                                <span className="text-zinc-400">wks</span>
                              </div>
                              <label className={`inline-flex items-center gap-1.5 text-[12px] px-2 py-1 rounded-md border cursor-pointer ${r.fired ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-300' : 'border-zinc-200 dark:border-zinc-700 text-zinc-500 dark:text-zinc-400'}`}>
                                <input type="checkbox" className="accent-rose-500" checked={!!r.fired} onChange={(e) => editRisk(t, r.id, { fired: e.target.checked })} />
                                assume it happens
                              </label>
                              <IconBtn label="Remove risk" danger onClick={() => onEditTask(t.id, { risks: risks.filter((x) => x.id !== r.id) })}>
                                <X size={13} />
                              </IconBtn>
                            </div>
                          ))}
                          <button
                            onClick={() => onEditTask(t.id, { risks: [...risks, { id: nid(), prob: 25, delayMin: 2, delayMax: 4, note: '' }] })}
                            className="text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 inline-flex items-center gap-1"
                          >
                            <Plus size={12} /> Add risk rule
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </RowGroup>
              )
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2.5 border-t border-zinc-200 dark:border-zinc-800 text-[12px] text-zinc-500 dark:text-zinc-400">
        The <span className="text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-100 dark:bg-amber-500/15 px-1.5 py-[1px] rounded">anchor</span>{' '}
        task's arrival drives everything downstream. Min–max weeks set each task's range; <Zap size={11} className="inline -mt-[2px]" /> risk rules are the IF-THENs —
        unfired risks are priced by the simulation only, "assume it happens" adds the delay to the plan (loudly labeled).
      </div>
    </div>
  )
}

/** Fragment wrapper so each task can emit its row + optional expanded risk row. */
function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
