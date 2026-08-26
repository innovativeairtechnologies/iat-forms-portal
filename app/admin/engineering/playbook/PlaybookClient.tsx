'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, Check, Lock, RotateCcw, Save } from 'lucide-react'
import { ListCardPage, ListCard, CardHead } from '@/components/admin/list-card'
import { STREAM_BLURB, STREAM_LABELS } from '@/lib/engineering'
import { ENG_PLAYBOOK_DEFAULT, type Playbook, type PlaybookStep } from '@/lib/eng-playbook'
import { StreamChip } from '../ui'

/* The scheduling-rules editor.
 *
 * ── Every field says where its number came from ────────────────────────────
 * The `note` under each step is not documentation for its own sake. Six months
 * from now somebody will ask why a submittal package is costed at two hours when
 * the last one took eight, and the answer — "the workbook says 2, the monday
 * board logged 8, and that gap is the thing we are trying to close" — has to be
 * on the screen where the number is, or it is nowhere.
 *
 * ── Unconfirmed steps are marked, not hidden ───────────────────────────────
 * A step nobody has costed shows an amber "unconfirmed" chip. Hiding them would
 * make the playbook look finished; deleting them would lose the structure the
 * meeting agreed on. Marked is the honest third option.
 */

const NUM =
  'h-7 w-[62px] rounded-md border border-hairline bg-surface px-1.5 text-[12px] tabular-nums text-ink ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors disabled:opacity-60'
const TXT =
  'h-7 w-full rounded-md border border-hairline bg-surface px-2 text-[12.5px] text-ink ' +
  'focus:outline-none focus-visible:ring-2 focus-visible:ring-brand transition-colors disabled:opacity-60'

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export default function PlaybookClient({ initial, canEdit }: { initial: Playbook; canEdit: boolean }) {
  const router = useRouter()
  const [pb, setPb] = useState<Playbook>(initial)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const edit = (fn: (draft: Playbook) => void) => {
    setPb(prev => {
      const next = structuredClone(prev)
      fn(next)
      return next
    })
    setDirty(true)
    setSaved(false)
  }

  const setStep = (streamIdx: number, stepIdx: number, patch: Partial<PlaybookStep>) =>
    edit(d => { d.streams[streamIdx].steps[stepIdx] = { ...d.streams[streamIdx].steps[stepIdx], ...patch } })

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const res = await fetch('/api/admin/engineering/playbook', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ playbook: pb }),
      })
      const d = await res.json().catch(() => ({}))
      if (!res.ok) { setError(d.error || `Could not save (HTTP ${res.status}).`); setSaving(false); return }
      setPb(d.playbook)
      setDirty(false); setSaved(true); setSaving(false)
      router.refresh()
    } catch (err) { setError(String(err)); setSaving(false) }
  }

  const reset = () => {
    if (!confirm('Replace every rule with the shipped default? Nothing already generated changes — tasks snapshot their hours and dates when they are created — but every future job will use these.')) return
    setPb(structuredClone(ENG_PLAYBOOK_DEFAULT))
    setDirty(true); setSaved(false)
  }

  return (
    <ListCardPage>
      <div className="space-y-3">
        <ListCard>
          <CardHead
            overline="Engineering"
            title="Scheduling Rules"
            count="What gets created when a job opens, when each piece is due, and how long it should take"
            actions={canEdit ? (
              <>
                <button type="button" onClick={reset} disabled={saving}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline px-3 text-[12.5px] font-medium text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink disabled:opacity-40">
                  <RotateCcw size={13} /> Shipped default
                </button>
                <button type="button" onClick={save} disabled={saving || !dirty}
                  className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50">
                  {saved && !dirty ? <><Check size={14} /> Saved</> : <><Save size={14} /> {saving ? 'Saving…' : 'Save rules'}</>}
                </button>
              </>
            ) : (
              <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline px-3 text-[12px] text-ink-muted">
                <Lock size={13} /> Read-only — engineering or an admin can change these
              </span>
            )}
          />

          <div className="border-b border-hairline px-5 py-3.5 text-[12.5px] leading-relaxed text-ink-secondary">
            <p>
              Every due date on the board is a job&apos;s <strong className="font-medium text-ink">PO date plus the cycle days</strong> below.
              Target hours are the workbook&apos;s &ldquo;Average Lead-Time&rdquo; — what a task <em>should</em> take, measured
              against what it does. Editing a rule changes future jobs only: a task snapshots its title, hours and dates the
              moment it is created, so nothing already on the board moves underneath anyone.
            </p>
            <p className="mt-2 text-ink-muted">
              Blank means <strong className="font-medium">no source gives a number</strong> — the workbook says &ldquo;TBD&rdquo;,
              &ldquo;See Master&rdquo;, &ldquo;Per Smartsheet&rdquo; or nothing at all. Blank is deliberate and prints as
              &ldquo;Not set&rdquo; everywhere. Filling one in is how the department turns an opinion into a standard; putting a
              plausible-looking guess in is how it gets one nobody remembers inventing.
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 border-b border-rose-200 bg-rose-50 px-5 py-2.5 dark:border-rose-500/20 dark:bg-rose-500/10">
              <AlertCircle size={14} className="mt-0.5 shrink-0 text-rose-500" />
              <p className="text-[12px] leading-relaxed text-rose-700 dark:text-rose-300">{error}</p>
            </div>
          )}
        </ListCard>

        {pb.streams.map((s, si) => (
          <ListCard key={s.stream}>
            <div className="flex flex-wrap items-center gap-3 border-b border-hairline px-4 py-2.5">
              <StreamChip stream={s.stream} />
              <h3 className="text-[12.5px] font-semibold text-ink">{STREAM_LABELS[s.stream]}</h3>
              <span className="hidden text-[11.5px] text-ink-muted lg:inline">{STREAM_BLURB[s.stream]}</span>
              <span className="ml-auto flex items-center gap-4">
                {/* The Elec sheet's Sch (hr) = ROUNDUP(takt × multiplier). Only
                    the electrical stream publishes one; the rest are blank
                    rather than 1, because 1 is a claim that touch time and
                    calendar time are the same thing. */}
                <label className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                  Schedule ×
                  <input
                    className={NUM} type="number" step="0.05" min="0" disabled={!canEdit}
                    value={s.multiplier ?? ''}
                    placeholder="—"
                    onChange={e => edit(d => { d.streams[si].multiplier = numOrNull(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[11.5px] text-ink-muted">
                  <input
                    type="checkbox" disabled={!canEdit} checked={s.autoGenerate}
                    onChange={e => edit(d => { d.streams[si].autoGenerate = e.target.checked })}
                    className="h-3.5 w-3.5 accent-[var(--brand)]"
                  />
                  Generate with every job
                </label>
              </span>
            </div>

            <div className="hidden grid-cols-[minmax(180px,1.6fr)_86px_86px_78px_66px_minmax(0,2fr)] items-center gap-3 border-b border-hairline bg-surface-soft px-4 h-9 text-[10px] font-semibold uppercase tracking-wider text-ink-muted lg:grid">
              <span>Step</span>
              <span>Target hrs</span>
              <span>Cycle days</span>
              <span>Bar %</span>
              <span>Priority</span>
              <span>Where the number comes from</span>
            </div>

            {s.steps.length === 0 ? (
              <p className="px-4 py-5 text-center text-[12.5px] text-ink-muted">
                This bucket has no steps, so nothing generates for it.
              </p>
            ) : s.steps.map((st, sti) => (
              <div key={st.key} className="grid grid-cols-1 items-center gap-x-3 gap-y-2 border-b border-hairline-soft px-4 py-2.5 last:border-b-0 lg:grid-cols-[minmax(180px,1.6fr)_86px_86px_78px_66px_minmax(0,2fr)]">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <input className={TXT} disabled={!canEdit} value={st.title}
                    onChange={e => setStep(si, sti, { title: e.target.value })} aria-label="Step name" />
                  <span className="flex flex-wrap gap-1">
                    {st.onDemand && (
                      <span className="rounded bg-surface-strong px-1.5 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-ink-muted"
                        title="Added by hand when it happens, not generated with the job">
                        On demand
                      </span>
                    )}
                    {st.provisional && (
                      <span className="rounded bg-amber-50 px-1.5 py-[2px] text-[10px] font-semibold uppercase tracking-wider text-amber-700 dark:bg-amber-500/10 dark:text-amber-400"
                        title="No source has costed or dated this step yet">
                        Unconfirmed
                      </span>
                    )}
                  </span>
                </span>

                <input className={NUM} type="number" step="0.25" min="0" disabled={!canEdit}
                  value={st.targetHours ?? ''} placeholder="—"
                  onChange={e => setStep(si, sti, { targetHours: numOrNull(e.target.value) })} aria-label="Target hours" />

                <input className={NUM} type="number" step="1" min="0" disabled={!canEdit}
                  value={st.cycleDays ?? ''} placeholder="—"
                  onChange={e => setStep(si, sti, { cycleDays: numOrNull(e.target.value) })} aria-label="Cycle days" />

                <input className={NUM} type="number" step="1" min="0" max="100" disabled={!canEdit}
                  value={st.band ?? ''} placeholder="—"
                  onChange={e => setStep(si, sti, { band: numOrNull(e.target.value) })} aria-label="Progress band" />

                <input className={NUM} type="number" step="1" min="0" max="9" disabled={!canEdit}
                  value={st.priority} onChange={e => setStep(si, sti, { priority: Number(e.target.value) || 0 })} aria-label="Priority" />

                <span className="text-[11.5px] leading-snug text-ink-muted">{st.note ?? '—'}</span>
              </div>
            ))}
          </ListCard>
        ))}

        {/* ── Chasing ────────────────────────────────────────────────────── */}
        <ListCard>
          <div className="flex items-center gap-2 border-b border-hairline px-4 h-11">
            <h3 className="text-[12.5px] font-semibold text-ink">Chasing</h3>
            <span className="text-[11px] text-ink-muted">When the morning sweep nudges, escalates and reports untouched work</span>
          </div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-3">
            {([
              ['nudgeLeadDays', 'Nudge the owner', 'days before a task is due'],
              ['escalateAfterDays', 'Tell the lead', 'days after a task went past due'],
              ['staleAfterDays', 'Call it untouched', 'days with no change of any kind'],
            ] as const).map(([key, label, sub]) => (
              <label key={key} className="block">
                <span className="mb-1.5 block text-[10px] font-semibold uppercase tracking-[0.055em] text-ink-muted">{label}</span>
                <span className="flex items-baseline gap-2">
                  <input className={NUM} type="number" min="0" step="1" disabled={!canEdit}
                    value={pb[key]} onChange={e => edit(d => { d[key] = Math.max(0, Number(e.target.value) || 0) })} />
                  <span className="text-[11.5px] text-ink-muted">{sub}</span>
                </span>
              </label>
            ))}
          </div>
          <p className="border-t border-hairline px-5 py-2.5 text-[11.5px] leading-relaxed text-ink-muted">
            These three are tunable defaults, not numbers from the workbook — nothing in the sources says how long silence
            should be tolerated. Start here and move them once the department has an opinion.
          </p>
        </ListCard>

        {/* ── The expected workweek ──────────────────────────────────────── */}
        <ListCard>
          <div className="flex items-center gap-2 border-b border-hairline px-4 h-11">
            <h3 className="text-[12.5px] font-semibold text-ink">The expected workweek</h3>
            <span className="text-[11px] text-ink-muted">Transcribed from the lead-time workbook</span>
          </div>
          <div className="grid gap-4 px-5 py-4 sm:grid-cols-2">
            {pb.capacity.map((role, ri) => (
              <div key={role.key} className="rounded-lg border border-hairline bg-surface-soft px-4 py-3">
                <p className="text-[12.5px] font-semibold text-ink">{role.label}</p>
                <label className="mt-2 flex items-center gap-2 text-[11.5px] text-ink-muted">
                  Hours a week
                  <input className={NUM} type="number" min="0" step="0.5" disabled={!canEdit}
                    value={role.weeklyHours ?? ''} placeholder="—"
                    onChange={e => edit(d => { d.capacity[ri].weeklyHours = numOrNull(e.target.value) })} />
                  {role.weeklyHours == null && <span className="text-ink-faint">not in the workbook</span>}
                </label>
                <ul className="mt-2.5 space-y-1.5">
                  {role.split.map(sp => (
                    <li key={sp.label} className="flex items-baseline gap-2 text-[12px]">
                      <span className="flex-1 text-ink-secondary">{sp.label}</span>
                      <span className="flex-shrink-0 tabular-nums text-ink-muted">{sp.share != null ? `${Math.round(sp.share * 100)}%` : '—'}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </ListCard>

        {dirty && canEdit && (
          <div className="sticky bottom-4 flex items-center gap-3 rounded-xl border border-hairline bg-surface px-4 py-3 shadow-[0_8px_24px_rgba(31,30,27,.10)] dark:shadow-none dark:ring-1 dark:ring-white/10">
            <p className="flex-1 text-[12.5px] text-ink-secondary">Unsaved changes. Nothing already on the board moves — these apply to jobs opened from here on.</p>
            <button type="button" onClick={() => { setPb(initial); setDirty(false) }}
              className="h-8 rounded-lg border border-hairline px-3 text-[12.5px] font-medium text-ink-secondary transition-colors hover:text-ink">
              Discard
            </button>
            <button type="button" onClick={save} disabled={saving}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[12.5px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-50">
              <Save size={14} /> {saving ? 'Saving…' : 'Save rules'}
            </button>
          </div>
        )}

        <div className="pb-4" />
      </div>
    </ListCardPage>
  )
}
