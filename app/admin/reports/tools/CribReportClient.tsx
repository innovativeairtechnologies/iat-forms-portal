'use client'

import type { CribReport } from '@/lib/crib-report'
import { moneyShort } from '@/lib/report-shared'
import { ListCardPage, ListCard, CardHead, Toolbar } from '@/components/admin/list-card'
import {
  Tile, TileGrid, Section, BarList, RangeTabs, ExportCsvButton, ReportFootnote,
} from '@/components/admin/report-ui'

export default function CribReportClient({ report }: { report: CribReport }) {
  const t = report.totals
  return (
    <ListCardPage>
      <ListCard>
        <CardHead overline="Reports" title="Tools and Inventory" count={`${t.tools} tools tracked`} />
        <RangeTabs basePath="/admin/reports/tools" active={report.rangeKey} count={t.movementsInRange} />

        <Toolbar>
          <ExportCsvButton
            rows={report.rows}
            filename="iat-tool-crib"
            hint="Every tool with its holder, dates and cost."
            columns={[
              ['Tag', r => r.tag],
              ['Tool', r => r.name],
              ['Category', r => r.category],
              ['Make / model', r => r.makeModel],
              ['Status', r => r.status],
              ['Held by', r => r.holder],
              ['Out since', r => r.heldSince],
              ['Days out', r => r.daysOut],
              ['Due', r => r.dueAt],
              ['Days overdue', r => r.daysOverdue],
              ['Purchase cost', r => r.cost],
            ]}
          />
        </Toolbar>

        <TileGrid>
          <Tile label="Tools tracked" value={String(t.tools)} sub="in the crib register" />
          <Tile label="Checked out" value={String(t.checkedOut)} tone={t.checkedOut > 0 ? 'warn' : undefined} sub={`with ${t.holders} ${t.holders === 1 ? 'person' : 'people'}`} />
          <Tile label="On the shelf" value={String(t.available)} tone={t.available > 0 ? 'good' : 'warn'} sub="available to take" />
          <Tile label="Past due" value={String(t.overdue)} tone={t.overdue > 0 ? 'warn' : 'good'} sub="out beyond their due date" />
          <Tile label="Longest out" value={t.longestOutDays == null ? '—' : `${t.longestOutDays} d`} tone={(t.longestOutDays ?? 0) > 30 ? 'warn' : undefined} sub="since it left the crib" />
          <Tile label="Movements" value={String(t.movementsInRange)} sub={report.rangeLabel.toLowerCase()} />
          {/* $0 means no costs are recorded, not that the tools are worthless —
              say which, or the tile reads as broken. */}
          <Tile
            label="Register value"
            value={t.inventoryValue > 0 ? moneyShort(t.inventoryValue) : "—"}
            sub={t.inventoryValue > 0 ? "purchase cost on record" : "no purchase costs recorded"}
          />
          <Tile label="Categories" value={String(report.byCategory.length)} sub="kinds of tool" />
        </TileGrid>

        <Section
          title="Out right now"
          sub="Longest out first. The number is days since it left the crib."
          summary={`${t.checkedOut} out`}
          defaultOpen
        >
          <BarList rows={report.outNow} empty="Everything is on the shelf." display={d => `${d} d`} />
        </Section>
        <Section title="Past their due date" summary={`${t.overdue} overdue`}>
          <BarList rows={report.overdue} empty="Nothing is past due." display={d => `${d} d over`} />
        </Section>
        <Section title="Who is holding what" summary={`${report.byHolder.length} people`}>
          <BarList rows={report.byHolder} empty="Nobody is holding anything." />
        </Section>
        <Section title="By category" summary={`${report.byCategory.length} categories`}>
          <BarList rows={report.byCategory} empty="No tools on record." />
        </Section>
        <Section title="Crib activity by month" summary={`${report.activityByMonth.length} months`}>
          <BarList rows={report.activityByMonth} empty="No movements in this range." />
        </Section>
        <Section title="What kind of movement" summary={`${report.byAction.length} kinds`}>
          <BarList rows={report.byAction} empty="No movements in this range." />
        </Section>

        <ReportFootnote>
          ⚠️ The date range applies to MOVEMENTS — check-outs, check-ins and transfers — because that
          is the only thing here that happens on a date. &ldquo;Out right now&rdquo; and &ldquo;past
          due&rdquo; deliberately ignore it: a tool that left the crib four months ago is exactly
          what belongs at the top of the list, and a date filter would hide the worst case. Time out
          is measured from the tool&apos;s own held-since stamp rather than from its last check-out
          event, so a tool passed between two people without coming back still reads as continuously
          out.
        </ReportFootnote>
      </ListCard>
    </ListCardPage>
  )
}
