export const dynamic = 'force-dynamic'

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { AlertCircle, CalendarRange, UserRound } from 'lucide-react'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getPlaybook, listTasks, rollUpByPerson } from '@/lib/eng-data'
import { ListCardPage, ListCard, CardHead, StatStrip, Stat } from '@/components/admin/list-card'
import { STREAMS, STREAM_LABELS, STREAM_TONE, hours as fmtHours } from '@/lib/engineering'
import { Nothing, ProgressBar, StreamChip } from '../ui'

/* /admin/engineering/capacity — who is carrying what, and what the week holds.
 *
 * ── The honest-hours rule ───────────────────────────────────────────────────
 * Target hours are null wherever no source gives one (see lib/eng-playbook.ts),
 * and this page NEVER treats a null as a zero. A person holding six uncosted
 * tasks would otherwise read as having a completely free week, which is the
 * precise lie this section exists to stop. Uncosted tasks are counted and shown
 * beside the hours, and any figure derived from the hours says how much of the
 * work it could actually see.
 */
export default async function EngineeringCapacityPage() {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const [open, playbook] = await Promise.all([listTasks({ openOnly: true }), getPlaybook()])
  const people = rollUpByPerson(open)

  const weekEnd = new Date(Date.now() + 7 * 86_400_000).toISOString().slice(0, 10)
  const dueThisWeek = open.filter(t => t.due_date && t.due_date <= weekEnd)
  const costed = open.filter(t => t.target_hours != null)
  const totalTarget = costed.reduce((a, t) => a + Number(t.target_hours), 0)
  const uncosted = open.length - costed.length
  const coverage = open.length ? Math.round((costed.length / open.length) * 100) : 0

  const byStream = STREAMS.map(s => {
    const list = open.filter(t => t.stream === s)
    const c = list.filter(t => t.target_hours != null)
    return {
      stream: s,
      open: list.length,
      hours: c.reduce((a, t) => a + Number(t.target_hours), 0),
      uncosted: list.length - c.length,
      multiplier: playbook.streams.find(p => p.stream === s)?.multiplier ?? null,
    }
  }).filter(s => s.open > 0)

  const maxHours = Math.max(1, ...byStream.map(s => s.hours))

  return (
    <ListCardPage>
      <div className="space-y-3">
        <ListCard>
          <CardHead
            overline="Engineering"
            title="Workload"
            count="Open work per person, and what the next seven days hold"
          />
          <StatStrip>
            <Stat tone="sky" label="Open tasks" value={open.length} />
            <Stat tone="amber" label="Due within 7 days" value={dueThisWeek.length} />
            <Stat tone="emerald" label="Target hours" value={totalTarget.toFixed(1)} sub={`Across the ${costed.length} tasks that have a target`} />
            <Stat
              tone={coverage < 60 ? 'rose' : coverage < 90 ? 'amber' : 'slate'}
              label="Costed"
              value={`${coverage}%`}
              sub={uncosted ? `${uncosted} task${uncosted === 1 ? '' : 's'} have no target hours` : 'Every open task has a target'}
            />
          </StatStrip>

          {uncosted > 0 && (
            <div className="flex items-start gap-2 border-b border-hairline bg-amber-50 px-5 py-2.5 dark:bg-amber-500/10">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-amber-500" />
              <p className="text-[12px] leading-relaxed text-amber-800 dark:text-amber-300">
                The hours above cover {coverage}% of open work. {uncosted} task{uncosted === 1 ? ' has' : 's have'} no target
                because no source gives one — the workbook says &ldquo;TBD&rdquo;, &ldquo;See Master&rdquo; or nothing at all.
                They are counted separately rather than as zero.{' '}
                <Link href="/admin/engineering/playbook" className="font-medium underline">Set them in Scheduling Rules</Link>.
              </p>
            </div>
          )}
        </ListCard>

        {/* ── Per person ─────────────────────────────────────────────────── */}
        <ListCard>
          <div className="flex items-center gap-2 border-b border-hairline px-4 h-11">
            <UserRound size={14} className="text-ink-faint" />
            <h3 className="text-[12.5px] font-semibold text-ink">Per person</h3>
            <span className="ml-auto text-[11px] text-ink-muted">Open tasks · at risk · target hours · due this week</span>
          </div>
          {people.length === 0 ? (
            <Nothing>Nothing is open, so nobody is carrying anything.</Nothing>
          ) : (
            <div className="divide-y divide-hairline-soft">
              {people.map(p => {
                const max = Math.max(1, ...people.map(x => x.open))
                return (
                  <div key={p.employeeId ?? '__unassigned'} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <span className={`w-44 flex-shrink-0 truncate text-[13px] font-medium ${p.employeeId ? 'text-ink' : 'text-amber-700 dark:text-amber-400'}`}>
                      {p.name}
                    </span>
                    <span className="min-w-[120px] flex-1">
                      <ProgressBar value={(p.open / max) * 100} tone={p.atRisk ? 'rose' : 'sky'} />
                    </span>
                    <span className="w-16 flex-shrink-0 text-right text-[12.5px] tabular-nums text-ink-secondary">{p.open} open</span>
                    <span className={`w-20 flex-shrink-0 text-right text-[12px] tabular-nums ${p.atRisk ? 'text-rose-600 dark:text-rose-400' : 'text-ink-faint'}`}>
                      {p.atRisk ? `${p.atRisk} at risk` : 'clear'}
                    </span>
                    <span className="w-28 flex-shrink-0 text-right text-[12px] tabular-nums text-ink-muted">
                      {p.targetHours > 0 ? `${p.targetHours.toFixed(1)} hr` : '—'}
                      {p.uncosted > 0 && <span className="text-ink-faint" title={`${p.uncosted} task(s) with no target hours`}> +{p.uncosted}?</span>}
                    </span>
                    <span className="w-24 flex-shrink-0 text-right text-[12px] tabular-nums text-ink-muted">{p.dueThisWeek} this week</span>
                  </div>
                )
              })}
            </div>
          )}
        </ListCard>

        {/* ── Where the open hours sit ───────────────────────────────────── */}
        <ListCard>
          <div className="flex items-center gap-2 border-b border-hairline px-4 h-11">
            <CalendarRange size={14} className="text-ink-faint" />
            <h3 className="text-[12.5px] font-semibold text-ink">Open hours by bucket</h3>
          </div>
          {byStream.length === 0 ? (
            <Nothing>Nothing open.</Nothing>
          ) : (
            <div className="divide-y divide-hairline-soft">
              {byStream.map(s => (
                <div key={s.stream} className="flex flex-wrap items-center gap-3 px-4 py-2.5">
                  <span className="w-[68px] flex-shrink-0"><StreamChip stream={s.stream} /></span>
                  <span className="w-40 flex-shrink-0 truncate text-[12.5px] text-ink-secondary">{STREAM_LABELS[s.stream]}</span>
                  <span className="min-w-[120px] flex-1"><ProgressBar value={(s.hours / maxHours) * 100} tone={STREAM_TONE[s.stream]} /></span>
                  <span className="w-16 flex-shrink-0 text-right text-[12.5px] tabular-nums text-ink-secondary">{s.open}</span>
                  <span className="w-24 flex-shrink-0 text-right text-[12px] tabular-nums text-ink-muted">
                    {s.hours > 0 ? `${s.hours.toFixed(2).replace(/0$/, '')} hr` : '—'}
                    {s.uncosted > 0 && <span className="text-ink-faint"> +{s.uncosted}?</span>}
                  </span>
                  {/* The Elec sheet's own formula: Sch (hr) = ROUNDUP(takt ×
                      multiplier). It is the gap between touch time and the
                      calendar time the work actually occupies, and it is the
                      only place either source publishes such a number. */}
                  <span className="w-32 flex-shrink-0 text-right text-[11.5px] tabular-nums text-ink-faint">
                    {s.multiplier != null && s.hours > 0
                      ? `${Math.ceil(s.hours * s.multiplier)} hr scheduled (×${s.multiplier})`
                      : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </ListCard>

        {/* ── The expected workweek ──────────────────────────────────────── */}
        <ListCard>
          <div className="flex items-center gap-2 border-b border-hairline px-4 h-11">
            <h3 className="text-[12.5px] font-semibold text-ink">The expected workweek</h3>
            <span className="text-[11px] text-ink-muted">From the lead-time workbook, transcribed as written</span>
            <Link href="/admin/engineering/playbook" className="ml-auto text-[11.5px] font-medium text-ink-muted transition-colors hover:text-ink">Edit →</Link>
          </div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            {playbook.capacity.map(role => (
              <div key={role.key} className="rounded-lg border border-hairline bg-surface-soft px-4 py-3">
                <p className="text-[12.5px] font-semibold text-ink">{role.label}</p>
                <p className="mt-0.5 text-[11px] text-ink-muted">
                  {role.weeklyHours != null
                    ? `${role.weeklyHours} hours a week`
                    : 'Weekly hours not set — the workbook describes the shape of the week, not its length'}
                </p>
                <ul className="mt-2.5 space-y-1.5">
                  {role.split.map(s => (
                    <li key={s.label} className="flex items-baseline gap-2 text-[12px]">
                      <span className="flex-1 text-ink-secondary">{s.label}</span>
                      <span className="flex-shrink-0 tabular-nums text-ink-muted">
                        {s.share != null ? `${Math.round(s.share * 100)}%` : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="border-t border-hairline px-5 py-2.5 text-[11.5px] leading-relaxed text-ink-muted">
            The 80 / 20 split is what makes the Support &amp; Other bucket worth keeping honest: the workbook already says one
            day in five of a Monday-to-Wednesday belongs to work that is not a production package. If that work is not logged,
            the only visible explanation for a week with nothing finished is the person.
          </p>
        </ListCard>

        <p className="pb-4 text-center text-[11px] text-ink-faint">
          Target hours are the workbook&apos;s &ldquo;Average Lead-Time&rdquo;: {fmtHours(2)} for a submittal package,{' '}
          {fmtHours(1)} for the long-lead list, {fmtHours(4)} for a unit outline.
        </p>
      </div>
    </ListCardPage>
  )
}
