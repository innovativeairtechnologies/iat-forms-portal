'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'
import {
  Camera, Check, CircleAlert, Loader2, Mic, Repeat2, RotateCcw, Sparkles, Video, X,
} from 'lucide-react'
import PageChrome from '@/app/admin/PageChrome'
import { ListCardPage, ListCard } from '@/components/admin/list-card'
import {
  CATEGORY_LABELS, SEVERITY_LABELS, clock, humanBytes, mediaSrc, shortDate, standingOf,
  type PpFindingRow, type PpThemeRow,
} from '@/lib/post-production'
import { CategoryChip, FindingStatusChip, SeverityChip, StandingChip } from '../ui'

const BTN =
  'inline-flex items-center gap-1.5 h-9 px-3 rounded-lg border border-hairline-strong bg-surface text-[13px] ' +
  'font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors disabled:opacity-40'

const PRIMARY =
  'inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium ' +
  'hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-40 disabled:active:scale-100'

const FIELD =
  'h-9 rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-ink ' +
  'hover:border-hairline-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors'

type Candidate = {
  finding_id: string; job_number: string; note: string
  category: string; severity: string; status: string
  theme_id: string | null; theme_title: string | null; created_at: string; rank: number
}

export default function FindingDetailClient({
  finding, assignees, themes,
}: {
  finding: PpFindingRow
  assignees: { id: string; name: string }[]
  themes: PpThemeRow[]
}) {
  const router = useRouter()
  const [, startTransition] = useTransition()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [resolution, setResolution] = useState(finding.resolution ?? '')
  const [similar, setSimilar] = useState<Candidate[] | null>(null)
  const [matching, setMatching] = useState(false)

  const standing = standingOf(finding)
  const theme = themes.find(t => t.id === finding.theme_id) ?? null

  const save = async (body: Record<string, unknown>) => {
    setBusy(true); setError('')
    const res = await fetch(`/api/admin/post-production/findings/${finding.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(json.error || 'Could not save that.'); return false }
    startTransition(() => router.refresh())
    return true
  }

  const loadSimilar = async () => {
    setMatching(true)
    const res = await fetch(`/api/admin/post-production/findings/${finding.id}/match`)
    const json = await res.json().catch(() => ({}))
    setMatching(false)
    setSimilar(res.ok ? (json.candidates ?? []) : [])
  }

  const runMatch = async () => {
    setMatching(true); setError('')
    const res = await fetch(`/api/admin/post-production/findings/${finding.id}/match`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apply: true }),
    })
    const json = await res.json().catch(() => ({}))
    setMatching(false)
    if (!res.ok) { setError(json.error || 'Could not check for repeats.'); return }
    if (!json.applied) {
      setError(json.suggestion?.why || 'Nothing earlier looks like the same issue.')
      return
    }
    startTransition(() => router.refresh())
  }

  const photos = finding.media.filter(m => m.kind === 'photo')
  const videos = finding.media.filter(m => m.kind === 'video')
  const audio = finding.media.filter(m => m.kind === 'audio')

  return (
    <ListCardPage>
      <PageChrome
        record={[
          { label: 'Post-Production', href: '/admin/engineering/post-production' },
          { label: `Job ${finding.job_number} · #${finding.seq}` },
        ]}
      >
        <FindingStatusChip status={finding.status} />
        <StandingChip standing={standing} />
      </PageChrome>

      {error && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/10 px-3 py-2.5">
          <CircleAlert size={15} className="text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
          <p className="text-[12.5px] text-rose-700 dark:text-rose-300 leading-snug flex-1">{error}</p>
          <button type="button" onClick={() => setError('')} aria-label="Dismiss">
            <X size={14} className="text-rose-500" />
          </button>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ── What was found ────────────────────────────────────────────────── */}
        <div className="space-y-4 min-w-0">
          <ListCard>
            <div className="px-5 py-4 border-b border-hairline flex items-center gap-2 flex-wrap">
              <CategoryChip category={finding.category} />
              <SeverityChip severity={finding.severity} />
              <span className="flex-1" />
              <span className="text-[11.5px] text-ink-muted">
                {finding.walked_by_name || 'Unknown'} · {shortDate(finding.created_at)}
              </span>
            </div>

            <div className="px-5 py-4">
              <p className="text-[14.5px] text-ink leading-relaxed whitespace-pre-wrap">
                {finding.note || <span className="text-ink-faint italic">No words on this one — see the attachments.</span>}
              </p>

              {/* ⚠️ Say where the words came from. A dictated sentence is a
                  machine's guess and it gets things wrong fluently enough that
                  nobody notices reading it back. The recording is right there. */}
              {(finding.note_source === 'dictated' || finding.note_source === 'mixed' || finding.note_source === 'transcribed') && (
                <p className="mt-3 inline-flex items-center gap-1.5 text-[11.5px] text-ink-faint">
                  <Mic size={11} />
                  {finding.note_source === 'transcribed' ? 'Transcribed from the recording' : 'Dictated at the unit'}
                  {audio.length > 0 && ' — play the audio below if anything reads oddly.'}
                </p>
              )}
            </div>
          </ListCard>

          {photos.length > 0 && (
            <ListCard>
              <div className="px-5 py-3 border-b border-hairline flex items-center gap-2">
                <Camera size={14} className="text-ink-muted" strokeWidth={1.75} />
                <h2 className="text-[13px] font-semibold text-ink">
                  {photos.length} photo{photos.length === 1 ? '' : 's'}
                </h2>
              </div>
              <div className="p-4 grid grid-cols-2 sm:grid-cols-3 gap-3">
                {photos.map(m => (
                  <a
                    key={m.path}
                    href={mediaSrc(m.path)}
                    target="_blank"
                    rel="noreferrer"
                    className="block rounded-lg overflow-hidden border border-hairline bg-surface-soft aspect-[4/3] hover:border-hairline-strong transition-colors"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={mediaSrc(m.path)} alt="Finding" className="w-full h-full object-cover" />
                  </a>
                ))}
              </div>
            </ListCard>
          )}

          {videos.length > 0 && (
            <ListCard>
              <div className="px-5 py-3 border-b border-hairline flex items-center gap-2">
                <Video size={14} className="text-ink-muted" strokeWidth={1.75} />
                <h2 className="text-[13px] font-semibold text-ink">
                  {videos.length} clip{videos.length === 1 ? '' : 's'}
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {videos.map(m => (
                  <div key={m.path}>
                    {/* preload="metadata": the signed URL is good for five
                        minutes and these are up to 50MB. Pulling every clip on
                        page load would be a lot of bytes nobody asked for. */}
                    <video
                      src={mediaSrc(m.path)}
                      controls
                      playsInline
                      preload="metadata"
                      className="w-full rounded-lg border border-hairline bg-ink/5 max-h-[420px]"
                    />
                    <p className="mt-1 text-[11px] text-ink-faint tabular-nums">{humanBytes(m.bytes)}</p>
                  </div>
                ))}
              </div>
            </ListCard>
          )}

          {audio.length > 0 && (
            <ListCard>
              <div className="px-5 py-3 border-b border-hairline flex items-center gap-2">
                <Mic size={14} className="text-ink-muted" strokeWidth={1.75} />
                <h2 className="text-[13px] font-semibold text-ink">
                  {audio.length} voice note{audio.length === 1 ? '' : 's'}
                </h2>
              </div>
              <div className="p-4 space-y-3">
                {audio.map(m => (
                  <div key={m.path} className="flex items-center gap-3">
                    <audio src={mediaSrc(m.path)} controls preload="metadata" className="flex-1 min-w-0 h-9" />
                    <span className="text-[11px] text-ink-faint tabular-nums flex-shrink-0">{clock(m.duration_ms)}</span>
                  </div>
                ))}
              </div>
            </ListCard>
          )}

          {/* ── The answer ──────────────────────────────────────────────────── */}
          <ListCard>
            <div className="px-5 py-3 border-b border-hairline">
              <h2 className="text-[13px] font-semibold text-ink">The solution</h2>
              <p className="text-[11.5px] text-ink-muted mt-0.5">
                What changes so the next one is built differently. A sentence is enough.
              </p>
            </div>
            <div className="p-4">
              <textarea
                value={resolution}
                onChange={e => setResolution(e.target.value)}
                rows={4}
                placeholder="Wheel section moved down 6 inches on the standard 4000-series layout; drawing revised."
                className="w-full resize-y rounded-lg bg-surface border border-hairline px-3 py-2.5 text-[13.5px] leading-relaxed text-ink placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
              />
              <div className="mt-3 flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  disabled={busy || !resolution.trim() || resolution === (finding.resolution ?? '')}
                  onClick={() => save({ resolution })}
                  className={PRIMARY}
                >
                  {busy ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} strokeWidth={2} />}
                  {finding.status === 'answered' ? 'Update the answer' : 'Mark answered'}
                </button>

                {/* ⚠️ Accepting is a DIFFERENT person's job to the answering.
                    The engineer who wrote the solution does not also get to
                    close the finding — a queue whose owner is its own judge is
                    a queue that empties itself, which is exactly how the
                    spreadsheet this replaces ended with hundreds of rows and no
                    outcomes. The button is here for whoever raised it. */}
                {finding.status === 'answered' && (
                  <>
                    <button type="button" disabled={busy} onClick={() => save({ status: 'closed' })} className={BTN}>
                      <Check size={15} /> Accept and close
                    </button>
                    <button type="button" disabled={busy} onClick={() => save({ status: 'assigned' })} className={BTN}>
                      <RotateCcw size={15} /> Send it back
                    </button>
                  </>
                )}
                {finding.status === 'closed' && (
                  <button type="button" disabled={busy} onClick={() => save({ status: 'assigned' })} className={BTN}>
                    <RotateCcw size={15} /> Reopen
                  </button>
                )}
              </div>
              {finding.resolved_at && (
                <p className="mt-2.5 text-[11.5px] text-ink-faint">
                  Answered {shortDate(finding.resolved_at)}
                </p>
              )}
            </div>
          </ListCard>

          {/* ── Similar findings ────────────────────────────────────────────── */}
          <ListCard>
            <div className="px-5 py-3 border-b border-hairline flex items-center gap-2 flex-wrap">
              <Repeat2 size={14} className="text-ink-muted" strokeWidth={1.75} />
              <h2 className="text-[13px] font-semibold text-ink">Said before?</h2>
              <span className="flex-1" />
              <button type="button" onClick={loadSimilar} disabled={matching} className={BTN}>
                {matching ? <Loader2 size={14} className="animate-spin" /> : null} Show similar
              </button>
              <button type="button" onClick={runMatch} disabled={matching} className={BTN}>
                <Sparkles size={14} strokeWidth={1.75} /> Check for a repeat
              </button>
            </div>

            <div className="p-4">
              {theme ? (
                <div className="rounded-lg border border-hairline bg-surface-soft p-3.5">
                  <div className="flex items-start gap-2 flex-wrap">
                    <Link
                      href={`/admin/engineering/post-production/themes?open=${theme.id}`}
                      className="text-[13.5px] font-medium text-ink hover:text-brand-ink transition-colors"
                    >
                      {theme.title}
                    </Link>
                    <span className="flex-1" />
                    {/* The count is confirmed links only. A model's un-reviewed
                        guess never contributes to a number somebody quotes. */}
                    <span className="text-[11.5px] text-ink-muted tabular-nums">
                      raised {theme.confirmed}×
                      {theme.suggested > 0 && ` · ${theme.suggested} to review`}
                    </span>
                  </div>

                  {finding.theme_source === 'ai' ? (
                    <div className="mt-3">
                      <p className="text-[12px] text-ink-muted leading-snug">
                        <Sparkles size={11} className="inline -mt-0.5 mr-1" />
                        Suggested grouping — nobody has confirmed it yet.
                        {finding.theme_note && <span className="block mt-1 italic">{finding.theme_note}</span>}
                      </p>
                      <div className="mt-2.5 flex gap-2">
                        <button type="button" disabled={busy} onClick={() => save({ confirm_theme: true })} className={PRIMARY}>
                          <Check size={15} strokeWidth={2} /> Yes, same issue
                        </button>
                        <button type="button" disabled={busy} onClick={() => save({ theme_id: null })} className={BTN}>
                          <X size={15} /> Not the same
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => save({ theme_id: null })}
                      className="mt-2.5 text-[12px] text-ink-muted hover:text-ink transition-colors"
                    >
                      Ungroup
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-[12.5px] text-ink-muted leading-relaxed">
                  Not grouped with anything. &ldquo;Check for a repeat&rdquo; reads the earlier findings and
                  says whether one of them is the same underlying issue.
                </p>
              )}

              {similar && (
                <div className="mt-4">
                  <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-2">
                    Closest earlier findings
                  </p>
                  {similar.length === 0 ? (
                    <p className="text-[12.5px] text-ink-muted">Nothing earlier reads like this one.</p>
                  ) : (
                    <div className="divide-y divide-hairline-soft border border-hairline rounded-lg overflow-hidden">
                      {similar.map(c => (
                        <Link
                          key={c.finding_id}
                          href={`/admin/engineering/post-production/${c.finding_id}`}
                          className="block px-3.5 py-2.5 hover:bg-surface-soft transition-colors"
                        >
                          <span className="flex items-center gap-2 text-[11.5px] text-ink-muted">
                            <span className="tabular-nums font-medium text-ink-secondary">{c.job_number}</span>
                            <span>{shortDate(c.created_at)}</span>
                            <span>{CATEGORY_LABELS[c.category as keyof typeof CATEGORY_LABELS] ?? c.category}</span>
                            {c.theme_title && <span className="truncate">· {c.theme_title}</span>}
                          </span>
                          <span className="block mt-0.5 text-[13px] text-ink line-clamp-2">{c.note}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </ListCard>
        </div>

        {/* ── Ownership rail ────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <ListCard>
            <div className="px-5 py-3 border-b border-hairline">
              <h2 className="text-[13px] font-semibold text-ink">Who is answering</h2>
            </div>
            <div className="p-4 space-y-3">
              <label className="block">
                <span className="block text-[12px] font-medium text-ink-secondary mb-1.5">Owner</span>
                {assignees.length === 0 ? (
                  <p className="text-[12.5px] text-amber-700 dark:text-amber-400 leading-snug">
                    Nobody holds the engineering permission yet, so there is no one to assign this to.
                    Grant it from Permissions.
                  </p>
                ) : (
                  <select
                    value={finding.assignee_id ?? ''}
                    disabled={busy}
                    onChange={e => save({ assignee_id: e.target.value || null })}
                    className={`${FIELD} w-full`}
                  >
                    <option value="">Nobody yet</option>
                    {assignees.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                )}
              </label>

              <label className="block">
                <span className="block text-[12px] font-medium text-ink-secondary mb-1.5">
                  Answer by
                </span>
                <input
                  type="date"
                  value={finding.due_date ?? ''}
                  disabled={busy}
                  onChange={e => save({ due_date: e.target.value || null })}
                  className={`${FIELD} w-full`}
                />
                <span className="block mt-1 text-[11px] text-ink-faint">
                  Two weeks from hand-over by default.
                </span>
              </label>
            </div>
          </ListCard>

          <ListCard>
            <div className="px-5 py-3 border-b border-hairline">
              <h2 className="text-[13px] font-semibold text-ink">The unit</h2>
            </div>
            <div className="px-5 py-1">
              <Meta label="Job">
                {finding.job_id ? (
                  <Link href={`/admin/engineering/jobs/${finding.job_id}`} className="hover:text-brand-ink transition-colors tabular-nums">
                    {finding.job_number}
                  </Link>
                ) : (
                  <span className="tabular-nums">{finding.job_number}</span>
                )}
              </Meta>
              <Meta label="Customer">{finding.customer_name || <span className="text-ink-faint">Not recorded</span>}</Meta>
              <Meta label="Walked by">{finding.walked_by_name || <span className="text-ink-faint">Unknown</span>}</Meta>
              <Meta label="Area">{CATEGORY_LABELS[finding.category]}</Meta>
              <Meta label="Severity">{SEVERITY_LABELS[finding.severity]}</Meta>
              <Meta label="Raised">{shortDate(finding.created_at)}</Meta>
            </div>
          </ListCard>

          <ListCard>
            <div className="px-5 py-3 border-b border-hairline">
              <h2 className="text-[13px] font-semibold text-ink">Group it by hand</h2>
            </div>
            <div className="p-4">
              <select
                value={finding.theme_id ?? ''}
                disabled={busy}
                onChange={e => save({ theme_id: e.target.value || null })}
                className={`${FIELD} w-full`}
              >
                <option value="">Not grouped</option>
                {themes.map(t => (
                  <option key={t.id} value={t.id}>{t.title}</option>
                ))}
              </select>
              <p className="mt-2 text-[11.5px] text-ink-muted leading-snug">
                Picking one here counts as confirmed — it is a person saying these are the same issue.
              </p>
            </div>
          </ListCard>
        </div>
      </div>
    </ListCardPage>
  )
}

function Meta({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-2.5 border-b border-hairline-soft last:border-0">
      <span className="text-[12px] text-ink-muted w-24 flex-shrink-0">{label}</span>
      <span className="text-[12.5px] font-medium text-ink-secondary flex-1 min-w-0 break-words">{children}</span>
    </div>
  )
}
