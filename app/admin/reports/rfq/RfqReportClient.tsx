'use client'

import type { RfqReport } from '@/lib/rfq-report'
import { ListCardPage, ListCard, CardHead, Toolbar } from '@/components/admin/list-card'
import {
  Tile, TileGrid, Section, BarList, RangeTabs, ExportCsvButton, ReportFootnote,
} from '@/components/admin/report-ui'

const n = (v: number | null, s = '') => (v == null ? '—' : `${v}${s}`)

export default function RfqReportClient({ report }: { report: RfqReport }) {
  const t = report.totals
  return (
    <ListCardPage>
      <ListCard>
        <CardHead overline="Reports" title="Quote Requests" count={`${report.rows.length} on record`} />
        <RangeTabs basePath="/admin/reports/rfq" active={report.rangeKey} count={t.submitted} />

        <Toolbar>
          <ExportCsvButton
            rows={report.rows}
            filename="iat-quote-requests"
            hint="Every request with its dates, application and owner."
            columns={[
              ['Reference', r => r.reference],
              ['Submitted', r => r.createdAt],
              ['Track', r => r.track],
              ['Application', r => r.application],
              ['Company', r => r.company],
              ['Contact', r => r.contact],
              ['Location', r => r.location],
              ['Status', r => r.status],
              ['Owner', r => r.assignee],
              ['Hours to assign', r => r.hoursToAssign],
              ['Age (days)', r => r.ageDays],
              ['Needed by', r => r.dateRequired],
            ]}
          />
        </Toolbar>

        <TileGrid>
          <Tile label="Requests" value={String(t.submitted)} sub={report.rangeLabel.toLowerCase()} />
          <Tile label="Room surveys" value={String(t.roomTrack)} sub="a space to hold" />
          <Tile label="Process surveys" value={String(t.processTrack)} sub="an airstream to dry" />
          <Tile label="Unclaimed" value={String(t.unassigned)} tone={t.unassigned > 0 ? 'warn' : 'good'} sub="nobody has picked these up" />
          <Tile label="Median hours to claim" value={n(t.medianHoursToAssign, ' h')} sub="submitted to owned" />
          <Tile label="Oldest unclaimed" value={n(t.oldestUnassignedDays, ' d')} tone={(t.oldestUnassignedDays ?? 0) > 3 ? 'warn' : undefined} sub="longest anything has sat" />
          <Tile label="With a deadline" value={String(t.withDeadline)} sub="gave a date they need it by" />
          <Tile label="Applications" value={String(report.byApplication.length)} sub="distinct kinds of job" />
        </TileGrid>

        <Section title="What they are asking about" summary={`${report.byApplication.length} kinds`} defaultOpen>
          <BarList rows={report.byApplication} empty="Nothing in this range." />
        </Section>
        <Section title="By month" summary={`${report.byMonth.length} months`}>
          <BarList rows={report.byMonth} empty="Nothing in this range." />
        </Section>
        <Section title="Who is asking" sub="Top 15 companies." summary={`${report.byCompany.length} shown`}>
          <BarList rows={report.byCompany} empty="Nothing in this range." />
        </Section>
        <Section title="Who is handling them" summary={`${report.byAssignee.length} people`}>
          <BarList rows={report.byAssignee} empty="Nothing in this range." />
        </Section>
        <Section title="By status" summary={`${report.byStatus.length} states`}>
          <BarList rows={report.byStatus} empty="Nothing in this range." />
        </Section>

        <ReportFootnote>
          ⚠️ This measures demand and responsiveness, not yield. There is no quote-to-order
          conversion here because nothing links a quote request to a deal — requests are re-keyed
          into DryWare by hand. A conversion rate guessed from matching company names would be worse
          than none, so it is deliberately absent. There is also no map: the survey records an
          elevation and a typed location, not coordinates.
        </ReportFootnote>
      </ListCard>
    </ListCardPage>
  )
}
