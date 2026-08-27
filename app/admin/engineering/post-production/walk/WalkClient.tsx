'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft, Camera, Video, Pencil, Plus, Check, Loader2, X,
  CircleAlert, CloudUpload, CheckCircle2,
} from 'lucide-react'
import FindingCard, { type Local } from '@/components/post-production/FindingCard'
import { uploadMedia } from '@/components/post-production/upload'
import {
  mediaSrc, normalizeJobNumber,
  type Media, type PpFinding, type PpWalkaround,
} from '@/lib/post-production'

/* ────────────────────────────────────────────────────────────────────────────
   The walkaround, for somebody signed in.

   The shop-floor scan page at /walk/<token> is the SAME screen for people with
   no portal account; both render components/post-production/FindingCard. What
   differs is only what has to differ — the gate on the API routes, and the fact
   that a scanner has to say who they are because nobody knows.

   ── Why it is one screen ───────────────────────────────────────────────────
   Somebody is holding a phone next to a running unit with a coffee in the other
   hand. Every modal is a thing to dismiss and every navigation is a thing to
   come back from. So: a header that says which unit, a stack of findings, and a
   bar of fat buttons pinned to the bottom of the glass. Nothing else.

   ── Why everything saves immediately ───────────────────────────────────────
   Shop wifi drops. The walkaround row exists before the first photo, each
   finding row exists before it has any words in it, and every photo, clip and
   sentence is a small write against something already on the server. A dropped
   connection costs the last action, never the walk.

   ── Handing over is a separate, deliberate act ─────────────────────────────
   Nothing in here nags anybody. The findings are drafts with no dates on them
   until "Hand over", which is the moment the two-week clock starts on each one.
   ──────────────────────────────────────────────────────────────────────────── */

const UPLOAD_URL = '/api/admin/post-production/upload-url'

type Job = {
  id: string; job_number: string; customer_name: string
  project_name: string; model_number: string | null; ship_date: string | null; status: string
}

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
   ONE number, and it is the one everybody already says out loud. It is the
   unit's serial and the job number at the same time — confirmed 2026-08-27 —
   so asking for both (which the first cut did) was asking somebody standing at
   a machine to type the same four digits twice.

   Recent jobs are offered as fat taps because typing on a phone next to a noisy
   unit is the worst part of any form, but an unmatched number is always
   accepted. A capture surface that can refuse to capture is one people stop
   opening. */
function UnitPicker({
  jobs, prefill, onStarted,
}: {
  jobs: Job[]; prefill: string; onStarted: (w: PpWalkaround) => void
}) {
  const [number, setNumber] = useState(prefill)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const clean = normalizeJobNumber(number)
  const matches = useMemo(() => {
    if (!clean) return jobs.slice(0, 8)
    return jobs.filter(j => j.job_number.includes(clean)).slice(0, 8)
  }, [jobs, clean])
  const exact = jobs.find(j => j.job_number === clean) ?? null

  const start = async () => {
    if (!clean) { setError('The serial is how the finding gets back to the right unit.'); return }
    setBusy(true); setError('')
    const res = await fetch('/api/admin/post-production/walkarounds', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ job_number: clean }),
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
            Two people can walk the same unit — that makes two walkarounds, and neither overwrites
            the other.
          </p>

          <label className="block mt-5 text-[12px] font-medium text-ink-secondary">
            Serial number
          </label>
          <input
            value={number}
            onChange={e => setNumber(e.target.value)}
            /* inputMode numeric brings up the number pad without blocking a
               serial that one day has a letter in it. */
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
  // A fresh upload previews from a local object URL — instant, and no read
  // request for bytes we just sent. Persisted media falls back to the signed
  // media route. Revoked on unmount; same pattern as ToolPhotos.
  const freshUrls = useRef<Map<string, string>>(new Map())
  useEffect(() => () => { freshUrls.current.forEach(URL.revokeObjectURL) }, [])
  const mediaSrcFor = (path: string) => freshUrls.current.get(path) ?? mediaSrc(path)

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

  const addFinding = useCallback(async (): Promise<Local | null> => {
    setError('')
    const res = await fetch('/api/admin/post-production/findings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walkaround_id: walk.id }),
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

  const pickFile = (kind: 'photo' | 'video', findingId: string | null) => {
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

    const res = await uploadMedia(kind, file, file.name || `${kind}.bin`, UPLOAD_URL)
    setBusy(false)
    if (!res.ok) { setError(res.error); return }
    freshUrls.current.set(res.media.path, res.previewUrl)
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
              Unit {walk.job_number} is with engineering. Each one is due an answer within two weeks.
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

        {/* Add another one WITHOUT scrolling to the bottom.
            Findings stack newest-first, so on a walk with six of them the action
            bar at the foot of the screen is a long scroll away from where you
            are reading — and you want the next note the moment you notice the
            next thing, not after hunting for a button. Asked for from a real
            phone 2026-08-27. */}
        <div className="mx-auto w-full max-w-[720px] px-4 pb-3">
          <button
            type="button"
            onClick={() => { void addFinding() }}
            disabled={busy}
            className="w-full h-11 rounded-lg border border-dashed border-hairline-strong bg-surface text-[13.5px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink active:scale-[0.99] disabled:opacity-50 transition-all inline-flex items-center justify-center gap-1.5"
          >
            <Plus size={16} strokeWidth={2} /> Add another note
          </button>
        </div>
      </div>

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
              uploadEndpoint={UPLOAD_URL}
              mediaSrcFor={mediaSrcFor}
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
              onAudio={(m, preview) => { freshUrls.current.set(m.path, preview); void attach(f.id, m) }}
              onRemoveMedia={p => removeMedia(f.id, p)}
              onRemove={() => removeFinding(f.id)}
            />
          ))}
        </div>
      </div>

      {/* The action bar. Pinned, fat targets, thumb-height. */}
      <div className="flex-shrink-0 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-[720px] px-3 py-2.5 grid grid-cols-3 gap-2">
          <ActionButton icon={<Camera size={19} strokeWidth={1.75} />} label="Photo" busy={busy} onClick={() => pickFile('photo', null)} />
          <ActionButton icon={<Video size={19} strokeWidth={1.75} />} label="Video" busy={busy} onClick={() => pickFile('video', null)} />
          <ActionButton icon={<Pencil size={19} strokeWidth={1.75} />} label="Note" busy={busy} onClick={() => { void addFinding() }} />
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
