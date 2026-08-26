'use client'

import { useMemo } from 'react'
// ⚠️ Types from eng-report-TYPES, never lib/eng-report. That module imports
// supabase-admin; a value import from it ships the service-role client to the
// browser and hydration dies with "supabaseKey is required" — past tsc and past
// a green server render. Labels come from lib/engineering.ts, which is
// dependency-free for exactly this reason.
import type { EngReport } from '@/lib/eng-report-types'
import { STREAM_LABELS, days } from '@/lib/engineering'
import { ListCardPage, ListCard, CardHead, Toolbar } from '@/components/admin/list-card'
import {
  Tile, TileGrid, Section, BarRow, BarList, RangeTabs, ExportCsvButton, ReportFootnote,
} from '@/components/admin/report-ui'

/* The engineering report.
 *
 * Everything is computed server-side (lib/eng-report.ts); this only presents it
 * and exports it. No charting library — what is worth seeing here is a spread
 * across buckets and a series by month, and a bar is a div with a width. Same
 * call every other report in this portal makes.
 */

const pct = (n: number | null) => (n == null ? '—' : `${n}%`)
const hrs = (n: number | null) => (n == null ? '—' : `${n} hr`)

/** Variance reads as a sentence, not a signed integer. "−3" tells a reader
 *  nothing about whether three days late is the median or the worst case. */
function variance(n: number | null): string {
  if (n == null) return '—'
  if (n === 0) return 'on the day'
  return n > 0 ? `${days(n)} early` : `${days(n)} late`
}

export default function EngReportClient({ report }: { report: EngReport }) {
  const t = report.totals
  const monthMax = useMemo(
    () => Math.max(1, ...report.monthly.flatMap(m => [m.created, m.completed])),
    [report.monthly],
  )
  const personMax = Math.max(1, ...report.byPerson.map(p => p.completed))
  const streamMax = Math.max(1, ...report.byStream.map(s => s.completed))

  const coveragePct = t.completed > 0 ? Math.round((t.hoursCoverage.logged / t.completed) * 100) : 0

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Reports"
          title="Engineering"
          count={`${t.completed} ${t.completed === 1 ? 'task' : 'tasks'} finished in ${report.rangeLabel.toLowerCase()} · ${t.openNow} open right now`}
        />

        <RangeTabs basePath="/admin/reports/engineering" active={report.rangeKey} count={t.completed} />

        <Toolbar>
          <ExportCsvButton
            rows={report.rows}
            filename="iat-engineering-tasks"
            hint="Every finished task in this range with its dates, owner, target and actual hours."
            columns={[
              ['Job', r => r.jobNumber],
              ['Customer', r => r.customer],
              ['Bucket', r => STREAM_LABELS[r.stream]],
              ['Step', r => r.step],
              ['Task', r => r.title],
              ['Owner', r => r.owner],
              ['Due', r => r.dueDate],
              ['Completed', r => r.completedAt],
              ['Days early (−ve = late)', r => r.varianceDays],
              ['Target hours', r => r.targetHours],
              ['Actual hours', r => r.actualHours],
              ['Calendar days start→done', r => r.cycleDays],
            ]}
          />
        </Toolbar>

        <TileGrid>
          <Tile
            label="On time"
            value={pct(t.onTimePct)}
            sub={`${t.onTime} of ${t.completed} finished on or before the date. Undated work is not scored.`}
            tone={t.onTimePct == null ? undefined : t.onTimePct >= 85 ? 'good' : t.onTimePct < 60 ? 'warn' : undefined}
          />
          <Tile label="Median finish" value={variance(t.medianVarianceDays)} sub="Against the due date, across everything finished" />
          <Tile
            label="At risk now"
            value={String(t.atRiskNow)}
            sub={`${t.overdueNow} past due · ${t.unassignedNow} with no owner`}
            tone={t.atRiskNow > 0 ? 'warn' : 'good'}
          />
          <Tile
            label="Jobs at risk"
            value={`${t.jobsAtRisk} of ${t.activeJobs}`}
            sub="Active jobs with at least one task overdue, trending late or blocked"
            tone={t.jobsAtRisk > 0 ? 'warn' : 'good'}
          />
        </TileGrid>

        {/* ── The honesty line ─────────────────────────────────────────────
            Every hours number below is a median over the tasks that HAVE logged
            hours. Printed without its coverage, a median over four of nineteen
            reads as a statement about the department. */}
        <div className="border-t border-hairline px-5 py-3">
          <p className="text-[12px] leading-relaxed text-ink-muted">
            <strong className="font-medium text-ink-secondary">Hours coverage: {coveragePct}%.</strong>{' '}
            {t.hoursCoverage.logged} of {t.completed} finished tasks have logged hours, so every hours figure below
            describes that subset — not the department. Median hands-on time across them:{' '}
            <strong className="font-medium tabular-nums text-ink-secondary">{hrs(t.medianActualHours)}</strong>.
            Median calendar time from first touch to done:{' '}
            <strong className="font-medium tabular-nums text-ink-secondary">
              {t.medianCycleDays == null ? '—' : days(t.medianCycleDays)}
            </strong>.
          </p>
        </div>

        {/* ── By bucket ───────────────────────────────────────────────────── */}
        <Section title="By bucket" sub="Finished work per bucket, and how much of it landed on time" defaultOpen summary={`${report.byStream.length} buckets`}>
          {report.byStream.length === 0 ? (
            <p className="px-5 py-3 text-[12.5px] text-ink-muted">Nothing finished in this range.</p>
          ) : report.byStream.map(s => (
            <BarRow
              key={s.stream}
              label={STREAM_LABELS[s.stream]}
              count={s.completed}
              max={streamMax}
              display={`${s.completed} · ${pct(s.onTimePct)} on time`}
              note={`Median finish ${variance(s.medianVarianceDays)} · median ${hrs(s.medianActualHours)} hands-on · ${s.costedOf.costed} of ${s.costedOf.total} had a target`}
            />
          ))}
        </Section>

        {/* ── Target vs actual, per step ──────────────────────────────────── */}
        <Section
          title="Target vs actual, per step"
          sub="The workbook's Average Lead-Time against what the work really takes. This is the question the department's own milestones ask — “lead-times under 4 hours, then under 2”."
          summary={`${report.bySteps.length} steps`}
        >
          {report.bySteps.length === 0 ? (
            <p className="px-5 py-3 text-[12.5px] text-ink-muted">Nothing finished in this range.</p>
          ) : (
            <div className="px-5 pb-1">
              <div className="grid grid-cols-[minmax(0,2fr)_70px_70px_80px_80px] gap-3 border-b border-hairline py-2 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                <span>Step</span>
                <span className="text-right">Done</span>
                <span className="text-right">Target</span>
                <span className="text-right">Actual</span>
                <span className="text-right">On time</span>
              </div>
              {report.bySteps.map(s => (
                <div key={`${s.stream}:${s.step}`} className="grid grid-cols-[minmax(0,2fr)_70px_70px_80px_80px] items-baseline gap-3 border-b border-hairline-soft py-2 last:border-b-0">
                  <span className="min-w-0">
                    <span className="block truncate text-[12.5px] text-ink">{s.title}</span>
                    <span className="block truncate text-[11px] text-ink-muted">{STREAM_LABELS[s.stream]}</span>
                  </span>
                  <span className="text-right text-[12.5px] tabular-nums text-ink-secondary">{s.completed}</span>
                  <span className="text-right text-[12.5px] tabular-nums text-ink-muted">
                    {s.targetHours == null ? <span className="text-ink-faint">Not set</span> : hrs(s.targetHours)}
                  </span>
                  <span className={`text-right text-[12.5px] tabular-nums ${
                    s.gapHours == null ? 'text-ink-muted'
                      : s.gapHours > 0 ? 'text-amber-700 dark:text-amber-400'
                      : 'text-emerald-700 dark:text-emerald-400'
                  }`}>
                    {hrs(s.medianActualHours)}
                    {s.gapHours != null && s.gapHours !== 0 && (
                      <span className="ml-1 text-[11px]">({s.gapHours > 0 ? '+' : ''}{s.gapHours})</span>
                    )}
                  </span>
                  <span className="text-right text-[12.5px] tabular-nums text-ink-secondary">{pct(s.onTimePct)}</span>
                </div>
              ))}
            </div>
          )}
          <ReportFootnote>
            Targets are read off each task as it was created, not off the live rules — so a step compares against the
            standard that applied when the job started, rather than one edited afterwards. A step with no target shows
            &ldquo;Not set&rdquo; rather than a made-up figure; set them in Scheduling Rules.
          </ReportFootnote>
        </Section>

        {/* ── By person ───────────────────────────────────────────────────── */}
        <Section
          title="By person"
          sub="Finished, on-time rate, and what each person is carrying right now"
          summary={`${report.byPerson.length} people`}
        >
          {report.byPerson.length === 0 ? (
            <p className="px-5 py-3 text-[12.5px] text-ink-muted">Nobody has finished anything in this range.</p>
          ) : report.byPerson.map(p => (
            <BarRow
              key={p.name}
              label={p.name}
              count={p.completed}
              max={personMax}
              display={`${p.completed} done · ${pct(p.onTimePct)} on time`}
              note={`Median finish ${variance(p.medianVarianceDays)} · ${p.openNow} open now${p.atRiskNow ? `, ${p.atRiskNow} at risk` : ''}${p.actualHours != null ? ` · ${p.actualHours} hr logged` : ''}`}
            />
          ))}
          <ReportFootnote>
            On-time counts only tasks that had a due date. Work with no date is left out entirely rather than scored as a
            success — otherwise the cheapest way to raise this number would be to stop setting dates.
          </ReportFootnote>
        </Section>

        {/* ── Month by month ──────────────────────────────────────────────── */}
        <Section title="Month by month" sub="Created against finished — whether the department is keeping up with what arrives" summary={`${report.monthly.length} months`}>
          {report.monthly.length === 0 ? (
            <p className="px-5 py-3 text-[12.5px] text-ink-muted">No activity in this range.</p>
          ) : report.monthly.map(m => (
            <BarRow
              key={m.month}
              label={new Date(`${m.month}-01T12:00:00`).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              count={m.completed}
              max={monthMax}
              display={`${m.completed} done / ${m.created} new`}
              note={m.late > 0 ? `${m.late} finished late` : undefined}
            />
          ))}
        </Section>

        {/* ── Where the work sits right now ───────────────────────────────── */}
        <Section title="Open right now" sub="A snapshot, not a range — the same numbers the status board shows">
          <BarList
            rows={[
              { label: 'Open tasks', count: t.openNow },
              { label: 'At risk (overdue, trending late or blocked)', count: t.atRiskNow },
              { label: 'Past their due date', count: t.overdueNow },
              { label: 'Nobody owns them', count: t.unassignedNow },
            ]}
            empty="Nothing open."
          />
        </Section>

        <ReportFootnote>
          Ahead / behind is arithmetic, not an estimate: at the point where a share of a task&apos;s window has been used
          up, its own progress bar says what pace it is running at, and the projected finish follows. A task at 0% is not
          projected at all — the answer would be infinity, and a board where everything is red is a board nobody reads.
        </ReportFootnote>
      </ListCard>
    </ListCardPage>
  )
}
