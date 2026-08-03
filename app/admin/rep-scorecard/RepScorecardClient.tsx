'use client'

/* ────────────────────────────────────────────────────────────────────────────
   /admin/rep-scorecard — the board. Ported from the IAT_Rep_Scorecard workbook:
   the "Individual Reps" tab becomes the Reps list, "Firm Rollup" becomes the
   Firms tab, and "Summary" becomes the stat strip above both. Scoring itself
   happens in <ScoreDrawer> (the house record-panel pattern).

   State lives here so the two tabs, the stat strip and the drawer always agree:
   a save patches the local card list and every rollup recomputes from it — no
   router.refresh() round trip mid-review.
   ──────────────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, ChevronDown, Gauge, Plus } from 'lucide-react'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar, CardTable, Row,
  EmptyRow, ListSearch, FilterDropdown, Pagination, usePagedList, ToneAvatar, Meter,
} from '@/components/admin/list-card'
import { StatusPill } from '@/components/admin/list'
import { Tabs } from '@/components/ui/Tabs'
import type { Contact } from '@/lib/supabase'
import type { RepPipeline, PipelineCandidate } from '@/lib/rep-pipeline'
import {
  buildScoredRep, rollupFirms, summarize, periodLabel, fmtMoney, fmtPct, fmtCoverage,
  TIERS, TIER_TONE, GRADE_TONE, REP_STATUSES, REP_STATUS_TONE, MAX_TOTAL,
  type RepScorecard, type Tier, type RepStatus,
} from '@/lib/rep-scorecard'
import ScoreDrawer from './ScoreDrawer'
import AddRepDialog from './AddRepDialog'

export type Firm = { id: string; name: string }

const REP_COLS = 'grid-cols-[minmax(190px,1.5fr)_minmax(130px,1fr)_110px_minmax(150px,1.1fr)_90px_110px_100px]'
const FIRM_COLS = 'grid-cols-[minmax(190px,1.6fr)_90px_minmax(140px,1fr)_130px_70px_110px_110px_100px]'

export default function RepScorecardClient({
  firms, initialReps, initialCards, pipelineByRep, candidates, period, periods, canEdit,
}: {
  firms: Firm[]
  initialReps: Contact[]
  initialCards: RepScorecard[]
  pipelineByRep: Record<string, RepPipeline>
  candidates: PipelineCandidate[]
  period: string
  periods: string[]
  canEdit: boolean
}) {
  const router = useRouter()
  const [reps, setReps] = useState(initialReps)
  const [cards, setCards] = useState(initialCards)
  const [tab, setTab] = useState<'reps' | 'firms'>('reps')
  const [search, setSearch] = useState('')
  const [firmFilter, setFirmFilter] = useState('__all')
  const [tierFilter, setTierFilter] = useState('__all')
  const [statusFilter, setStatusFilter] = useState('__all')
  const [openRepId, setOpenRepId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)

  const firmName = useMemo(() => new Map(firms.map((f) => [f.id, f.name])), [firms])

  /** Every rep joined to their card FOR THE SELECTED PERIOD, scored. */
  const scoredReps = useMemo(() => {
    const byRep = new Map<string, RepScorecard>()
    for (const c of cards) if (c.period === period) byRep.set(c.contact_id, c)
    return reps.map((r) => buildScoredRep(r, firmName.get(r.company_id) ?? 'Unknown firm', byRep.get(r.id) ?? null))
  }, [reps, cards, period, firmName])

  const summary = useMemo(() => summarize(scoredReps), [scoredReps])
  const rollup = useMemo(() => rollupFirms(scoredReps, firms), [scoredReps, firms])

  const filteredReps = useMemo(() => {
    const q = search.trim().toLowerCase()
    return scoredReps.filter((r) => {
      if (firmFilter !== '__all' && r.companyId !== firmFilter) return false
      if (statusFilter !== '__all' && r.repStatus !== statusFilter) return false
      if (tierFilter !== '__all') {
        if (tierFilter === '__unscored' ? r.scored.tier !== null : r.scored.tier !== tierFilter) return false
      }
      if (!q) return true
      return [r.name, r.firmName, r.territory, r.title].filter(Boolean).join(' ').toLowerCase().includes(q)
    })
  }, [scoredReps, search, firmFilter, tierFilter, statusFilter])

  // Firms with nobody on them are noise on a rollup, so they're hidden — EXCEPT
  // when one is the active filter, where hiding it would leave an empty table
  // with no explanation for why.
  const filteredFirms = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rollup.filter((f) => {
      if (firmFilter !== '__all') return f.companyId === firmFilter
      if (f.people === 0) return false
      if (!q) return true
      return f.firmName.toLowerCase().includes(q)
    })
  }, [rollup, search, firmFilter])

  const resetKey = `${tab}|${search}|${firmFilter}|${tierFilter}|${statusFilter}|${period}`
  const rowCount = tab === 'reps' ? filteredReps.length : filteredFirms.length
  const { page, setPage, perPage, setPerPage, totalPages, start, end } = usePagedList(rowCount, { resetKey, initialPerPage: 25 })

  const openRep = openRepId ? scoredReps.find((r) => r.id === openRepId) ?? null : null

  /** Replace (or insert) a saved card, keyed on rep + period. */
  const applySavedCard = (card: RepScorecard) => {
    setCards((prev) => {
      const i = prev.findIndex((c) => c.contact_id === card.contact_id && c.period === card.period)
      if (i === -1) return [...prev, card]
      const next = [...prev]
      next[i] = card
      return next
    })
  }

  const changePeriod = (next: string) => {
    // Close any open record first. router.push is a SAME-ROUTE navigation, so
    // this component (and the drawer's working copy of the old period's scores)
    // survives it — the drawer would end up showing Q2's draft under a Q3
    // header. The scrim makes this unreachable today; it's a cheap guard against
    // that stopping being true.
    setOpenRepId(null)
    // Period is a URL param so a review is linkable and a refresh keeps it.
    router.push(`/admin/rep-scorecard?period=${encodeURIComponent(next)}`)
  }

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Sales"
          title="Rep Scorecard"
          count={`${summary.scored} of ${summary.reps} rep${summary.reps === 1 ? '' : 's'} scored for ${periodLabel(period)} · ten health signals, 0–${MAX_TOTAL}`}
          actions={
            <>
              <PeriodSelect value={period} options={periods} onChange={changePeriod} />
              {canEdit && (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Plus size={15} />
                  Add rep
                </button>
              )}
            </>
          }
        />

        <StatStrip>
          <Stat
            tone="sky"
            label="Avg score"
            value={summary.avgTotal === null ? '—' : `${summary.avgTotal}`}
            sub={summary.avgScorePct === null ? 'Nobody scored yet' : `${fmtPct(summary.avgScorePct)} of ${MAX_TOTAL}`}
          />
          <Stat tone="emerald" label="Platinum / Gold" value={summary.byTier['Platinum / Gold']} sub="Invest and grow" />
          <Stat tone="amber" label="Silver" value={summary.byTier.Silver} sub="Targeted coaching" />
          <Stat tone="rose" label="Developing / At-risk" value={summary.byTier['Developing / At-risk']} sub="Rebuild the basics" />
          <Stat
            tone="slate"
            label="Booked / goal"
            value={summary.goal > 0 ? fmtPct(summary.pctToGoal) : '—'}
            sub={summary.goal > 0 ? `${fmtMoney(summary.booked, { compact: true })} of ${fmtMoney(summary.goal, { compact: true })}` : 'No goals entered'}
          />
        </StatStrip>

        <Tabs
          tabs={[
            { key: 'reps' as const, label: 'Reps', count: scoredReps.length },
            { key: 'firms' as const, label: 'Firms', count: rollup.filter((f) => f.people > 0).length },
          ]}
          active={tab}
          onChange={setTab}
        />

        <Toolbar>
          <ListSearch value={search} onChange={setSearch} placeholder={tab === 'reps' ? 'Search reps…' : 'Search firms…'} />
          <FilterDropdown
            icon={Building2}
            allLabel="All firms"
            value={firmFilter}
            onChange={setFirmFilter}
            options={firms.map((f) => ({ value: f.id, label: f.name }))}
          />
          {tab === 'reps' && (
            <>
              <FilterDropdown
                icon={Gauge}
                allLabel="All tiers"
                value={tierFilter}
                onChange={setTierFilter}
                options={[...TIERS.map((t) => ({ value: t, label: t })), { value: '__unscored', label: 'Not scored yet' }]}
              />
              <FilterDropdown
                allLabel="All statuses"
                value={statusFilter}
                onChange={setStatusFilter}
                options={REP_STATUSES.map((s) => ({ value: s, label: s }))}
              />
            </>
          )}
        </Toolbar>

        {tab === 'reps' ? (
          <CardTable
            cols={REP_COLS}
            minWidth={1060}
            head={
              <>
                <span>Rep</span>
                <span>Firm</span>
                <span>Status</span>
                <span>Score</span>
                <span className="justify-self-end">Grade</span>
                <span className="justify-self-end">% to goal</span>
                <span className="justify-self-end">Coverage</span>
              </>
            }
          >
            {filteredReps.length === 0 ? (
              <EmptyRow>
                {scoredReps.length === 0
                  ? canEdit
                    ? 'No reps on the board yet. “Add rep” starts the roster — names already quoting in DryWare are offered as you type.'
                    : 'No reps on the board yet.'
                  : 'Nothing matches that filter.'}
              </EmptyRow>
            ) : (
              filteredReps.slice(start, end).map((r) => (
                <Row key={r.id} cols={REP_COLS} onClick={() => setOpenRepId(r.id)} selected={r.id === openRepId}>
                  <span className="flex items-center gap-2.5 min-w-0">
                    <ToneAvatar name={r.name} size={28} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink truncate">{r.name}</span>
                      <span className="block text-[11.5px] text-ink-muted truncate">
                        {[r.title, r.territory].filter(Boolean).join(' · ') || 'No title or territory'}
                      </span>
                    </span>
                  </span>
                  <span className="text-[12.5px] text-ink-secondary truncate">{r.firmName}</span>
                  <span>
                    {r.repStatus
                      ? <StatusPill tone={REP_STATUS_TONE[r.repStatus as RepStatus] ?? 'slate'}>{r.repStatus}</StatusPill>
                      : <span className="text-[12px] text-ink-faint">—</span>}
                  </span>
                  <span className="min-w-0">
                    {r.scored.total === null ? (
                      <span className="text-[12px] text-ink-faint">Not scored</span>
                    ) : (
                      <span className="flex items-center gap-2.5">
                        <Meter
                          value={Math.round((r.scored.total / MAX_TOTAL) * 100)}
                          tone={TIER_TONE[r.scored.tier as Tier]}
                          showValue={false}
                        />
                        <span className="text-[12.5px] tabular-nums text-ink-secondary">
                          {r.scored.total}<span className="text-ink-faint">/{MAX_TOTAL}</span>
                        </span>
                        {r.scored.scoredCount < 10 && (
                          <span
                            className="text-[10.5px] tabular-nums text-ink-faint"
                            title={`Only ${r.scored.scoredCount} of the ten signals are scored — the total is still out of ${MAX_TOTAL}.`}
                          >
                            {r.scored.scoredCount}/10
                          </span>
                        )}
                      </span>
                    )}
                  </span>
                  <span className="justify-self-end">
                    {r.scored.grade
                      ? <StatusPill tone={GRADE_TONE[r.scored.grade]}>{r.scored.grade}</StatusPill>
                      : <span className="text-[12px] text-ink-faint">—</span>}
                  </span>
                  <span className="justify-self-end text-[12.5px] tabular-nums text-ink-secondary">{fmtPct(r.pctToGoal)}</span>
                  <span className="justify-self-end text-[12.5px] tabular-nums text-ink-secondary">{fmtCoverage(r.coverage)}</span>
                </Row>
              ))
            )}
          </CardTable>
        ) : (
          <CardTable
            cols={FIRM_COLS}
            minWidth={1100}
            head={
              <>
                <span>Firm</span>
                <span className="justify-self-end">Scored</span>
                <span>Avg score</span>
                <span>Tier</span>
                <span className="justify-self-end">Grade</span>
                <span className="justify-self-end">Mix</span>
                <span className="justify-self-end">% to goal</span>
                <span className="justify-self-end">Pipeline</span>
              </>
            }
          >
            {filteredFirms.length === 0 ? (
              <EmptyRow>
                {rollup.every((f) => f.people === 0)
                  ? 'No reps on the board yet — firms appear here once they have people.'
                  : 'Nothing matches that filter.'}
              </EmptyRow>
            ) : (
              filteredFirms.slice(start, end).map((f) => (
                <Row
                  key={f.companyId}
                  cols={FIRM_COLS}
                  onClick={() => { setFirmFilter(f.companyId); setTab('reps') }}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    <ToneAvatar name={f.firmName} size={28} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink truncate">{f.firmName}</span>
                      <span className="block text-[11.5px] text-ink-muted truncate">
                        {f.people} rep{f.people === 1 ? '' : 's'}
                      </span>
                    </span>
                  </span>
                  <span className="justify-self-end text-[12.5px] tabular-nums text-ink-secondary">
                    {f.scored}<span className="text-ink-faint">/{f.people}</span>
                  </span>
                  <span className="min-w-0">
                    {f.avgTotal === null ? (
                      <span className="text-[12px] text-ink-faint">Not scored</span>
                    ) : (
                      <span className="flex items-center gap-2.5">
                        <Meter value={Math.round((f.avgTotal / MAX_TOTAL) * 100)} tone={TIER_TONE[f.tier as Tier]} showValue={false} />
                        <span className="text-[12.5px] tabular-nums text-ink-secondary">
                          {f.avgTotal.toFixed(1)}<span className="text-ink-faint">/{MAX_TOTAL}</span>
                        </span>
                      </span>
                    )}
                  </span>
                  <span>
                    {f.tier
                      ? <StatusPill tone={TIER_TONE[f.tier]}>{f.tier}</StatusPill>
                      : <span className="text-[12px] text-ink-faint">—</span>}
                  </span>
                  <span className="justify-self-end">
                    {f.grade
                      ? <StatusPill tone={GRADE_TONE[f.grade]}>{f.grade}</StatusPill>
                      : <span className="text-[12px] text-ink-faint">—</span>}
                  </span>
                  <span
                    className="justify-self-end text-[12px] tabular-nums text-ink-muted"
                    title="Platinum / Silver / Developing"
                  >
                    <span className="text-emerald-600 dark:text-emerald-400">{f.platinum}</span>
                    {' / '}
                    <span className="text-amber-600 dark:text-amber-400">{f.silver}</span>
                    {' / '}
                    <span className="text-rose-500 dark:text-rose-400">{f.developing}</span>
                  </span>
                  <span className="justify-self-end text-[12.5px] tabular-nums text-ink-secondary">{fmtPct(f.pctToGoal)}</span>
                  <span className="justify-self-end text-[12.5px] tabular-nums text-ink-secondary">
                    {f.pipeline > 0 ? fmtMoney(f.pipeline, { compact: true }) : '—'}
                  </span>
                </Row>
              ))
            )}
          </CardTable>
        )}

        <Pagination
          page={page} perPage={perPage} total={rowCount} totalPages={totalPages}
          onPage={setPage} onPerPage={setPerPage} unit={tab === 'reps' ? 'reps' : 'firms'}
        />
      </ListCard>

      {openRep && (
        <ScoreDrawer
          rep={openRep}
          period={period}
          history={cards.filter((c) => c.contact_id === openRep.id)}
          pipeline={pipelineByRep[openRep.id] ?? null}
          firms={firms}
          canEdit={canEdit}
          onClose={() => setOpenRepId(null)}
          onSaved={applySavedCard}
          onRepUpdated={(rep) => setReps((prev) => prev.map((r) => (r.id === rep.id ? rep : r)))}
          onRepDeleted={(id) => {
            setReps((prev) => prev.filter((r) => r.id !== id))
            setCards((prev) => prev.filter((c) => c.contact_id !== id))
            setOpenRepId(null)
          }}
        />
      )}

      {adding && (
        <AddRepDialog
          firms={firms}
          candidates={candidates}
          onClose={() => setAdding(false)}
          onAdded={(rep) => {
            setReps((prev) => [...prev, rep].sort((a, b) => a.name.localeCompare(b.name)))
            setAdding(false)
            setOpenRepId(rep.id)
            // The new rep's DryWare pipeline is resolved server-side, so pull a
            // fresh page in the background — the drawer works either way, it
            // just gains the "DryWare says" assist once this lands.
            router.refresh()
          }}
        />
      )}
    </ListCardPage>
  )
}

/** Quarter picker. Sits in the card head beside the primary action. */
function PeriodSelect({ value, options, onChange }: { value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="relative inline-flex items-center">
      <span className="sr-only">Review period</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 pl-3 pr-8 rounded-lg bg-surface-soft border border-hairline text-[13px] font-medium text-ink-secondary outline-none focus:border-brand cursor-pointer appearance-none transition-colors"
      >
        {options.map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
      </select>
      <ChevronDown size={13} className="pointer-events-none absolute right-2.5 text-ink-muted" />
    </label>
  )
}
