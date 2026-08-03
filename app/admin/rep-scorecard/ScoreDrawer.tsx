'use client'

/* ────────────────────────────────────────────────────────────────────────────
   ScoreDrawer — one rep's record: score the ten signals, keep the hard numbers,
   read the trend. The workbook's row, unrolled into something you can actually
   review a person in.

   Three tabs, because a review has three moods: Score (the ten signals),
   Numbers (goal / booked / pipeline / RFQs / hit rate, plus the DryWare assist),
   and Trend (this rep across every period scored so far — the thing a
   spreadsheet snapshot could never show).

   The drawer holds a full working copy and saves on demand: half-scoring
   somebody and navigating away should not leave a partial row behind, and
   `dismissable={false}` while dirty means Esc/scrim-click can't discard it
   silently either.
   ──────────────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from 'react'
import {
  AlertTriangle, Check, Loader2, Sparkles, Trash2, TrendingDown, TrendingUp, X,
} from 'lucide-react'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/Drawer'
import { Tabs } from '@/components/ui/Tabs'
import { StatusPill } from '@/components/admin/list'
import { ToneAvatar } from '@/components/admin/list-card'
import { cn } from '@/lib/utils'
import type { Contact } from '@/lib/supabase'
import type { RepPipeline } from '@/lib/rep-pipeline'
import {
  SIGNALS, SIGNAL_KEYS, SIGNAL_SCORES, signalTone, scoreCard, coverage, pctToGoal, num,
  periodLabel, fmtMoney, fmtPct, fmtCoverage, REP_STATUSES, REP_STATUS_TONE,
  TIER_TONE, GRADE_TONE, MAX_TOTAL, COVERAGE_TARGET,
  type RepScorecard, type ScoredRep, type SignalKey, type RepStatus,
} from '@/lib/rep-scorecard'
import type { Firm } from './RepScorecardClient'

const INPUT_CX =
  'w-full h-9 px-2.5 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink placeholder:text-ink-faint outline-none focus:border-brand transition-colors tabular-nums'
const LABEL_CX = 'block text-[12px] font-medium text-ink-secondary mb-1.5'
const BTN_QUIET =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline text-[13px] font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors disabled:opacity-50'

/** The editable working copy — every field a string so inputs stay controlled
 *  and an emptied box means "clear it" rather than NaN. */
type Draft = {
  signals: Record<SignalKey, number | null>
  annual_goal: string
  booked_ytd: string
  open_pipeline: string
  rfqs_60d: string
  /** Entered as a PERCENT (40), stored as a fraction (0.4). */
  hit_rate: string
  notes: string
}

function draftFrom(card: RepScorecard | null): Draft {
  const s = {} as Record<SignalKey, number | null>
  for (const k of SIGNAL_KEYS) s[k] = card?.[k] ?? null
  const hit = num(card?.hit_rate)
  return {
    signals: s,
    annual_goal: card?.annual_goal != null ? String(num(card.annual_goal) ?? '') : '',
    booked_ytd: card?.booked_ytd != null ? String(num(card.booked_ytd) ?? '') : '',
    open_pipeline: card?.open_pipeline != null ? String(num(card.open_pipeline) ?? '') : '',
    rfqs_60d: card?.rfqs_60d != null ? String(card.rfqs_60d) : '',
    hit_rate: hit === null ? '' : String(Math.round(hit * 1000) / 10),
    notes: card?.notes ?? '',
  }
}

export default function ScoreDrawer({
  rep, period, history, pipeline, firms, canEdit, onClose, onSaved, onRepUpdated, onRepDeleted,
}: {
  rep: ScoredRep
  period: string
  history: RepScorecard[]
  pipeline: RepPipeline | null
  firms: Firm[]
  canEdit: boolean
  onClose: () => void
  onSaved: (card: RepScorecard) => void
  onRepUpdated: (rep: Contact) => void
  onRepDeleted: (id: string) => void
}) {
  const [tab, setTab] = useState<'score' | 'numbers' | 'trend'>('score')
  const [draft, setDraft] = useState<Draft>(() => draftFrom(rep.card))
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [editingRep, setEditingRep] = useState(false)

  const live = useMemo(() => scoreCard(draft.signals), [draft.signals])
  const goal = num(draft.annual_goal)
  const booked = num(draft.booked_ytd)
  const pipelineVal = num(draft.open_pipeline)
  const liveCoverage = coverage(goal, booked, pipelineVal)
  const livePctToGoal = pctToGoal(goal, booked)

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setDraft((d) => ({ ...d, [key]: value }))
    setDirty(true)
    setError('')
  }
  const setSignal = (key: SignalKey, value: number | null) => {
    setDraft((d) => ({ ...d, signals: { ...d.signals, [key]: value } }))
    setDirty(true)
    setError('')
  }

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const hit = num(draft.hit_rate)
      const res = await fetch('/api/admin/rep-scorecard/scores', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId: rep.id,
          period,
          ...draft.signals,
          annual_goal: draft.annual_goal === '' ? null : num(draft.annual_goal),
          booked_ytd: draft.booked_ytd === '' ? null : num(draft.booked_ytd),
          open_pipeline: draft.open_pipeline === '' ? null : num(draft.open_pipeline),
          rfqs_60d: draft.rfqs_60d === '' ? null : num(draft.rfqs_60d),
          // Percent in the box → fraction in the column, matching the workbook.
          hit_rate: hit === null ? null : Math.min(1, Math.max(0, hit / 100)),
          notes: draft.notes.trim() || null,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setError(json.error || 'Could not save the scorecard.'); return }
      onSaved(json.scorecard as RepScorecard)
      setDirty(false)
    } catch {
      setError('Could not reach the server. Check your connection and try again.')
    } finally {
      setSaving(false)
    }
  }

  const removeRep = async () => {
    setSaving(true)
    try {
      const res = await fetch(`/api/admin/rep-scorecard/reps/${rep.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) { setError(json.error || 'Could not remove the rep.'); setConfirmDelete(false); return }
      onRepDeleted(rep.id)
    } finally {
      setSaving(false)
    }
  }

  // Every period this rep has been scored in, newest first.
  const trend = useMemo(
    () => history
      .map((c) => ({ period: c.period, scored: scoreCard(c), card: c }))
      .filter((t) => t.scored.total !== null)
      .sort((a, b) => b.period.localeCompare(a.period)),
    [history],
  )

  const tierNow = live.tier

  return (
    <Drawer onClose={onClose} dismissable={!dirty && !confirmDelete} width={620} labelledBy="rep-drawer-title">
      <DrawerHeader>
        <div className="flex items-start gap-3">
          <ToneAvatar name={rep.name} size={38} />
          <div className="min-w-0 flex-1">
            <h2 id="rep-drawer-title" className="text-[16px] font-semibold text-ink tracking-tight truncate">{rep.name}</h2>
            <p className="text-[12px] text-ink-muted truncate">
              {[rep.firmName, rep.title, rep.territory].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
            {live.total === null ? (
              <StatusPill tone="slate">Not scored</StatusPill>
            ) : (
              <>
                <span className="text-[20px] font-semibold text-ink tabular-nums leading-none">
                  {live.total}<span className="text-[13px] text-ink-faint">/{MAX_TOTAL}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  {tierNow && <StatusPill tone={TIER_TONE[tierNow]}>{tierNow}</StatusPill>}
                  {live.grade && <StatusPill tone={GRADE_TONE[live.grade]}>{live.grade}</StatusPill>}
                </span>
              </>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <StatusPill tone="sky">{periodLabel(period)}</StatusPill>
          {rep.repStatus && <StatusPill tone={REP_STATUS_TONE[rep.repStatus as RepStatus] ?? 'slate'}>{rep.repStatus}</StatusPill>}
          {live.total !== null && live.scoredCount < SIGNAL_KEYS.length && (
            <span className="inline-flex items-center gap-1 text-[11.5px] text-ink-muted">
              <AlertTriangle size={12} className="text-amber-500" />
              {live.scoredCount} of {SIGNAL_KEYS.length} signals scored — the total is still out of {MAX_TOTAL}
            </span>
          )}
          {rep.card?.scored_by_name && !dirty && (
            <span className="text-[11.5px] text-ink-faint">
              Last scored by {rep.card.scored_by_name}
            </span>
          )}
        </div>
      </DrawerHeader>

      <Tabs
        tabs={[
          { key: 'score' as const, label: 'Score', count: `${live.scoredCount}/${SIGNAL_KEYS.length}` },
          { key: 'numbers' as const, label: 'Numbers' },
          { key: 'trend' as const, label: 'Trend', count: trend.length || undefined },
        ]}
        active={tab}
        onChange={setTab}
      />

      <DrawerBody>
        {tab === 'score' && (
          <div className="space-y-1">
            {SIGNALS.map((sig, i) => {
              const value = draft.signals[sig.key]
              return (
                <div key={sig.key} className="py-2.5 border-b border-hairline-soft last:border-0">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-[13px] font-medium text-ink">
                        <span className="text-ink-faint tabular-nums mr-1.5">{i + 1}.</span>
                        {sig.label}
                      </p>
                      <p className="text-[11.5px] text-ink-muted mt-0.5 leading-snug">{sig.help}</p>
                    </div>
                    <SignalPicker
                      value={value}
                      disabled={!canEdit}
                      onChange={(v) => setSignal(sig.key, v)}
                    />
                  </div>
                  {sig.key === 'coverage_3x' && liveCoverage.kind === 'ratio' && (
                    <p className="mt-1.5 text-[11.5px] text-ink-muted">
                      Measured coverage is{' '}
                      <b className="font-semibold text-ink-secondary tabular-nums">{fmtCoverage(liveCoverage)}</b>
                      {liveCoverage.value >= COVERAGE_TARGET
                        ? ` — at or above the ${COVERAGE_TARGET}x bar.`
                        : ` — below the ${COVERAGE_TARGET}x bar.`}
                    </p>
                  )}
                </div>
              )
            })}

            <div className="pt-4">
              <label className={LABEL_CX} htmlFor="rep-notes">Notes / next action</label>
              <textarea
                id="rep-notes"
                value={draft.notes}
                onChange={(e) => set('notes', e.target.value)}
                disabled={!canEdit}
                rows={3}
                placeholder="What happens before the next review?"
                className="w-full px-2.5 py-2 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink placeholder:text-ink-faint outline-none focus:border-brand transition-colors resize-y"
              />
            </div>
          </div>
        )}

        {tab === 'numbers' && (
          <div className="space-y-4">
            <p className="text-[12px] text-ink-muted leading-snug">
              Optional context. These don&apos;t score — they&apos;re what you judge the signals against, and
              they roll up per firm.
            </p>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Annual goal ($)">
                <input type="number" min="0" step="1000" value={draft.annual_goal} disabled={!canEdit}
                  onChange={(e) => set('annual_goal', e.target.value)} className={INPUT_CX} placeholder="400000" />
              </Field>
              <Field label="Booked YTD ($)">
                <input type="number" min="0" step="1000" value={draft.booked_ytd} disabled={!canEdit}
                  onChange={(e) => set('booked_ytd', e.target.value)} className={INPUT_CX} placeholder="150000" />
              </Field>
              <Field label="Open pipeline ($)">
                <input type="number" min="0" step="1000" value={draft.open_pipeline} disabled={!canEdit}
                  onChange={(e) => set('open_pipeline', e.target.value)} className={INPUT_CX} placeholder="520000" />
              </Field>
              <Field label="RFQs (last 60 days)">
                <input type="number" min="0" step="1" value={draft.rfqs_60d} disabled={!canEdit}
                  onChange={(e) => set('rfqs_60d', e.target.value)} className={INPUT_CX} placeholder="6" />
              </Field>
              <Field label="Hit rate (%)">
                <input type="number" min="0" max="100" step="1" value={draft.hit_rate} disabled={!canEdit}
                  onChange={(e) => set('hit_rate', e.target.value)} className={INPUT_CX} placeholder="40" />
              </Field>
            </div>

            {/* Derived, exactly as the workbook's gray columns. */}
            <div className="rounded-xl border border-hairline bg-surface-soft px-4 py-3 flex flex-wrap gap-x-8 gap-y-2">
              <Derived label="% to goal" value={fmtPct(livePctToGoal)} />
              <Derived
                label="Coverage"
                value={fmtCoverage(liveCoverage)}
                hint={liveCoverage.kind === 'ratio' ? `Pipeline ÷ the ${fmtMoney((goal ?? 0) - (booked ?? 0))} gap to goal` : undefined}
              />
            </div>

            {pipeline && (
              <div className="rounded-xl border border-hairline px-4 py-3">
                <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-muted">
                  <Sparkles size={12} className="text-ink-muted" />
                  From DryWare
                </p>
                <p className="mt-1.5 text-[12.5px] text-ink-secondary leading-snug">
                  <b className="font-semibold text-ink tabular-nums">{fmtMoney(pipeline.openPipeline)}</b> open across{' '}
                  <b className="font-semibold text-ink tabular-nums">{pipeline.quotes}</b> quote{pipeline.quotes === 1 ? '' : 's'},{' '}
                  <b className="font-semibold text-ink tabular-nums">{pipeline.rfqs60d}</b> in the last 60 days
                  {pipeline.lastQuoted && <> · last quoted {new Date(pipeline.lastQuoted).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</>}.
                </p>
                <p className="mt-1 text-[11.5px] text-ink-faint leading-snug">
                  Matched on the rep&apos;s name in the DryWare mirror, so treat it as a starting point — nothing
                  is saved until you use it.
                </p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      setDraft((d) => ({
                        ...d,
                        open_pipeline: String(Math.round(pipeline.openPipeline)),
                        rfqs_60d: String(pipeline.rfqs60d),
                      }))
                      setDirty(true)
                    }}
                    className="mt-2.5 inline-flex items-center gap-1.5 h-8 px-3 rounded-lg border border-hairline text-[12.5px] font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors"
                  >
                    <Check size={13} />
                    Use these figures
                  </button>
                )}
              </div>
            )}

            {canEdit && (
              <div className="pt-1">
                {editingRep ? (
                  <RepDetailsForm rep={rep} firms={firms} onDone={(updated) => { if (updated) onRepUpdated(updated); setEditingRep(false) }} />
                ) : (
                  <button type="button" onClick={() => setEditingRep(true)} className={BTN_QUIET}>
                    Edit rep details
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {tab === 'trend' && (
          <div>
            {trend.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-ink-muted">
                No scored periods yet. Score {rep.name.split(' ')[0]} for {periodLabel(period)} and the trend starts here.
              </p>
            ) : (
              <div className="space-y-1">
                {trend.map((t, i) => {
                  const prev = trend[i + 1]
                  const delta = prev ? (t.scored.total ?? 0) - (prev.scored.total ?? 0) : null
                  return (
                    <div
                      key={t.period}
                      className={cn(
                        'flex items-center gap-3 py-2.5 border-b border-hairline-soft last:border-0',
                        t.period === period && 'font-medium',
                      )}
                    >
                      <span className="w-[74px] flex-shrink-0 text-[12.5px] text-ink-secondary tabular-nums">
                        {periodLabel(t.period)}
                      </span>
                      <span className="flex-1 min-w-0 h-1.5 rounded-full bg-surface-strong overflow-hidden">
                        <span
                          className={cn('block h-full rounded-full', {
                            'bg-emerald-500': t.scored.tier === 'Platinum / Gold',
                            'bg-amber-500': t.scored.tier === 'Silver',
                            'bg-rose-500': t.scored.tier === 'Developing / At-risk',
                          })}
                          style={{ width: `${Math.max(3, ((t.scored.total ?? 0) / MAX_TOTAL) * 100)}%` }}
                        />
                      </span>
                      <span className="w-14 text-right text-[12.5px] text-ink-secondary tabular-nums flex-shrink-0">
                        {t.scored.total}/{MAX_TOTAL}
                      </span>
                      <span className="w-16 flex justify-end flex-shrink-0">
                        {delta === null ? (
                          <span className="text-[11.5px] text-ink-faint">—</span>
                        ) : delta === 0 ? (
                          <span className="text-[11.5px] text-ink-faint tabular-nums">±0</span>
                        ) : (
                          <span className={cn(
                            'inline-flex items-center gap-0.5 text-[11.5px] tabular-nums',
                            delta > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400',
                          )}>
                            {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                            {delta > 0 ? '+' : ''}{delta}
                          </span>
                        )}
                      </span>
                      <span className="w-7 flex justify-end flex-shrink-0">
                        {t.scored.grade && <StatusPill tone={GRADE_TONE[t.scored.grade]}>{t.scored.grade}</StatusPill>}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </DrawerBody>

      <DrawerFooter>
        {canEdit ? (
          confirmDelete ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[12px] text-ink-secondary">
                Remove {rep.name}{trend.length > 0 ? ` and ${trend.length} scored period${trend.length === 1 ? '' : 's'}` : ''}?
              </span>
              <button type="button" onClick={removeRep} disabled={saving}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-rose-600 text-white text-[12.5px] font-medium hover:bg-rose-700 transition-colors disabled:opacity-50">
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
                Remove
              </button>
              <button type="button" onClick={() => setConfirmDelete(false)} className="text-[12.5px] text-ink-muted hover:text-ink">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDelete(true)}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline text-[13px] font-medium text-rose-600 hover:border-hairline-strong transition-colors"
            >
              <Trash2 size={14} />
              Remove rep
            </button>
          )
        ) : (
          <span className="text-[12px] text-ink-muted">Read-only — scoring is admin and sales.</span>
        )}

        <div className="flex items-center gap-2 flex-wrap justify-end">
          {error && <span className="text-[12px] text-rose-600 max-w-[280px]">{error}</span>}
          {!error && !dirty && rep.card?.scored_at && (
            <span className="text-[11.5px] text-ink-faint">
              Saved {new Date(rep.card.scored_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
          <button type="button" onClick={onClose} className={BTN_QUIET}>
            {dirty ? 'Discard' : 'Close'}
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              {saving ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
              Save
            </button>
          )}
        </div>
      </DrawerFooter>
    </Drawer>
  )
}

/** The workbook's 0/1/2 dropdown, as a segmented control — three taps beats a
 *  select when you're doing it ten times per rep. Clicking the active value
 *  clears it back to unscored (0 and "not looked at" are different things). */
function SignalPicker({
  value, disabled, onChange,
}: {
  value: number | null; disabled?: boolean; onChange: (v: number | null) => void
}) {
  return (
    <div className="flex items-center gap-1 flex-shrink-0" role="group">
      {SIGNAL_SCORES.map((s) => {
        const on = value === s.value
        return (
          <button
            key={s.value}
            type="button"
            disabled={disabled}
            aria-pressed={on}
            title={`${s.value} — ${s.label}${on ? ' (click again to clear)' : ''}`}
            onClick={() => onChange(on ? null : s.value)}
            className={cn(
              'w-8 h-8 rounded-lg text-[12.5px] font-semibold tabular-nums border transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
              on
                ? {
                    rose: 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-200 dark:border-rose-500/30',
                    amber: 'bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-500/30',
                    emerald: 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/30',
                  }[signalTone(s.value) as 'rose' | 'amber' | 'emerald']
                : 'bg-surface border-hairline text-ink-faint hover:border-hairline-strong hover:text-ink-muted',
            )}
          >
            {s.value}
          </button>
        )
      })}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className={LABEL_CX}>{label}</span>{children}</label>
}

function Derived({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted">{label}</p>
      <p className="mt-0.5 text-[15px] font-semibold text-ink tabular-nums">{value}</p>
      {hint && <p className="text-[11px] text-ink-faint">{hint}</p>}
    </div>
  )
}

/** Inline editor for the rep's own fields (contacts, 062 + 075) — separate from
 *  the scorecard save because it writes a different row on a different route. */
function RepDetailsForm({
  rep, firms, onDone,
}: {
  rep: ScoredRep; firms: Firm[]; onDone: (updated: Contact | null) => void
}) {
  const [name, setName] = useState(rep.name)
  const [title, setTitle] = useState(rep.title ?? '')
  const [territory, setTerritory] = useState(rep.territory ?? '')
  const [status, setStatus] = useState(rep.repStatus ?? '')
  const [companyId, setCompanyId] = useState(rep.companyId)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const save = async () => {
    setBusy(true)
    setErr('')
    try {
      const res = await fetch(`/api/admin/rep-scorecard/reps/${rep.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, title, territory, rep_status: status || null, company_id: companyId }),
      })
      const json = await res.json()
      if (!res.ok) { setErr(json.error || 'Could not save.'); return }
      onDone(json.rep as Contact)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="rounded-xl border border-hairline px-4 py-3.5 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted">Rep details</p>
        <button type="button" onClick={() => onDone(null)} className="text-ink-faint hover:text-ink transition-colors" aria-label="Cancel">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name">
          <input value={name} onChange={(e) => setName(e.target.value)} className={INPUT_CX} />
        </Field>
        <Field label="Role / title">
          <input value={title} onChange={(e) => setTitle(e.target.value)} className={INPUT_CX} placeholder="Account Mgr" />
        </Field>
        <Field label="Territory / region">
          <input value={territory} onChange={(e) => setTerritory(e.target.value)} className={INPUT_CX} placeholder="Ohio Valley" />
        </Field>
        <Field label="Status">
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={cn(INPUT_CX, 'cursor-pointer')}>
            <option value="">—</option>
            {REP_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>
        <Field label="Firm">
          <select value={companyId} onChange={(e) => setCompanyId(e.target.value)} className={cn(INPUT_CX, 'cursor-pointer')}>
            {firms.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
          </select>
        </Field>
      </div>
      <p className="text-[11.5px] text-ink-faint">
        This is the shared rep roster — edits here also show on the territory map&apos;s directory.
      </p>
      {err && <p className="text-[12px] text-rose-600">{err}</p>}
      <div className="flex items-center gap-2">
        <button type="button" onClick={save} disabled={busy || !name.trim()}
          className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand text-white text-[12.5px] font-medium hover:bg-brand-hover transition-colors disabled:opacity-50">
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
          Save details
        </button>
      </div>
    </div>
  )
}
