'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Lock, PenLine } from 'lucide-react'
import { cn } from '@/lib/utils'
import { POINTS, type BacnetPoint, type PointGroup } from '@/lib/cpco'

/* The BACnet point list as something a rep can interrogate rather than a
   spreadsheet to memorise.

   Three ideas carried from the course design:
   - Read-only vs writable is THE question on an integration call, so it is the
     loudest visual distinction here (the pill on every row).
   - The instance numbers are this job's, not gospel — the header says so, and
     `optional` rows are labelled for equipment not every unit has.
   - The export's defects are shown, not hidden: a rep who has seen "this label
     is wrong in the export" handles the confused-integrator call calmly. */

const GROUPS: { key: PointGroup | 'all'; label: string }[] = [
  { key: 'all', label: 'All 38' },
  { key: 'alarm', label: 'Alarms' },
  { key: 'sensor', label: 'Sensors' },
  { key: 'setpoint', label: 'Setpoints' },
  { key: 'command', label: 'Commands' },
]

const TYPE_SHORT: Record<BacnetPoint['type'], string> = {
  BinaryInput: 'BI',
  BinaryValue: 'BV',
  AnalogInput: 'AI',
  AnalogValue: 'AV',
}

export default function PointExplorer({ className }: { className?: string }) {
  const [group, setGroup] = useState<PointGroup | 'all'>('all')
  const [writableOnly, setWritableOnly] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  const rows = useMemo(
    () =>
      POINTS.filter(p => (group === 'all' ? true : p.group === group)).filter(p =>
        writableOnly ? p.writable : true,
      ),
    [group, writableOnly],
  )

  const writableCount = POINTS.filter(p => p.writable).length

  return (
    <div className={cn('overflow-hidden rounded-xl border border-hairline bg-surface', className)}>
      <div className="border-b border-hairline px-5 py-4">
        <h3 className="text-[15px] font-medium text-ink">The unit’s BACnet point list</h3>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
          {POINTS.length} objects; a building system can write exactly{' '}
          <span className="font-medium text-ink">{writableCount}</span> of them. Instance numbers
          are per-job — treat this list as the pattern, not the gospel. None of these objects
          declares a unit on the wire, so tell the integrator: temperatures are °F, pressures are
          inches of water.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-b border-hairline px-5 py-3">
        {GROUPS.map(g => (
          <button
            key={g.key}
            type="button"
            onClick={() => setGroup(g.key)}
            className={cn(
              'rounded-lg border px-2.5 py-1 text-[12px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              group === g.key
                ? 'border-brand bg-brand text-white'
                : 'border-hairline bg-surface text-ink-secondary hover:border-hairline-strong hover:text-ink',
            )}
          >
            {g.label}
          </button>
        ))}
        <label className="ml-auto inline-flex cursor-pointer items-center gap-2 text-[12px] text-ink-secondary">
          <input
            type="checkbox"
            checked={writableOnly}
            onChange={e => setWritableOnly(e.target.checked)}
            className="h-3.5 w-3.5 accent-[var(--brand)]"
          />
          Writable only
        </label>
      </div>

      <ul className="divide-y divide-hairline-soft">
        {rows.map(p => {
          const expanded = open === p.instance
          return (
            <li key={p.instance}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : p.instance)}
                aria-expanded={expanded}
                className="flex w-full items-center gap-3 px-5 py-2.5 text-left transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
              >
                <span className="w-14 shrink-0 text-[12px] tabular-nums text-ink-muted">
                  {TYPE_SHORT[p.type]} {p.instance}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{p.description}</span>
                {p.defect && <AlertTriangle size={13} className="shrink-0 text-amber-600" />}
                {p.optional && (
                  <span className="shrink-0 rounded-full bg-surface-strong px-2 py-0.5 text-[10.5px] uppercase tracking-wide text-ink-muted">
                    If equipped
                  </span>
                )}
                <span
                  className={cn(
                    'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-medium uppercase tracking-wide',
                    p.writable ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300' : 'bg-surface-strong text-ink-muted',
                  )}
                >
                  {p.writable ? <PenLine size={10} /> : <Lock size={10} />}
                  {p.writable ? 'Writable' : 'Read-only'}
                </span>
              </button>

              {expanded && (
                <div className="space-y-2 border-t border-hairline-soft bg-surface-soft px-5 py-3 text-[12.5px] leading-relaxed">
                  <p className="text-ink-secondary">
                    <span className="text-ink-muted">Variable </span>
                    <code className="text-ink">{p.name}</code>
                    {p.actualUnit && (
                      <>
                        <span className="text-ink-muted"> · reads in </span>
                        <span className="text-ink">{p.actualUnit}</span>
                        <span className="text-ink-muted"> (declared {p.declaredUnit})</span>
                      </>
                    )}
                  </p>
                  {p.group === 'setpoint' && (
                    <p className="text-ink-secondary">
                      Range {p.min} to {p.max}
                      {p.default != null ? <> · default {p.default}</> : <> · no default in the export</>}
                    </p>
                  )}
                  {p.note && <p className="text-ink-secondary">{p.note}</p>}
                  {p.defect && (
                    <p className="flex items-start gap-1.5 text-amber-700 dark:text-amber-400">
                      <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                      <span>
                        <span className="font-medium">Known export defect: </span>
                        {p.defect} Flagged to engineering — expect the fixed label in a future
                        release, and don’t be thrown when a customer’s BAS shows the wrong one.
                      </span>
                    </p>
                  )}
                </div>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
