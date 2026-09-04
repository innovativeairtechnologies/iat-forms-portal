'use client'

/* ────────────────────────────────────────────────────────────────────────────
   /admin/comp-review — the annual compensation review.

   The "Sample Annual Review Spreadsheet" workbook, re-read as a list: one row
   per person, editing in <CompLineDrawer> rather than in the grid. The point of
   the move is that a pay sheet is a set of RECORDS, not cells — you review a
   person, not a row of columns — so the identity column carries the name and
   tenure, the table shows only the numbers worth scanning, and everything else
   lives in the record panel.

   State lives here so the stat strip, the table and the drawer always agree.
   That matters more here than on other lists: the relative-score denominator is
   the LIVE MEAN of the recorded scores, so scoring one person moves everybody
   else's raise and every total. Recomputing from one `lines` array is what keeps
   that honest — no router.refresh() round trip mid-review.
   ──────────────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { CalendarDays, ChevronDown, Filter, Loader2, Lock, Plus, Settings2, Users } from 'lucide-react'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar, CardTable, Row,
  EmptyRow, ListSearch, FilterDropdown, Pagination, usePagedList, ToneAvatar,
} from '@/components/admin/list-card'
import { StatusPill } from '@/components/admin/list'
import {
  computeLine, constantsOf, effectiveAvg, summarize, num, tenureOf,
  scoreTone, fmtMoney, fmtRate, fmtPct, fmtAdjustment, fmtScore, fmtDelta,
  PAY_KIND_LABEL, PAY_KIND_TONE,
  type CompCycle, type CompReviewLine,
} from '@/lib/comp-review'
import CompLineDrawer from './CompLineDrawer'
import CycleSettingsDialog from './CycleSettingsDialog'
import AddPersonDialog from './AddPersonDialog'

export type RosterPerson = {
  id: string
  name: string
  hireDate: string | null
  jobTitle: string | null
  department: string | null
}

export type CycleRef = { id: string; year: number; status: string }

const COLS =
  'grid-cols-[minmax(200px,1.7fr)_90px_105px_95px_110px_110px_minmax(120px,1fr)]'

/** POST/PATCH helper.
 *
 *  Reads the body as TEXT first and parses by hand. A catch-all middleware
 *  redirect on /api/* would send `fetch` to /login, which it FOLLOWS — the
 *  caller then sees a 200 with an HTML body and happily reports success while
 *  nothing was written. Anything that isn't JSON is treated as a failure. */
async function send(url: string, method: 'POST' | 'PATCH' | 'DELETE', body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  const text = await res.text()
  let json: Record<string, unknown> | null = null
  try { json = JSON.parse(text) as Record<string, unknown> } catch { /* not JSON */ }
  if (!json) throw new Error('The server did not return a result — you may have been signed out. Reload and try again.')
  if (!res.ok || json.ok !== true) throw new Error(typeof json.error === 'string' ? json.error : 'Save failed.')
  return json
}

export default function CompReviewClient({
  cycle, cycles, initialLines, roster, canEdit, canAdmin,
}: {
  cycle: CompCycle | null
  cycles: CycleRef[]
  initialLines: CompReviewLine[]
  roster: RosterPerson[]
  canEdit: boolean
  canAdmin: boolean
}) {
  const router = useRouter()
  const [lines, setLines] = useState(initialLines)
  const [search, setSearch] = useState('')
  const [payFilter, setPayFilter] = useState('__all')
  const [scoreFilter, setScoreFilter] = useState('__all')
  const [openId, setOpenId] = useState<string | null>(null)
  const [adding, setAdding] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const isFinal = cycle?.status === 'final'
  const editable = canEdit && !!cycle && !isFinal

  const constants = useMemo(() => constantsOf(cycle), [cycle])
  // The denominator. Live while the cycle is draft, frozen once finalized.
  const avg = useMemo(() => effectiveAvg(cycle, lines), [cycle, lines])
  const summary = useMemo(() => summarize(lines, constants, avg), [lines, constants, avg])

  const hireDates = useMemo(() => new Map(roster.map((p) => [p.id, p.hireDate])), [roster])

  const rows = useMemo(
    () => lines.map((line) => ({
      line,
      computed: computeLine(line, constants, avg),
      tenure: tenureOf(line, line.employee_id ? hireDates.get(line.employee_id) : null),
    })),
    [lines, constants, avg, hireDates],
  )

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(({ line, computed }) => {
      if (payFilter !== '__all' && computed.kind !== payFilter) return false
      if (scoreFilter === 'scored' && num(line.score) === null) return false
      if (scoreFilter === 'unscored' && num(line.score) !== null) return false
      if (!q) return true
      return line.person_name.toLowerCase().includes(q)
    })
  }, [rows, search, payFilter, scoreFilter])

  const resetKey = `${search}|${payFilter}|${scoreFilter}|${cycle?.id ?? ''}`
  const { page, setPage, perPage, setPerPage, totalPages, start, end } =
    usePagedList(filtered.length, { resetKey, initialPerPage: 25 })

  const open = openId ? rows.find((r) => r.line.id === openId) ?? null : null

  const applyLine = (saved: CompReviewLine) =>
    setLines((prev) => prev.map((l) => (l.id === saved.id ? saved : l)))
  const addLine = (created: CompReviewLine) =>
    setLines((prev) => [...prev, created].sort((a, b) => a.person_name.localeCompare(b.person_name)))
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.id !== id))

  const alreadyOnReview = useMemo(
    () => new Set(lines.map((l) => l.employee_id).filter(Boolean) as string[]),
    [lines],
  )

  // ── No cycle yet ───────────────────────────────────────────────────────────
  if (!cycle) {
    return (
      <ListCardPage>
        <ListCard>
          <CardHead overline="HR" title="Compensation Review" count="No review has been started yet." />
          <StartCycle canEdit={canEdit} rosterCount={roster.length} onStarted={() => router.refresh()} />
        </ListCard>
      </ListCardPage>
    )
  }

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="HR"
          title="Compensation Review"
          count={
            <>
              {summary.scored} of {summary.people} scored
              {' · '}
              {isFinal
                ? `${cycle.year} is finalized — scores frozen at an average of ${fmtScore(cycle.avg_score_final)}`
                : avg === null
                  ? 'No scores recorded yet, so no raises are calculated'
                  : `Raises are relative to the current average score of ${fmtScore(avg)}`}
              {summary.missingPay > 0 && ` · ${summary.missingPay} scored with no pay on file`}
            </>
          }
          actions={
            <>
              {isFinal && <StatusPill tone="slate" icon={<Lock size={11} />}>Finalized</StatusPill>}
              <YearSelect
                value={cycle.year}
                options={cycles}
                onChange={(y) => { setOpenId(null); router.push(`/admin/comp-review?year=${y}`) }}
              />
              {canAdmin && (
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline text-[13px] font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors"
                >
                  <Settings2 size={15} />
                  Settings
                </button>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <Plus size={15} />
                  Add person
                </button>
              )}
            </>
          }
        />

        <StatStrip>
          <Stat tone="slate" label="People" value={summary.people} sub={`${summary.scored} reviewed`} />
          <Stat
            tone="sky"
            label="Average score"
            value={avg === null ? '—' : fmtScore(avg)}
            sub={avg === null ? 'The raise divisor' : isFinal ? 'Frozen at finalize' : `Divisor · from ${summary.scored} score${summary.scored === 1 ? '' : 's'}`}
          />
          <Stat tone="slate" label="Current payroll" value={fmtMoney(summary.currentPayroll)} sub="Annualized" />
          <Stat tone="violet" label="New payroll" value={fmtMoney(summary.newPayroll)} sub="Unscored held at current pay" />
          <Stat
            tone={summary.payrollDelta > 0 ? 'emerald' : 'slate'}
            label="Increase"
            value={fmtDelta(summary.payrollDelta)}
            sub={summary.payrollDeltaPct === null ? 'No payroll on file' : `${fmtPct(summary.payrollDeltaPct)} of current`}
          />
          <Stat tone="amber" label="Bonuses" value={fmtMoney(summary.bonusTotal)} sub="Not part of the raise math" />
        </StatStrip>

        <Toolbar>
          <ListSearch value={search} onChange={setSearch} placeholder="Search people…" />
          <FilterDropdown
            icon={Users}
            allLabel="Hourly & salaried"
            value={payFilter}
            onChange={setPayFilter}
            options={[
              { value: 'hourly', label: 'Hourly' },
              { value: 'salaried', label: 'Salaried' },
              { value: 'none', label: 'No pay on file' },
            ]}
          />
          <FilterDropdown
            icon={Filter}
            allLabel="Scored & unscored"
            value={scoreFilter}
            onChange={setScoreFilter}
            options={[
              { value: 'scored', label: 'Scored' },
              { value: 'unscored', label: 'Not scored yet' },
            ]}
          />
        </Toolbar>

        <CardTable
          cols={COLS}
          minWidth={1040}
          head={
            <>
              <span>Employee</span>
              <span className="justify-self-end">Score</span>
              <span className="justify-self-end">Current</span>
              <span className="justify-self-end">Adj %</span>
              <span className="justify-self-end">Increase</span>
              <span className="justify-self-end">New rate</span>
              <span className="justify-self-end">New annual</span>
            </>
          }
        >
          {filtered.length === 0 ? (
            <EmptyRow>
              {lines.length === 0
                ? editable
                  ? 'Nobody on this review yet. “Add person” pulls from the staff list.'
                  : 'Nobody on this review yet.'
                : 'Nothing matches that filter.'}
            </EmptyRow>
          ) : (
            filtered.slice(start, end).map(({ line, computed, tenure }) => (
              <Row key={line.id} cols={COLS} onClick={() => setOpenId(line.id)} selected={line.id === openId}>
                <span className="flex items-center gap-2.5 min-w-0">
                  <ToneAvatar name={line.person_name} size={28} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink truncate">{line.person_name}</span>
                    <span className="block text-[11.5px] text-ink-muted truncate">
                      {[tenure, PAY_KIND_LABEL[computed.kind]].filter(Boolean).join(' · ')}
                    </span>
                  </span>
                </span>

                <span className="justify-self-end">
                  {computed.relScore === null
                    ? num(line.score) === null
                      ? <span className="text-[12px] text-ink-faint">—</span>
                      : <StatusPill tone="slate">{fmtScore(line.score)}</StatusPill>
                    : <StatusPill tone={scoreTone(computed.relScore)}>{fmtScore(line.score)}</StatusPill>}
                </span>

                <span className="justify-self-end text-[12.5px] tabular-nums text-ink-secondary">
                  {computed.kind === 'hourly'
                    ? fmtRate(num(line.per_hour))
                    : computed.kind === 'salaried'
                      ? fmtMoney(num(line.gross_annual))
                      : <span className="text-ink-faint">—</span>}
                </span>

                <span className="justify-self-end text-[12.5px] tabular-nums text-ink-secondary">
                  {fmtAdjustment(computed.adjustment)}
                </span>

                <span className="justify-self-end text-[12.5px] tabular-nums text-ink-secondary">
                  {computed.kind === 'hourly' ? fmtRate(computed.hourlyIncrease) : fmtDelta(computed.annualIncrease)}
                </span>

                <span className="justify-self-end text-[12.5px] tabular-nums text-ink-secondary">
                  {computed.newHourly === null ? <span className="text-ink-faint">—</span> : fmtRate(computed.newHourly)}
                </span>

                <span className="justify-self-end text-[12.5px] tabular-nums font-medium text-ink">
                  {computed.newAnnual === null
                    ? computed.currentAnnual === null
                      ? <span className="font-normal text-ink-faint">—</span>
                      : <span className="font-normal text-ink-muted">{fmtMoney(computed.currentAnnual)}</span>
                    : fmtMoney(computed.newAnnual)}
                </span>
              </Row>
            ))
          )}
        </CardTable>

        <Pagination
          page={page}
          perPage={perPage}
          total={filtered.length}
          totalPages={totalPages}
          onPage={setPage}
          onPerPage={setPerPage}
          unit="people"
        />
      </ListCard>

      {open && (
        <CompLineDrawer
          line={open.line}
          tenure={open.tenure}
          year={cycle.year}
          constants={constants}
          avg={avg}
          // Everyone else's recorded scores, so the drawer can show the average
          // this edit would produce rather than the one currently saved.
          otherScores={lines
            .filter((l) => l.id !== open.line.id)
            .map((l) => num(l.score))
            .filter((s): s is number => s !== null)}
          editable={editable}
          isFinal={isFinal}
          onClose={() => setOpenId(null)}
          onSaved={(saved) => applyLine(saved)}
          onDeleted={() => { removeLine(open.line.id); setOpenId(null) }}
        />
      )}

      {adding && (
        <AddPersonDialog
          cycleId={cycle.id}
          roster={roster}
          taken={alreadyOnReview}
          onClose={() => setAdding(false)}
          onAdded={(created) => { addLine(created); setAdding(false) }}
        />
      )}

      {settingsOpen && (
        <CycleSettingsDialog
          cycle={cycle}
          avg={avg}
          scoredCount={summary.scored}
          onClose={() => setSettingsOpen(false)}
          onSaved={() => { setSettingsOpen(false); router.refresh() }}
        />
      )}
    </ListCardPage>
  )
}

// ── Year selector ────────────────────────────────────────────────────────────

function YearSelect({ value, options, onChange }: { value: number; options: CycleRef[]; onChange: (y: number) => void }) {
  if (options.length <= 1) {
    return (
      <span className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline text-[13px] font-medium text-ink-secondary tabular-nums">
        <CalendarDays size={15} className="text-ink-muted" />
        {value}
      </span>
    )
  }
  return (
    <label className="relative inline-flex items-center">
      <CalendarDays size={15} className="absolute left-3 text-ink-muted pointer-events-none" />
      <select
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="appearance-none h-9 pl-9 pr-8 rounded-lg border border-hairline bg-surface text-[13px] font-medium text-ink-secondary tabular-nums outline-none focus:border-brand transition-colors"
        aria-label="Review year"
      >
        {options.map((c) => (
          <option key={c.id} value={c.year}>{c.year}{c.status === 'final' ? ' (final)' : ''}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-2.5 text-ink-muted pointer-events-none" />
    </label>
  )
}

// ── Empty state ──────────────────────────────────────────────────────────────

function StartCycle({ canEdit, rosterCount, onStarted }: { canEdit: boolean; rosterCount: number; onStarted: () => void }) {
  const [year, setYear] = useState(new Date().getFullYear())
  const [seed, setSeed] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setBusy(true); setError(null)
    try {
      await send('/api/admin/comp-review/cycles', 'POST', { year, seedFromEmployees: seed })
      onStarted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the review.')
      setBusy(false)
    }
  }

  return (
    <div className="px-5 py-10 text-center">
      <p className="text-[14px] text-ink-secondary max-w-md mx-auto">
        A review cycle holds one year of pay, scores and merit increases — and the
        constants the raise math uses.
      </p>
      {canEdit ? (
        <>
          <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-24 h-9 px-2.5 text-[13px] text-center rounded-lg bg-surface-soft border border-hairline text-ink outline-none focus:border-brand transition-colors tabular-nums"
              aria-label="Review year"
            />
            <button
              type="button"
              onClick={start}
              disabled={busy}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              Start the {year} review
            </button>
          </div>
          <label className="mt-4 inline-flex items-center gap-2 text-[12.5px] text-ink-muted">
            <input type="checkbox" checked={seed} onChange={(e) => setSeed(e.target.checked)} className="accent-[var(--brand)]" />
            Add all {rosterCount} staff to start (customers excluded)
          </label>
          {error && <p className="mt-4 text-[12.5px] text-rose-500">{error}</p>}
        </>
      ) : (
        <p className="mt-4 text-[12.5px] text-ink-faint">An admin or HR can start one.</p>
      )}
    </div>
  )
}

export { send }
