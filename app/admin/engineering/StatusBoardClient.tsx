'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, Monitor, RefreshCw, UserRound, X } from 'lucide-react'
import { ListCardPage, ListCard, CardHead, StatStrip, Stat } from '@/components/admin/list-card'
import { STREAM_BLURB, STREAM_LABELS, STREAM_TONE, shortDate } from '@/lib/engineering'
import type { PersonLoad, StatusBoard, StreamTile } from '@/lib/eng-data'
import { Metric, Nothing, ProgressBar, ProjectionPill, Sparkline, StreamChip } from './ui'

/* The Status Box. Read-only on purpose: this is the screen you look AT, and
   every row is a link into the place the work is actually done. A board that is
   also an editor is a board people accidentally change while reading it —
   especially the one running unattended on a wall. */

const WALL_REFRESH_MS = 60_000
/** How many rows a tile shows before "and N more". Six is what fits a tile at
 *  the wall's type size without the tile scrolling — a wall board nobody can
 *  scroll must not hide its worst row below a fold. Sorted worst-first, so the
 *  rows that are cut are always the healthiest ones. */
const ROWS_PER_TILE = 6

function StreamTileCard({ tile, wall }: { tile: StreamTile; wall: boolean }) {
  const rows = tile.rows.slice(0, ROWS_PER_TILE)
  const more = tile.rows.length - rows.length

  return (
    <div className="rounded-xl border border-hairline bg-surface flex flex-col min-h-0">
      <div className="flex items-center gap-2 px-4 h-11 border-b border-hairline-soft">
        <StreamChip stream={tile.stream} />
        <h3 className={`font-semibold text-ink tracking-[-0.006em] truncate ${wall ? 'text-[15px]' : 'text-[12.5px]'}`}>
          {STREAM_LABELS[tile.stream]}
        </h3>
        <span className={`tabular-nums text-ink-muted ${wall ? 'text-[15px]' : 'text-[12px]'}`}>{tile.open}</span>
        <span className="ml-auto flex items-center gap-2">
          {tile.atRisk > 0 && (
            <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider px-2 py-[3px] rounded-md bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              <AlertCircle size={11} /> {tile.atRisk}
            </span>
          )}
          {/* The whiteboard's "trending" squiggle — completions per week, eight
              weeks, oldest left. */}
          <Sparkline points={tile.trend} tone={STREAM_TONE[tile.stream]} width={wall ? 92 : 68} height={wall ? 26 : 20} />
        </span>
      </div>

      {rows.length === 0 ? (
        <Nothing>
          Nothing open. <span className="text-ink-faint">{STREAM_BLURB[tile.stream]}</span>
        </Nothing>
      ) : (
        <div className="divide-y divide-hairline-soft">
          {rows.map(r => {
            const href = r.job_id ? `/admin/engineering/jobs/${r.job_id}` : '/admin/engineering/tasks'
            return (
              <Link
                key={r.id}
                href={href}
                className="grid grid-cols-[70px_minmax(0,1fr)_auto] items-center gap-2.5 px-4 py-2 transition-colors hover:bg-surface-soft group"
              >
                <span className={`tabular-nums font-medium text-ink truncate ${wall ? 'text-[14px]' : 'text-[12.5px]'}`}>
                  {r.job_number ?? <span className="text-ink-faint font-normal">Standing</span>}
                </span>
                <span className="min-w-0">
                  <span className={`block truncate text-ink-secondary group-hover:text-brand-ink transition-colors ${wall ? 'text-[14px]' : 'text-[12.5px]'}`}>
                    {r.title}
                  </span>
                  <span className={`flex items-center gap-2 ${wall ? 'text-[12px]' : 'text-[11px]'} text-ink-muted`}>
                    <span className="truncate">
                      {r.assignee_name ?? <span className="text-amber-700 dark:text-amber-400">Unassigned</span>}
                    </span>
                    <span className="text-ink-faint">·</span>
                    <span className="tabular-nums whitespace-nowrap">{shortDate(r.due_date)}</span>
                    <span className="hidden sm:flex flex-1 min-w-[40px] max-w-[90px]">
                      <ProgressBar
                        value={r.progress}
                        expected={r.projection.expectedPct}
                        tone={STREAM_TONE[tile.stream]}
                        height={4}
                      />
                    </span>
                  </span>
                </span>
                <span className="justify-self-end"><ProjectionPill projection={r.projection} compact /></span>
              </Link>
            )
          })}
          {more > 0 && (
            <Link href="/admin/engineering/tasks" className="block px-4 py-2 text-[11.5px] text-ink-muted hover:text-ink transition-colors">
              and {more} more →
            </Link>
          )}
        </div>
      )}
    </div>
  )
}

function PeopleStrip({ people, wall }: { people: PersonLoad[]; wall: boolean }) {
  if (!people.length) return <Nothing>Nothing is open, so nobody is carrying anything.</Nothing>
  const max = Math.max(1, ...people.map(p => p.open))
  return (
    <div className="divide-y divide-hairline-soft">
      {people.map(p => (
        <div key={p.employeeId ?? '__unassigned'} className="flex items-center gap-3 px-4 py-2.5">
          <span className={`w-40 flex-shrink-0 truncate font-medium ${wall ? 'text-[14px]' : 'text-[12.5px]'} ${
            p.employeeId ? 'text-ink' : 'text-amber-700 dark:text-amber-400'
          }`}>
            {p.name}
          </span>
          <span className="flex-1 min-w-0">
            <ProgressBar value={(p.open / max) * 100} tone={p.atRisk > 0 ? 'rose' : 'sky'} height={6} />
          </span>
          <span className={`tabular-nums text-ink-secondary w-10 text-right ${wall ? 'text-[14px]' : 'text-[12px]'}`}>{p.open}</span>
          <span className={`tabular-nums w-24 text-right ${wall ? 'text-[13px]' : 'text-[11.5px]'} ${p.atRisk ? 'text-rose-600 dark:text-rose-400' : 'text-ink-faint'}`}>
            {p.atRisk ? `${p.atRisk} at risk` : 'clear'}
          </span>
          {/* Target hours next to a count of tasks nobody has costed. A person
              carrying six uncosted tasks must not read as having a free week. */}
          <span className={`hidden lg:block tabular-nums w-28 text-right ${wall ? 'text-[13px]' : 'text-[11.5px]'} text-ink-muted`}>
            {p.targetHours > 0 ? `${p.targetHours.toFixed(1)} hr` : '—'}
            {p.uncosted > 0 && <span className="text-ink-faint"> +{p.uncosted} n/s</span>}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function StatusBoardClient({
  board, people, activeJobs, wall,
}: {
  board: StatusBoard
  people: PersonLoad[]
  activeJobs: number
  wall: boolean
}) {
  const router = useRouter()
  const [refreshedAt, setRefreshedAt] = useState<string | null>(null)

  // The wall display refreshes itself; the desk view does not. An unattended
  // screen that goes stale is worse than no screen, and a page that reloads
  // under someone reading it is worse than a stale one.
  useEffect(() => {
    if (!wall) return
    const t = setInterval(() => {
      router.refresh()
      setRefreshedAt(new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' }))
    }, WALL_REFRESH_MS)
    return () => clearInterval(t)
  }, [wall, router])

  const t = board.totals
  const clear = t.atRisk === 0 && t.unassigned === 0

  if (wall) {
    return (
      <div className="flex-1 overflow-y-auto bg-canvas p-5">
        <div className="flex items-center gap-4 mb-4">
          <div className="min-w-0">
            <p className="text-[12px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Engineering</p>
            <h1 className="text-[30px] font-semibold text-ink leading-tight tracking-[-0.02em]">Status Board</h1>
          </div>
          <div className="ml-auto flex items-center gap-2.5 flex-shrink-0">
            <Metric label="Open" value={t.open} />
            <Metric label="At risk" value={t.atRisk} tone={t.atRisk ? 'rose' : undefined} />
            <Metric label="Overdue" value={t.overdue} tone={t.overdue ? 'rose' : undefined} />
            <Metric label="Unassigned" value={t.unassigned} tone={t.unassigned ? 'amber' : undefined} />
            <Metric label="Active jobs" value={activeJobs} />
            <Link
              href="/admin/engineering"
              className="ml-1 flex items-center justify-center w-9 h-9 rounded-lg border border-hairline text-ink-muted hover:text-ink hover:border-hairline-strong transition-colors"
              title="Leave wall display"
            >
              <X size={15} />
            </Link>
          </div>
        </div>

        <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
          {board.tiles.map(tile => <StreamTileCard key={tile.stream} tile={tile} wall />)}
        </div>

        <div className="mt-3 rounded-xl border border-hairline bg-surface">
          <div className="flex items-center gap-2 px-4 h-11 border-b border-hairline-soft">
            <UserRound size={14} className="text-ink-faint" />
            <h3 className="text-[15px] font-semibold text-ink">Who is carrying what</h3>
          </div>
          <PeopleStrip people={people} wall />
        </div>

        <p className="mt-3 text-center text-[11.5px] text-ink-faint">
          Live · refreshes every minute{refreshedAt ? ` · last at ${refreshedAt}` : ''}
        </p>
      </div>
    )
  }

  return (
    <ListCardPage>
      {/* ListCardPage adds page padding but no gap between siblings — every other
          list page holds exactly one card. This one is four stacked blocks. */}
      <div className="space-y-3">
      <ListCard>
        <CardHead
          overline="Engineering"
          title="Status Board"
          count={`${t.open} open ${t.open === 1 ? 'task' : 'tasks'} across ${activeJobs} active ${activeJobs === 1 ? 'job' : 'jobs'}`}
          actions={
            <Link
              href="/admin/engineering?tv=1"
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-hairline text-[12.5px] font-medium text-ink-secondary hover:text-ink hover:border-hairline-strong transition-colors"
            >
              <Monitor size={13} /> Wall display
            </Link>
          }
        />
        <StatStrip>
          <Stat tone="sky" label="Open" value={t.open} sub="Tasks not finished" />
          <Stat tone={t.atRisk ? 'rose' : 'slate'} label="At risk" value={t.atRisk} sub="Overdue, trending late or blocked" />
          <Stat tone={t.overdue ? 'rose' : 'slate'} label="Overdue" value={t.overdue} sub="The due date has passed" />
          <Stat tone={t.unassigned ? 'amber' : 'slate'} label="Unassigned" value={t.unassigned} sub="Nobody owns these" />
        </StatStrip>

        {clear && (
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-hairline-soft text-[12.5px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 size={14} /> Everything open has an owner and is projected to land on time.
          </div>
        )}
      </ListCard>

      <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-3">
        {board.tiles.map(tile => <StreamTileCard key={tile.stream} tile={tile} wall={false} />)}
      </div>

      <ListCard>
        <div className="flex items-center gap-2 px-4 h-11 border-b border-hairline-soft">
          <UserRound size={14} className="text-ink-faint" />
          <h3 className="text-[12.5px] font-semibold text-ink">Who is carrying what</h3>
          <Link href="/admin/engineering/capacity" className="ml-auto text-[11.5px] font-medium text-ink-muted hover:text-ink transition-colors">
            Workload →
          </Link>
        </div>
        <PeopleStrip people={people} wall={false} />
      </ListCard>

      <p className="flex items-center justify-center gap-1.5 pb-4 text-[11px] text-ink-faint">
        <RefreshCw size={11} />
        Ahead / behind is projected from each task&apos;s own progress against its own window — arithmetic, not a guess, and the same number every time.
      </p>
      </div>
    </ListCardPage>
  )
}
