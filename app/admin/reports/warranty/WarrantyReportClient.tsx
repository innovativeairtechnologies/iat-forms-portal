'use client'

import type { WarrantyReport } from '@/lib/warranty-report'
import { ListCardPage, ListCard, CardHead, Toolbar } from '@/components/admin/list-card'
import {
  Tile, TileGrid, Section, BarList, RangeTabs, ExportCsvButton, ReportFootnote,
} from '@/components/admin/report-ui'

export default function WarrantyReportClient({ report }: { report: WarrantyReport }) {
  const t = report.totals
  return (
    <ListCardPage>
      <ListCard>
        <CardHead overline="Reports" title="Installed Base and Warranty" count={`${t.units} units on record`} />
        <RangeTabs basePath="/admin/reports/warranty" active={report.rangeKey} count={t.shippedInRange} />

        <Toolbar>
          <ExportCsvButton
            rows={report.rows}
            filename="iat-installed-base"
            hint="Every unit with its customer, dates and warranty state."
            columns={[
              ['Serial', r => r.serial],
              ['Model', r => r.model],
              ['Company', r => r.company],
              ['Contact', r => r.contact],
              ['Location', r => r.location],
              ['Shipped', r => r.shipDate],
              ['Installed', r => r.installDate],
              ['Warranty ends', r => r.warrantyEnd],
              ['State', r => r.state],
              ['Days left', r => r.daysLeft],
              ['Status', r => r.status],
            ]}
          />
        </Toolbar>

        <TileGrid>
          <Tile label="Units tracked" value={String(t.units)} sub="the whole installed base" />
          <Tile label="In warranty" value={String(t.inWarranty)} tone="good" />
          <Tile label="Out of warranty" value={String(t.outOfWarranty)} sub="aftermarket candidates" />
          <Tile
            label="No warranty data"
            value={String(t.unknown)}
            tone={t.unknown > 0 ? 'warn' : undefined}
            sub="no ship date or end set"
          />
          <Tile
            label="Expiring in 90 days"
            value={String(t.expiring90)}
            tone={t.expiring90 > 0 ? 'warn' : undefined}
            sub="worth a call now"
          />
          <Tile label="Shipped in range" value={String(t.shippedInRange)} sub={report.rangeLabel.toLowerCase()} />
          <Tile label="Models" value={String(report.byModel.length)} sub="distinct machines out there" />
          <Tile label="Customers" value={String(report.byCompany.length)} sub="holding equipment" />
        </TileGrid>

        <Section
          title="Coming off warranty in the next 90 days"
          sub="Soonest first. A call list rather than a chart — the number beside each is days remaining."
          summary={`${t.expiring90} units`}
          defaultOpen
        >
          <BarList
            rows={report.expiringSoon}
            empty="Nothing expires in the next 90 days."
            display={days => `${days} d`}
          />
        </Section>
        <Section title="Warranty state" summary={`${t.units} units`}>
          <BarList rows={report.byState} empty="No equipment on record." />
        </Section>
        <Section title="By model" sub="Top 15." summary={`${report.byModel.length} models`}>
          <BarList rows={report.byModel} empty="No equipment on record." />
        </Section>
        <Section title="By customer" sub="Top 15." summary={`${report.byCompany.length} customers`}>
          <BarList rows={report.byCompany} empty="No equipment on record." />
        </Section>
        <Section title="By ship year" summary={`${report.byShipYear.length} years`}>
          <BarList rows={report.byShipYear} empty="No ship dates on record." />
        </Section>

        <ReportFootnote>
          Warranty state is computed by the same code the equipment pages use rather than re-derived
          here, so this and a unit&apos;s own page can never disagree about whether it is covered. An
          explicit warranty end wins; otherwise the term counts forward from the ship date,
          defaulting to twelve months. ⚠️ The date range applies to SHIP date, so it answers what was
          shipped in a window. The expiry list ignores it on purpose: a unit shipped three years ago
          and expiring next month is exactly what you want to see.
        </ReportFootnote>
      </ListCard>
    </ListCardPage>
  )
}
