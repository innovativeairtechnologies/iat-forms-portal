'use client'

import { useId, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, Download } from 'lucide-react'
import { RANGES } from '@/lib/report-shared'
import { tabCx, tabCountCx } from '@/components/admin/list'

/* The shared furniture every report is built from — tiles, bar rows,
   collapsible sections, the range tabs and the CSV button.

   Extracted when the second report was added rather than left to be copied: five
   reports with five slightly different Section components is how a portal starts
   looking assembled instead of designed.

   No charting library. What is worth seeing here — a spread across buckets, a
   series by month — is a bar, and a bar is a div with a width. A chart dependency
   would cost more than it explains. */

export function Tile({
  label, value, sub, tone,
}: {
  label: string
  value: string
  sub?: string
  tone?: 'good' | 'warn'
}) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
      <p className={`mt-1.5 text-[24px] font-semibold leading-none tabular-nums tracking-tight ${
        tone === 'warn' ? 'text-amber-700 dark:text-amber-400'
        : tone === 'good' ? 'text-emerald-700 dark:text-emerald-400'
        : 'text-ink'
      }`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11.5px] leading-snug text-ink-muted">{sub}</p>}
    </div>
  )
}

export function TileGrid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">{children}</div>
}

/** `max` is passed in so every row in a group shares one scale. Bars scaled to
 *  their own value are just a list of full-width bars. */
export function BarRow({
  label, count, max, display, note,
}: {
  label: string
  count: number
  max: number
  /** What to print on the right. Defaults to the raw count; money passes a string. */
  display?: string
  note?: string
}) {
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3 px-5 py-2">
      <span className="w-[190px] flex-shrink-0 truncate text-[12.5px] text-ink-secondary" title={label}>{label}</span>
      <span className="relative h-[18px] flex-1 overflow-hidden rounded bg-surface-soft">
        <span className="absolute inset-y-0 left-0 rounded bg-sky-500/70 dark:bg-sky-500/50" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-[86px] flex-shrink-0 text-right text-[12.5px] tabular-nums text-ink">{display ?? count}</span>
      {note && <span className="w-[96px] flex-shrink-0 text-right text-[11.5px] tabular-nums text-ink-muted">{note}</span>}
    </div>
  )
}

/**
 * A collapsible block.
 *
 * Headline tiles are deliberately NOT sections — they answer "how are we doing",
 * and a report whose headline you must open first is a worse report. Everything
 * below them is detail you go looking for, so it starts shut.
 *
 * `summary` is what makes collapsing safe rather than merely tidy: a shut section
 * still says how much is inside, so nothing goes invisible by being closed.
 *
 * A real <button> with aria-expanded/aria-controls, not a styled div, so it
 * announces its state and works from the keyboard. The body unmounts when shut.
 *
 * Open/shut is per mount and NOT persisted: the range tabs re-render from the
 * server, and a remembered layout surviving a range change would show yesterday's
 * choices against today's numbers.
 */
export function Section({
  title, sub, summary, defaultOpen = false, children,
}: {
  title: string
  sub?: string
  summary?: string
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(defaultOpen)
  const id = useId()

  return (
    <div className="border-t border-hairline">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-expanded={open}
        aria-controls={id}
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left transition-colors hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
      >
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-ink-muted transition-transform duration-150 ${open ? 'rotate-180' : ''}`}
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{title}</span>
          {sub && open && (
            <span className="mt-0.5 block text-[11.5px] font-normal normal-case tracking-normal text-ink-muted">{sub}</span>
          )}
        </span>
        {summary && <span className="flex-shrink-0 text-[11.5px] tabular-nums text-ink-faint">{summary}</span>}
      </button>
      {open && <div id={id} className="pb-3">{children}</div>}
    </div>
  )
}

/** A bar list with its own shared scale and an empty state. */
export function BarList({
  rows, empty, display,
}: {
  rows: { label: string; count: number; note?: string }[]
  empty: string
  display?: (n: number) => string
}) {
  if (!rows.length) return <p className="px-5 py-3 text-[12.5px] text-ink-muted">{empty}</p>
  const max = Math.max(1, ...rows.map(r => r.count))
  return (
    <>
      {rows.map(r => (
        <BarRow key={r.label} label={r.label} count={r.count} max={max} display={display?.(r.count)} note={r.note} />
      ))}
    </>
  )
}

/** Range tabs. Pushes `?range=` so the server rebuilds — the numbers are
 *  computed there, and a shareable URL beats hidden client state. */
export function RangeTabs({ basePath, active, count }: { basePath: string; active: string; count?: number }) {
  const router = useRouter()
  const params = useSearchParams()
  return (
    <div className="flex items-center gap-1 overflow-x-auto border-b border-hairline px-3 scrollbar-hide">
      {RANGES.map(r => (
        <button
          key={r.key}
          onClick={() => {
            const next = new URLSearchParams(params.toString())
            next.set('range', r.key)
            router.push(`${basePath}?${next.toString()}`)
          }}
          className={tabCx(active === r.key)}
        >
          {r.label}
          {active === r.key && count != null && <span className={tabCountCx(true)}>{count}</span>}
        </button>
      ))}
    </div>
  )
}

/**
 * CSV of the underlying rows. The point of "go back and track this after a few
 * months" is usually a spreadsheet, not a dashboard.
 *
 * Built client-side from data already on the page, so it needs no endpoint and
 * cannot drift from what is displayed.
 *
 * ⚠️ The leading BOM is not decoration — without it Excel reads a UTF-8 CSV as
 * the local codepage and mangles any accented company name. (Verifying it needs
 * arrayBuffer: Blob.text() strips a leading BOM while decoding, so a text check
 * reports it missing when it is there.)
 */
export function ExportCsvButton<T>({
  rows, columns, filename, hint,
}: {
  rows: T[]
  columns: [string, (r: T) => string | number | null][]
  filename: string
  hint?: string
}) {
  const [busy, setBusy] = useState(false)

  const run = () => {
    setBusy(true)
    try {
      // Quote everything and double inner quotes: company names contain commas,
      // and a free-text note can contain both.
      const cell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const csv = [
        columns.map(c => cell(c[0])).join(','),
        ...rows.map(r => columns.map(c => cell(c[1](r))).join(',')),
      ].join('\r\n')

      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <button
        onClick={run}
        disabled={busy || !rows.length}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        <Download size={14} /> Export CSV
      </button>
      {hint && <span className="text-[12px] text-ink-muted">{hint}</span>}
    </>
  )
}

/** The small-print block every report closes with. */
export function ReportFootnote({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-t border-hairline-soft px-5 py-4">
      <p className="text-[11px] leading-relaxed text-ink-faint">{children}</p>
    </div>
  )
}
