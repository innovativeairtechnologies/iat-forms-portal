'use client'

import { useRef, useState } from 'react'
import { AlertTriangle, Check, FileUp, Info, Loader2 } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import {
  FACT_SPECS,
  enumLabel,
  factValueLabel,
  type FactKey,
  type UnitFacts,
} from '@/lib/soo'
import type { FactConflict, SourceMethod, UnitFactsRecord } from '@/lib/soo-extract'

/* The unit-configuration panel: upload a submittal, then confirm what it says.
 *
 * ── The ordering is the feature ────────────────────────────────────────────
 * Rows are ordered by BLAST RADIUS, never by document order:
 *
 *   A · Conflicts        two readers disagree — you decide
 *   B · Gating facts     each one switches clauses in or out
 *   C · Identity         printed on the cover
 *   D · Design           printed in the body, never gates anything
 *   E · Not recognised   collapsed; the drift alarm
 *
 * A flat fifty-row table gets clicked through, and deterministic assembly then
 * renders the wrong facts with total confidence — which is the failure that
 * actually reaches the field. Two things fight that: every gating row carries
 * "N on · M off" so a reviewer can see which dropdowns move the document, and
 * every row states how many independent readers agreed, so "Schedule + model
 * number" can be skimmed while "only the second reader saw this" gets read.
 */

export type Proposal = {
  record: UnitFactsRecord
  modelNote: string | null
  pageCount: number
  dropped: { guideSpec: number; vendor: number }
}

export type FactImpact = Partial<Record<FactKey, { on: number; off: number }>>

const METHOD_LABEL: Record<SourceMethod, string> = {
  human: 'entered by hand',
  schedule: 'Schedule',
  duct: 'Duct connections',
  bullet: 'Specs list',
  model_number: 'Model number',
  llm: 'second reader only',
}

const inputCls =
  'w-full h-9 px-2.5 rounded-lg bg-surface-soft border border-hairline text-[13px] text-ink outline-none focus:border-brand disabled:opacity-60'

export default function FactReview({
  docId,
  facts,
  provenance,
  conflicts,
  impact,
  readOnly,
  submittalPath,
  onChange,
  onExtracted,
  onResolveConflict,
}: {
  docId: string
  facts: UnitFacts
  provenance: Record<string, { page: number; snippet: string; method: SourceMethod }>
  conflicts: FactConflict[]
  impact: FactImpact
  readOnly: boolean
  submittalPath: string | null
  onChange: (k: FactKey, raw: string) => void
  onExtracted: (p: Proposal) => void
  onResolveConflict: (fact: FactKey, value: unknown) => void
}) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [proposal, setProposal] = useState<Proposal | null>(null)
  const [showUnmapped, setShowUnmapped] = useState(false)

  async function upload(file: File) {
    setBusy('upload'); setError(null)
    try {
      const urlRes = await fetch('/api/admin/soo/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size }),
      })
      const urlJson = await urlRes.json().catch(() => ({}))
      if (!urlRes.ok) throw new Error(urlJson.error || 'Could not start the upload.')

      const sb = createSupabaseBrowser()
      const { error: upErr } = await sb.storage
        .from('soo-submittals')
        .uploadToSignedUrl(urlJson.path, urlJson.token, file, { contentType: 'application/pdf' })
      if (upErr) throw new Error(upErr.message || 'Upload failed.')

      setBusy('reading')
      const res = await fetch(`/api/admin/soo/${docId}/extract`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: urlJson.path }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Could not read the submittal.')

      setProposal(json as Proposal)
      onExtracted(json as Proposal)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    } finally {
      setBusy(null)
    }
  }

  const gating = (Object.keys(FACT_SPECS) as FactKey[]).filter((k) => impact[k])
  const identity = (Object.keys(FACT_SPECS) as FactKey[]).filter(
    (k) => FACT_SPECS[k].group === 'identity' && !impact[k]
  )
  const design = (Object.keys(FACT_SPECS) as FactKey[]).filter(
    (k) => FACT_SPECS[k].group === 'design' && FACT_SPECS[k].kind !== 'object'
  )
  const unknownGating = gating.filter((k) => (facts as Record<string, unknown>)[k] == null)

  const row = (k: FactKey) => (
    <FactRow
      key={k}
      k={k}
      facts={facts}
      prov={provenance[k]}
      agreement={proposal?.record.agreement?.[k]}
      impact={impact[k]}
      disabled={readOnly}
      onChange={onChange}
    />
  )

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 px-4 py-3">
          <p className="text-[13px] text-rose-700 dark:text-rose-300">{error}</p>
        </div>
      )}

      {/* ── Upload ─────────────────────────────────────────────────────── */}
      {!readOnly && (
        <div className="rounded-xl border border-hairline bg-surface">
          <div className="px-5 py-4 border-b border-hairline">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-1">Step one</p>
            <h2 className="text-[15px] font-semibold text-ink">Read the DryWare submittal</h2>
            <p className="text-[12.5px] text-ink-muted mt-1">
              The PDF is kept — it is the evidence behind every value below, so you can always check where a number came from.
            </p>
          </div>
          <div className="p-5">
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) upload(f)
                e.target.value = ''
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={!!busy}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {busy ? <Loader2 size={15} className="animate-spin" /> : <FileUp size={15} />}
              {busy === 'upload' ? 'Uploading…' : busy === 'reading' ? 'Reading…' : submittalPath ? 'Read another submittal' : 'Upload submittal'}
            </button>

            {proposal && (
              <div className="mt-4 space-y-1.5">
                <p className="text-[12.5px] text-ink-secondary">
                  Read {proposal.pageCount} pages. Set aside {proposal.dropped.guideSpec} pages of generic
                  specification and {proposal.dropped.vendor} pages of vendor literature — neither describes this unit.
                </p>
                {proposal.modelNote && (
                  <p className="text-[12.5px] text-amber-600 dark:text-amber-400 flex items-start gap-1.5">
                    <Info size={14} className="flex-shrink-0 mt-0.5" /> {proposal.modelNote}
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── A · Conflicts ──────────────────────────────────────────────── */}
      {conflicts.length > 0 && (
        <div className="rounded-xl border border-rose-200 dark:border-rose-500/30 bg-surface">
          <div className="px-5 py-4 border-b border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-rose-600 dark:text-rose-400 mb-1">
              Read these first
            </p>
            <h2 className="text-[15px] font-semibold text-rose-800 dark:text-rose-200 flex items-center gap-2">
              <AlertTriangle size={16} /> {conflicts.length} disagreement{conflicts.length === 1 ? '' : 's'}
            </h2>
            <p className="text-[12.5px] text-rose-700 dark:text-rose-300 mt-1">
              Two readers of the submittal reached different answers. Pick the right one — approval is blocked until you do.
            </p>
          </div>
          <div className="p-5 space-y-4">
            {conflicts.map((c) => (
              <div key={c.fact}>
                <p className="text-[13px] font-semibold text-ink mb-1.5">{c.label}</p>
                <div className="space-y-1.5">
                  {c.sources.map((s, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={readOnly}
                      onClick={() => onResolveConflict(c.fact, s.value)}
                      className="w-full text-left rounded-lg border border-hairline px-3 py-2 hover:bg-surface-soft transition-colors disabled:opacity-60"
                    >
                      <span className="text-[13px] text-ink">{factValueLabel(c.fact, s.value)}</span>
                      <span className="text-[11.5px] text-ink-muted ml-2">
                        {METHOD_LABEL[s.method]}{s.page ? ` · page ${s.page}` : ''}
                      </span>
                      <span className="block text-[11.5px] text-ink-muted mt-0.5 truncate">“{s.snippet}”</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── B · Gating facts ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-hairline bg-surface">
        <div className="px-5 py-4 border-b border-hairline">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-1">Confirm carefully</p>
          <h2 className="text-[15px] font-semibold text-ink">Configuration that changes the sequence</h2>
          <p className="text-[12.5px] text-ink-muted mt-1">
            Each of these switches clauses in or out. The counts show what the current value does — a row moving
            six clauses deserves a second look against the submittal.
          </p>
          {unknownGating.length > 0 && (
            <p className="text-[12.5px] text-amber-600 dark:text-amber-400 mt-2">
              {unknownGating.length} still unknown. Their clauses are held back rather than guessed.
            </p>
          )}
        </div>
        <div className="p-5 space-y-3.5">{gating.map(row)}</div>
      </div>

      {/* ── C · Identity ───────────────────────────────────────────────── */}
      <div className="rounded-xl border border-hairline bg-surface">
        <div className="px-5 py-4 border-b border-hairline">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-1">Reference</p>
          <h2 className="text-[15px] font-semibold text-ink">Identity</h2>
        </div>
        <div className="p-5 space-y-3.5">{identity.map(row)}</div>
      </div>

      {/* ── D · Design conditions ──────────────────────────────────────── */}
      <div className="rounded-xl border border-hairline bg-surface">
        <div className="px-5 py-4 border-b border-hairline">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-1">Reference</p>
          <h2 className="text-[15px] font-semibold text-ink">Design conditions</h2>
          <p className="text-[12.5px] text-ink-muted mt-1">Printed on the document. These never decide which clauses apply.</p>
        </div>
        <div className="p-5 space-y-3.5">{design.map(row)}</div>
      </div>

      {/* ── E · Not recognised ─────────────────────────────────────────── */}
      {proposal && proposal.record.unmapped.length > 0 && (
        <div className="rounded-xl border border-hairline bg-surface">
          <button
            type="button"
            onClick={() => setShowUnmapped((v) => !v)}
            className="w-full px-5 py-4 flex items-center gap-2 text-left"
          >
            <span className="text-[13.5px] font-semibold text-ink">
              {proposal.record.unmapped.length} line{proposal.record.unmapped.length === 1 ? '' : 's'} we didn’t recognise
            </span>
            <div className="flex-1" />
            <span className="text-[12.5px] text-ink-muted">{showUnmapped ? 'Hide' : 'Show'}</span>
          </button>
          {showUnmapped && (
            <div className="px-5 pb-5 pt-4 border-t border-hairline space-y-1.5">
              <p className="text-[12.5px] text-ink-muted mb-2">
                Nothing is wrong if this list is short. It grows when DryWare changes its layout — worth a look then.
              </p>
              {proposal.record.unmapped.map((u, i) => (
                <p key={i} className="text-[12.5px] text-ink-secondary">
                  <span className="text-ink-muted">p.{u.page}</span> {u.group ? `[${u.group}] ` : ''}{u.text}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── One fact ────────────────────────────────────────────────────────────────

function FactRow({
  k, facts, prov, agreement, impact, disabled, onChange,
}: {
  k: FactKey
  facts: UnitFacts
  prov?: { page: number; snippet: string; method: SourceMethod }
  agreement?: number
  impact?: { on: number; off: number }
  disabled: boolean
  onChange: (k: FactKey, v: string) => void
}) {
  const spec = FACT_SPECS[k]
  const raw = (facts as Record<string, unknown>)[k]
  const value = raw === null || raw === undefined ? '' : String(raw)
  const unknown = raw === null || raw === undefined

  // Two independent readings agreeing is the signal that lets a reviewer skim
  // a row; one reading — especially the model's — is the signal to read it.
  const corroborated = (agreement ?? 0) > 1
  const modelOnly = prov?.method === 'llm'

  return (
    <div>
      <div className="flex items-center gap-2 mb-1 flex-wrap">
        <span className="text-[12px] text-ink-secondary">{spec.label}</span>
        {spec.unit && <span className="text-[11px] text-ink-muted">({spec.unit})</span>}
        <div className="flex-1" />
        {impact && (
          <span className="text-[10.5px] tabular-nums text-ink-muted">
            <b className="font-semibold text-ink-secondary">{impact.on}</b> on ·{' '}
            <b className="font-semibold text-ink-secondary">{impact.off}</b> off
          </span>
        )}
        {unknown && impact && (
          <span className="text-[10.5px] font-semibold px-1.5 py-[1px] rounded bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400">
            unknown
          </span>
        )}
      </div>

      {spec.kind === 'boolean' && (
        <select value={value} onChange={(e) => onChange(k, e.target.value)} disabled={disabled} className={inputCls}>
          <option value="">Unknown</option>
          <option value="true">Yes</option>
          <option value="false">No</option>
        </select>
      )}
      {spec.kind === 'enum' && (
        <select value={value} onChange={(e) => onChange(k, e.target.value)} disabled={disabled} className={inputCls}>
          <option value="">Unknown</option>
          {spec.options?.map((o) => <option key={o} value={o}>{enumLabel(o)}</option>)}
        </select>
      )}
      {(spec.kind === 'number' || spec.kind === 'string') && (
        <input
          value={value}
          onChange={(e) => onChange(k, e.target.value)}
          disabled={disabled}
          inputMode={spec.kind === 'number' ? 'decimal' : undefined}
          className={inputCls}
        />
      )}

      {prov && !unknown && (
        <p className="text-[11.5px] mt-1 flex items-center gap-1.5 flex-wrap">
          {corroborated ? (
            <span className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
              <Check size={12} /> {agreement} readings agree
            </span>
          ) : modelOnly ? (
            <span className="text-amber-600 dark:text-amber-400">Only the second reader saw this — worth checking</span>
          ) : (
            <span className="text-ink-muted">{METHOD_LABEL[prov.method]}</span>
          )}
          {prov.page > 0 && <span className="text-ink-muted">· page {prov.page}</span>}
          {prov.snippet && <span className="text-ink-muted truncate">· “{prov.snippet.slice(0, 70)}”</span>}
        </p>
      )}
    </div>
  )
}
