'use client'

import type { AdoptionReport } from '@/lib/adoption-report'
import { ListCardPage, ListCard, CardHead, Toolbar } from '@/components/admin/list-card'
import {
  Tile, TileGrid, Section, BarList, RangeTabs, ExportCsvButton, ReportFootnote,
} from '@/components/admin/report-ui'

export default function AdoptionReportClient({ report }: { report: AdoptionReport }) {
  const t = report.totals
  const ssoPct = t.activePeople ? Math.round((t.ssoPeople / t.activePeople) * 100) : null

  return (
    <ListCardPage>
      <ListCard>
        <CardHead overline="Reports" title="Portal Adoption" count={`${t.activePeople} people signed in`} />
        <RangeTabs basePath="/admin/reports/adoption" active={report.rangeKey} count={t.activePeople} />

        <Toolbar>
          <ExportCsvButton
            rows={report.rows}
            filename="iat-portal-adoption"
            hint="Every person who signed in, with how often and when last."
            columns={[
              ['Name', r => r.name],
              ['Email', r => r.email],
              ['Role', r => r.role],
              ['Sign-ins', r => r.logins],
              ['Last seen', r => r.lastSeen],
              ['Days since', r => r.daysSinceSeen],
              ['Methods', r => r.methods],
            ]}
          />
        </Toolbar>

        <TileGrid>
          <Tile label="Active people" value={String(t.activePeople)} sub={report.rangeLabel.toLowerCase()} />
          <Tile label="Sign-ins" value={String(t.totalLogins)} sub="events, not sessions" />
          <Tile
            label="Using Microsoft SSO"
            value={ssoPct == null ? '—' : `${t.ssoPeople} of ${t.activePeople}`}
            tone={(ssoPct ?? 0) < 50 ? 'warn' : 'good'}
            sub={ssoPct == null ? '' : `${ssoPct}% of active people`}
          />
          <Tile
            label="Still on a password"
            value={String(t.passwordPeople)}
            tone={t.passwordPeople > 0 ? 'warn' : 'good'}
            sub="have not moved to SSO"
          />
          <Tile label="Staff accounts" value={String(t.staffAccounts)} sub="non-customer profiles" />
          <Tile
            label="Never signed in"
            value={String(t.neverSignedIn)}
            tone={t.neverSignedIn > 0 ? 'warn' : 'good'}
            sub="have an account, never used it"
          />
          <Tile label="Quiet 30+ days" value={String(t.dormant30)} sub="signed in, then stopped" />
          <Tile label="Roles seen" value={String(report.byRole.length)} sub="distinct roles signing in" />
        </TileGrid>

        <Section
          title="How people sign in"
          sub="Sign-in events by method. The SSO rollout in one bar chart."
          summary={`${report.byMethod.length} methods`}
          defaultOpen
        >
          <BarList rows={report.byMethod} empty="Nothing in this range." />
        </Section>
        <Section
          title="Never signed in"
          sub="Staff accounts with no sign-in on record, ever."
          summary={`${report.never.length} people`}
        >
          <BarList rows={report.never} empty="Everyone with an account has used it." display={() => ''} />
        </Section>
        <Section title="Active people by month" summary={`${report.byMonth.length} months`}>
          <BarList rows={report.byMonth} empty="Nothing in this range." />
        </Section>
        <Section title="By role" summary={`${report.byRole.length} roles`}>
          <BarList rows={report.byRole} empty="Nothing in this range." />
        </Section>
        <Section title="Which portal" summary={`${report.byPortal.length} surfaces`}>
          <BarList rows={report.byPortal} empty="Nothing in this range." />
        </Section>

        <ReportFootnote>
          ⚠️ The trail records SIGN-INS, not sessions. Someone who signs in once and works all week
          counts once; someone bounced by an expired session counts twice in a minute. So the honest
          unit here is people, never sign-ins, which is why every headline above counts people.
          &ldquo;Never signed in&rdquo; is measured against staff profiles rather than the employees
          table, because that table is not staff-only: every customer invite adds a row to it, and
          counting there would report your customers as staff who never logged in.
        </ReportFootnote>
      </ListCard>
    </ListCardPage>
  )
}
