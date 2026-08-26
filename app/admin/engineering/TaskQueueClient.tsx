'use client'

import { useMemo, useState } from 'react'
import { Layers, UserRound } from 'lucide-react'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar,
  ListSearch, FilterDropdown, Pagination, usePagedList,
} from '@/components/admin/list-card'
import {
  OPEN_STATUSES, STREAMS, STREAM_LABELS, TASK_STATUSES, TASK_STATUS_LABELS,
  isAtRisk, projectTask, type EngTaskRow,
} from '@/lib/engineering'
import TaskEditRow from './TaskEditRow'
import { Nothing } from './ui'
import AddSupportTask from './AddSupportTask'

/* The task queue — every unit of engineering work in one filterable list, and
   the same component behind My Work.
 *
 * ── Why "Needs attention" is its own filter and not a sort ──────────────────
 * A manager opening this page has one question, and it is not "show me
 * everything". The four states worth chasing — overdue, trending late, blocked,
 * nobody owns it, nobody has touched it — are each one click, because a filter
 * somebody has to construct is a filter nobody uses.
 */

const STALE_DAYS = 5

type Focus = '__all' | 'at_risk' | 'overdue' | 'unassigned' | 'stale' | 'open' | 'done'

const FOCUS_OPTIONS: { value: Focus; label: string }[] = [
  { value: 'open', label: 'Open work' },
  { value: 'at_risk', label: 'Needs attention' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'unassigned', label: 'Nobody owns it' },
  { value: 'stale', label: `Untouched ${STALE_DAYS}+ days` },
  { value: 'done', label: 'Finished' },
]

export default function TaskQueueClient({
  rows, assignees, overline, title, blurb, scope = 'all',
}: {
  rows: EngTaskRow[]
  assignees: { id: string; name: string }[]
  overline: string
  title: string
  blurb: string
  scope?: 'all' | 'mine'
}) {
  const [search, setSearch] = useState('')
  const [stream, setStream] = useState('__all')
  const [status, setStatus] = useState('__all')
  const [owner, setOwner] = useState('__all')
  const [focus, setFocus] = useState<Focus>('open')

  const now = useMemo(() => new Date(), [])
  const staleBefore = useMemo(() => new Date(now.getTime() - STALE_DAYS * 86_400_000).toISOString(), [now])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      const open = (OPEN_STATUSES as readonly string[]).includes(r.status)
      if (focus === 'open' && !open) return false
      if (focus === 'done' && open) return false
      if (focus === 'at_risk' && !(open && isAtRisk(projectTask(r, now)))) return false
      if (focus === 'overdue' && !(open && projectTask(r, now).kind === 'overdue')) return false
      if (focus === 'unassigned' && !(open && !r.assignee_id)) return false
      if (focus === 'stale' && !(open && r.updated_at < staleBefore)) return false
      if (stream !== '__all' && r.stream !== stream) return false
      if (status !== '__all' && r.status !== status) return false
      if (owner === '__unassigned' && r.assignee_id) return false
      if (owner !== '__all' && owner !== '__unassigned' && r.assignee_id !== owner) return false
      if (!q) return true
      return [r.title, r.job_number, r.customer_name, r.assignee_name, STREAM_LABELS[r.stream]]
        .filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [rows, search, stream, status, owner, focus, now, staleBefore])

  const { page, setPage, perPage, setPerPage, totalPages, start, end } = usePagedList(
    filtered.length, { initialPerPage: 25, resetKey: `${search}|${stream}|${status}|${owner}|${focus}` },
  )

  const counts = useMemo(() => {
    const open = rows.filter(r => (OPEN_STATUSES as readonly string[]).includes(r.status))
    return {
      open: open.length,
      atRisk: open.filter(r => isAtRisk(projectTask(r, now))).length,
      unassigned: open.filter(r => !r.assignee_id).length,
      stale: open.filter(r => r.updated_at < staleBefore).length,
    }
  }, [rows, now, staleBefore])

  const owners = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of rows) if (r.assignee_id && r.assignee_name) seen.set(r.assignee_id, r.assignee_name)
    return [...seen].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  return (
    <ListCardPage>
      <div className="space-y-3">
        <ListCard>
          <CardHead
            overline={overline}
            title={title}
            count={blurb}
            actions={<AddSupportTask assignees={assignees} />}
          />
          <StatStrip>
            <Stat tone="sky" label="Open" value={counts.open} />
            <Stat tone={counts.atRisk ? 'rose' : 'slate'} label="Needs attention" value={counts.atRisk} sub="Overdue, trending late or blocked" />
            {scope === 'all' && <Stat tone={counts.unassigned ? 'amber' : 'slate'} label="Nobody owns it" value={counts.unassigned} />}
            <Stat
              tone={counts.stale ? 'amber' : 'slate'}
              label={`Untouched ${STALE_DAYS}+ days`}
              value={counts.stale}
              sub="No change of any kind"
            />
          </StatStrip>
          <Toolbar>
            <ListSearch value={search} onChange={setSearch} placeholder="Search task, job, customer…" />
            <FilterDropdown
              icon={Layers} allLabel="Everything" value={focus}
              onChange={v => setFocus(v as Focus)} options={FOCUS_OPTIONS}
            />
            <FilterDropdown
              icon={Layers} allLabel="All buckets" value={stream} onChange={setStream}
              options={STREAMS.map(s => ({ value: s, label: STREAM_LABELS[s] }))}
            />
            <FilterDropdown
              icon={Layers} allLabel="Any status" value={status} onChange={setStatus}
              options={TASK_STATUSES.map(s => ({ value: s, label: TASK_STATUS_LABELS[s] }))}
            />
            {scope === 'all' && (
              <FilterDropdown
                icon={UserRound} allLabel="Anyone" value={owner} onChange={setOwner}
                options={[{ value: '__unassigned', label: 'Unassigned' }, ...owners.map(o => ({ value: o.id, label: o.name }))]}
              />
            )}
          </Toolbar>

          {filtered.length === 0 ? (
            <Nothing>
              {rows.length === 0
                ? scope === 'mine'
                  ? 'Nothing is assigned to you.'
                  : 'No tasks yet. Open a job and the plan generates itself.'
                : 'Nothing matches that filter.'}
            </Nothing>
          ) : (
            <div>
              {filtered.slice(start, end).map(t => (
                <TaskEditRow key={t.id} task={t} assignees={assignees} showJob dense />
              ))}
            </div>
          )}

          <Pagination
            page={page} perPage={perPage} total={filtered.length} totalPages={totalPages}
            onPage={setPage} onPerPage={setPerPage} unit="tasks"
          />
        </ListCard>

        <p className="pb-4 text-center text-[11px] text-ink-faint">
          The tick on each progress bar is where a linear pace says the task should be by now. Hours on the left are what
          it has taken; hours on the right are the target from the scheduling rules.
        </p>
      </div>
    </ListCardPage>
  )
}
