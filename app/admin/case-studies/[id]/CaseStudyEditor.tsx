'use client'

/* ────────────────────────────────────────────────────────────────────────────
   Case-study editor — intake on the left, Claude's draft + review on the right.

   The review side is deliberately input-vs-output honest: the human edits
   `edited_sections` while `draft_sections` (Claude's original) stays readable
   under each section, and the gaps / unverified-numbers panels must be worked
   to zero before Approve unlocks. "Where did that number come from" should
   always be one glance, never an investigation.
   ──────────────────────────────────────────────────────────────────────────── */

import { useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle, Building2, CheckCircle2, ChevronDown, EyeOff, FileText,
  Loader2, Plus, Printer, RotateCcw, Send, Sparkles, Trash2, Undo2, X,
} from 'lucide-react'
import PageChrome from '@/app/admin/PageChrome'
import DeleteRecordButton from '@/components/admin/DeleteRecordButton'
import { StatusPill, type Tone } from '@/components/admin/list'
import { cn } from '@/lib/utils'
import type { Equipment } from '@/lib/supabase'
import {
  SECTION_KEYS, SECTION_LABELS, STATUS_LABELS, blankUnit, missingForGenerate,
  unitFromEquipment,
  type CaseStudy, type CaseStudyStatus, type Claim, type Gap, type NumberFlag,
  type Sections, type UnitInput,
} from '@/lib/case-studies'

const STATUS_TONE: Record<CaseStudyStatus, Tone> = {
  draft: 'slate', in_review: 'amber', approved: 'emerald',
}

// Local unit rows need a stable key for React (server ids die on every replace).
type LocalUnit = UnitInput & { _key: string }
let unitKey = 0
const withKey = (u: UnitInput): LocalUnit => ({ ...u, _key: `u${++unitKey}` })

// ── Small token-styled form primitives (per DESIGN.md §6) ─────────────────────

function L({ children, required }: { children: ReactNode; required?: boolean }) {
  return (
    <span className="block text-[12px] font-medium text-ink-secondary mb-1.5">
      {children}
      {required && <span className="text-rose-500"> *</span>}
    </span>
  )
}

const inputCls =
  'w-full h-9 px-3 text-[13px] rounded-lg bg-surface border border-hairline text-ink placeholder:text-ink-faint outline-none hover:border-hairline-strong focus:border-brand transition-colors disabled:opacity-60'

function TextInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} className={cn(inputCls, props.className)} />
}

function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={cn(inputCls, 'h-auto min-h-[86px] py-2 leading-relaxed resize-y', props.className)}
    />
  )
}

function EditorCard({ title, caption, children, tone }: {
  title: string; caption?: string; children: ReactNode; tone?: 'amber' | 'rose'
}) {
  return (
    <section className={cn(
      'rounded-xl border bg-surface',
      tone === 'amber' ? 'border-amber-300 dark:border-amber-500/40'
        : tone === 'rose' ? 'border-rose-300 dark:border-rose-500/40'
        : 'border-hairline',
    )}>
      <div className="px-4 pt-3.5 pb-3 border-b border-hairline-soft">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {caption && <p className="text-[11.5px] text-ink-muted mt-0.5">{caption}</p>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

const btnSecondary =
  'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-surface border border-hairline-strong text-[13px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors disabled:opacity-50'
const btnPrimary =
  'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-60'

// ── The editor ────────────────────────────────────────────────────────────────

export default function CaseStudyEditor({
  initial, equipment, canApprove,
}: {
  initial: CaseStudy
  equipment: Equipment[]
  canApprove: boolean
}) {
  const router = useRouter()

  // Study-level fields
  const [title, setTitle] = useState(initial.title)
  const [disclosure, setDisclosure] = useState(initial.customer_disclosure)
  const [industry, setIndustry] = useState(initial.industry ?? '')
  const [region, setRegion] = useState(initial.region ?? '')
  const [context, setContext] = useState(initial.context_input)
  const [before, setBefore] = useState(initial.problem_before)
  const [after, setAfter] = useState(initial.outcome_after)
  const [units, setUnits] = useState<LocalUnit[]>(
    (initial.case_study_units ?? []).map((u) => withKey(u))
  )

  // Draft / review artifacts
  const [status, setStatus] = useState<CaseStudyStatus>(initial.status)
  const [draftSections, setDraftSections] = useState<Sections | null>(initial.draft_sections)
  const [sections, setSections] = useState<Sections | null>(initial.edited_sections)
  const [claims, setClaims] = useState<Claim[]>(initial.claims ?? [])
  const [gaps, setGaps] = useState<Gap[]>(initial.gaps ?? [])
  const [flags, setFlags] = useState<NumberFlag[]>(initial.flags ?? [])
  const [reviewNotes, setReviewNotes] = useState(initial.review_notes ?? '')

  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [statusBusy, setStatusBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showClaims, setShowClaims] = useState(false)

  const locked = status === 'approved'
  const touch = () => { setDirty(true); setNotice('') }

  const missing = useMemo(
    () => missingForGenerate({ context_input: context, problem_before: before, outcome_after: after }, units),
    [context, before, after, units]
  )
  const openGaps = gaps.filter((g) => !g.resolved)
  const openFlags = flags.filter((f) => !f.cleared)
  const blockers: string[] = [
    ...(!sections ? ['No draft has been generated yet.'] : []),
    ...(openGaps.length ? [`${openGaps.length} unresolved gap${openGaps.length === 1 ? '' : 's'}`] : []),
    ...(openFlags.length ? [`${openFlags.length} unverified number${openFlags.length === 1 ? '' : 's'}`] : []),
  ]

  // ── Persistence ────────────────────────────────────────────────────────────

  const save = async (): Promise<boolean> => {
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/case-studies/${initial.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          customer_disclosure: disclosure,
          industry: industry || null,
          region: region || null,
          context_input: context,
          problem_before: before,
          outcome_after: after,
          review_notes: reviewNotes || null,
          edited_sections: sections ?? undefined,
          gaps,
          flags,
          units: units.map(({ _key, ...u }) => u),
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not save.')
        return false
      }
      setDirty(false)
      setNotice('Saved')
      router.refresh()
      return true
    } finally {
      setSaving(false)
    }
  }

  const generate = async () => {
    setError('')
    if (missing.length) {
      setError(`Fill the required fields first: ${missing.slice(0, 4).join('; ')}${missing.length > 4 ? '…' : ''}`)
      return
    }
    // Persist inputs first so the server drafts from exactly what's on screen.
    if (dirty && !(await save())) return
    setGenerating(true)
    try {
      const res = await fetch(`/api/admin/case-studies/${initial.id}/generate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Generation failed.')
        if (json.missing) setError(`Fill the required fields first: ${json.missing.slice(0, 4).join('; ')}`)
        return
      }
      setDraftSections(json.sections)
      setSections(json.sections)
      setClaims(json.claims ?? [])
      setGaps(json.gaps ?? [])
      setFlags(json.flags ?? [])
      setStatus('draft')
      setDirty(false)
      setNotice('Draft generated — review it on the right')
      router.refresh()
    } finally {
      setGenerating(false)
    }
  }

  const transition = async (action: 'submit' | 'approve' | 'reopen') => {
    setError('')
    if (dirty && !(await save())) return
    setStatusBusy(true)
    try {
      const res = await fetch(`/api/admin/case-studies/${initial.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.blockers ? `${json.error} ${json.blockers.join(' ')}` : (json.error || 'Could not update status.'))
        return
      }
      setStatus(json.status)
      setNotice(json.status === 'approved' ? 'Approved — ready to print or export' : '')
      router.refresh()
    } finally {
      setStatusBusy(false)
    }
  }

  // ── Units helpers ──────────────────────────────────────────────────────────

  const setUnit = (key: string, patch: Partial<UnitInput>) => {
    setUnits((us) => us.map((u) => (u._key === key ? { ...u, ...patch } : u)))
    touch()
  }
  const addBlank = () => { setUnits((us) => [...us, withKey(blankUnit())]); touch() }
  const addFromEquipment = (id: string) => {
    const e = equipment.find((x) => x.id === id)
    if (!e) return
    setUnits((us) => [...us, withKey(unitFromEquipment(e))])
    touch()
  }
  const removeUnit = (key: string) => { setUnits((us) => us.filter((u) => u._key !== key)); touch() }

  // ── Top-bar actions ────────────────────────────────────────────────────────

  const actions = (
    <>
      <StatusPill tone={STATUS_TONE[status]}>{STATUS_LABELS[status]}</StatusPill>
      {dirty && !locked && (
        <button type="button" onClick={save} disabled={saving} className={btnSecondary}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : null} Save
        </button>
      )}
      {status === 'draft' && !sections && (
        <button type="button" onClick={generate} disabled={generating || saving} className={btnPrimary}>
          {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
          {generating ? 'Drafting…' : 'Generate draft'}
        </button>
      )}
      {status === 'draft' && sections && (
        <button type="button" onClick={() => transition('submit')} disabled={statusBusy || generating} className={btnPrimary}>
          {statusBusy ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />} Submit for review
        </button>
      )}
      {status === 'in_review' && (
        <>
          <button type="button" onClick={() => transition('reopen')} disabled={statusBusy} className={btnSecondary}>
            <Undo2 size={15} /> Back to draft
          </button>
          {canApprove && (
            <button
              type="button"
              onClick={() => transition('approve')}
              disabled={statusBusy || blockers.length > 0}
              title={blockers.length ? blockers.join(' · ') : undefined}
              className={btnPrimary}
            >
              {statusBusy ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />} Approve
            </button>
          )}
        </>
      )}
      {status === 'approved' && (
        <>
          {canApprove && (
            <button type="button" onClick={() => transition('reopen')} disabled={statusBusy} className={btnSecondary}>
              <Undo2 size={15} /> Reopen
            </button>
          )}
          <Link href={`/print/case-study/${initial.id}`} className={btnPrimary}>
            <Printer size={15} /> Print / PDF
          </Link>
        </>
      )}
      <DeleteRecordButton
        endpoint={`/api/admin/case-studies/${initial.id}`}
        entityLabel="case study"
        redirectTo="/admin/case-studies"
      />
    </>
  )

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <PageChrome record={title || 'Untitled case study'}>{actions}</PageChrome>

      <div className="flex-1 min-h-0 overflow-y-auto bg-canvas">
        <div className="p-4 sm:p-6 max-w-[1500px]">
          {(error || notice) && (
            <div className={cn(
              'mb-4 px-4 py-2.5 rounded-lg border text-[13px]',
              error
                ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 text-rose-700 dark:text-rose-400'
                : 'border-hairline bg-surface text-ink-secondary',
            )}>
              {error || notice}
            </div>
          )}

          <div className="grid gap-5 lg:grid-cols-2 items-start">
            {/* ── LEFT: the inputs ─────────────────────────────────────────── */}
            <div className="grid gap-5">
              <EditorCard
                title="Customer & framing"
                caption="Anonymized studies never show the customer's name or serials — Claude doesn't even receive them."
              >
                <div className="grid gap-3.5">
                  <div className="flex items-center gap-2 text-[13px] text-ink-secondary">
                    <Building2 size={15} className="text-ink-muted" />
                    {initial.customers ? (
                      <>
                        <span className="font-medium text-ink">{initial.customers.company_name}</span>
                        <Link href={`/admin/customers/${initial.customers.id}`} className="text-[12px] text-brand-ink hover:underline">
                          View customer
                        </Link>
                      </>
                    ) : (
                      <span className="text-ink-muted">Not linked to a customer record</span>
                    )}
                  </div>
                  <label className="block">
                    <L>Working title</L>
                    <TextInput value={title} onChange={(e) => { setTitle(e.target.value); touch() }} disabled={locked} placeholder="Untitled case study" />
                  </label>
                  <div>
                    <L>Customer disclosure</L>
                    <div className="inline-flex rounded-lg border border-hairline overflow-hidden">
                      {(['anonymized', 'named'] as const).map((d) => (
                        <button
                          key={d}
                          type="button"
                          disabled={locked}
                          onClick={() => { setDisclosure(d); touch() }}
                          className={cn(
                            'inline-flex items-center gap-1.5 h-8 px-3 text-[12.5px] font-medium transition-colors disabled:opacity-60',
                            disclosure === d ? 'bg-brand-soft text-brand-ink' : 'bg-surface text-ink-muted hover:text-ink',
                          )}
                        >
                          {d === 'anonymized' && <EyeOff size={13} />}
                          {d === 'anonymized' ? 'Anonymized' : 'Named'}
                        </button>
                      ))}
                    </div>
                    {disclosure === 'named' && (
                      <p className="text-[11.5px] text-amber-600 dark:text-amber-400 mt-1.5">
                        Naming a customer publicly usually needs their sign-off — confirm before this leaves the building.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <label className="block">
                      <L>Industry</L>
                      <TextInput value={industry} onChange={(e) => { setIndustry(e.target.value); touch() }} disabled={locked} placeholder="e.g. Pharmaceutical" />
                    </label>
                    <label className="block">
                      <L>Region</L>
                      <TextInput value={region} onChange={(e) => { setRegion(e.target.value); touch() }} disabled={locked} placeholder="e.g. Southeast US" />
                    </label>
                  </div>
                </div>
              </EditorCard>

              <EditorCard
                title={`Units (${units.length})`}
                caption="Identity can auto-fill from Equipment; the application and conditions are the facts the story is grounded in — they must come from you."
              >
                <div className="grid gap-4">
                  {units.map((u, i) => (
                    <div key={u._key} className="rounded-lg border border-hairline-soft bg-surface-soft p-3.5">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Unit {i + 1}</span>
                        {!locked && (
                          <button type="button" onClick={() => removeUnit(u._key)} className="text-ink-faint hover:text-rose-500 transition-colors" aria-label={`Remove unit ${i + 1}`}>
                            <X size={15} />
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <label className="block">
                          <L required>Model number</L>
                          <TextInput value={u.model_number} onChange={(e) => setUnit(u._key, { model_number: e.target.value })} disabled={locked} placeholder="e.g. IAT-5000" />
                        </label>
                        <label className="block">
                          <L>Serial number</L>
                          <TextInput value={u.serial_number ?? ''} onChange={(e) => setUnit(u._key, { serial_number: e.target.value || null })} disabled={locked} />
                        </label>
                        <label className="block">
                          <L>Voltage</L>
                          <TextInput value={u.voltage ?? ''} onChange={(e) => setUnit(u._key, { voltage: e.target.value || null })} disabled={locked} placeholder="e.g. 460V/3ph/60Hz" />
                        </label>
                        <label className="block">
                          <L>Install date</L>
                          <TextInput type="date" value={u.install_date ?? ''} onChange={(e) => setUnit(u._key, { install_date: e.target.value || null })} disabled={locked} />
                        </label>
                        <label className="block col-span-2">
                          <L>Site / location</L>
                          <TextInput value={u.location ?? ''} onChange={(e) => setUnit(u._key, { location: e.target.value || null })} disabled={locked} placeholder="City, State" />
                        </label>
                        <label className="block col-span-2">
                          <L required>Application — what does this unit serve?</L>
                          <TextInput value={u.application} onChange={(e) => setUnit(u._key, { application: e.target.value })} disabled={locked} placeholder="e.g. Tablet coating room, 2,400 sq ft" />
                        </label>
                        <label className="block">
                          <L required>Entering conditions</L>
                          <TextInput value={u.entering_conditions} onChange={(e) => setUnit(u._key, { entering_conditions: e.target.value })} disabled={locked} placeholder="e.g. 85°F / 60% RH" />
                        </label>
                        <label className="block">
                          <L required>Target conditions</L>
                          <TextInput value={u.target_conditions} onChange={(e) => setUnit(u._key, { target_conditions: e.target.value })} disabled={locked} placeholder="e.g. 68°F / 35% RH" />
                        </label>
                        <label className="block">
                          <L required>Airflow</L>
                          <TextInput value={u.airflow} onChange={(e) => setUnit(u._key, { airflow: e.target.value })} disabled={locked} placeholder="e.g. 5,000 SCFM" />
                        </label>
                        <label className="block">
                          <L>Notes</L>
                          <TextInput value={u.notes ?? ''} onChange={(e) => setUnit(u._key, { notes: e.target.value || null })} disabled={locked} placeholder="Anything else notable" />
                        </label>
                      </div>
                    </div>
                  ))}

                  {!locked && (
                    <div className="flex items-center gap-2 flex-wrap">
                      <button type="button" onClick={addBlank} className={btnSecondary}>
                        <Plus size={15} /> Add unit
                      </button>
                      {equipment.length > 0 && (
                        <div className="relative">
                          <select
                            value=""
                            onChange={(e) => e.target.value && addFromEquipment(e.target.value)}
                            className="h-9 pl-3 pr-8 rounded-lg bg-surface-soft border border-hairline text-[13px] text-ink-secondary outline-none focus:border-brand cursor-pointer appearance-none"
                            aria-label="Add unit from equipment"
                          >
                            <option value="">Add from equipment…</option>
                            {equipment.map((e) => (
                              <option key={e.id} value={e.id}>
                                {e.serial_number}{e.model_number ? ` · ${e.model_number}` : ''}
                              </option>
                            ))}
                          </select>
                          <ChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-ink-muted" />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </EditorCard>

              <EditorCard
                title="The story"
                caption="Claude writes only from what you put here — anything you leave out, it can't (and won't) fill in."
              >
                <div className="grid gap-3.5">
                  <label className="block">
                    <L required>Project context</L>
                    <TextArea
                      value={context}
                      onChange={(e) => { setContext(e.target.value); touch() }}
                      disabled={locked}
                      placeholder="The background sales/marketing wants in the study: who the customer is operationally, why the project happened, constraints, timeline, anything that makes this one worth telling."
                      className="min-h-[120px]"
                    />
                  </label>
                  <label className="block">
                    <L required>The problem before</L>
                    <TextArea
                      value={before}
                      onChange={(e) => { setBefore(e.target.value); touch() }}
                      disabled={locked}
                      placeholder="What they were doing previously and what was failing about it — condensation, mold, product loss, downtime, a unit that couldn't keep up…"
                    />
                  </label>
                  <label className="block">
                    <L required>The outcome after</L>
                    <TextArea
                      value={after}
                      onChange={(e) => { setAfter(e.target.value); touch() }}
                      disabled={locked}
                      placeholder="The result, in whatever terms you actually have — conditions held, complaints stopped, line restarted. Numbers only if they're real; the draft can't use figures that aren't here."
                    />
                  </label>
                </div>
              </EditorCard>
            </div>

            {/* ── RIGHT: the draft + review ────────────────────────────────── */}
            <div className="grid gap-5">
              {!sections ? (
                <EditorCard title="Draft">
                  <div className="py-10 text-center">
                    <FileText size={28} className="mx-auto text-ink-faint" />
                    <p className="mt-3 text-[13.5px] font-medium text-ink">No draft yet</p>
                    <p className="mt-1 text-[12.5px] text-ink-muted max-w-sm mx-auto">
                      Fill in the required fields on the left, then Generate. Claude writes only
                      from your inputs — every number is checked against them, and anything it
                      couldn&apos;t source shows up here as a gap instead of a guess.
                    </p>
                    {missing.length > 0 && (
                      <p className="mt-3 text-[12px] text-ink-faint">
                        Still needed: {missing.slice(0, 3).join(' · ')}{missing.length > 3 ? ` · +${missing.length - 3} more` : ''}
                      </p>
                    )}
                  </div>
                </EditorCard>
              ) : (
                <>
                  {openGaps.length > 0 && (
                    <EditorCard tone="amber" title={`Gaps — input the draft needs (${openGaps.length})`} caption="Claude wanted these facts and was forbidden to invent them. Add the input and regenerate, or mark one resolved if the prose already reads right without it.">
                      <ul className="grid gap-2">
                        {gaps.map((g, i) => (
                          <li key={i} className={cn('flex items-start gap-2.5 text-[12.5px]', g.resolved && 'opacity-50')}>
                            <AlertTriangle size={14} className="text-amber-500 flex-shrink-0 mt-0.5" />
                            <span className="flex-1 text-ink-secondary">
                              <b className="font-semibold text-ink">{SECTION_LABELS[g.section as keyof typeof SECTION_LABELS] ?? g.section}:</b> {g.need}
                            </span>
                            {!locked && (
                              <button
                                type="button"
                                onClick={() => { setGaps((gs) => gs.map((x, xi) => (xi === i ? { ...x, resolved: !x.resolved } : x))); touch() }}
                                className="text-[11.5px] font-medium text-brand-ink hover:underline flex-shrink-0"
                              >
                                {g.resolved ? 'Reopen' : 'Mark resolved'}
                              </button>
                            )}
                          </li>
                        ))}
                      </ul>
                    </EditorCard>
                  )}

                  {openFlags.length > 0 && (
                    <EditorCard tone="rose" title={`Unverified numbers (${openFlags.length})`} caption="These figures appear in the prose but not in any input — the exact fabrication this tool exists to catch. Fix the text (or the inputs), or clear one if it's genuinely accounted for.">
                      <ul className="grid gap-2.5">
                        {flags.map((f, i) => (
                          <li key={i} className={cn('text-[12.5px]', f.cleared && 'opacity-50')}>
                            <div className="flex items-start gap-2.5">
                              <span className="px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400 font-semibold tabular-nums flex-shrink-0">{f.token}</span>
                              <span className="flex-1 min-w-0 text-ink-muted">
                                in <b className="font-semibold text-ink-secondary">{SECTION_LABELS[f.section as keyof typeof SECTION_LABELS] ?? f.section}</b>
                                <span className="block truncate text-ink-faint">{f.snippet}</span>
                              </span>
                              {!locked && (
                                <button
                                  type="button"
                                  onClick={() => { setFlags((fs) => fs.map((x, xi) => (xi === i ? { ...x, cleared: !x.cleared } : x))); touch() }}
                                  className="text-[11.5px] font-medium text-brand-ink hover:underline flex-shrink-0"
                                >
                                  {f.cleared ? 'Unclear' : 'Clear'}
                                </button>
                              )}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </EditorCard>
                  )}

                  <EditorCard
                    title={locked ? 'Approved case study' : 'Draft — review & edit'}
                    caption={locked
                      ? `Approved ${initial.approved_at ? new Date(initial.approved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''} · locked. Reopen to edit.`
                      : "Claude's original stays underneath each section — what you approve is what you see here."}
                  >
                    <div className="grid gap-4">
                      {SECTION_KEYS.map((k) => {
                        const changed = draftSections && sections[k] !== draftSections[k]
                        return (
                          <div key={k}>
                            <div className="flex items-center gap-2 mb-1.5">
                              <L>{SECTION_LABELS[k]}</L>
                              {changed && !locked && (
                                <button
                                  type="button"
                                  onClick={() => { setSections((s) => (s ? { ...s, [k]: draftSections![k] } : s)); touch() }}
                                  className="inline-flex items-center gap-1 text-[11px] text-ink-muted hover:text-ink transition-colors mb-1.5"
                                  title="Reset to Claude's original"
                                >
                                  <RotateCcw size={11} /> edited — reset
                                </button>
                              )}
                            </div>
                            {locked ? (
                              <p className="text-[13px] leading-relaxed text-ink whitespace-pre-wrap">{sections[k]}</p>
                            ) : (
                              <TextArea
                                value={sections[k]}
                                onChange={(e) => { setSections((s) => (s ? { ...s, [k]: e.target.value } : s)); touch() }}
                                className={k === 'title' ? 'min-h-[44px]' : k === 'summary' ? 'min-h-[70px]' : 'min-h-[110px]'}
                              />
                            )}
                            {!locked && changed && draftSections && (
                              <details className="mt-1">
                                <summary className="text-[11px] text-ink-faint cursor-pointer hover:text-ink-muted">Claude&apos;s original</summary>
                                <p className="mt-1 px-3 py-2 rounded-lg bg-surface-soft border border-hairline-soft text-[12px] leading-relaxed text-ink-muted whitespace-pre-wrap">
                                  {draftSections[k]}
                                </p>
                              </details>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  </EditorCard>

                  {claims.length > 0 && (
                    <EditorCard title="Where each fact came from" caption="Every factual claim in the draft, traced to the input it used.">
                      <button
                        type="button"
                        onClick={() => setShowClaims((v) => !v)}
                        className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-secondary hover:text-ink transition-colors"
                      >
                        <ChevronDown size={14} className={cn('transition-transform', showClaims && 'rotate-180')} />
                        {showClaims ? 'Hide' : 'Show'} {claims.length} claim{claims.length === 1 ? '' : 's'}
                      </button>
                      {showClaims && (
                        <ul className="mt-3 grid gap-2">
                          {claims.map((c, i) => (
                            <li key={i} className="text-[12.5px] text-ink-secondary flex items-start gap-2.5">
                              <span className="flex-1">{c.statement}</span>
                              <code className="px-1.5 py-0.5 rounded bg-surface-soft border border-hairline-soft text-[10.5px] text-ink-muted flex-shrink-0">{c.source}</code>
                            </li>
                          ))}
                        </ul>
                      )}
                    </EditorCard>
                  )}

                  <EditorCard title="Review notes" caption="Visible to everyone on the study — feedback, sign-off context, what to fix.">
                    <TextArea
                      value={reviewNotes}
                      onChange={(e) => { setReviewNotes(e.target.value); touch() }}
                      placeholder="e.g. Waiting on the customer's OK to be named; airflow figure confirmed with engineering."
                    />
                  </EditorCard>

                  {status === 'draft' && sections && !locked && (
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={generate} disabled={generating || saving} className={btnSecondary}>
                        {generating ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
                        {generating ? 'Drafting…' : 'Regenerate from inputs'}
                      </button>
                      <span className="text-[11.5px] text-ink-faint">Replaces the draft and your edits with a fresh pass over the current inputs.</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
