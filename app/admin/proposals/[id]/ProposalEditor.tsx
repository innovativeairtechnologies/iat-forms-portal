'use client'

import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Download, Loader2, ShieldCheck, Sparkles } from 'lucide-react'
import PageChrome from '../../PageChrome'
import { StatusPill, type Tone } from '@/components/admin/list'
import {
  allowedTokens,
  approvalBlockers,
  blankSections,
  checkDigits,
  missingForGenerate,
  SECTION_LABELS,
  type DigitFlag,
  type Gap,
  type Proposal,
  type ProposalStatus,
  type Sections,
} from '@/lib/proposals'

/* The proposal editor.
 *
 * Follows the case-study editor's shape deliberately: plain <textarea> per
 * section, PageChrome for the top bar, inputs left / review right. NOT TipTap —
 * StarterKit silently drops any HTML its schema does not model, which is how 133
 * Learn lessons were flattened, and AI-generated prose is exactly the sort of
 * content that arrives with unmodelled markup.
 */

const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
}
const STATUS_TONE: Record<ProposalStatus, Tone> = {
  draft: 'slate',
  in_review: 'amber',
  approved: 'emerald',
}

const inputCx =
  'h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-ink transition-colors placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60'
const areaCx =
  'w-full rounded-lg border border-hairline bg-surface px-2.5 py-2 text-[13px] leading-relaxed text-ink transition-colors placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60'
const btnPrimary =
  'inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const btnSecondary =
  'inline-flex h-9 items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

function Card({ children, tone }: { children: ReactNode; tone?: 'amber' | 'rose' }) {
  const border =
    tone === 'rose'
      ? 'border-rose-200 dark:border-rose-500/30'
      : tone === 'amber'
        ? 'border-amber-200 dark:border-amber-500/30'
        : 'border-hairline'
  return <div className={`rounded-xl border ${border} bg-surface`}>{children}</div>
}

function Head({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline px-5 py-3.5">
      <h2 className="text-[15px] font-semibold tracking-[-0.011em] text-ink">{title}</h2>
      {caption && <p className="text-[12px] text-ink-muted">{caption}</p>}
    </div>
  )
}

function L({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[12px] font-medium text-ink-secondary">{children}</p>
}

export default function ProposalEditor({
  initial,
  canApprove,
}: {
  initial: Proposal
  canApprove: boolean
}) {
  const router = useRouter()
  const [p, setP] = useState<Proposal>(initial)
  const [sections, setSections] = useState<Sections>(
    (initial.edited_sections as Sections) ?? blankSections(),
  )
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState<null | 'save' | 'generate' | 'verify' | 'status' | 'pdf'>(null)
  const [error, setError] = useState('')
  const [blocked, setBlocked] = useState<{ reason: string; fields: string[] } | null>(null)

  const locked = p.status === 'approved'

  const setField = <K extends keyof Proposal>(key: K, value: Proposal[K]) => {
    setP((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }
  const setSection = (key: keyof Sections, value: string) => {
    setSections((prev) => ({ ...prev, [key]: value }))
    setDirty(true)
  }

  // Recomputed live so a figure typed into the draft is flagged as it is typed,
  // not only when the server saves it. The server re-derives the same list on
  // every PATCH — this copy is for the UI.
  const liveFlags: DigitFlag[] = useMemo(() => {
    const stored = (p.flags ?? []) as DigitFlag[]
    return checkDigits(sections, allowedTokens(p)).map((f) => ({
      ...f,
      cleared: stored.some((s) => s.token === f.token && s.section === f.section && s.cleared),
    }))
  }, [sections, p])

  const gaps = (p.gaps ?? []) as Gap[]
  const missing = missingForGenerate(p)
  const blockers = approvalBlockers({
    edited_sections: sections,
    gaps,
    flags: liveFlags,
  })

  const save = useCallback(async (): Promise<boolean> => {
    setBusy('save')
    setError('')
    try {
      const res = await fetch(`/api/admin/proposals/${p.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: p.title,
          customer_name: p.customer_name,
          job_name: p.job_name,
          site_location: p.site_location,
          prepared_for: p.prepared_for,
          application_input: p.application_input,
          requirements_input: p.requirements_input,
          review_notes: p.review_notes,
          edited_sections: sections,
          gaps,
        }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not save.')
        return false
      }
      setP(json.proposal)
      setDirty(false)
      return true
    } finally {
      setBusy(null)
    }
  }, [p, sections, gaps])

  const generate = async () => {
    if (dirty && !(await save())) return
    setBusy('generate')
    setError('')
    setBlocked(null)
    try {
      const res = await fetch(`/api/admin/proposals/${p.id}/generate`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        // A refusal is not a failure to be retried — show Claude's own words.
        if (json.blocked?.reason) setBlocked(json.blocked)
        else setError([json.error, (json.missing ?? []).join(', ')].filter(Boolean).join(' '))
        return
      }
      setSections(json.sections)
      setP((prev) => ({ ...prev, ...json, edited_sections: json.sections, status: 'draft' }))
      setDirty(false)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const verify = async () => {
    setBusy('verify')
    setError('')
    try {
      const res = await fetch(`/api/admin/proposals/${p.id}/verify`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error || 'Could not verify against DryWare.')
        return
      }
      setP(json.proposal)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const transition = async (action: 'submit' | 'approve' | 'reopen') => {
    if (dirty && !(await save())) return
    setBusy('status')
    setError('')
    try {
      const res = await fetch(`/api/admin/proposals/${p.id}/status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError([json.error, (json.blockers ?? []).join(' ')].filter(Boolean).join(' '))
        return
      }
      setP(json.proposal)
      router.refresh()
    } finally {
      setBusy(null)
    }
  }

  const downloadPdf = async () => {
    setBusy('pdf')
    setError('')
    try {
      const { generateProposalPDF } = await import('@/lib/proposal-pdf')
      const blob = await generateProposalPDF({
        title: p.title,
        customer_name: p.customer_name,
        job_name: p.job_name,
        site_location: p.site_location,
        prepared_for: p.prepared_for,
        status: p.status,
        sections,
        sizing_result: p.sizing_result,
        verification: p.verification,
        reference: p.id.slice(0, 8).toUpperCase(),
        dateLabel: new Date().toLocaleDateString('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
        }),
      })

      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `IAT-Proposal-${(p.job_name || p.customer_name || 'draft').replace(/[^a-z0-9]+/gi, '-')}${p.status === 'approved' ? '' : '-DRAFT'}.pdf`
      a.click()
      URL.revokeObjectURL(url)

      // Archive only the approved artifact — a watermarked draft is disposable.
      if (p.status === 'approved') {
        const signed = await fetch(`/api/admin/proposals/${p.id}/pdf`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ size: blob.size }),
        })
        const sj = await signed.json()
        if (signed.ok) {
          const { createSupabaseBrowser } = await import('@/lib/supabase-browser')
          const sb = createSupabaseBrowser()
          const { error: upErr } = await sb.storage
            .from('proposal-docs')
            .uploadToSignedUrl(sj.path, sj.token, blob, { contentType: 'application/pdf' })
          if (!upErr) {
            await fetch(`/api/admin/proposals/${p.id}/pdf`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ path: sj.path }),
            })
            router.refresh()
          }
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not build the PDF.')
    } finally {
      setBusy(null)
    }
  }

  const toggleFlag = (i: number) => {
    const next = liveFlags.map((f, idx) => (idx === i ? { ...f, cleared: !f.cleared } : f))
    setP((prev) => ({ ...prev, flags: next }))
    void fetch(`/api/admin/proposals/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ flags: next }),
    })
  }

  const toggleGap = (i: number) => {
    const next = gaps.map((g, idx) => (idx === i ? { ...g, resolved: !g.resolved } : g))
    setP((prev) => ({ ...prev, gaps: next }))
    void fetch(`/api/admin/proposals/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gaps: next }),
    })
  }

  const sel = p.sizing_result?.selection

  return (
    <>
      <PageChrome record={p.title || 'Untitled proposal'}>
        <StatusPill tone={STATUS_TONE[p.status]}>{STATUS_LABELS[p.status]}</StatusPill>
        {dirty && !locked && (
          <button type="button" onClick={save} disabled={busy !== null} className={btnSecondary}>
            {busy === 'save' ? <Loader2 size={15} className="animate-spin" /> : null}
            Save
          </button>
        )}
        <button type="button" onClick={downloadPdf} disabled={busy !== null} className={btnSecondary}>
          {busy === 'pdf' ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {p.status === 'approved' ? 'PDF' : 'Draft PDF'}
        </button>

        {p.status === 'draft' && (
          <button type="button" onClick={generate} disabled={busy !== null || missing.length > 0}
            title={missing.length > 0 ? `Still needed: ${missing.join(', ')}` : undefined}
            className={btnPrimary}>
            {busy === 'generate' ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
            {p.draft_sections ? 'Redraft' : 'Draft with Claude'}
          </button>
        )}
        {p.status === 'draft' && p.draft_sections && (
          <button type="button" onClick={() => transition('submit')} disabled={busy !== null} className={btnSecondary}>
            Submit for review
          </button>
        )}
        {p.status === 'in_review' && (
          <>
            <button type="button" onClick={() => transition('reopen')} disabled={busy !== null} className={btnSecondary}>
              Back to draft
            </button>
            {canApprove && (
              <button type="button" onClick={() => transition('approve')}
                disabled={busy !== null || blockers.length > 0}
                title={blockers.length > 0 ? blockers.join(' ') : 'Approve and lift the draft watermark'}
                className={btnPrimary}>
                Approve
              </button>
            )}
          </>
        )}
        {p.status === 'approved' && canApprove && (
          <button type="button" onClick={() => transition('reopen')} disabled={busy !== null} className={btnSecondary}>
            Reopen
          </button>
        )}
      </PageChrome>

      <div className="flex-1 overflow-y-auto bg-canvas">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          {error && (
            <div className="mb-4 rounded-xl border border-rose-200 bg-surface px-5 py-3 text-[13px] text-rose-700 dark:border-rose-500/30 dark:text-rose-400">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ── Left: the inputs ─────────────────────────────────────────── */}
            <div className="space-y-6">
              <Card>
                <Head title="Customer & project" />
                <div className="space-y-4 px-5 py-4">
                  <div>
                    <L>Proposal title</L>
                    <input className={inputCx} value={p.title} disabled={locked}
                      onChange={(e) => setField('title', e.target.value)} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <L>Customer</L>
                      <input className={inputCx} value={p.customer_name} disabled={locked}
                        onChange={(e) => setField('customer_name', e.target.value)} />
                    </div>
                    <div>
                      <L>Job name</L>
                      <input className={inputCx} value={p.job_name} disabled={locked}
                        onChange={(e) => setField('job_name', e.target.value)} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <L>Site</L>
                      <input className={inputCx} value={p.site_location ?? ''} disabled={locked}
                        onChange={(e) => setField('site_location', e.target.value)} />
                    </div>
                    <div>
                      <L>Attention</L>
                      <input className={inputCx} value={p.prepared_for ?? ''} disabled={locked}
                        onChange={(e) => setField('prepared_for', e.target.value)} />
                    </div>
                  </div>
                </div>
              </Card>

              <Card>
                <Head title="What Claude drafts from"
                  caption="Prose only — it is never shown a figure" />
                <div className="space-y-4 px-5 py-4">
                  <div>
                    <L>What the space is used for</L>
                    <textarea className={areaCx} rows={4} value={p.application_input} disabled={locked}
                      placeholder="A packaging room that has to stay dry year round…"
                      onChange={(e) => setField('application_input', e.target.value)} />
                  </div>
                  <div>
                    <L>What the customer needs</L>
                    <textarea className={areaCx} rows={4} value={p.requirements_input} disabled={locked}
                      placeholder="Stop condensation on the fillers; the existing air handler stays…"
                      onChange={(e) => setField('requirements_input', e.target.value)} />
                  </div>
                  {missing.length > 0 && (
                    <p className="text-[12px] text-ink-muted">
                      Still needed before drafting: {missing.join(', ')}.
                    </p>
                  )}
                </div>
              </Card>

              <Card>
                <Head title="Selection"
                  caption={p.catalog_source === 'fallback' ? 'Built-in catalog' : undefined} />
                <div className="px-5 py-4">
                  {sel ? (
                    <>
                      <p className="text-[15px] font-semibold tabular-nums text-ink">
                        {sel.unitsRequired > 1 && <span className="text-ink-secondary">{sel.unitsRequired} × </span>}
                        {sel.model}
                      </p>
                      <p className="mt-1 text-[12px] tabular-nums text-ink-muted">
                        {sel.wheelDiameterMm} × {sel.wheelDepthMm} mm rotor · {sel.faceVelocityFpm.toFixed(0)} fpm
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {p.verification ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
                            <ShieldCheck size={12} /> Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-1 text-[10px] font-semibold text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                            Preliminary
                          </span>
                        )}
                        {!locked && (
                          <button type="button" onClick={verify} disabled={busy !== null} className={btnSecondary}>
                            {busy === 'verify' ? <Loader2 size={15} className="animate-spin" /> : <ShieldCheck size={15} />}
                            {p.verification ? 'Re-verify' : 'Verify with DryWare'}
                          </button>
                        )}
                      </div>
                      {!p.verification && (
                        <p className="mt-3 text-[12px] text-ink-muted">
                          Wheel performance is a planning estimate until verified. Those coefficients
                          are conservative, so an unverified proposal may quote a larger unit than the
                          job needs.
                        </p>
                      )}
                    </>
                  ) : (
                    <p className="text-[13px] text-ink-secondary">
                      No sizing selection attached. Start a proposal from a Sizing Studio run to
                      carry one across — every figure on the PDF comes from it.
                    </p>
                  )}
                </div>
              </Card>
            </div>

            {/* ── Right: the draft and its review ──────────────────────────── */}
            <div className="space-y-6">
              {blocked && (
                <Card tone="rose">
                  <Head title="Claude declined to draft this" />
                  <div className="px-5 py-4">
                    <p className="text-[13px] text-ink-secondary">{blocked.reason}</p>
                    {blocked.fields.length > 0 && (
                      <p className="mt-2 flex flex-wrap gap-1.5">
                        {blocked.fields.map((f) => (
                          <code key={f} className="rounded bg-surface-strong px-1.5 py-0.5 text-[11px] text-ink-secondary">{f}</code>
                        ))}
                      </p>
                    )}
                    <p className="mt-2 text-[12px] text-ink-muted">
                      Retrying with the same inputs will land here again.
                    </p>
                  </div>
                </Card>
              )}

              {liveFlags.length > 0 && (
                <Card tone="rose">
                  <Head title="Figures written by the model"
                    caption={`${liveFlags.filter((f) => !f.cleared).length} to clear`} />
                  <div className="space-y-3 px-5 py-4">
                    <p className="text-[12px] text-ink-muted">
                      Every number on a proposal should come from the sizing snapshot, not from
                      prose. Check each of these against the selection, then clear it or edit it out.
                    </p>
                    {liveFlags.map((f, i) => (
                      <div key={`${f.section}-${f.token}-${i}`} className="flex items-start justify-between gap-3 border-t border-hairline pt-3">
                        <div className="min-w-0">
                          <code className="rounded bg-surface-strong px-1.5 py-0.5 text-[12px] font-semibold text-ink">{f.token}</code>
                          <span className="ml-2 text-[11px] uppercase tracking-[0.06em] text-ink-muted">
                            {SECTION_LABELS[f.section as keyof Sections] ?? f.section}
                          </span>
                          <p className="mt-1 text-[12px] text-ink-secondary">{f.snippet}</p>
                        </div>
                        <button type="button" onClick={() => toggleFlag(i)} disabled={locked} className={btnSecondary}>
                          {f.cleared ? 'Unclear' : 'Clear'}
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              {gaps.length > 0 && (
                <Card tone="amber">
                  <Head title="Gaps the draft needs" />
                  <div className="space-y-3 px-5 py-4">
                    {gaps.map((g, i) => (
                      <div key={i} className="flex items-start justify-between gap-3 border-t border-hairline pt-3 first:border-0 first:pt-0">
                        <p className={`text-[13px] ${g.resolved ? 'text-ink-faint line-through' : 'text-ink-secondary'}`}>
                          {g.need}
                        </p>
                        <button type="button" onClick={() => toggleGap(i)} disabled={locked} className={btnSecondary}>
                          {g.resolved ? 'Reopen' : 'Resolved'}
                        </button>
                      </div>
                    ))}
                  </div>
                </Card>
              )}

              <Card>
                <Head title="The document"
                  caption={locked ? 'Approved — reopen to edit' : undefined} />
                <div className="space-y-4 px-5 py-4">
                  {(['cover_letter', 'scope', 'exclusions', 'notes'] as const).map((key) => (
                    <div key={key}>
                      <L>
                        {SECTION_LABELS[key]}
                        {(key === 'cover_letter' || key === 'scope') && (
                          <span className="ml-1.5 text-[11px] font-normal text-ink-faint">drafted by Claude</span>
                        )}
                      </L>
                      <textarea
                        className={areaCx}
                        rows={key === 'cover_letter' ? 8 : key === 'scope' ? 10 : 5}
                        value={sections[key]}
                        disabled={locked}
                        onChange={(e) => setSection(key, e.target.value)}
                      />
                    </div>
                  ))}
                </div>
              </Card>

              {p.status !== 'draft' && (
                <Card>
                  <Head title="Review notes" />
                  <div className="px-5 py-4">
                    <textarea className={areaCx} rows={3} value={p.review_notes ?? ''}
                      onChange={(e) => setField('review_notes', e.target.value)} />
                    {blockers.length > 0 && (
                      <ul className="mt-3 space-y-1">
                        {blockers.map((b) => (
                          <li key={b} className="text-[12px] text-ink-muted">— {b}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </Card>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
