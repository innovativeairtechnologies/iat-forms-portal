'use client'

import type { SalesReport } from '@/lib/sales-report'
import { money, moneyShort } from '@/lib/report-shared'
import { ListCardPage, ListCard, CardHead, Toolbar } from '@/components/admin/list-card'
import {
  Tile, TileGrid, Section, BarList, RangeTabs, ExportCsvButton, ReportFootnote,
} from '@/components/admin/report-ui'

export default function SalesReportClient({ report }: { report: SalesReport }) {
  const t = report.totals
  return (
    <ListCardPage>
      <ListCard>
        <CardHead overline="Reports" title="Sales Pipeline" count={`${report.rows.length} deals on record`} />
        <RangeTabs basePath="/admin/reports/sales" active={report.rangeKey} count={t.dealCount} />

        <Toolbar>
          <ExportCsvButton
            rows={report.rows}
            filename="iat-pipeline"
            hint="Every deal with its value, confidence and dates."
            columns={[
              ['Customer', r => r.customer],
              ['Job', r => r.jobName],
              ['Rep', r => r.rep],
              ['Project type', r => r.projectType],
              ['Model', r => r.unitModel],
              ['Quoted', r => r.total],
              ['Confidence %', r => r.confidence],
              ['Weighted', r => r.weighted],
              ['Date quoted', r => r.dateQuoted],
              ['Expected close', r => r.expectedClose],
              ['Age (days)', r => r.ageDays],
              ['Stage', r => r.stage],
              ['Closed reason', r => r.closedReason],
            ]}
          />
        </Toolbar>

        <TileGrid>
          <Tile label="Open deals" value={String(t.dealCount)} sub={report.rangeLabel.toLowerCase()} />
          <Tile label="Quoted value" value={moneyShort(t.quotedValue)} sub="sticker total" />
          <Tile label="Weighted forecast" value={moneyShort(t.weightedValue)} tone="good" sub="value × confidence" />
          <Tile label="Median deal" value={moneyShort(t.medianDealSize)} sub="half are bigger" />
          <Tile label="70%+ confidence" value={moneyShort(t.highConfidenceValue)} sub="the near end of the pipe" />
          <Tile label="No close date" value={String(t.withoutExpectedClose)} tone={t.withoutExpectedClose > 0 ? 'warn' : undefined} sub="cannot be forecast" />
          <Tile label="Oldest quote" value={t.staleDays == null ? '—' : `${t.staleDays} d`} tone={(t.staleDays ?? 0) > 365 ? 'warn' : undefined} sub="since it was quoted" />
          <Tile label="Reps" value={String(report.byRep.length)} sub="with deals attributed" />
        </TileGrid>

        <Section title="Pipeline by confidence" sub="Quoted value in each band — the honest read of where things stand." summary={moneyShort(t.quotedValue)} defaultOpen>
          <BarList rows={report.byConfidence} empty="Nothing in this range." display={money} />
        </Section>
        <Section title="By rep" sub="Quoted value attributed to each. Top 15." summary={`${report.byRep.length} reps`}>
          <BarList rows={report.byRep} empty="Nothing in this range." display={money} />
        </Section>
        <Section title="Weighted forecast by expected close month" summary={`${report.byCloseMonth.length} months`}>
          <BarList rows={report.byCloseMonth} empty="No deals carry an expected close date." display={money} />
        </Section>
        <Section title="By project type" sub="Quoted value. Top 15." summary={`${report.byProjectType.length} types`}>
          <BarList rows={report.byProjectType} empty="Nothing in this range." display={money} />
        </Section>
        <Section title="By unit model" sub="Deal count, not value. Top 15." summary={`${report.byModel.length} models`}>
          <BarList rows={report.byModel} empty="Nothing in this range." />
        </Section>

        <ReportFootnote>
          🔴 This reports value and confidence, not a stage funnel, and that is deliberate. Of the
          stage-history rows on file, the large majority are seed rows written by the DryWare sync
          when each deal was created; the genuine human moves are a single week of one person&apos;s
          activity in July, including several immediately reversed. Every deal currently sits in
          &ldquo;quoted&rdquo;. A velocity chart off that would show clicking, not selling — so the
          report follows what the pipeline actually forecasts by, which is confidence. If the board
          starts being used, stage velocity becomes worth adding and the history is already being
          recorded. ⚠️ Deals are a mirror of DryWare, which wipes and reloads on each sync: the money
          fields can change underneath you, so treat this as a current read rather than a ledger.
        </ReportFootnote>
      </ListCard>
    </ListCardPage>
  )
}
