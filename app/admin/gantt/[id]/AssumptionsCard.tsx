'use client'

import { Plus, X } from 'lucide-react'
import { nid, type GanttAssumption } from '@/lib/gantt'
import { fieldCls, IconBtn, InfoTip } from './ui'

/* The assumptions register — every chart carries its own caveats, on screen and
   in print. Render-only; state lives in the shell. */

export default function AssumptionsCard({ assumptions, onChange }: {
  assumptions: GanttAssumption[]
  onChange: (next: GanttAssumption[]) => void
}) {
  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40">
      <div className="px-4 py-3 border-b border-zinc-200 dark:border-zinc-800">
        <h3 className="text-[14px] font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
          Assumptions
          <InfoTip text={<>The “fine print” behind the dates — anything that has to be true for this schedule to hold (vendor quotes, one test cycle, no design changes). These print on the shared PDF, so the dates never travel without their caveats.</>} />
        </h3>
        <p className="text-[12px] text-zinc-400 dark:text-zinc-500">What this schedule takes for granted — printed with the chart.</p>
      </div>
      <div className="px-4 py-3 space-y-2">
        {assumptions.length === 0 && (
          <p className="text-[12.5px] text-zinc-400 dark:text-zinc-500">None yet — e.g. "Assumes a single test cycle", "Assumes vendor quote of 10 wks holds".</p>
        )}
        {assumptions.map((a, i) => (
          <div key={a.id} className="flex items-center gap-2">
            <span className="text-[12px] text-zinc-300 dark:text-zinc-600 tabular-nums w-4">{i + 1}.</span>
            <input
              className={fieldCls}
              value={a.text}
              placeholder="Assumes…"
              onChange={(e) => onChange(assumptions.map((x) => (x.id === a.id ? { ...x, text: e.target.value } : x)))}
            />
            <IconBtn label="Remove assumption" danger onClick={() => onChange(assumptions.filter((x) => x.id !== a.id))}>
              <X size={13} />
            </IconBtn>
          </div>
        ))}
        <button
          onClick={() => onChange([...assumptions, { id: nid(), text: '' }])}
          className="text-[12px] text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 inline-flex items-center gap-1"
        >
          <Plus size={12} /> Add assumption
        </button>
      </div>
    </div>
  )
}
