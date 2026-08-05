'use client'

/* ────────────────────────────────────────────────────────────────────────────
   CompLineDrawer — one person's compensation record.

   The workbook's row, unrolled into something you can actually review a person
   in: what they're paid now, what they scored, and what that produces — with the
   arithmetic shown rather than hidden behind a cell reference. The Result block
   is the whole reason this is a portal page instead of a spreadsheet: the sheet
   could compute `=C3*(G3/48)` but never explain it.

   The drawer holds a full working copy and saves on demand — half-editing
   somebody's pay and navigating away should not leave a partial row behind, and
   `dismissable={false}` while dirty means Esc or a scrim click can't discard it
   silently either.

   The preview is computed against the average this edit WOULD produce, not the
   one currently saved. Because the denominator is the live mean of the recorded
   scores, typing a score here moves this person's raise and everyone else's;
   showing the pre-edit number would be a small lie at exactly the moment it
   matters, so the shift is surfaced instead.
   ──────────────────────────────────────────────────────────────────────────── */

import { useMemo, useState } from 'react'
import { AlertTriangle, Check, Info, Loader2, Lock, Trash2 } from 'lucide-react'
import { Drawer, DrawerHeader, DrawerBody, DrawerFooter } from '@/components/ui/Drawer'
import { StatusPill } from '@/components/admin/list'
import { ToneAvatar } from '@/components/admin/list-card'
import {
  computeLine, num, fmtMoney, fmtRate, fmtPct, fmtAdjustment, fmtScore, fmtDelta,
  PAY_KIND_LABEL, PAY_KIND_TONE,
  type CompReviewLine, type Constants,
} from '@/lib/comp-review'
import { send } from './CompReviewClient'

const INPUT_BASE =
  'w-full h-9 px-2.5 text-[13px] rounded-lg bg-surface-soft border border-hairline text-ink placeholder:text-ink-faint outline-none focus:border-brand transition-colors'
/** Numeric fields — figures line up column-wise while you type. */
const INPUT_CX = `${INPUT_BASE} tabular-nums`
const LABEL_CX = 'block text-[12px] font-medium text-ink-secondary mb-1.5'
const BTN_QUIET =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline text-[13px] font-medium text-ink-secondary hover:border-hairline-strong hover:text-ink transition-colors disabled:opacity-50'

/** Every field a string so inputs stay controlled and an emptied box means
 *  "clear it" rather than NaN. */
type Draft = {
  person_name: string
  tenure_override: string
  per_hour: string
  gross_annual: string
  bonus: string
  score: string
  notes: string
}

const str = (v: string | number | null | undefined) => {
  const n = num(v)
  return n === null ? '' : String(n)
}

function draftFrom(line: CompReviewLine): Draft {
  return {
    person_name: line.person_name,
    tenure_override: line.tenure_override ?? '',
    per_hour: str(line.per_hour),
    gross_annual: str(line.gross_annual),
    bonus: str(line.bonus),
    score: str(line.score),
    notes: line.notes ?? '',
  }
}

/** '' → null, otherwise a number. Mirrors the API validator's coercion. */
const toValue = (s: string) => {
  const t = s.trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}

export default function CompLineDrawer({
  line, tenure, year, constants, avg, otherScores, editable, isFinal,
  onClose, onSaved, onDeleted,
}: {
  line: CompReviewLine
  tenure: string | null
  year: number
  constants: Constants
  avg: number | null
  /** Scores of every OTHER line — needed to preview the denominator shift. */
  otherScores: number[]
  editable: boolean
  isFinal: boolean
  onClose: () => void
  onSaved: (line: CompReviewLine) => void
  onDeleted: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() => draftFrom(line))
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const dirty = useMemo(() => {
    const original = draftFrom(line)
    return (Object.keys(original) as (keyof Draft)[]).some((k) => original[k] !== draft[k])
  }, [draft, line])

  // The denominator this edit would produce. A finalized cycle is frozen, so it
  // keeps its snapshot no matter what is typed.
  const previewAvg = useMemo(() => {
    if (isFinal) return avg
    const draftScore = toValue(draft.score)
    const all = draftScore === null ? otherScores : [...otherScores, draftScore]
    if (all.length === 0) return null
    return all.reduce((a, b) => a + b, 0) / all.length
  }, [draft.score, otherScores, avg, isFinal])

  const preview = useMemo(
    () => computeLine(
      { per_hour: toValue(draft.per_hour), gross_annual: toValue(draft.gross_annual), score: toValue(draft.score) },
      constants,
      previewAvg,
    ),
    [draft.per_hour, draft.gross_annual, draft.score, constants, previewAvg],
  )

  // Worth calling out only when it actually moves — and only when other people
  // are affected by the move.
  const avgShifts =
    !isFinal && avg !== null && previewAvg !== null &&
    Math.abs(previewAvg - avg) > 1e-9 && otherScores.length > 0

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const res = await send(`/api/admin/comp-review/lines/${line.id}`, 'PATCH', {
        person_name: draft.person_name.trim(),
        tenure_override: draft.tenure_override.trim() || null,
        per_hour: toValue(draft.per_hour),
        gross_annual: toValue(draft.gross_annual),
        bonus: toValue(draft.bonus),
        score: toValue(draft.score),
        notes: draft.notes.trim() || null,
      })
      onSaved(res.line as CompReviewLine)
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed.')
      setSaving(false)
    }
  }

  const remove = async () => {
    setSaving(true); setError(null)
    try {
      await send(`/api/admin/comp-review/lines/${line.id}`, 'DELETE')
      onDeleted()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove them.')
      setSaving(false)
    }
  }

  const ro = !editable

  return (
    <Drawer onClose={onClose} dismissable={!dirty && !saving} width={520} labelledBy="comp-line-name">
      <DrawerHeader>
        <div className="flex items-center gap-3">
          <ToneAvatar name={line.person_name} size={38} />
          <div className="min-w-0 flex-1">
            <h2 id="comp-line-name" className="text-[15px] font-semibold text-ink truncate">{line.person_name}</h2>
            <p className="text-[12px] text-ink-muted truncate">
              {[tenure, isFinal ? 'Finalized' : null].filter(Boolean).join(' · ') || 'No tenure on file'}
            </p>
          </div>
          <StatusPill tone={PAY_KIND_TONE[preview.kind]}>{PAY_KIND_LABEL[preview.kind]}</StatusPill>
        </div>
      </DrawerHeader>

      <DrawerBody>
        {isFinal && (
          <Note icon={<Lock size={14} />}>
            The {year} review is finalized. Reopen it in Settings to make changes.
          </Note>
        )}

        {/* ── Current pay ─────────────────────────────────────────────────── */}
        <Section title="Current pay">
          <p className="text-[11.5px] text-ink-muted -mt-1 mb-3">
            Fill in whichever applies — hourly staff need a rate, salaried staff an annual figure.
            Neither is required.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Per hour">
              <input
                className={INPUT_CX} inputMode="decimal" placeholder="—" disabled={ro}
                value={draft.per_hour} onChange={(e) => set('per_hour', e.target.value)}
              />
            </Field>
            <Field label="Gross annual">
              <div className="flex gap-1.5">
                <input
                  className={INPUT_CX} inputMode="decimal" placeholder="—" disabled={ro}
                  value={draft.gross_annual} onChange={(e) => set('gross_annual', e.target.value)}
                />
                {!ro && toValue(draft.per_hour) !== null && (
                  <button
                    type="button"
                    title={`Fill from the hourly rate — rate × ${constants.hoursPerWeek} × ${constants.weeksPerYear}`}
                    onClick={() => set('gross_annual', String(Math.round((toValue(draft.per_hour) ?? 0) * constants.hoursPerWeek * constants.weeksPerYear)))}
                    className="flex-shrink-0 h-9 px-2 rounded-lg border border-hairline text-[11px] font-medium text-ink-muted hover:text-ink hover:border-hairline-strong transition-colors"
                  >
                    = ×{constants.hoursPerWeek * constants.weeksPerYear}
                  </button>
                )}
              </div>
            </Field>
          </div>
          <div className="mt-3">
            <Field label="Bonus">
              <input
                className={INPUT_CX} inputMode="decimal" placeholder="—" disabled={ro}
                value={draft.bonus} onChange={(e) => set('bonus', e.target.value)}
              />
              <p className="text-[11px] text-ink-faint mt-1">
                Recorded and totalled, but not part of the raise calculation — same as the spreadsheet.
              </p>
            </Field>
          </div>
        </Section>

        {/* ── Review ──────────────────────────────────────────────────────── */}
        <Section title="Review">
          <Field label="Score">
            <input
              className={INPUT_CX} inputMode="decimal" placeholder="—" disabled={ro}
              value={draft.score} onChange={(e) => set('score', e.target.value)}
            />
            <p className="text-[11px] text-ink-faint mt-1">
              Any consistent scale works — raises are relative to the average, not to a fixed maximum.
            </p>
          </Field>
          <div className="mt-3">
            <Field label="Notes">
              <textarea
                rows={3} disabled={ro}
                className={`${INPUT_CX} h-auto py-2 resize-y`}
                value={draft.notes} onChange={(e) => set('notes', e.target.value)}
                placeholder="What came out of the review conversation…"
              />
            </Field>
          </div>
        </Section>

        {/* ── Result ──────────────────────────────────────────────────────── */}
        <Section title="Result">
          {preview.relScore === null ? (
            <p className="text-[12.5px] text-ink-muted">
              {toValue(draft.score) === null
                ? 'Enter a score to calculate an increase.'
                : 'No average to compare against yet — score at least one person.'}
            </p>
          ) : (
            <>
              <dl className="space-y-1.5">
                <Line
                  label="Relative score"
                  math={`${fmtScore(toValue(draft.score))} ÷ ${fmtScore(previewAvg)}`}
                  value={preview.relScore.toFixed(3)}
                />
                <Line
                  label="Raise figure"
                  math={`${preview.relScore.toFixed(3)} × ${constants.raisePool}`}
                  value={fmtAdjustment(preview.raisePct)}
                />
                <Line
                  label="Adjustment"
                  math={`${preview.relScore.toFixed(3)} × ${fmtAdjustment(preview.raisePct)}`}
                  value={fmtAdjustment(preview.adjustment)}
                />
                <Line
                  label="Applied"
                  math={`${fmtAdjustment(preview.adjustment)} ÷ ${constants.divisor}`}
                  value={fmtPct(preview.raiseFraction, 2)}
                  strong
                />
              </dl>

              {preview.kind === 'none' ? (
                <Note icon={<AlertTriangle size={14} />}>
                  Scored, but there's no pay on file — so there's nothing to apply the increase to.
                </Note>
              ) : (
                <dl className="mt-3 pt-3 border-t border-hairline-soft space-y-1.5">
                  {preview.kind === 'hourly' ? (
                    <>
                      <Line
                        label="Hourly increase"
                        math={`${fmtRate(toValue(draft.per_hour))} × ${fmtPct(preview.raiseFraction, 2)}`}
                        value={fmtRate(preview.hourlyIncrease)}
                      />
                      <Line
                        label="New rate"
                        math={`${fmtRate(toValue(draft.per_hour))} + ${fmtRate(preview.hourlyIncrease)}`}
                        value={fmtRate(preview.newHourly)}
                        strong
                      />
                      <Line
                        label="New gross annual"
                        math={`${fmtRate(preview.newHourly)} × ${constants.hoursPerWeek} × ${constants.weeksPerYear}`}
                        value={fmtMoney(preview.newAnnual)}
                        strong
                      />
                    </>
                  ) : (
                    <>
                      <Line
                        label="New gross annual"
                        math={`${fmtMoney(preview.currentAnnual)} × ${(1 + (preview.raiseFraction ?? 0)).toFixed(4)}`}
                        value={fmtMoney(preview.newAnnual)}
                        strong
                      />
                      <Line label="Annual increase" math="" value={fmtDelta(preview.annualIncrease)} />
                    </>
                  )}
                </dl>
              )}

              {avgShifts && (
                <Note icon={<Info size={14} />}>
                  Saving this moves the average score from {fmtScore(avg)} to {fmtScore(previewAvg)},
                  which re-calculates the other {otherScores.length} scored {otherScores.length === 1 ? 'person' : 'people'} too.
                </Note>
              )}
            </>
          )}
        </Section>

        {/* ── Identity ────────────────────────────────────────────────────── */}
        <Section title="Details">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name on this review">
              <input
                className={INPUT_BASE} disabled={ro}
                value={draft.person_name} onChange={(e) => set('person_name', e.target.value)}
              />
            </Field>
            <Field label="Tenure">
              <input
                className={INPUT_CX} disabled={ro} placeholder={tenure ?? 'From hire date'}
                value={draft.tenure_override} onChange={(e) => set('tenure_override', e.target.value)}
              />
            </Field>
          </div>
          <p className="text-[11px] text-ink-faint mt-1.5">
            {line.employee_id
              ? 'Tenure comes from their hire date unless you override it here.'
              : 'Not linked to a portal account, so tenure has to be entered by hand.'}
          </p>
        </Section>

        {error && (
          <p className="mt-4 text-[12.5px] text-rose-500 flex items-start gap-1.5">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5" />
            {error}
          </p>
        )}
      </DrawerBody>

      <DrawerFooter>
        {editable ? (
          confirmDelete ? (
            <button type="button" onClick={remove} disabled={saving} className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-rose-300 dark:border-rose-500/40 text-[13px] font-medium text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50">
              <Trash2 size={15} />
              Really remove?
            </button>
          ) : (
            <button type="button" onClick={() => setConfirmDelete(true)} disabled={saving} className={BTN_QUIET}>
              <Trash2 size={15} />
              Remove
            </button>
          )
        ) : <span />}

        <div className="flex items-center gap-2">
          <button type="button" onClick={onClose} disabled={saving} className={BTN_QUIET}>
            {dirty ? 'Discard' : 'Close'}
          </button>
          {editable && (
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty || !draft.person_name.trim()}
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

// ── Small presentational pieces ──────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-5 last:mb-0">
      <h3 className="text-[10px] font-semibold uppercase tracking-wider text-ink-muted mb-2.5">{title}</h3>
      {children}
    </section>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className={LABEL_CX}>{label}</span>{children}</label>
}

/** One step of the arithmetic: what it is, how it got there, what it came to. */
function Line({ label, math, value, strong }: { label: string; math: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline gap-3">
      <dt className={`text-[12.5px] ${strong ? 'text-ink font-medium' : 'text-ink-secondary'}`}>{label}</dt>
      {math && <dd className="text-[11px] text-ink-faint tabular-nums truncate">{math}</dd>}
      <div className="flex-1 border-b border-dotted border-hairline min-w-[8px]" />
      <dd className={`text-[12.5px] tabular-nums flex-shrink-0 ${strong ? 'text-ink font-semibold' : 'text-ink-secondary'}`}>{value}</dd>
    </div>
  )
}

function Note({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <p className="mt-3 text-[11.5px] text-ink-muted flex items-start gap-1.5 rounded-lg bg-surface-soft border border-hairline px-2.5 py-2">
      <span className="flex-shrink-0 mt-px text-ink-faint">{icon}</span>
      <span>{children}</span>
    </p>
  )
}
