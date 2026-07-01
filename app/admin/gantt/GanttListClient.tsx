'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, CalendarRange, Loader2 } from 'lucide-react'
import { StatusPill, timeAgo, type Tone } from '@/components/admin/list'
import { layout, addWeeks, fmtDate, type GanttChart } from '@/lib/gantt'
import { createChart } from './actions'

const STATUS_TONE: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'emerald' },
  complete: { label: 'Complete', tone: 'sky' },
  draft: { label: 'Draft', tone: 'slate' },
}

export default function GanttListClient({ charts }: { charts: GanttChart[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)

  const make = async (kind: 'blank' | 'auckland') => {
    setBusy(kind)
    try {
      const { id } = await createChart(kind)
      router.push(`/admin/gantt/${id}`)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300 min-h-0">
      <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-4">
        <div>
          <h1 className="text-[18px] font-semibold text-zinc-900 dark:text-zinc-100">Gantt</h1>
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500">Customer project timelines — plan, track, and share.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => make('auckland')}
            disabled={!!busy}
            className="text-[13px] px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800 inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy === 'auckland' ? <Loader2 size={15} className="animate-spin" /> : <CalendarRange size={15} />} New from template
          </button>
          <button
            onClick={() => make('blank')}
            disabled={!!busy}
            className="text-[13px] px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {busy === 'blank' ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} New chart
          </button>
        </div>
      </div>

      <div className="px-6 pb-10">
        {charts.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 py-16 text-center">
            <CalendarRange size={22} className="mx-auto text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-[14px] text-zinc-600 dark:text-zinc-300">No project timelines yet.</p>
            <button
              onClick={() => make('auckland')}
              className="mt-3 text-[13px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium inline-flex items-center gap-1.5"
            >
              <Plus size={14} /> New from template
            </button>
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {charts.map((c) => {
              const L = layout(c)
              const ship = fmtDate(addWeeks(c.start_date, L.ship))
              const tcount = c.tasks.filter((t) => t.kind === 'task').length
              const meta = STATUS_TONE[c.status] || STATUS_TONE.active
              return (
                <Link
                  key={c.id}
                  href={`/admin/gantt/${c.id}`}
                  className="group rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 p-4 hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-[14.5px] font-medium text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400">
                        {c.name}
                      </div>
                      <div className="text-[12.5px] text-zinc-400 dark:text-zinc-500 truncate">{c.customer || '—'}</div>
                    </div>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </div>
                  <div className="mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800 flex items-end justify-between">
                    <div>
                      <div className="text-[11px] text-zinc-400 dark:text-zinc-500">est. ship</div>
                      <div className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100 tabular-nums">{ship}</div>
                    </div>
                    <div className="text-[11.5px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                      {tcount} tasks · {Math.round(L.ship)} wks
                      {c.updated_at ? ` · ${timeAgo(c.updated_at)}` : ''}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
