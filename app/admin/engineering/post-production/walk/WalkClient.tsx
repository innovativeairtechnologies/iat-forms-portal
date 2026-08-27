'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Camera, Video, Pencil, Trash2, Check, Loader2, X,
  CircleAlert, CloudUpload, CheckCircle2,
} from 'lucide-react'
import {
  CATEGORIES, CATEGORY_LABELS, CATEGORY_SHORT, SEVERITIES, SEVERITY_BLURB, SEVERITY_LABELS,
  clock, humanBytes, mediaSrc, normalizeJobNumber,
  type Category, type Media, type PpFinding, type PpWalkaround, type Severity,
} from '@/lib/post-production'
import VoiceNote from './VoiceNote'
import { uploadMedia } from './upload'

/* ────────────────────────────────────────────────────────────────────────────
   The walkaround.

   ── Why it is one screen ───────────────────────────────────────────────────
   Somebody is holding a phone next to a running unit with a coffee in the other
   hand. Every modal is a thing to dismiss and every navigation is a thing to
   come back from. So: a header that says which unit, a stack of findings, and a
   bar of four fat buttons pinned to the bottom of the glass. Nothing else.

   ── Why everything saves immediately ───────────────────────────────────────
   Shop wifi drops. The walkaround row exists before the first photo, each
   finding row exists before it has any words in it, and every photo, clip and
   sentence is a small write against something already on the server. A dropped
   connection costs the last action, never the walk. The alternative — hold it
   all in memory until a Submit button — is exactly how somebody loses ten
   minutes of observations at the far end of the building.

   ── Handing over is a separate, deliberate act ─────────────────────────────
   Nothing in here nags anybody. The findings are drafts with no dates on them
   until "Hand to engineering", which is the moment the two-week clock starts on
   each one.
   ──────────────────────────────────────────────────────────────────────────── */

type Job = {
  id: string; job_number: string; customer_name: string
  project_name: string; model_number: string | null; ship_date: string | null; status: string
}

type Local = PpFinding & { _saving?: boolean; _error?: string }

export default function WalkClient({
  initialWalk, initialFindings, jobs, prefillJob, transcriptionConfigured,
}: {
  initialWalk: PpWalkaround | null
  initialFindings: PpFinding[]
  jobs: Job[]
  prefillJob: string
  transcriptionConfigured: boolean
}) {
  const router = useRouter()
  const [walk, setWalk] = useState(initialWalk)
  const [findings, setFindings] = useState<Local[]>(initialFindings)

  if (!walk) {
    return <UnitPicker jobs={jobs} prefill={prefillJob} onStarted={w => setWalk(w)} />
  }

  return (
    <Walking
      walk={walk}
      findings={findings}
      setFindings={setFindings}
      transcriptionConfigured={transcriptionConfigured}
      onDiscarded={() => { setWalk(null); setFindings([]); router.refresh() }}
    />
  )
}

/* ── Step one: which unit ───────────────────────────────────────────────────
   The job number is the only required thing, and it is four digits everyone
   already says out loud. Recent jobs are offered as fat taps because typing on a
   phone next to a noisy unit is the worst part of any form — but an unmatched
   number is always accepted. A capture surface that can refuse to capture is a
   capture surface people stop opening. */
function UnitPicker({
  jobs, prefill, onStarted,
}: {
  jobs: Job[]; prefill: string; onStarted: (w: PpWalkaround) => void
}) {
  const [number, setNumber] = useState(prefill)
  const [serial, setSerial] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const clean = normalizeJobNumber(number)
  const matches = useMemo(() => {
    if (!clean) return jobs.slice(0, 8)
    return jobs.filter(j => j.job_number.includes(clean)).slice(0, 8)
  }, [jobs, clean])
  const exact = jobs.find(j => j.job_number === clean) ?? null

  const start = async () => {
    if (!clean) { setError('The job number is how the finding gets back to the right unit.'); return }
    setBusy(true); setError('')
    const res = await fetch('/api/admin/post-production/walkarounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_number: clean, unit_serial: serial || null }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(json.error || 'Could not start the walkaround.'); return }
    onStarted(json.walkaround)
  }

  return (
    <div className="flex-1 min-h-0 overflow-y-auto bg-canvas">
      <div className="mx-auto w-full max-w-[560px] p-4 sm:p-6">
        <Link
          href="/admin/engineering/post-production"
          className="inline-flex items-center gap-1.5 text-[13px] text-ink-muted hover:text-ink transition-colors mb-4"
        >
          <ArrowLeft size={15} /> Post-production
        </Link>

        <div className="rounded-xl border border-hairline bg-surface p-5">
          <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Walkaround</p>
          <h1 className="mt-1 text-[22px] font-semibold text-ink tracking-tight">Which unit?</h1>
          <p className="mt-1.5 text-[13px] text-ink-muted leading-relaxed">
            The job number the shop uses. Two people can walk the same unit — that makes two walkarounds,
            and neither overwrites the other.
          </p>

          <label className="block mt-5 text-[12px] font-medium text-ink-secondary">Job number</label>
          <input
            value={number}
            onChange={e => setNumber(e.target.value)}
            /* inputMode numeric brings up the number pad without blocking a job
               number that one day has a letter in it. */
            inputMode="numeric"
            autoComplete="off"
            autoFocus
            placeholder="4153"
            className="mt-1.5 w-full h-14 px-4 rounded-lg bg-surface border border-hairline text-[24px] font-medium text-ink tabular-nums tracking-wide placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
          />

          {exact ? (
            <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-brand-soft px-3 py-2.5">
              <CheckCircle2 size={15} className="text-brand-ink mt-0.5 flex-shrink-0" />
              <p className="text-[12.5px] text-brand-ink leading-snug">
                <strong>{exact.customer_name || 'Unnamed customer'}</strong>
                {exact.model_number ? ` · ${exact.model_number}` : ''}
                {exact.project_name ? <><br /><span className="opacity-80">{exact.project_name}</span></> : null}
              </p>
            </div>
          ) : clean ? (
            <p className="mt-2.5 text-[12px] text-ink-muted leading-snug">
              No engineering job with that number — the walkaround still works, it just will not
              carry a customer through.
            </p>
          ) : null}

          {matches.length > 0 && (
            <div className="mt-4">
              <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted mb-2">
                {clean ? 'Matching' : 'Recent'}
              </p>
              <div className="flex flex-wrap gap-2">
                {matches.map(j => (
                  <button
                    key={j.id}
                    type="button"
                    onClick={() => setNumber(j.job_number)}
                    className={`text-left px-3 py-2 rounded-lg border transition-colors ${
                      j.job_number === clean
                        ? 'border-brand bg-brand-soft'
                        : 'border-hairline bg-surface hover:bg-surface-soft hover:border-hairline-strong'
                    }`}
                  >
                    <span className="block text-[15px] font-medium text-ink tabular-nums">{j.job_number}</span>
                    <span className="block text-[11.5px] text-ink-muted truncate max-w-[160px]">
                      {j.customer_name || '—'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="block mt-5 text-[12px] font-medium text-ink-secondary">
            Unit serial <span className="text-ink-faint font-normal">— optional</span>
          </label>
          <input
            value={serial}
            onChange={e => setSerial(e.target.value)}
            placeholder="Off the nameplate, if it is on there yet"
            className="mt-1.5 w-full h-11 px-3 rounded-lg bg-surface border border-hairline text-[13px] text-ink placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
          />

          {error && <p className="mt-3 text-[12.5px] text-rose-600 dark:text-rose-400">{error}</p>}

          <button
            type="button"
            onClick={start}
            disabled={busy}
            className="mt-5 w-full h-12 rounded-lg bg-brand text-white text-[14px] font-medium hover:bg-brand-hover active:scale-[0.99] disabled:opacity-60 transition-all inline-flex items-center justify-center gap-2"
          >
            {busy ? <><Loader2 size={16} className="animate-spin" /> Starting…</> : 'Start walking'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ── Step two: the walk ─────────────────────────────────────────────────────── */
function Walking({
  walk, findings, setFindings, transcriptionConfigured, onDiscarded,
}: {
  walk: PpWalkaround
  findings: Local[]
  setFindings: React.Dispatch<React.SetStateAction<Local[]>>
  transcriptionConfigured: boolean
  onDiscarded: () => void
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [handover, setHandover] = useState<{ submitted: number; grouped: number } | null>(null)
  const [confirmDiscard, setConfirmDiscard] = useState(false)

  const photoRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLInputElement | null>(null)
  const pendingKindRef = useRef<'photo' | 'video' | null>(null)
  const targetRef = useRef<string | null>(null)

  /* Debounced text saves, one timer per finding. A dictated note arrives a
     phrase at a time, so saving on every keystroke would be a write per word;
     700ms is under the time it takes to say the next sentence. */
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => {
    const map = timers.current
    return () => { map.forEach(clearTimeout); map.clear() }
  }, [])

  const patch = useCallback(async (id: string, body: Record<string, unknown>) => {
    setFindings(cur => cur.map(f => (f.id === id ? { ...f, _saving: true, _error: undefined } : f)))
    const res = await fetch(`/api/admin/post-production/findings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    setFindings(cur => cur.map(f => (f.id === id
      ? res.ok
        // Merge rather than replace: a note the person has kept typing while the
        // request was in flight must not be reverted to what the server echoed.
        ? { ...f, ...json.finding, note: f.note, _saving: false, _error: undefined }
        : { ...f, _saving: false, _error: json.error || 'Not saved' }
      : f)))
  }, [setFindings])

  const queueSave = useCallback((id: string, body: Record<string, unknown>) => {
    const map = timers.current
    const existing = map.get(id)
    if (existing) clearTimeout(existing)
    map.set(id, setTimeout(() => { map.delete(id); void patch(id, body) }, 700))
  }, [patch])

  const addFinding = useCallback(async (seed: Partial<PpFinding> = {}): Promise<Local | null> => {
    setError('')
    const res = await fetch('/api/admin/post-production/findings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walkaround_id: walk.id, ...seed }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setError(json.error || 'Could not add that.'); return null }
    const created: Local = { ...json.finding, media: json.finding.media ?? [] }
    // Newest first: on a phone the thing you just did must not be below the fold.
    setFindings(cur => [created, ...cur])
    return created
  }, [walk.id, setFindings])

  const attach = useCallback(async (findingId: string, media: Media) => {
    setFindings(cur => {
      const next = cur.map(f => (f.id === findingId ? { ...f, media: [...f.media, media] } : f))
      const target = next.find(f => f.id === findingId)
      if (target) void patch(findingId, { media: target.media })
      return next
    })
  }, [patch, setFindings])

  const pickFile = async (kind: 'photo' | 'video', findingId: string | null) => {
    pendingKindRef.current = kind
    targetRef.current = findingId
    ;(kind === 'photo' ? photoRef : videoRef).current?.click()
  }

  const onFile = async (file: File | undefined) => {
    const kind = pendingKindRef.current
    if (!file || !kind) return
    setBusy(true); setError('')

    let id = targetRef.current
    if (!id) {
      const created = await addFinding()
      if (!created) { setBusy(false); return }
      id = created.id
    }

    const res = await uploadMedia(kind, file, file.name || `${kind}.bin`)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    await attach(id, res.media)
  }

  const removeMedia = (findingId: string, path: string) => {
    setFindings(cur => {
      const next = cur.map(f => (f.id === findingId ? { ...f, media: f.media.filter(m => m.path !== path) } : f))
      const target = next.find(f => f.id === findingId)
      if (target) void patch(findingId, { media: target.media })
      return next
    })
  }

  const removeFinding = async (id: string) => {
    setFindings(cur => cur.filter(f => f.id !== id))
    await fetch(`/api/admin/post-production/findings/${id}`, { method: 'DELETE' })
  }

  const usable = findings.filter(f => f.note.trim() || f.media.length > 0)

  const handOver = async () => {
    // Flush anything a debounce is still holding, or the last sentence somebody
    // dictated would be submitted without its words.
    timers.current.forEach(clearTimeout)
    timers.current.clear()
    for (const f of findings) {
      await patch(f.id, { note: f.note, note_source: f.note_source, category: f.category, severity: f.severity })
    }

    setBusy(true); setError('')
    const res = await fetch(`/api/admin/post-production/walkarounds/${walk.id}`, { method: 'POST' })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(json.error || 'Could not hand it over.'); return }
    setHandover({ submitted: json.submitted, grouped: json.grouped })
  }

  const discard = async () => {
    setBusy(true)
    await fetch(`/api/admin/post-production/walkarounds/${walk.id}`, { method: 'DELETE' })
    setBusy(false)
    onDiscarded()
  }

  if (handover) {
    return (
      <div className="flex-1 min-h-0 overflow-y-auto bg-canvas">
        <div className="mx-auto w-full max-w-[560px] p-4 sm:p-6">
          <div className="rounded-xl border border-hairline bg-surface p-6 text-center">
            <span className="inline-flex w-12 h-12 rounded-full bg-brand-soft items-center justify-center">
              <Check size={24} className="text-brand-ink" strokeWidth={2} />
            </span>
            <h1 className="mt-4 text-[20px] font-semibold text-ink tracking-tight">
              {handover.submitted} finding{handover.submitted === 1 ? '' : 's'} handed over
            </h1>
            <p className="mt-2 text-[13.5px] text-ink-secondary leading-relaxed">
              Job {walk.job_number} is with engineering. Each one is due an answer within two weeks.
            </p>
            {handover.grouped > 0 && (
              <p className="mt-3 text-[12.5px] text-ink-muted leading-relaxed">
                {handover.grouped} of them looks like something raised before. Those are marked as
                suggestions until somebody confirms them.
              </p>
            )}
            <div className="mt-6 flex flex-col gap-2">
              <Link
                href={`/admin/engineering/post-production?walk=${walk.id}&tab=all`}
                className="h-11 rounded-lg bg-brand text-white text-[14px] font-medium hover:bg-brand-hover active:scale-[0.99] transition-all inline-flex items-center justify-center"
              >
                See them in the queue
              </Link>
              <button
                type="button"
                onClick={() => router.push('/admin/engineering/post-production/walk')}
                className="h-11 rounded-lg border border-hairline-strong bg-surface text-[14px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors"
              >
                Walk another unit
              </button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-canvas">
      {/* Header — which unit, and the way out. */}
      <div className="flex-shrink-0 border-b border-hairline bg-surface">
        <div className="mx-auto w-full max-w-[720px] px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setConfirmDiscard(true)}
            aria-label="Leave this walkaround"
            className="w-9 h-9 -ml-1 rounded-lg inline-flex items-center justify-center text-ink-muted hover:bg-surface-strong hover:text-ink transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">Walking</p>
            <p className="text-[17px] font-semibold text-ink tabular-nums leading-tight">
              {walk.job_number}
              {walk.customer_name && (
                <span className="ml-2 text-[13px] font-normal text-ink-muted truncate">{walk.customer_name}</span>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={handOver}
            disabled={busy || usable.length === 0}
            className="h-10 px-3.5 rounded-lg bg-brand text-white text-[13.5px] font-medium hover:bg-brand-hover active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all inline-flex items-center gap-1.5 flex-shrink-0"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} strokeWidth={1.75} />}
            Hand over{usable.length > 0 ? ` (${usable.length})` : ''}
          </button>
        </div>
      </div>

      {/* The findings. */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] px-4 py-4 pb-32 space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/10 px-3 py-2.5">
              <CircleAlert size={15} className="text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
              <p className="text-[12.5px] text-rose-700 dark:text-rose-300 leading-snug flex-1">{error}</p>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={14} className="text-rose-500" /></button>
            </div>
          )}

          {findings.length === 0 && (
            <div className="rounded-xl border border-dashed border-hairline-strong bg-surface/50 px-5 py-10 text-center">
              <p className="text-[14px] text-ink-secondary leading-relaxed">
                Walk the unit. Talk, photograph or film anything you would have done differently.
              </p>
              <p className="mt-2 text-[12.5px] text-ink-muted leading-relaxed">
                Everything saves as you go. Nothing reaches engineering until you hand it over.
              </p>
            </div>
          )}

          {findings.map((f, i) => (
            <FindingCard
              key={f.id}
              finding={f}
              number={findings.length - i}
              transcriptionConfigured={transcriptionConfigured}
              onNote={(note, source) => {
                setFindings(cur => cur.map(x => (x.id === f.id ? { ...x, note, note_source: source } : x)))
                queueSave(f.id, { note, note_source: source })
              }}
              onCategory={c => {
                setFindings(cur => cur.map(x => (x.id === f.id ? { ...x, category: c } : x)))
                void patch(f.id, { category: c })
              }}
              onSeverity={s => {
                setFindings(cur => cur.map(x => (x.id === f.id ? { ...x, severity: s } : x)))
                void patch(f.id, { severity: s })
              }}
              onPhoto={() => pickFile('photo', f.id)}
              onVideo={() => pickFile('video', f.id)}
              onAudio={m => attach(f.id, m)}
              onRemoveMedia={p => removeMedia(f.id, p)}
              onRemove={() => removeFinding(f.id)}
            />
          ))}
        </div>
      </div>

      {/* The action bar. Pinned, four fat targets, thumb-height. */}
      <div className="flex-shrink-0 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-[720px] px-3 py-2.5 grid grid-cols-3 gap-2">
          <ActionButton icon={<Camera size={19} strokeWidth={1.75} />} label="Photo" busy={busy} onClick={() => pickFile('photo', null)} />
          <ActionButton icon={<Video size={19} strokeWidth={1.75} />} label="Video" busy={busy} onClick={() => pickFile('video', null)} />
          <ActionButton icon={<Pencil size={19} strokeWidth={1.75} />} label="Note" busy={busy} onClick={() => addFinding()} />
        </div>
      </div>

      {/* capture="environment" opens the rear camera on a phone and falls back to
          a file picker on a desktop, where this page is perfectly usable too. */}
      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden"
        onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />

      {confirmDiscard && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-ink/40 p-4">
          <div className="w-full max-w-[420px] rounded-xl border border-hairline bg-surface p-5">
            <h2 className="text-[16px] font-semibold text-ink">Leave this walkaround?</h2>
            <p className="mt-1.5 text-[13px] text-ink-secondary leading-relaxed">
              {usable.length > 0
                ? `It stays open with ${usable.length} finding${usable.length === 1 ? '' : 's'} on it — reopening this page picks it back up. Discarding removes it for good.`
                : 'Nothing has been recorded on it yet.'}
            </p>
            <div className="mt-5 flex flex-col-reverse sm:flex-row gap-2 sm:justify-end">
              <button
                type="button"
                onClick={discard}
                disabled={busy}
                className="h-10 px-3.5 rounded-lg border border-hairline-strong bg-surface text-[13px] font-medium text-rose-600 dark:text-rose-400 hover:bg-surface-soft transition-colors"
              >
                Discard it
              </button>
              <div className="flex-1 hidden sm:block" />
              <button
                type="button"
                onClick={() => setConfirmDiscard(false)}
                className="h-10 px-3.5 rounded-lg border border-hairline-strong bg-surface text-[13px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors"
              >
                Keep walking
              </button>
              <Link
                href="/admin/engineering/post-production"
                className="h-10 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover inline-flex items-center justify-center transition-colors"
              >
                Leave it open
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function ActionButton({
  icon, label, onClick, busy,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="h-14 rounded-lg border border-hairline-strong bg-surface flex flex-col items-center justify-center gap-0.5 text-ink-secondary hover:bg-surface-soft hover:text-ink active:scale-[0.97] disabled:opacity-50 transition-all"
    >
      {busy ? <Loader2 size={19} className="animate-spin" /> : icon}
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  )
}

/* ── One finding ────────────────────────────────────────────────────────────── */
function FindingCard({
  finding, number, transcriptionConfigured,
  onNote, onCategory, onSeverity, onPhoto, onVideo, onAudio, onRemoveMedia, onRemove,
}: {
  finding: Local
  number: number
  transcriptionConfigured: boolean
  onNote: (note: string, source: PpFinding['note_source']) => void
  onCategory: (c: Category) => void
  onSeverity: (s: Severity) => void
  onPhoto: () => void
  onVideo: () => void
  onAudio: (m: Media) => void
  onRemoveMedia: (path: string) => void
  onRemove: () => void
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  // Grow to fit. A dictated observation runs long and a phone textarea that
  // scrolls internally hides the beginning of what somebody just said.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 420)}px`
  }, [finding.note])

  /** Dictated text is APPENDED, never substituted for what is in the box. Somebody
   *  who typed half a sentence and then started talking must end up with both. */
  const appendDictated = (text: string) => {
    const t = text.trim()
    if (!t) return
    const joined = finding.note.trim() ? `${finding.note.trimEnd()} ${t}` : t
    onNote(joined, finding.note_source === 'typed' && finding.note.trim() ? 'mixed' : 'dictated')
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface">
      <div className="flex items-center gap-2 px-4 h-11 border-b border-hairline-soft">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
          Finding {number}
        </span>
        <span className="flex-1" />
        {finding._saving && <Loader2 size={13} className="animate-spin text-ink-faint" />}
        {finding._error && <span className="text-[11px] text-rose-500">{finding._error}</span>}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove this finding"
          className="w-8 h-8 -mr-1.5 rounded-lg inline-flex items-center justify-center text-ink-faint hover:bg-surface-strong hover:text-rose-500 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <textarea
          ref={taRef}
          value={finding.note}
          onChange={e => onNote(e.target.value, finding.note_source === 'dictated' ? 'mixed' : 'typed')}
          rows={2}
          placeholder="What would you have done differently?"
          className="w-full resize-none rounded-lg bg-surface border border-hairline px-3 py-2.5 text-[14px] leading-relaxed text-ink placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
        />

        <VoiceNote
          transcriptionConfigured={transcriptionConfigured}
          onTranscript={appendDictated}
          onDone={onAudio}
        />

        {finding.media.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {finding.media.map(m => (
              <MediaThumb key={m.path} media={m} onRemove={() => onRemoveMedia(m.path)} />
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPhoto}
            className="flex-1 h-10 rounded-lg border border-hairline bg-surface text-[12.5px] font-medium text-ink-muted hover:bg-surface-soft hover:text-ink transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Camera size={15} strokeWidth={1.75} /> Photo
          </button>
          <button
            type="button"
            onClick={onVideo}
            className="flex-1 h-10 rounded-lg border border-hairline bg-surface text-[12.5px] font-medium text-ink-muted hover:bg-surface-soft hover:text-ink transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Video size={15} strokeWidth={1.75} /> Video
          </button>
        </div>

        {/* Area. Horizontally scrollable so nine chips never wrap into a wall on
            a 375px screen, and "Other" is a real answer — nobody standing at a
            unit should have to shop for a category. */}
        <div className="-mx-4 px-4 overflow-x-auto">
          <div className="flex gap-1.5 w-max pb-0.5">
            {CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => onCategory(c)}
                title={CATEGORY_LABELS[c]}
                className={`h-8 px-2.5 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${
                  finding.category === c
                    ? 'bg-ink text-canvas'
                    : 'bg-surface-strong text-ink-muted hover:text-ink'
                }`}
              >
                {CATEGORY_SHORT[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {SEVERITIES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onSeverity(s)}
              title={SEVERITY_BLURB[s]}
              className={`h-9 rounded-lg text-[12px] font-medium transition-colors ${
                finding.severity === s
                  ? 'bg-ink text-canvas'
                  : 'bg-surface-strong text-ink-muted hover:text-ink'
              }`}
            >
              {SEVERITY_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function MediaThumb({ media, onRemove }: { media: Media; onRemove: () => void }) {
  const src = mediaSrc(media.path)
  return (
    <div className="relative w-[76px] h-[76px] rounded-lg overflow-hidden border border-hairline bg-surface-soft group">
      {media.kind === 'photo' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Finding" className="w-full h-full object-cover" />
      )}
      {media.kind === 'video' && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-ink-muted">
          <Video size={20} strokeWidth={1.75} />
          <span className="text-[10px] tabular-nums">{humanBytes(media.bytes) || 'Clip'}</span>
        </div>
      )}
      {media.kind === 'audio' && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-ink-muted">
          <span className="w-6 h-6 rounded-full bg-surface-strong flex items-center justify-center text-[11px]">♪</span>
          <span className="text-[10px] tabular-nums">{clock(media.duration_ms)}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full bg-ink/60 text-canvas"
      >
        <X size={12} />
      </button>
    </div>
  )
}
