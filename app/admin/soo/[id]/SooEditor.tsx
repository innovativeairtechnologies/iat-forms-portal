'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, Check, EyeOff, FileText, Info, Printer, RefreshCw, Save } from 'lucide-react'
import PageChrome from '../../PageChrome'
import { StatusPill, type Tone } from '@/components/admin/list'
import {
  FACT_SPECS,
  applyOverrides,
  approvalBlockers,
  coerceFactValue,
  type AssemblyResult,
  type ClauseOverride,
  type FactKey,
  type RenderedClause,
  type SooDocument,
  type UnitFacts,
} from '@/lib/soo'
import type { FactConflict, SourceMethod } from '@/lib/soo-extract'
import FactReview, { type FactImpact, type Proposal } from './FactReview'

/* The Sequence of Operation editor.
 *
 * Two panes: the unit configuration on the left, the assembled document on the
 * right. Follows the proposals/case-study editor shape — plain <textarea> per
 * clause, NOT TipTap, because StarterKit silently drops any HTML its schema does
 * not model (which is how 133 Learn lessons were flattened) and a sequence is
 * numbered steps and tables, the two things it models worst.
 *
 * ── The one thing to get right here ─────────────────────────────────────────
 * The configuration form is ordered by BLAST RADIUS, not by document order.
 * Facts that gate clauses come first, each annotated with how many clauses its
 * current value switches on and off. A flat form gets clicked through, and
 * deterministic assembly will then render wrong facts with total confidence —
 * that is the failure that actually reaches the field. The "6 on · 3 off" chip
 * is what makes an engineer stop on the row that matters.
 *
 * The right pane always shows what was LEFT OUT ("23 clauses not applicable")
 * alongside what was included. A sequence you cannot audit for omissions is not
 * worth more than the Word file it replaced.
 */

const STATUS_TONE: Record<string, Tone> = { draft: 'slate', in_review: 'amber', approved: 'emerald' }
const STATUS_LABEL: Record<string, string> = { draft: 'Draft', in_review: 'In review', approved: 'Approved' }

const btn = 'inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[13px] font-medium transition-opacity disabled:opacity-50'
const btnGhost = `${btn} border border-hairline bg-surface text-ink-secondary hover:bg-surface-soft`
const btnBrand = `${btn} bg-brand text-white hover:opacity-90`

export default function SooEditor({
  doc: initial,
  impact,
  libraryVersion,
  canApprove,
}: {
  doc: SooDocument
  impact: FactImpact
  libraryVersion: number
  canApprove: boolean
}) {
  const router = useRouter()
  const [doc, setDoc] = useState<SooDocument>(initial)
  const [facts, setFacts] = useState<UnitFacts>((initial.facts ?? {}) as UnitFacts)
  const [overrides, setOverrides] = useState<ClauseOverride[]>(initial.overrides ?? [])
  const [provenance, setProvenance] = useState<Record<string, { page: number; snippet: string; method: SourceMethod }>>(
    (initial.provenance ?? {}) as Record<string, { page: number; snippet: string; method: SourceMethod }>
  )
  const [conflicts, setConflicts] = useState<FactConflict[]>((initial.conflicts ?? []) as unknown as FactConflict[])
  const [meta, setMeta] = useState({
    customer_name: initial.customer_name,
    project_name: initial.project_name,
    unit_tag: initial.unit_tag ?? '',
  })
  const [selected, setSelected] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showExcluded, setShowExcluded] = useState(false)

  const readOnly = doc.status === 'approved'
  const assembled = doc.assembled as AssemblyResult | null
  const withOverrides = useMemo(
    () => (assembled ? applyOverrides(assembled, overrides) : null),
    [assembled, overrides]
  )

  const blockers = useMemo(
    () => approvalBlockers({ ...doc, facts, overrides, conflicts: conflicts as unknown as Record<string, unknown>[] }),
    [doc, facts, overrides, conflicts]
  )

  const dirty =
    JSON.stringify(facts) !== JSON.stringify(doc.facts) ||
    JSON.stringify(overrides) !== JSON.stringify(doc.overrides ?? []) ||
    JSON.stringify(conflicts) !== JSON.stringify(doc.conflicts ?? []) ||
    meta.customer_name !== doc.customer_name ||
    meta.project_name !== doc.project_name ||
    (meta.unit_tag || null) !== doc.unit_tag

  const staleAssembly = !!assembled && JSON.stringify(facts) !== JSON.stringify(doc.facts)

  async function save() {
    setBusy('save'); setError(null)
    try {
      const res = await fetch(`/api/admin/soo/${doc.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...meta, unit_tag: meta.unit_tag || null, facts, overrides, provenance, conflicts }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error ?? 'Could not save.'); return }
      setDoc(data.document)
      setFacts((data.document.facts ?? {}) as UnitFacts)
      router.refresh()
    } finally { setBusy(null) }
  }

  async function runAssemble() {
    setBusy('assemble'); setError(null)
    try {
      // Save first — assembly reads the stored facts, so assembling with unsaved
      // edits would silently build the document from the previous configuration.
      if (dirty) {
        const s = await fetch(`/api/admin/soo/${doc.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...meta, unit_tag: meta.unit_tag || null, facts, overrides, provenance, conflicts }),
        })
        if (!s.ok) { setError((await s.json().catch(() => null))?.error ?? 'Could not save.'); return }
      }
      const res = await fetch(`/api/admin/soo/${doc.id}/assemble`, { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (!res.ok) { setError(data?.error ?? 'Could not assemble.'); return }
      setDoc(data.document)
      setOverrides(data.document.overrides ?? [])
      if (data.droppedOverrides > 0) {
        setError(`${data.droppedOverrides} edit${data.droppedOverrides === 1 ? '' : 's'} were dropped — their clauses no longer apply to this unit.`)
      }
      router.refresh()
    } finally { setBusy(null) }
  }

  async function setStatus(action: 'submit' | 'approve' | 'reopen') {
    setBusy(action); setError(null)
    try {
      const res = await fetch(`/api/admin/soo/${doc.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok) {
        setError([data?.error, ...(data?.blockers ?? [])].filter(Boolean).join(' · '))
        return
      }
      setDoc(data.document)
      router.refresh()
    } finally { setBusy(null) }
  }

  /**
   * A human edit always wins and always says so.
   *
   * `method: 'human'` is recorded alongside the value so the document can state
   * which facts a person typed rather than read — and so a later re-extraction
   * can warn before discarding them. It also outranks every reader in
   * PRECEDENCE, which is why an edit silently settles the conflict on that fact.
   */
  function setFact(key: FactKey, raw: string) {
    const value = coerceFactValue(key, raw)
    setFacts((f) => ({ ...f, [key]: value }))
    setProvenance((p) => ({
      ...p,
      [key]: { page: 0, snippet: value === null ? 'cleared by hand' : 'entered by hand', method: 'human' },
    }))
    setConflicts((c) => c.filter((x) => x.fact !== key))
  }

  function resolveConflict(fact: FactKey, value: unknown) {
    setFacts((f) => ({ ...f, [fact]: value }))
    setProvenance((p) => ({ ...p, [fact]: { page: 0, snippet: 'chosen by hand', method: 'human' } }))
    setConflicts((c) => c.filter((x) => x.fact !== fact))
  }

  function applyProposal(proposal: Proposal) {
    // The proposal REPLACES the fact set rather than merging into it: a merge
    // would leave values from a previous submittal sitting alongside the new
    // one with no way to tell which document each came from.
    setFacts(proposal.record.facts)
    setProvenance(proposal.record.provenance as Record<string, { page: number; snippet: string; method: SourceMethod }>)
    setConflicts(proposal.record.conflicts)
    const f = proposal.record.facts
    setMeta({
      customer_name: f.customer ?? '',
      project_name: f.project_name ?? '',
      unit_tag: f.unit_tag ?? '',
    })
  }

  function setOverride(key: string, text: string, original: string) {
    setOverrides((list) => {
      const rest = list.filter((o) => o.clause_key !== key)
      if (text === original) return rest
      const existing = list.find((o) => o.clause_key === key)
      return [...rest, { clause_key: key, text, ...(existing?.note ? { note: existing.note } : {}) }]
    })
  }

  function setOverrideNote(key: string, note: string) {
    setOverrides((list) => list.map((o) => (o.clause_key === key ? { ...o, note } : o)))
  }

  const gating = (Object.keys(FACT_SPECS) as FactKey[]).filter((k) => impact[k])
  const identity = (Object.keys(FACT_SPECS) as FactKey[]).filter((k) => FACT_SPECS[k].group === 'identity' && !impact[k])
  const design = (Object.keys(FACT_SPECS) as FactKey[]).filter((k) => FACT_SPECS[k].group === 'design' && FACT_SPECS[k].kind !== 'object')

  return (
    <>
      <PageChrome record={doc.project_name || doc.title || 'Sequence'}>
        <StatusPill tone={STATUS_TONE[doc.status] ?? 'slate'}>{STATUS_LABEL[doc.status] ?? doc.status}</StatusPill>
        {!readOnly && (
          <button type="button" onClick={save} disabled={!dirty || !!busy} className={btnGhost}>
            <Save size={14} /> {busy === 'save' ? 'Saving…' : 'Save'}
          </button>
        )}
        {!readOnly && (
          <button type="button" onClick={runAssemble} disabled={!!busy} className={btnBrand}>
            <RefreshCw size={14} /> {busy === 'assemble' ? 'Assembling…' : assembled ? 'Reassemble' : 'Assemble'}
          </button>
        )}
        {assembled && (
          <Link href={`/print/soo/${doc.id}`} className={btnGhost}>
            <Printer size={14} /> Print
          </Link>
        )}
        {doc.status === 'draft' && assembled && (
          <button type="button" onClick={() => setStatus('submit')} disabled={!!busy} className={btnGhost}>
            Submit for review
          </button>
        )}
        {doc.status === 'in_review' && canApprove && (
          <button type="button" onClick={() => setStatus('approve')} disabled={!!busy || blockers.length > 0} className={btnBrand}>
            <Check size={14} /> Approve
          </button>
        )}
        {doc.status !== 'draft' && (
          <button type="button" onClick={() => setStatus('reopen')} disabled={!!busy} className={btnGhost}>
            Reopen
          </button>
        )}
      </PageChrome>

      <div className="flex-1 min-h-0 overflow-y-auto bg-canvas">
        <div className="p-4 sm:p-6 grid grid-cols-1 xl:grid-cols-[minmax(0,420px)_minmax(0,1fr)] gap-5 items-start">

          {/* ── Left: the unit configuration ───────────────────────────── */}
          <div>
            {error && (
              <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3 mb-5">
                <p className="text-[13px] text-rose-700 dark:text-rose-300">{error}</p>
              </div>
            )}
            <FactReview
              docId={doc.id}
              facts={facts}
              provenance={provenance}
              conflicts={conflicts}
              impact={impact}
              readOnly={readOnly}
              submittalPath={doc.submittal_path}
              onChange={setFact}
              onExtracted={applyProposal}
              onResolveConflict={resolveConflict}
            />
          </div>

          {/* ── Right: the assembled document ──────────────────────────── */}
          <div className="space-y-5">
            {blockers.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50 dark:bg-amber-500/10 px-5 py-4">
                <p className="text-[13px] font-semibold text-amber-800 dark:text-amber-200 flex items-center gap-2 mb-2">
                  <AlertTriangle size={15} /> Not ready to approve
                </p>
                <ul className="space-y-1">
                  {blockers.map((b, i) => (
                    <li key={i} className="text-[12.5px] text-amber-700 dark:text-amber-300">· {b}</li>
                  ))}
                </ul>
              </div>
            )}

            {staleAssembly && (
              <div className="rounded-xl border border-hairline bg-surface-soft px-5 py-3">
                <p className="text-[12.5px] text-ink-secondary flex items-center gap-2">
                  <Info size={14} /> The configuration has changed since this was assembled. Reassemble to bring the document up to date.
                </p>
              </div>
            )}

            {!withOverrides && (
              <div className="rounded-xl border border-hairline bg-surface px-5 py-14 text-center">
                <FileText size={22} className="mx-auto text-ink-muted mb-3" />
                <p className="text-[13px] text-ink-secondary">Confirm the configuration, then assemble the sequence.</p>
              </div>
            )}

            {withOverrides && (
              <>
                <div className="rounded-xl border border-hairline bg-surface">
                  <div className="px-5 py-4 border-b border-hairline flex items-center gap-3 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-1">
                        Library v{doc.library_version ?? libraryVersion}
                      </p>
                      <h2 className="text-[15px] font-semibold text-ink">Sequence of Operation</h2>
                    </div>
                    <div className="flex-1" />
                    <span className="text-[12.5px] text-ink-muted tabular-nums">
                      {countClauses(withOverrides)} clauses
                    </span>
                  </div>

                  <div className="p-5 space-y-6">
                    {withOverrides.sections.map((s) => (
                      <div key={s.key}>
                        <h3 className="text-[13.5px] font-semibold text-ink mb-3">{s.title}</h3>
                        <ClauseList
                          clauses={s.clauses}
                          selected={selected}
                          onSelect={setSelected}
                          overrides={overrides}
                          original={assembled!}
                          onEdit={setOverride}
                          onNote={setOverrideNote}
                          readOnly={readOnly}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {withOverrides.uncovered.length > 0 && (
                  <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-5 py-4">
                    <p className="text-[13px] font-semibold text-rose-700 dark:text-rose-300 mb-2">
                      The master library has nothing for this configuration
                    </p>
                    {withOverrides.uncovered.map((u) => (
                      <p key={u.fact} className="text-[12.5px] text-rose-700 dark:text-rose-300">
                        · {u.why} — this unit is {u.value}.
                      </p>
                    ))}
                  </div>
                )}

                {withOverrides.blocked.length > 0 && (
                  <div className="rounded-xl border border-hairline bg-surface">
                    <div className="px-5 py-4 border-b border-hairline">
                      <h3 className="text-[13.5px] font-semibold text-ink">
                        Unresolved — {withOverrides.blocked.length} clause{withOverrides.blocked.length === 1 ? '' : 's'}
                      </h3>
                      <p className="text-[12.5px] text-ink-muted mt-1">
                        These are missing from the document until the facts they need are filled in.
                      </p>
                    </div>
                    <div className="p-5 space-y-2">
                      {withOverrides.blocked.map((b) => (
                        <div key={b.key} className="text-[12.5px]">
                          <span className="text-ink-secondary">{b.summary}</span>
                          <span className="text-ink-muted"> — {b.why}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* The completeness receipt. */}
                <div className="rounded-xl border border-hairline bg-surface">
                  <button
                    type="button"
                    onClick={() => setShowExcluded((v) => !v)}
                    className="w-full px-5 py-4 flex items-center gap-2 text-left"
                  >
                    <EyeOff size={15} className="text-ink-muted" />
                    <span className="text-[13.5px] font-semibold text-ink">
                      Not applicable to this unit — {withOverrides.excluded.length} clause{withOverrides.excluded.length === 1 ? '' : 's'}
                    </span>
                    <div className="flex-1" />
                    <span className="text-[12.5px] text-ink-muted">{showExcluded ? 'Hide' : 'Show'}</span>
                  </button>
                  {showExcluded && (
                    <div className="px-5 pb-5 space-y-1.5 border-t border-hairline pt-4">
                      {withOverrides.excluded.map((e) => (
                        <div key={e.key} className="text-[12.5px]">
                          <span className="text-ink-secondary">{e.summary}</span>
                          <span className="text-ink-muted"> — {e.why}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Pieces ──────────────────────────────────────────────────────────────────

const inputCls =
  'w-full h-9 px-2.5 rounded-lg bg-surface-soft border border-hairline text-[13px] text-ink outline-none focus:border-brand disabled:opacity-60'


function countClauses(r: AssemblyResult): number {
  let n = 0
  const walk = (cs: RenderedClause[]) => { for (const c of cs) { n += 1; walk(c.children) } }
  for (const s of r.sections) walk(s.clauses)
  return n
}

function findOriginal(r: AssemblyResult, key: string): string {
  let found = ''
  const walk = (cs: RenderedClause[]) => {
    for (const c of cs) { if (c.key === key) found = c.text; walk(c.children) }
  }
  for (const s of r.sections) walk(s.clauses)
  return found
}

function ClauseList({
  clauses, selected, onSelect, overrides, original, onEdit, onNote, readOnly,
}: {
  clauses: RenderedClause[]
  selected: string | null
  onSelect: (k: string | null) => void
  overrides: ClauseOverride[]
  original: AssemblyResult
  onEdit: (key: string, text: string, original: string) => void
  onNote: (key: string, note: string) => void
  readOnly: boolean
}) {
  return (
    <div className="space-y-1">
      {clauses.map((c) => {
        const isSelected = selected === c.key
        const override = overrides.find((o) => o.clause_key === c.key)
        const needsNote = !!override && c.usedConstants.length > 0 && !override.note?.trim()
        return (
          <div key={c.key} style={{ marginLeft: c.depth * 18 }}>
            {c.heading && <p className="text-[13px] font-semibold text-ink mt-3 mb-1.5">{c.heading}</p>}

            {c.text.trim() && (
              <button
                type="button"
                onClick={() => onSelect(isSelected ? null : c.key)}
                className={`w-full text-left rounded-lg px-3 py-2 transition-colors ${
                  isSelected ? 'bg-brand-soft' : 'hover:bg-surface-soft'
                }`}
              >
                <span className="text-[13px] text-ink-secondary leading-relaxed">
                  {c.depth > 0 && <span className="text-ink-muted">• </span>}
                  {c.text}
                </span>
                {override && (
                  <span className={`ml-2 inline-block text-[10.5px] font-semibold px-1.5 py-[1px] rounded ${
                    needsNote
                      ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      : 'bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-400'
                  }`}>
                    {needsNote ? 'edited — needs a note' : 'edited'}
                  </span>
                )}
              </button>
            )}

            {isSelected && (
              <div className="mt-2 mb-3 rounded-lg border border-hairline bg-surface-soft p-3 space-y-3">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Why this is here</p>
                  {c.because.length === 0
                    ? <p className="text-[12.5px] text-ink-muted">Always included — no conditions.</p>
                    : c.because.map((b, i) => <p key={i} className="text-[12.5px] text-ink-secondary">· {b}</p>)}
                </div>

                {c.usedFacts.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">From the submittal</p>
                    {c.usedFacts.map((f) => (
                      <p key={f.slot} className="text-[12.5px] text-ink-secondary">· {f.label}: <b className="font-semibold">{f.value}</b></p>
                    ))}
                  </div>
                )}

                {c.usedConstants.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Control constants</p>
                    {c.usedConstants.map((k) => (
                      <div key={k.slot} className="mb-1.5">
                        <p className="text-[12.5px] text-ink-secondary">· {k.label}: <b className="font-semibold">{k.value}</b></p>
                        <p className="text-[11.5px] text-ink-muted ml-3">{k.rationale}</p>
                      </div>
                    ))}
                  </div>
                )}

                {!readOnly && (
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-ink-muted mb-1.5">Text</p>
                    <textarea
                      value={c.text}
                      onChange={(e) => onEdit(c.key, e.target.value, findOriginal(original, c.key))}
                      rows={4}
                      className="w-full px-2.5 py-2 rounded-lg bg-surface border border-hairline text-[13px] text-ink leading-relaxed outline-none focus:border-brand resize-y"
                    />
                    {override && c.usedConstants.length > 0 && (
                      <div className="mt-2">
                        <p className="text-[11.5px] text-ink-secondary mb-1">
                          This clause carries a control constant. Say why it was changed — the approval gate requires it.
                        </p>
                        <input
                          value={override.note ?? ''}
                          onChange={(e) => onNote(c.key, e.target.value)}
                          placeholder="e.g. Agreed with the controls contractor, 2026-08-06"
                          className={inputCls}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {c.children.length > 0 && (
              <ClauseList
                clauses={c.children}
                selected={selected}
                onSelect={onSelect}
                overrides={overrides}
                original={original}
                onEdit={onEdit}
                onNote={onNote}
                readOnly={readOnly}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
