import Link from 'next/link'
import { AlertCircle, CheckCircle2, Clock, DraftingCompass, Inbox, UserRound } from 'lucide-react'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { Card, CardHead, CardBody } from '@/components/dashboards/sales-charts'
import { AttentionRow } from '@/components/dashboards/exec-cards'
import { listTasks, rollUpByPerson } from '@/lib/eng-data'
import {
  STREAMS, STREAM_LABELS, STREAM_SHORT, STREAM_TONE,
  isAtRisk, projectTask, shortDate, type EngTaskRow,
} from '@/lib/engineering'
import { ProgressBar, ProjectionPill } from '@/app/admin/engineering/ui'

/* ────────────────────────────────────────────────────────────────────────────
   Engineering cards for the dashboard grid — leadership's and James's view of
   the section, on the page they already open first.

   All three read ONE `listTasks({ openOnly: true })` batch passed down from the
   registry, not one query each. Three cards on one dashboard firing their own
   full table read is how a dashboard becomes the slowest page in the portal.

   ⚠️ Every card supplies its OWN <Card> and <CardHead>. DashboardGrid wraps
   children in a bare <div> and adds no chrome — a card that forgets renders as
   an anonymous block of numbers with no border and no title, which on a grid of
   titled cards gives no clue what it belongs to. (That shipped once, on
   my_rfqs.) Do not drop the wrapper.
   ──────────────────────────────────────────────────────────────────────────── */

const TONE_HEX = { emerald: '#10b981', sky: '#0ea5e9', rose: '#f43f5e', amber: '#f59e0b', violet: '#8b5cf6', slate: '#94a3b8' }

export type EngCardData = {
  open: EngTaskRow[]
  unplannedJobs: number
  staleDays: number
}

/** One read, shared by every engineering card on the grid. */
export async function getEngCardData(staleDays = 5): Promise<EngCardData> {
  const [open, jobs] = await Promise.all([
    listTasks({ openOnly: true }),
    // Active jobs with no tasks at all — the one failure mode job creation can
    // leave behind, and invisible unless something counts it. Two small reads
    // rather than a join: PostgREST cannot express "has no related rows" without
    // one, and the tables are hundreds of rows.
    supabaseAdmin.from('eng_jobs').select('id').eq('status', 'active'),
  ])
  const withTasks = new Set(open.map(t => t.job_id).filter(Boolean) as string[])
  const { data: anyTasks } = await supabaseAdmin.from('eng_tasks').select('job_id').not('job_id', 'is', null)
  for (const r of anyTasks ?? []) if (r.job_id) withTasks.add(r.job_id as string)

  return {
    open,
    unplannedJobs: (jobs.data ?? []).filter(j => !withTasks.has(j.id as string)).length,
    staleDays,
  }
}

// ── Engineering Status — the Status Box, compressed to a card ────────────────
export function EngStatusCard({ d }: { d: EngCardData }) {
  const now = new Date()
  const tiles = STREAMS.map(stream => {
    const rows = d.open.filter(t => t.stream === stream)
    return {
      stream,
      open: rows.length,
      atRisk: rows.filter(t => isAtRisk(projectTask(t, now))).length,
      progress: rows.length
        ? Math.round(rows.reduce((a, t) => a + t.progress, 0) / rows.length)
        : 100,
    }
  }).filter(t => t.open > 0)

  return (
    <Card className="h-full">
      <CardHead
        title="Engineering Status"
        icon={<DraftingCompass size={13} />}
        iconTone="emerald"
        action="Status board"
        href="/admin/engineering"
      />
      {tiles.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">Nothing open in engineering.</p>
      ) : (
        <CardBody className="divide-y divide-hairline-soft">
          {tiles.map(t => (
            <Link
              key={t.stream}
              href="/admin/engineering"
              className="flex items-center gap-3 px-4 py-2 transition-colors hover:bg-surface-soft"
              title={STREAM_LABELS[t.stream]}
            >
              <span className="w-[46px] flex-shrink-0 text-[10px] font-semibold uppercase tracking-wider text-ink-muted">
                {STREAM_SHORT[t.stream]}
              </span>
              <span className="min-w-0 flex-1">
                <ProgressBar value={t.progress} tone={STREAM_TONE[t.stream]} height={5} />
              </span>
              <span className="w-8 flex-shrink-0 text-right text-[12px] tabular-nums text-ink-secondary">{t.open}</span>
              <span className={`w-14 flex-shrink-0 text-right text-[11px] tabular-nums ${t.atRisk ? 'text-rose-600 dark:text-rose-400' : 'text-ink-faint'}`}>
                {t.atRisk ? `${t.atRisk} risk` : 'clear'}
              </span>
            </Link>
          ))}
        </CardBody>
      )}
    </Card>
  )
}

// ── Engineering Risk — what a director should look at first ─────────────────
export function EngRiskCard({ d }: { d: EngCardData }) {
  const now = new Date()
  const staleBefore = new Date(now.getTime() - d.staleDays * 86_400_000).toISOString()
  const overdue = d.open.filter(t => projectTask(t, now).kind === 'overdue').length
  const behind = d.open.filter(t => projectTask(t, now).kind === 'behind').length
  const unassigned = d.open.filter(t => !t.assignee_id).length
  const stale = d.open.filter(t => t.updated_at < staleBefore).length
  const total = overdue + behind + unassigned + stale + d.unplannedJobs

  return (
    <Card className="h-full">
      <CardHead title="Engineering Risk" icon={<AlertCircle size={13} />} iconTone="amber" action="Task queue" href="/admin/engineering/tasks" />
      <div className="p-2">
        <AttentionRow icon={<Clock size={15} />} color={TONE_HEX.rose} label="Past their due date" value={overdue} href="/admin/engineering/tasks" />
        {/* "Trending late" is the number that has no equivalent in a spreadsheet:
            work that is not yet late and will be, computed from its own progress
            against its own window. It is the whole reason the progress bar is
            worth keeping current. */}
        <AttentionRow icon={<AlertCircle size={15} />} color={TONE_HEX.amber} label="Trending late — not yet overdue" value={behind} href="/admin/engineering/tasks" />
        <AttentionRow icon={<Inbox size={15} />} color={TONE_HEX.violet} label="Nobody owns these" value={unassigned} href="/admin/engineering/tasks" />
        <AttentionRow icon={<Clock size={15} />} color={TONE_HEX.sky} label={`Untouched ${d.staleDays}+ days`} value={stale} href="/admin/engineering/tasks" />
        {d.unplannedJobs > 0 && (
          <AttentionRow icon={<DraftingCompass size={15} />} color={TONE_HEX.rose} label="Active jobs with no plan at all" value={d.unplannedJobs} href="/admin/engineering/jobs" />
        )}
      </div>
      {total === 0 && (
        <div className="-mt-1 px-5 pb-4">
          <p className="flex items-center gap-2 text-[12px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Everything open has an owner and is projected to land on time.
          </p>
        </div>
      )}
    </Card>
  )
}

// ── My Engineering Work ─────────────────────────────────────────────────────
export function EngMyWorkCard({ d, employeeId }: { d: EngCardData; employeeId: string }) {
  const now = new Date()
  const mine = d.open
    .filter(t => t.assignee_id === employeeId)
    .map(t => ({ t, p: projectTask(t, now) }))
    .sort((a, b) => (a.p.varianceDays ?? 9999) - (b.p.varianceDays ?? 9999))

  const head = <CardHead title="My Engineering Work" icon={<UserRound size={13} />} iconTone="sky" action="All of it" href="/admin/engineering/my-work" />

  if (!mine.length) {
    return (
      <Card className="h-full">
        {head}
        <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">Nothing in engineering is assigned to you.</p>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      {head}
      <CardBody className="divide-y divide-hairline-soft">
        {mine.slice(0, 6).map(({ t, p }) => (
          <Link
            key={t.id}
            href={t.job_id ? `/admin/engineering/jobs/${t.job_id}` : '/admin/engineering/my-work'}
            className="flex items-center gap-2.5 px-4 py-2 transition-colors hover:bg-surface-soft"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-medium text-ink">{t.title}</span>
              <span className="block truncate text-[11px] text-ink-muted">
                {t.job_number ? `${t.job_number} · ` : ''}{STREAM_SHORT[t.stream]} · due {shortDate(t.due_date)}
              </span>
            </span>
            <span className="flex-shrink-0"><ProjectionPill projection={p} compact /></span>
          </Link>
        ))}
        {mine.length > 6 && (
          <Link href="/admin/engineering/my-work" className="block px-4 py-2 text-[11.5px] text-ink-muted transition-colors hover:text-ink">
            and {mine.length - 6} more →
          </Link>
        )}
      </CardBody>
    </Card>
  )
}

// ── Who is carrying what ────────────────────────────────────────────────────
export function EngLoadCard({ d }: { d: EngCardData }) {
  const people = rollUpByPerson(d.open).slice(0, 8)
  const max = Math.max(1, ...people.map(p => p.open))
  return (
    <Card className="h-full">
      <CardHead title="Engineering Load" icon={<UserRound size={13} />} iconTone="violet" action="Workload" href="/admin/engineering/capacity" />
      {people.length === 0 ? (
        <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">Nothing open, so nobody is carrying anything.</p>
      ) : (
        <CardBody className="divide-y divide-hairline-soft">
          {people.map(p => (
            <div key={p.employeeId ?? '__unassigned'} className="flex items-center gap-3 px-4 py-2">
              <span className={`w-28 flex-shrink-0 truncate text-[12px] ${p.employeeId ? 'text-ink-secondary' : 'text-amber-700 dark:text-amber-400'}`}>
                {p.name}
              </span>
              <span className="min-w-0 flex-1"><ProgressBar value={(p.open / max) * 100} tone={p.atRisk ? 'rose' : 'sky'} height={5} /></span>
              <span className="w-7 flex-shrink-0 text-right text-[12px] tabular-nums text-ink-secondary">{p.open}</span>
            </div>
          ))}
        </CardBody>
      )}
    </Card>
  )
}
