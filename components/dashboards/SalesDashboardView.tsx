import Link from 'next/link'
import {
  Layers, Target, Trophy, Percent, DollarSign, Inbox,
  Building2, Filter, TrendingUp, Award, CalendarClock, Activity, AlertTriangle,
  ArrowUpRight, FileSpreadsheet, Flame,
} from 'lucide-react'
import type { Deal } from '@/lib/supabase'
import { formatCompactCurrency as fmtC } from '@/lib/utils'
import {
  computeSummary, monthlyQuoteSeries, confidenceBands, groupStats,
  industryStats, salesProjections, attentionSignals,
} from '@/lib/deals'
import { timeAgo } from '@/components/admin/list'
import {
  T, pct, CATEGORICAL, Card, CardHead, CardBody, Kpi,
  QuoteActivityChart, ConfidenceFunnel, Donut, DonutLegend, RepRow,
  ProjectionTile, RecentWonRow, OpenDealRow, NotTracked, type LegendItem,
} from '@/components/dashboards/sales-charts'

/* ────────────────────────────────────────────────────────────────────────────
   Sales department dashboard for /dashboard — a one-screen command center. Six
   KPIs across the top, then a 4-column × 3-row grid that fills the viewport so
   the whole picture reads at a glance with no scrolling (on desktop; it relaxes
   into a scrollable stack on smaller screens). Colored KPI chips + multi-hue
   category charts give it life while every swatch stays a sanctioned Tone.

   Every figure is live from the deals table via lib/deals.ts. The handful the
   board can't feed (a goal line, lead/meeting activity) show an honest "not
   tracked yet" state. Pure/deterministic given (deals, now).
   ──────────────────────────────────────────────────────────────────────────── */

export default function SalesDashboardView({ deals, displayName }: { deals: Deal[]; displayName: string }) {
  const now = new Date()

  const summary = computeSummary(deals)
  const open = deals.filter((d) => d.status === null)
  const raw = open.reduce((a, d) => a + d.total_cost, 0)
  const weighted = open.reduce((a, d) => a + d.total_cost * (d.confidence / 100), 0)
  const avgOpen = summary.openCount > 0 ? raw / summary.openCount : 0

  const months = monthlyQuoteSeries(deals, now)
  const bands = confidenceBands(deals)
  const groups = groupStats(deals)
  const industries = industryStats(deals)
  const proj = salesProjections(deals, now)
  const attention = attentionSignals(deals, now)

  const maxGroupWeighted = Math.max(1, ...groups.map((g) => g.weighted))
  const thisMonth = months[months.length - 1]
  const lastTouch = deals.length
    ? deals.reduce((a, d) => (d.created_at > a ? d.created_at : a), deals[0].created_at)
    : null

  const recentWon = deals
    .filter((d) => d.status === 'Won')
    .sort((a, b) => (b.date_quoted || b.created_at).localeCompare(a.date_quoted || a.created_at))
    .slice(0, 5)

  // Largest live opportunities — anchors the tall card with real depth.
  const largestOpen = [...open].sort((a, b) => b.total_cost - a.total_cost).slice(0, 9)

  // Status donut
  const statusSegs = [
    { value: summary.wonCount, color: T.emerald, label: 'Won' },
    { value: summary.openCount, color: T.sky, label: 'Open' },
    { value: summary.lostCount, color: T.rose, label: 'Lost' },
  ]
  const statusLegend: LegendItem[] = statusSegs.map((s) => ({
    label: s.label, color: s.color, valueText: String(s.value), pctText: `${pct(s.value, deals.length)}%`,
  }))

  // Industry donut — top 5 by open $, remainder folded into "Other"
  const topInd = industries.slice(0, 5)
  const otherRaw = industries.slice(5).reduce((a, s) => a + s.raw, 0)
  const indSource = otherRaw > 0
    ? [...topInd, { name: 'Other', raw: otherRaw, weighted: 0, count: 0 }]
    : topInd
  const indSegs = indSource.map((s, i) => ({ value: s.raw, color: CATEGORICAL[i % CATEGORICAL.length] }))
  const indLegend: LegendItem[] = indSource.map((s, i) => ({
    label: s.name, color: CATEGORICAL[i % CATEGORICAL.length], valueText: fmtC(s.raw), pctText: `${pct(s.raw, raw)}%`,
  }))

  // ── Empty board ──
  if (deals.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col bg-canvas">
        <div className="flex-1 min-h-0 overflow-y-auto p-5 animate-fade-up">
          <Card className="max-w-md mx-auto mt-10 p-8 text-center">
            <span className="mx-auto w-12 h-12 rounded-xl bg-surface-strong flex items-center justify-center text-ink-muted">
              <FileSpreadsheet size={20} />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold text-ink">No deals on the board yet</h2>
            <p className="mt-1.5 text-[13px] text-ink-secondary leading-relaxed">
              Import the sales team&apos;s forecasting export in the deals workspace and this dashboard comes alive.
            </p>
            <Link href="/admin/deals" className="mt-5 inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-medium text-white" style={{ backgroundColor: 'var(--brand)' }}>
              Open deals workspace <ArrowUpRight size={15} />
            </Link>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-canvas">
      <div className="flex-1 min-h-0 flex flex-col gap-2.5 p-3.5 xl:p-4 overflow-y-auto lg:overflow-hidden animate-fade-up">

        {/* ── Header ── */}
        <header className="shrink-0 flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-2.5 min-w-0">
            <h1 className="text-[18px] font-semibold text-ink tracking-[-0.02em] flex-shrink-0">Sales Dashboard</h1>
            <span className="text-[12px] text-ink-muted truncate hidden md:inline tabular-nums">
              Live pipeline overview{displayName ? ` · ${displayName}` : ''}{lastTouch ? ` · refreshed ${timeAgo(lastTouch)} ago` : ''}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] px-2 py-1 rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-400">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Live
            </span>
            <Link href="/admin/deals" className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft hover:text-ink transition-colors">
              Deals workspace <ArrowUpRight size={14} />
            </Link>
          </div>
        </header>

        {/* ── KPI strip ── */}
        <div className="shrink-0 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <Kpi tone="sky" label="Total pipeline" value={fmtC(raw)} sub="open, unweighted" icon={<Layers size={16} />} />
          <Kpi tone="violet" label="Qualified" value={fmtC(weighted)} sub="confidence-weighted" icon={<Target size={16} />} />
          <Kpi tone="emerald" label="Won to date" value={proj.wonToDate > 0 ? fmtC(proj.wonToDate) : '—'} sub={`${summary.wonCount} deals closed`} icon={<Trophy size={16} />} />
          <Kpi tone="amber" label="Win rate" value={summary.winRate === null ? '—' : `${Math.round(summary.winRate)}%`} sub={summary.winRate === null ? 'no closed deals' : `${summary.wonCount}W · ${summary.lostCount}L`} icon={<Percent size={16} />} />
          <Kpi tone="rose" label="Avg deal size" value={fmtC(avgOpen)} sub="open, raw value" icon={<DollarSign size={16} />} />
          <Kpi tone="slate" label="Open deals" value={String(summary.openCount)} sub={`across ${groups.length} groups`} icon={<Inbox size={16} />} />
        </div>

        {/* ── Fill-the-viewport grid: 4 cols × 3 rows on desktop ── */}
        <div className="flex-1 min-h-0 grid gap-2.5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-3">

          {/* Rep leaderboard — single cell, sized to its handful of rows */}
          <Card className="lg:col-start-1 lg:row-start-1">
            <CardHead title="Top rep leaderboard" hint="weighted pipeline" icon={<Trophy size={13} />} iconTone="amber" />
            <CardBody>
              {groups.slice(0, 5).map((g, i) => (
                <RepRow key={g.name} g={g} rank={i + 1} maxWeighted={maxGroupWeighted} totalWeighted={Math.max(1, weighted)} />
              ))}
            </CardBody>
          </Card>

          {/* Deals by status */}
          <Card className="lg:col-start-2 lg:row-start-1">
            <CardHead title="Deals by status" icon={<Layers size={13} />} iconTone="sky" />
            <CardBody className="flex items-center gap-3 px-4">
              <Donut segments={statusSegs} centerTop={String(deals.length)} centerSub="DEALS" />
              <DonutLegend items={statusLegend} />
            </CardBody>
          </Card>

          {/* Pipeline by industry */}
          <Card className="lg:col-start-3 lg:row-start-1">
            <CardHead title="Pipeline by industry" icon={<Building2 size={13} />} iconTone="violet" />
            {raw > 0 ? (
              <CardBody className="flex items-center gap-3 px-4">
                <Donut segments={indSegs} centerTop={fmtC(raw)} centerSub="OPEN" />
                <DonutLegend items={indLegend} />
              </CardBody>
            ) : (
              <CardBody className="flex items-center justify-center">
                <p className="text-[12px] text-ink-muted px-4 text-center">No open pipeline to break down.</p>
              </CardBody>
            )}
          </Card>

          {/* Pipeline by confidence — single cell (5 bands) */}
          <Card className="lg:col-start-4 lg:row-start-1">
            <CardHead title="Pipeline by confidence" hint="forecast by confidence, not stage" icon={<Filter size={13} />} iconTone="emerald" />
            <CardBody>
              <ConfidenceFunnel bands={bands} />
            </CardBody>
          </Card>

          {/* Largest open deals — the tall anchor, real depth */}
          <Card className="lg:col-start-1 lg:row-start-2 lg:row-span-2">
            <CardHead title="Largest open deals" hint="biggest live opportunities" icon={<Flame size={13} />} iconTone="rose" />
            <CardBody>
              {largestOpen.length ? (
                largestOpen.map((d) => <OpenDealRow key={d.id} deal={d} />)
              ) : (
                <p className="text-[12px] text-ink-muted px-4 py-4 text-center">No open deals on the board.</p>
              )}
            </CardBody>
          </Card>

          {/* Quoting activity — wide */}
          <Card className="sm:col-span-2 lg:col-start-2 lg:row-start-2 lg:col-span-2">
            <CardHead title="Quoting activity" hint="$ quoted per month · count above each bar" icon={<TrendingUp size={13} />} iconTone="sky" />
            <CardBody className="px-2 py-2">
              <QuoteActivityChart months={months} />
            </CardBody>
          </Card>

          {/* Recently won */}
          <Card className="lg:col-start-2 lg:row-start-3">
            <CardHead title="Recently won" icon={<Award size={13} />} iconTone="emerald" />
            <CardBody>
              {recentWon.length ? (
                recentWon.map((d) => <RecentWonRow key={d.id} deal={d} />)
              ) : (
                <p className="text-[12px] text-ink-muted px-4 py-4 text-center leading-snug">No closed-won deals yet — mark deals Won in Pipeline.</p>
              )}
            </CardBody>
          </Card>

          {/* Projections */}
          <Card className="lg:col-start-4 lg:row-start-2">
            <CardHead title="Projections" icon={<CalendarClock size={13} />} iconTone="amber" />
            <CardBody className="flex flex-col">
              <ProjectionTile label="Run rate" value={proj.runRate !== null ? fmtC(proj.runRate) : '—'} sub={proj.runRate !== null ? `${fmtC(proj.wonYtd)} won YTD, annualized` : 'Needs a dated win this year'} accent={proj.runRate !== null} />
              <ProjectionTile label="Best case" value={fmtC(proj.bestCase)} sub="Won + full open pipeline" />
              <ProjectionTile label="Commit case" value={fmtC(proj.commitCase)} sub="Won + weighted pipeline" />
            </CardBody>
          </Card>

          {/* Sales activity */}
          <Card className="lg:col-start-3 lg:row-start-3">
            <CardHead title="Sales activity" hint="this month" icon={<Activity size={13} />} iconTone="violet" />
            <CardBody>
              <div className="flex items-center justify-between px-4 py-2 border-t border-hairline-soft first:border-t-0">
                <span className="text-[12px] text-ink-secondary">Quotes sent</span>
                <span className="text-[14px] font-semibold text-ink tabular-nums">{thisMonth?.count ?? 0}</span>
              </div>
              <NotTracked label="New leads" />
              <NotTracked label="New opportunities" />
              <NotTracked label="Meetings held" />
            </CardBody>
          </Card>

          {/* Needs attention */}
          <Card className="lg:col-start-4 lg:row-start-3">
            <CardHead title="Needs attention" icon={<AlertTriangle size={13} />} iconTone="rose" />
            <CardBody>
              {attention.length === 0 ? (
                <p className="text-[12px] text-ink-muted px-4 py-4 text-center">Board looks healthy.</p>
              ) : (
                attention.slice(0, 4).map((a, i) => {
                  const dot = a.tone === 'rose' ? T.rose : a.tone === 'amber' ? T.amber : T.sky
                  return (
                    <div key={i} className="flex items-start gap-2.5 px-4 py-2 border-t border-hairline-soft first:border-t-0">
                      <span className="mt-1.5 w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
                      <p className="text-[11.5px] text-ink-secondary leading-snug min-w-0">{a.label}</p>
                    </div>
                  )
                })
              )}
            </CardBody>
          </Card>

        </div>
      </div>
    </div>
  )
}
