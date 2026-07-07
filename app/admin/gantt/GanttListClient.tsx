'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Plus, CalendarRange, ChevronRight, Loader2 } from 'lucide-react'
import {
  HEADER_BOX, BODY_BOX, rowCx, StatusPill, timeAgo, Th, TableScroll,
  ListPageHeader, IdentityCell, type Tone,
} from '@/components/admin/list'
import { layoutRange, addWeeks, fmtDate, fmtShort, type GanttChart } from '@/lib/gantt'
import { createChart } from './actions'

const STATUS_TONE: Record<string, { label: string; tone: Tone }> = {
  active: { label: 'Active', tone: 'emerald' },
  complete: { label: 'Complete', tone: 'sky' },
  draft: { label: 'Draft', tone: 'slate' },
}

const COLS = 'grid-cols-[2fr_200px_88px_100px_64px_28px]'

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
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Page header */}
      <ListPageHeader
        overline="Planning"
        title="Gantt"
        count={`${charts.length} project ${charts.length === 1 ? 'timeline' : 'timelines'}`}
        actions={
          <>
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
          </>
        }
      />

      <div className="p-4 sm:p-8">
        {/* Floating header */}
        <TableScroll minWidth={820}>
        <div className={`grid ${COLS} ${HEADER_BOX}`}>
          <Th>Project</Th>
          <Th>Ship Window</Th>
          <Th>Tasks</Th>
          <Th>Status</Th>
          <Th>Updated</Th>
          <Th />
        </div>

        {/* Body */}
        <div className={BODY_BOX}>
          {charts.length === 0 ? (
            <div className="py-16 text-center">
              <CalendarRange size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">No project timelines yet.</p>
            </div>
          ) : (
            charts.map((c, i) => {
              const R = layoutRange(c)
              const windowTxt = `${fmtShort(addWeeks(c.start_date, R.shipBest))} – ${fmtDate(addWeeks(c.start_date, R.shipWorst))}`
              const plan = fmtDate(addWeeks(c.start_date, R.ship))
              const tcount = c.tasks.filter((t) => t.kind === 'task').length
              const meta = STATUS_TONE[c.status] || STATUS_TONE.active
              return (
                <Link
                  key={c.id}
                  href={`/admin/gantt/${c.id}`}
                  className={`${rowCx(COLS, { i })} group`}
                >
                  {/* Identity — project name over customer */}
                  <IdentityCell
                    icon={<CalendarRange size={13} />}
                    title={c.name}
                    subtitle={c.customer || undefined}
                  />
                  {/* Ship window (+ plan) */}
                  <div className="min-w-0">
                    <div className="text-zinc-700 dark:text-zinc-200 tabular-nums truncate">{windowTxt}</div>
                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500 tabular-nums truncate">plan {plan}</div>
                  </div>
                  {/* Tasks */}
                  <div className="text-zinc-600 dark:text-zinc-300 tabular-nums">{tcount} {tcount === 1 ? 'task' : 'tasks'}</div>
                  {/* Status */}
                  <div>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </div>
                  {/* Updated */}
                  <div className="text-zinc-400 dark:text-zinc-500 tabular-nums">{c.updated_at ? timeAgo(c.updated_at) : '—'}</div>
                  {/* Chevron */}
                  <div className="flex justify-center">
                    <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                  </div>
                </Link>
              )
            })
          )}
        </div>
        </TableScroll>
      </div>
    </div>
  )
}
