'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  Camera, Mic, Video, ClipboardCheck, Repeat2, Plus, ImageIcon, QrCode,
} from 'lucide-react'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar,
  CardTable, Row, EmptyRow, ListSearch, FilterDropdown, ToneAvatar,
  usePagedList, Pagination,
} from '@/components/admin/list-card'
import {
  useBulkSelect, SelectBox, BulkBar, BulkDeleteButton,
} from '@/components/admin/bulk-select'
import { timeAgo } from '@/components/admin/list'
import {
  CATEGORIES, CATEGORY_LABELS, SEVERITIES, SEVERITY_LABELS,
  WALK_ROLE_SUFFIX, findingTitle, shortDate, standingOf,
  type PpFindingRow,
} from '@/lib/post-production'
import type { PpSummary } from '@/lib/pp-data'
import { CategoryChip, FindingStatusChip, SeverityChip, StandingChip } from './ui'

/* The findings queue.

   Read-only: every row links to the finding, which is where the work is done. A
   list that is also an editor is a list people change while reading it, and this
   one carries dates other people are being chased against.

   Mobile: `COLS` drops to identity · standing (docs/mobile.md). Everything else
   is `hidden sm:*`, so nothing scrolls sideways on a phone — which matters here
   more than usual, because the person who raised a finding is the person most
   likely to check it from the shop floor. */

/* 34px select column leads on desktop, matching /admin/rfq and /admin/tickets.
   It is `hidden sm:flex`, so on a phone the mobile tier is still identity +
   standing and nothing scrolls sideways — bulk triage is a desk job. */
const COLS =
  'grid-cols-[minmax(0,1fr)_auto] ' +
  'sm:grid-cols-[34px_64px_minmax(0,1fr)_110px_104px_120px_130px_92px]'

type Tab = 'open' | 'mine' | 'late' | 'answered' | 'all'

export default function QueueClient({
  findings, summary, assignees, myEmployeeId, initialTab, highlightWalk, canDelete,
}: {
  findings: PpFindingRow[]
  summary: PpSummary
  assignees: { id: string; name: string }[]
  myEmployeeId: string | null
  initialTab: string
  highlightWalk: string | null
  /** /api/admin/bulk-delete is FULL-ADMIN only, but this page is gated on
   *  `engineering_jobs`, which engineering and production_manager also hold.
   *  Rendering Delete for them would offer a button that 403s, which reads as
   *  broken rather than forbidden. Same reasoning as /admin/rfq. */
  canDelete: boolean
}) {
  const [tab, setTab] = useState<Tab>(
    (['open', 'mine', 'late', 'answered', 'all'] as const).includes(initialTab as Tab)
      ? (initialTab as Tab)
      : 'open',
  )
  const [q, setQ] = useState('')
  // ⚠️ '__all' is FilterDropdown's own sentinel for 'no filter', not ''. Seeding
  // these with an empty string made every pill render as an ACTIVE filter with a
  // blank label, and selecting 'Any area' then set '__all' — which the predicates
  // below would have matched against as if it were a category, emptying the list.
  const [category, setCategory] = useState('__all')
  const [severity, setSeverity] = useState('__all')
  const [owner, setOwner] = useState('__all')
  const sel = useBulkSelect()

  const now = new Date()

  const counts = useMemo(() => ({
    open: findings.filter(f => f.status === 'open' || f.status === 'assigned').length,
    mine: myEmployeeId ? findings.filter(f => f.assignee_id === myEmployeeId && (f.status === 'open' || f.status === 'assigned')).length : 0,
    late: findings.filter(f => standingOf(f, now).kind === 'overdue').length,
    answered: findings.filter(f => f.status === 'answered').length,
    all: findings.length,
  }), [findings, myEmployeeId]) // eslint-disable-line react-hooks/exhaustive-deps

  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return findings.filter(f => {
      if (tab === 'open' && !(f.status === 'open' || f.status === 'assigned')) return false
      if (tab === 'mine' && (f.assignee_id !== myEmployeeId || f.status === 'closed' || f.status === 'duplicate')) return false
      if (tab === 'late' && standingOf(f, now).kind !== 'overdue') return false
      if (tab === 'answered' && f.status !== 'answered') return false
      if (category !== '__all' && f.category !== category) return false
      if (severity !== '__all' && f.severity !== severity) return false
      if (owner === '__none' && f.assignee_id) return false
      if (owner !== '__all' && owner !== '__none' && f.assignee_id !== owner) return false
      if (highlightWalk && tab === 'all' && f.walkaround_id !== highlightWalk) return false
      if (needle) {
        const hay = `${f.note} ${f.job_number} ${f.customer_name} ${f.assignee_name ?? ''} ${f.theme_title ?? ''}`.toLowerCase()
        if (!hay.includes(needle)) return false
      }
      return true
    })
  }, [findings, tab, q, category, severity, owner, myEmployeeId, highlightWalk]) // eslint-disable-line react-hooks/exhaustive-deps

  // Paginated like every other admin list. `resetKey` sends the reader back to
  // page 1 whenever the filter changes, so a tab switch never lands them on an
  // empty page 4.
  const paged = usePagedList(rows.length, { resetKey: `${tab}|${q}|${category}|${severity}|${owner}` })
  const pageRows = rows.slice(paged.start, paged.end)

  /* ⚠️ Select-all is PAGE-scoped — see the note on togglePage in
     bulk-select.tsx. Computing it from the whole filtered set means one click
     ticks the header, visibly checks the rows on screen, and quietly puts every
     off-screen row into a selection that has a Delete button on it. That
     shipped once on /admin/tickets: 10 rows checked, "Selected: 17". */
  const allSelected = pageRows.length > 0 && pageRows.every(r => sel.has(r.id))
  const someSelected = pageRows.some(r => sel.has(r.id))

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Engineering"
          title="Post-Production"
          count="What the walkaround found, who owns it, and when it is due back."
          actions={
            <>
              <Link
                href="/admin/engineering/post-production/themes"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline-strong bg-surface text-[13px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors"
              >
                <Repeat2 size={15} strokeWidth={1.75} /> Recurring
              </Link>
              <Link
                href="/admin/engineering/post-production/tags"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline-strong bg-surface text-[13px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors"
              >
                <QrCode size={15} strokeWidth={1.75} /> Shop tags
              </Link>
              <Link
                href="/admin/engineering/post-production/preflight"
                className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline-strong bg-surface text-[13px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors"
              >
                <ClipboardCheck size={15} strokeWidth={1.75} /> Pre-production
              </Link>
              {/* The one primary action on this view. */}
              <Link
                href="/admin/engineering/post-production/walk"
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all"
              >
                <Plus size={15} strokeWidth={2} /> Walk a unit
              </Link>
            </>
          }
        />

        <StatStrip>
          <Stat tone="amber" label="Open" value={summary.open} sub={`${summary.unassigned} unassigned`} />
          <Stat tone="rose" label="Past the date" value={summary.overdue} sub="two-week response" />
          <Stat tone="violet" label="Answered, waiting" value={summary.answeredWaiting} sub="needs accepting" />
          <Stat
            tone="sky"
            label="Recurring issues"
            value={summary.recurringThemes}
            sub={summary.toReview > 0 ? `${summary.toReview} match${summary.toReview === 1 ? '' : 'es'} to review` : 'confirmed groupings'}
          />
          {/* ⚠️ The median prints its COVERAGE beside it, the same rule the
              engineering report follows. A median over three closed findings is
              a number with a shape, not a measurement, and printing it bare
              invites somebody to quote it in a meeting. */}
          <Stat
            tone="emerald"
            label="Median answer"
            value={summary.medianDaysToAnswer == null ? 'Not set' : `${summary.medianDaysToAnswer}d`}
            sub={summary.medianCoverage ? `over ${summary.medianCoverage} answered` : 'nothing answered yet'}
          />
        </StatStrip>

        <Toolbar>
          <TabButtons tab={tab} setTab={setTab} counts={counts} />
          <div className="flex-1" />
          <ListSearch value={q} onChange={setQ} placeholder="Search findings…" width={220} />
          <FilterDropdown
            value={category}
            onChange={setCategory}
            allLabel="Any area"
            options={CATEGORIES.map(c => ({ value: c, label: CATEGORY_LABELS[c] }))}
          />
          <FilterDropdown
            value={severity}
            onChange={setSeverity}
            allLabel="Any severity"
            options={SEVERITIES.map(s => ({ value: s, label: SEVERITY_LABELS[s] }))}
          />
          <FilterDropdown
            value={owner}
            onChange={setOwner}
            allLabel="Anyone"
            options={[
              { value: '__none', label: 'Nobody yet' },
              ...assignees.map(a => ({ value: a.id, label: a.name })),
            ]}
          />
        </Toolbar>

        <CardTable
          cols={COLS}
          minWidth={1020}
          head={
            <>
              <SelectBox
                className="hidden sm:flex"
                checked={allSelected}
                indeterminate={someSelected}
                label={allSelected ? 'Clear selection on this page' : 'Select every finding on this page'}
                onChange={() => sel.togglePage(pageRows.map(r => r.id), !allSelected)}
              />
              <span className="hidden sm:block">Job</span>
              <span>Finding</span>
              <span className="hidden sm:block">Area</span>
              <span className="hidden sm:block">Severity</span>
              <span className="hidden sm:block">Owner</span>
              <span className="hidden sm:block">Status</span>
              <span className="hidden sm:block justify-self-end">Due</span>
            </>
          }
        >
          {rows.length === 0 ? (
            <EmptyRow>
              {findings.length === 0
                ? 'No walkarounds have been handed over yet. "Walk a unit" starts one on your phone.'
                : 'Nothing matches those filters.'}
            </EmptyRow>
          ) : (
            pageRows.map(f => {
              const standing = standingOf(f, now)
              const photos = f.media.filter(m => m.kind === 'photo').length
              const videos = f.media.filter(m => m.kind === 'video').length
              const audio = f.media.filter(m => m.kind === 'audio').length
              return (
                <Row key={f.id} cols={COLS} href={`/admin/engineering/post-production/${f.id}`} selected={sel.has(f.id)}>
                  {/* ⛔ SelectBox's input is decorative with pointer-events off —
                      it lives inside the row's <a>, so the wrapper carries the
                      semantics. Do not "simplify" it into a plain interactive
                      checkbox here. See list-checkbox-in-row-link. */}
                  <SelectBox className="hidden sm:flex" checked={sel.has(f.id)} onChange={() => sel.toggle(f.id)} />
                  <span className="hidden sm:block tabular-nums text-[13px] font-medium text-ink">
                    {f.job_number}
                  </span>

                  <span className="min-w-0">
                    <span className="block truncate text-[13px] text-ink group-hover:text-brand-ink transition-colors">
                      {findingTitle(f.note)}
                    </span>
                    <span className="flex items-center gap-2 text-[11px] text-ink-muted mt-0.5">
                      <span className="sm:hidden tabular-nums font-medium text-ink-secondary">{f.job_number}</span>
                      <span className="truncate">
                        {f.walked_by_name || 'Unknown'}
                        {f.walked_by_role && WALK_ROLE_SUFFIX[f.walked_by_role] && (
                          <span className="text-ink-faint"> · {WALK_ROLE_SUFFIX[f.walked_by_role]}</span>
                        )}
                      </span>
                      {/* A name typed into a phone on the floor is not the same
                          claim as a signed-in one, so the row says which. */}
                      {f.source === 'tag' && (
                        <QrCode size={11} className="text-ink-faint flex-shrink-0" aria-label="Filed from a shop-floor tag — name is self-declared" />
                      )}
                      <span className="text-ink-faint">·</span>
                      <span className="whitespace-nowrap">{timeAgo(f.created_at)}</span>
                      {(photos > 0 || videos > 0 || audio > 0) && (
                        <span className="flex items-center gap-1.5 text-ink-faint">
                          {photos > 0 && <span className="inline-flex items-center gap-0.5"><Camera size={11} />{photos}</span>}
                          {videos > 0 && <span className="inline-flex items-center gap-0.5"><Video size={11} />{videos}</span>}
                          {audio > 0 && <span className="inline-flex items-center gap-0.5"><Mic size={11} />{audio}</span>}
                        </span>
                      )}
                      {f.theme_id && (
                        <span
                          className="inline-flex items-center gap-0.5 text-ink-faint"
                          title={f.theme_source === 'ai' ? 'Suggested grouping — not confirmed' : `Grouped: ${f.theme_title}`}
                        >
                          <Repeat2 size={11} />
                          {f.theme_source === 'ai' && <span className="text-[10px]">?</span>}
                        </span>
                      )}
                    </span>
                  </span>

                  <span className="hidden sm:block min-w-0"><CategoryChip category={f.category} /></span>
                  <span className="hidden sm:block min-w-0"><SeverityChip severity={f.severity} /></span>

                  <span className="hidden sm:flex items-center gap-2 min-w-0">
                    {f.assignee_name ? (
                      <>
                        <ToneAvatar name={f.assignee_name} size={22} />
                        <span className="truncate text-[12.5px] text-ink-secondary">{f.assignee_name}</span>
                      </>
                    ) : (
                      <span className="text-[12.5px] text-amber-700 dark:text-amber-400">Nobody yet</span>
                    )}
                  </span>

                  <span className="hidden sm:block min-w-0"><FindingStatusChip status={f.status} /></span>

                  <span className="justify-self-end flex flex-col items-end gap-0.5">
                    <StandingChip standing={standing} />
                    <span className="hidden sm:block text-[10.5px] text-ink-faint tabular-nums">
                      {shortDate(f.due_date)}
                    </span>
                  </span>
                </Row>
              )
            })
          )}
        </CardTable>

        {rows.length > 0 && (
          <Pagination
            page={paged.page}
            perPage={paged.perPage}
            total={rows.length}
            totalPages={paged.totalPages}
            onPage={paged.setPage}
            onPerPage={paged.setPerPage}
            unit="findings"
          />
        )}

        {findings.length === 0 && (
          <div className="px-5 py-8 border-t border-hairline-soft">
            <p className="text-[12.5px] text-ink-muted leading-relaxed max-w-[62ch]">
              <ImageIcon size={13} className="inline mr-1.5 -mt-0.5" />
              A walkaround is one lap of one unit. Type the job number, then talk, photograph or film
              whatever you would have done differently. Everything saves as you go, and handing it over
              starts a two-week clock on each finding.
            </p>
          </div>
        )}
      </ListCard>

      {/* The floating bulk bar, same component and same placement as /admin/rfq
          and /admin/tickets. Delete is the only action here for now, and it is
          full-admin only — a finding is somebody's recorded criticism of a build
          with a clock on it, so removing one is a narrower grant than working
          it. Scoped roles see the bar with a count and no Delete rather than a
          button that 403s. */}
      <BulkBar count={sel.count} onClear={sel.clear}>
        {canDelete && <BulkDeleteButton entity="post_production" ids={sel.ids} onDone={sel.clear} />}
      </BulkBar>
    </ListCardPage>
  )
}

/** The tab row lives in the Toolbar rather than as links, so switching keeps the
 *  search text and filters — a person triaging with "Fit & clearance" selected
 *  should not lose it moving from Open to Past the date. */
function TabButtons({
  tab, setTab, counts,
}: {
  tab: Tab
  setTab: (t: Tab) => void
  counts: Record<Tab, number>
}) {
  const items: { key: Tab; label: string }[] = [
    { key: 'open', label: 'Open' },
    { key: 'mine', label: 'Mine' },
    { key: 'late', label: 'Past the date' },
    { key: 'answered', label: 'Answered' },
    { key: 'all', label: 'All' },
  ]
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {items.map(i => {
        const on = tab === i.key
        return (
          <button
            key={i.key}
            type="button"
            onClick={() => setTab(i.key)}
            className={`inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg text-[12.5px] transition-colors ${
              on ? 'bg-ink text-canvas font-medium' : 'text-ink-muted hover:bg-surface-strong hover:text-ink'
            }`}
          >
            {i.label}
            {counts[i.key] > 0 && (
              <span className={`text-[10.5px] tabular-nums ${on ? 'opacity-70' : 'text-ink-faint'}`}>
                {counts[i.key]}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
