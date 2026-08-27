'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMemo, useState, useTransition } from 'react'
import { ArrowLeft, ChevronDown, Loader2, Sparkles, TrendingUp } from 'lucide-react'
import { ListCardPage, ListCard, CardHead, StatStrip, Stat } from '@/components/admin/list-card'
import {
  CATEGORY_LABELS, RECURRENCE_THRESHOLD, THEME_STATUSES, THEME_STATUS_LABELS,
  findingTitle, shortDate, standingOf,
  type PpFindingRow, type PpThemeRow, type ThemeStatus,
} from '@/lib/post-production'
import { CategoryChip, FindingStatusChip, StandingChip, ThemeStatusChip } from '../ui'

const BTN =
  'inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg border border-hairline text-[12.5px] font-medium ' +
  'text-ink-secondary hover:text-ink hover:border-hairline-strong transition-colors disabled:opacity-40'

export default function ThemesClient({
  themes, findings, openId,
}: {
  themes: PpThemeRow[]
  findings: PpFindingRow[]
  openId: string | null
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [open, setOpen] = useState<string | null>(openId)
  const [busy, setBusy] = useState('')

  const byTheme = useMemo(() => {
    const m = new Map<string, PpFindingRow[]>()
    for (const f of findings) {
      if (!f.theme_id) continue
      m.set(f.theme_id, [...(m.get(f.theme_id) ?? []), f])
    }
    return m
  }, [findings])

  // Worst first: what keeps happening and is still happening. A board sorted by
  // date would bury the thing raised twelve times under this morning's typo.
  const sorted = useMemo(() => [...themes].sort((a, b) => {
    const rank = (t: PpThemeRow) => (t.status === 'open' ? 0 : t.status === 'accepted' ? 1 : 2)
    if (rank(a) !== rank(b)) return rank(a) - rank(b)
    if (b.confirmed !== a.confirmed) return b.confirmed - a.confirmed
    return (b.lastSeen ?? '').localeCompare(a.lastSeen ?? '')
  }), [themes])

  const recurring = themes.filter(t => t.status === 'open' && t.confirmed >= RECURRENCE_THRESHOLD)
  const toReview = themes.reduce((n, t) => n + t.suggested, 0)
  const stillOpen = themes.reduce((n, t) => n + t.stillOpen, 0)

  const setStatus = async (id: string, status: ThemeStatus) => {
    setBusy(id)
    await fetch(`/api/admin/post-production/themes/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    setBusy('')
    startTransition(() => router.refresh())
  }

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Post-production"
          title="Recurring issues"
          count="What keeps coming back, and how many jobs it has cost."
          actions={
            <Link
              href="/admin/engineering/post-production"
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline-strong bg-surface text-[13px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors"
            >
              <ArrowLeft size={15} strokeWidth={1.75} /> Findings
            </Link>
          }
        />

        <StatStrip>
          <Stat tone="rose" label="Still recurring" value={recurring.length} sub={`raised ${RECURRENCE_THRESHOLD}+ times`} />
          <Stat tone="amber" label="Findings still open" value={stillOpen} sub="inside those groups" />
          <Stat tone="slate" label="Suggested, unreviewed" value={toReview} sub="not in any count" />
          <Stat tone="emerald" label="Settled" value={themes.filter(t => t.status !== 'open').length} sub="resolved or accepted" />
        </StatStrip>

        {/* 🔴 The honesty note is part of the feature, not a disclaimer bolted on.
            The whole value of "raised twelve times" is that somebody can check
            it, so the screen states what is and is not in the number. */}
        <div className="px-5 py-3 border-b border-hairline bg-surface-soft">
          <p className="text-[11.5px] text-ink-muted leading-relaxed max-w-[86ch]">
            <Sparkles size={11} className="inline -mt-0.5 mr-1" />
            Counts are groupings a person confirmed. Matches suggested automatically are listed
            separately and never added in — a number worth acting on has to survive being checked.
          </p>
        </div>

        {sorted.length === 0 ? (
          <div className="px-5 py-16 text-center">
            <p className="text-[14px] text-ink-secondary">Nothing has been raised twice yet.</p>
            <p className="mt-1.5 text-[12.5px] text-ink-muted max-w-[52ch] mx-auto leading-relaxed">
              Groups appear here once the same issue turns up on more than one unit. An empty board is
              the goal, not a gap.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-hairline-soft">
            {sorted.map(t => {
              const rows = byTheme.get(t.id) ?? []
              const isOpen = open === t.id
              return (
                <div key={t.id}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : t.id)}
                    className="w-full text-left px-5 py-3.5 flex items-start gap-3 hover:bg-surface-soft transition-colors"
                  >
                    <ChevronDown
                      size={16}
                      className={`text-ink-faint mt-0.5 flex-shrink-0 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 flex-wrap">
                        <span className="text-[14px] font-medium text-ink">{t.title}</span>
                        <ThemeStatusChip status={t.status} />
                        <CategoryChip category={t.category} />
                      </span>
                      {t.summary && (
                        <span className="block mt-1 text-[12.5px] text-ink-muted leading-relaxed max-w-[78ch]">
                          {t.summary}
                        </span>
                      )}
                      <span className="block mt-1.5 text-[11.5px] text-ink-faint">
                        {t.jobs.length > 0
                          ? <>Jobs <span className="tabular-nums text-ink-muted">{t.jobs.join(', ')}</span></>
                          : 'No confirmed findings yet'}
                        {t.firstSeen && <> · first {shortDate(t.firstSeen)}, last {shortDate(t.lastSeen)}</>}
                      </span>
                    </span>

                    <span className="flex-shrink-0 text-right">
                      <span className="flex items-center justify-end gap-1.5 text-[18px] font-semibold text-ink tabular-nums">
                        {t.confirmed >= RECURRENCE_THRESHOLD && <TrendingUp size={14} className="text-rose-500" />}
                        {t.confirmed}×
                      </span>
                      <span className="block text-[10.5px] text-ink-faint">
                        {t.stillOpen > 0 ? `${t.stillOpen} still open` : 'all answered'}
                      </span>
                      {t.suggested > 0 && (
                        <span className="block text-[10.5px] text-ink-faint mt-0.5">
                          +{t.suggested} to review
                        </span>
                      )}
                    </span>
                  </button>

                  {isOpen && (
                    <div className="px-5 pb-4 pl-12">
                      <div className="flex items-center gap-2 flex-wrap mb-3">
                        {THEME_STATUSES.map(s => (
                          <button
                            key={s}
                            type="button"
                            disabled={busy === t.id || t.status === s}
                            onClick={() => setStatus(t.id, s)}
                            className={`${BTN} ${t.status === s ? 'bg-surface-strong text-ink' : ''}`}
                          >
                            {busy === t.id && <Loader2 size={13} className="animate-spin" />}
                            {THEME_STATUS_LABELS[s]}
                          </button>
                        ))}
                        <span className="text-[11.5px] text-ink-faint">
                          {/* The reopen rule stated where somebody will read it. */}
                          Marking it resolved stops it being carried into pre-production — a new
                          finding on it reopens it automatically.
                        </span>
                      </div>

                      {rows.length === 0 ? (
                        <p className="text-[12.5px] text-ink-muted">Nothing is grouped under this yet.</p>
                      ) : (
                        <div className="border border-hairline rounded-lg overflow-hidden divide-y divide-hairline-soft">
                          {rows.map(f => (
                            <Link
                              key={f.id}
                              href={`/admin/engineering/post-production/${f.id}`}
                              className="flex items-center gap-3 px-3.5 py-2.5 hover:bg-surface-soft transition-colors"
                            >
                              <span className="tabular-nums text-[12.5px] font-medium text-ink w-12 flex-shrink-0">
                                {f.job_number}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-[13px] text-ink">{findingTitle(f.note)}</span>
                                <span className="block text-[11px] text-ink-muted">
                                  {shortDate(f.created_at)} · {f.assignee_name ?? 'nobody yet'}
                                  {f.theme_source === 'ai' && (
                                    <span className="ml-1.5 text-ink-faint">· suggested, unconfirmed</span>
                                  )}
                                </span>
                              </span>
                              <span className="flex-shrink-0 hidden sm:block"><FindingStatusChip status={f.status} /></span>
                              <span className="flex-shrink-0"><StandingChip standing={standingOf(f)} /></span>
                            </Link>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </ListCard>
    </ListCardPage>
  )
}
