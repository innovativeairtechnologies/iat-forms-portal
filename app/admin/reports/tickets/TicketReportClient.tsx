'use client'

import { useMemo } from 'react'
// ⚠️ From ticket-report-TYPES, never ticket-report. That module imports
// supabase-admin, and RANGES is a VALUE import, so pulling it from there ships
// the service-role client to the browser and hydration dies with
// "supabaseKey is required" — past tsc and past a green server render.
import { RANGES, type TicketReport } from '@/lib/ticket-report-types'
import { ListCardPage, ListCard, CardHead, Toolbar } from '@/components/admin/list-card'
import {
  Tile, TileGrid, Section, BarRow, BarList, RangeTabs, ExportCsvButton, ReportFootnote,
} from '@/components/admin/report-ui'

/* The report view. Everything is computed server-side (lib/ticket-report.ts);
   this only presents it and exports it.

   No charting library. The two things worth seeing over time — opened vs closed
   per month, and the aging spread — are bar rows, and a bar row is a div with a
   width. Pulling in a chart dependency for that would cost more than it explains. */

const fmt = (n: number | null | undefined, suffix = '') =>
  n == null ? '—' : `${n}${suffix}`

export default function TicketReportClient({ report }: { report: TicketReport }) {
  const t = report.totals

  const monthMax = useMemo(
    () => Math.max(1, ...report.monthly.flatMap(m => [m.opened, m.closed])),
    [report.monthly],
  )

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

        <RangeTabs basePath="/admin/reports/tickets" active={report.rangeKey} count={t.openedInRange} />

        <Toolbar>
          <ExportCsvButton
            rows={report.rows}
            filename="iat-support-tickets"
            hint="Every ticket with its dates, owner and resolution — the whole table, not this page."
            columns={[
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
            ]}
          />
        </Toolbar>

        <TileGrid>
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
        </TileGrid>

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

        <ReportFootnote>
          Close dates come from the audit trail rather than a stored field, so a ticket closed
          through a path that was not audited shows no close date and is left out of the timing
          figures rather than counted as zero. Medians, not averages, throughout. Reopen counts are
          attributed to the month the ticket was opened, which is exact for All time and approximate
          for a shorter range.
        </ReportFootnote>
      </ListCard>
    </ListCardPage>
  )
}
