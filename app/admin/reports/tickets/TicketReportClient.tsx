'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useId, useMemo, useState } from 'react'
import { ChevronDown, Download } from 'lucide-react'
// ⚠️ From ticket-report-TYPES, never ticket-report. That module imports
// supabase-admin, and RANGES is a VALUE import, so pulling it from there ships
// the service-role client to the browser and hydration dies with
// "supabaseKey is required" — past tsc and past a green server render.
import { RANGES, type TicketReport } from '@/lib/ticket-report-types'
import { ListCardPage, ListCard, CardHead, Toolbar } from '@/components/admin/list-card'
import { tabCx, tabCountCx } from '@/components/admin/list'

/* The report view. Everything is computed server-side (lib/ticket-report.ts);
   this only presents it and exports it.

   No charting library. The two things worth seeing over time — opened vs closed
   per month, and the aging spread — are bar rows, and a bar row is a div with a
   width. Pulling in a chart dependency for that would cost more than it explains. */

const fmt = (n: number | null | undefined, suffix = '') =>
  n == null ? '—' : `${n}${suffix}`

function Tile({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'good' | 'warn' }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
      <p className={`mt-1.5 text-[24px] font-semibold leading-none tabular-nums tracking-tight ${
        tone === 'warn' ? 'text-amber-700 dark:text-amber-400' : tone === 'good' ? 'text-emerald-700 dark:text-emerald-400' : 'text-ink'
      }`}>
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11.5px] leading-snug text-ink-muted">{sub}</p>}
    </div>
  )
}

/** A labeled bar row. `max` is passed in so every row in a group shares a scale —
 *  bars scaled to their own value are just a list of full-width bars. */
function BarRow({ label, count, max, note }: { label: string; count: number; max: number; note?: string }) {
  const pct = max > 0 ? Math.max(2, Math.round((count / max) * 100)) : 0
  return (
    <div className="flex items-center gap-3 px-5 py-2">
      <span className="w-[190px] flex-shrink-0 truncate text-[12.5px] text-ink-secondary" title={label}>{label}</span>
      <span className="relative h-[18px] flex-1 overflow-hidden rounded bg-surface-soft">
        <span className="absolute inset-y-0 left-0 rounded bg-sky-500/70 dark:bg-sky-500/50" style={{ width: `${pct}%` }} />
      </span>
      <span className="w-[76px] flex-shrink-0 text-right text-[12.5px] tabular-nums text-ink">{count}</span>
      {note && <span className="w-[90px] flex-shrink-0 text-right text-[11.5px] tabular-nums text-ink-muted">{note}</span>}
    </div>
  )
}

/**
 * A collapsible block of the report.
 *
 * The headline tiles above are NOT one of these on purpose — they are the answer
 * to "how are we doing", and a report whose headline you have to open first is a
 * worse report. Everything below them is detail you go looking for, so it starts
 * shut and the page opens as a summary rather than a wall.
 *
 * `summary` is what makes collapsing safe rather than merely tidy: a shut
 * section still says how much is inside it, so nothing becomes invisible just
 * because it is closed.
 *
 * A real <button> with aria-expanded/aria-controls, not a styled div — same
 * disclosure idiom as the Advanced blocks in the RFQ wizard — so it announces
 * its state to a screen reader and works from the keyboard.
 *
 * Open/shut is per mount and deliberately not persisted: the range tabs
 * re-render this from the server, and a remembered layout that survives a range
 * change would show yesterday's choices against today's numbers.
 */
function Section({
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
          {sub && open && <span className="mt-0.5 block text-[11.5px] font-normal normal-case tracking-normal text-ink-muted">{sub}</span>}
        </span>
        {summary && (
          <span className="flex-shrink-0 text-[11.5px] tabular-nums text-ink-faint">{summary}</span>
        )}
      </button>
      {open && <div id={id} className="pb-3">{children}</div>}
    </div>
  )
}

export default function TicketReportClient({ report }: { report: TicketReport }) {
  const router = useRouter()
  const params = useSearchParams()
  const [exporting, setExporting] = useState(false)
  const t = report.totals

  const setRange = (key: string) => {
    const next = new URLSearchParams(params.toString())
    next.set('range', key)
    router.push(`/admin/reports/tickets?${next.toString()}`)
  }

  const monthMax = useMemo(
    () => Math.max(1, ...report.monthly.flatMap(m => [m.opened, m.closed])),
    [report.monthly],
  )

  /** CSV of the underlying rows — the point of "go back and track these after a
   *  few months" is usually a spreadsheet, not a dashboard. Built client-side
   *  from data already on the page, so it needs no endpoint and cannot drift
   *  from what is displayed. */
  const exportCsv = () => {
    setExporting(true)
    try {
      const cols: [string, (r: TicketReport['rows'][number]) => string | number | null][] = [
        ['Ticket', r => r.ticketNumber],
        ['Customer', r => r.customer],
        ['Company', r => r.company],
        ['Model', r => r.model],
        ['Serial', r => r.serial],
        ['Status', r => r.status],
        ['Priority', r => r.priority],
        ['Type', r => r.requestType],
        ['Owner', r => r.owner],
        ['Created', r => r.createdAt],
        ['Closed', r => r.closedAt],
        ['Days to close', r => r.daysToClose],
        ['Age (days, if open)', r => r.ageDays],
        ['Times reopened', r => r.reopenCount],
        ['Resolution', r => r.resolvedReason],
      ]
      // Quote everything and double inner quotes: company names contain commas,
      // and a resolution note can contain both.
      const cell = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`
      const csv = [
        cols.map(c => cell(c[0])).join(','),
        ...report.rows.map(r => cols.map(c => cell(c[1](r))).join(',')),
      ].join('\r\n')

      const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `iat-support-tickets-${report.rangeKey}-${new Date().toISOString().slice(0, 10)}.csv`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const ownerMax = Math.max(1, ...report.byOwner.map(o => o.assigned))
  const companyMax = Math.max(1, ...report.byCompany.map(c => c.count))
  const modelMax = Math.max(1, ...report.byModel.map(m => m.count))
  const reasonMax = Math.max(1, ...report.byReason.map(r => r.count))
  const agingMax = Math.max(1, ...report.aging.map(a => a.count))

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Reports"
          title="Support Tickets"
          count={`${report.rows.length} ${report.rows.length === 1 ? 'ticket' : 'tickets'} on record`}
        />

        <div className="flex items-center gap-1 overflow-x-auto border-b border-hairline px-3 scrollbar-hide">
          {RANGES.map(r => (
            <button key={r.key} onClick={() => setRange(r.key)} className={tabCx(report.rangeKey === r.key)}>
              {r.label}
              {r.key === report.rangeKey && <span className={tabCountCx(true)}>{t.openedInRange}</span>}
            </button>
          ))}
        </div>

        <Toolbar>
          <button
            onClick={exportCsv}
            disabled={exporting || !report.rows.length}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <Download size={14} /> Export CSV
          </button>
          <span className="text-[12px] text-ink-muted">
            Every ticket with its dates, owner and resolution — the whole table, not this page.
          </span>
        </Toolbar>

        {/* Headline */}
        <div className="grid grid-cols-2 gap-3 p-5 lg:grid-cols-4">
          <Tile label="Opened" value={String(t.openedInRange)} sub={report.rangeLabel.toLowerCase()} />
          <Tile label="Closed" value={String(t.closedInRange)} sub={report.rangeLabel.toLowerCase()} />
          <Tile
            label="Net change"
            value={t.net > 0 ? `+${t.net}` : String(t.net)}
            sub={t.net > 0 ? 'backlog grew' : t.net < 0 ? 'backlog shrank' : 'level'}
            tone={t.net > 0 ? 'warn' : t.net < 0 ? 'good' : undefined}
          />
          <Tile label="Still open" value={String(t.openNow)} sub={`${t.unassignedNow} unassigned`} tone={t.unassignedNow > 0 ? 'warn' : undefined} />
          <Tile label="Median days to close" value={fmt(t.medianDaysToClose)} sub="created to first close" />
          <Tile label="Oldest open" value={fmt(t.oldestOpenDays, ' d')} sub="longest anything has waited" tone={(t.oldestOpenDays ?? 0) > 90 ? 'warn' : undefined} />
          <Tile label="Reopen rate" value={fmt(t.reopenRatePct, '%')} sub="of everything ever closed" tone={(t.reopenRatePct ?? 0) > 15 ? 'warn' : undefined} />
          <Tile label="Reopened" value={String(t.reopenedInRange)} sub="tickets that came back" />
        </div>

        <Section
          title="Open tickets by age"
          sub="Anything not closed, by how long it has been waiting."
          summary={`${t.openNow} open`}
          defaultOpen
        >
          {report.aging.map(b => <BarRow key={b.label} label={b.label} count={b.count} max={agingMax} />)}
        </Section>

        <Section title="Opened vs closed by month" summary={`${report.monthly.length} ${report.monthly.length === 1 ? 'month' : 'months'}`}>
          {report.monthly.length === 0
            ? <p className="px-5 py-3 text-[12.5px] text-ink-muted">Nothing in this range.</p>
            : report.monthly.map(m => (
                <div key={m.month} className="px-0">
                  <BarRow label={`${m.month} · opened`} count={m.opened} max={monthMax} />
                  <BarRow label={`${m.month} · closed`} count={m.closed} max={monthMax} />
                </div>
              ))}
        </Section>

        <Section title="By owner" sub="Assigned in total, closed, and the median days they take." summary={`${report.byOwner.length} ${report.byOwner.length === 1 ? 'person' : 'people'}`}>
          {report.byOwner.map(o => (
            <BarRow
              key={o.owner}
              label={o.owner}
              count={o.assigned}
              max={ownerMax}
              note={o.medianDaysToClose == null ? `${o.closed} closed` : `${o.closed} · ${o.medianDaysToClose}d`}
            />
          ))}
        </Section>

        <Section title="By customer" sub={`Opened ${report.rangeLabel.toLowerCase()}. Top 15.`} summary={`${report.byCompany.length} shown`}>
          {report.byCompany.map(c => <BarRow key={c.label} label={c.label} count={c.count} max={companyMax} />)}
        </Section>

        <Section title="By equipment model" sub="Which machines generate the support. Top 15." summary={`${report.byModel.length} shown`}>
          {report.byModel.map(m => <BarRow key={m.label} label={m.label} count={m.count} max={modelMax} />)}
        </Section>

        <Section title="How they were resolved" sub={`Tickets closed ${report.rangeLabel.toLowerCase()}.`} summary={`${report.byReason.length} ${report.byReason.length === 1 ? 'reason' : 'reasons'}`}>
          {report.byReason.length === 0
            ? <p className="px-5 py-3 text-[12.5px] text-ink-muted">Nothing closed in this range.</p>
            : report.byReason.map(r => <BarRow key={r.label} label={r.label} count={r.count} max={reasonMax} />)}
        </Section>

        <div className="border-t border-hairline-soft px-5 py-4">
          <p className="text-[11px] leading-relaxed text-ink-faint">
            Close dates come from the audit trail rather than a stored field, so a ticket closed
            through a path that was not audited shows no close date and is left out of the timing
            figures rather than counted as zero. Medians, not averages, throughout. Reopen counts are
            attributed to the month the ticket was opened, which is exact for All time and
            approximate for a shorter range.
          </p>
        </div>
      </ListCard>
    </ListCardPage>
  )
}
