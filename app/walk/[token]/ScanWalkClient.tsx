'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  ArrowLeft, Camera, Check, CheckCircle2, CircleAlert, CloudUpload,
  Loader2, Pencil, Plus, Video, X,
} from 'lucide-react'
import Logo from '@/components/Logo'
import FindingCard, { type Local, type UploadState } from '@/components/post-production/FindingCard'
import MicBlockedBanner from '@/components/post-production/MicBlockedBanner'
import { hasAudioTrack } from '@/lib/has-audio-track'
import { micHelpLine } from '@/lib/mic-help'
import { uploadMedia } from '@/components/post-production/upload'
import {
  WALK_ROLES, WALK_ROLE_LABELS, normalizeJobNumber,
  type Media, type PpFinding, type PpTag, type PpWalkaround, type WalkRole,
} from '@/lib/post-production'

/* ────────────────────────────────────────────────────────────────────────────
   The shop-floor walkaround. Scanned off a sticker, no login.

   This is the SAME screen as the signed-in walk — both render
   components/post-production/FindingCard, which is why a fix to the recorder or
   the category chips lands in both at once. Two things differ, and only because
   they have to:

     1. Nobody is signed in, so the page has to ask who you are and how you
        worked on this unit. That second question is not bureaucracy: it is the
        four perspectives the meeting was actually about, and it is what turns
        twelve findings on one unit into a build review.
     2. Every write goes through /api/walk/<token>/*, where the sticker's token
        is the credential and each route re-proves the thing being written
        belongs to that sticker.

   ── What the device remembers ──────────────────────────────────────────────
   Name, role, and which walkaround is MINE, in localStorage keyed by token. The
   name and role save a loud-room typing session on every future scan. The
   walkaround id is what stops a standing tag on the test bay wall from dropping
   the electrician into the tester's half-finished walk — the device knows which
   one it started, and anything else is offered as an explicit choice.
   ──────────────────────────────────────────────────────────────────────────── */

type Job = { customer_name: string; model_number: string | null; project_name: string } | null
type OpenWalk = { walk: PpWalkaround; findings: PpFinding[] }

const remember = (key: string, value: string) => {
  // Private browsing and locked-down site data both throw here. A remembered
  // name is a convenience; losing it must never break the page.
  try { window.localStorage.setItem(key, value) } catch { /* fine */ }
}
const recall = (key: string): string => {
  try { return window.localStorage.getItem(key) ?? '' } catch { return '' }
}

export default function ScanWalkClient({
  tag, job, people, openWalks, transcriptionConfigured,
}: {
  tag: PpTag
  job: Job
  people: string[]
  openWalks: OpenWalk[]
  transcriptionConfigured: boolean
}) {
  const [session, setSession] = useState<OpenWalk | null>(null)
  const [resumed, setResumed] = useState(false)
  const [done, setDone] = useState<{ submitted: number } | null>(null)

  const mineKey = `pp-walk:${tag.token}`

  // Resume only MY walk, and only once on mount.
  useEffect(() => {
    if (resumed) return
    setResumed(true)
    const mine = recall(mineKey)
    const found = mine ? openWalks.find(w => w.walk.id === mine) : null
    if (found) setSession(found)
  }, [resumed, mineKey, openWalks])

  if (done) {
    return (
      <Done
        submitted={done.submitted}
        jobNumber={session?.walk.job_number ?? tag.job_number ?? ''}
        onAgain={() => { setDone(null); setSession(null); remember(mineKey, '') }}
      />
    )
  }

  if (!session) {
    return (
      <Intro
        tag={tag}
        job={job}
        people={people}
        others={openWalks.filter(w => w.walk.id !== recall(mineKey))}
        onStarted={s => { remember(mineKey, s.walk.id); setSession(s) }}
        onResume={s => { remember(mineKey, s.walk.id); setSession(s) }}
      />
    )
  }

  return (
    <Walking
      tag={tag}
      session={session}
      transcriptionConfigured={transcriptionConfigured}
      onLeave={() => setSession(null)}
      onSubmitted={n => setDone({ submitted: n })}
    />
  )
}

/* ── Shell ──────────────────────────────────────────────────────────────────
   No portal chrome: this page has no sidebar, no top bar and no navigation,
   because there is nowhere else for a scanner to go and every extra control is
   one more thing to mis-tap while holding a phone at arm's length. */
function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[100dvh] flex flex-col bg-canvas">
      <div className="flex-shrink-0 border-b border-hairline bg-surface">
        <div className="mx-auto w-full max-w-[720px] px-4 h-14 flex items-center gap-2">
          <Logo className="h-6 w-auto" />
          <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
            Post-production
          </span>
        </div>
      </div>
      {children}
    </div>
  )
}

/* ── Who are you, and which unit ────────────────────────────────────────────── */
function Intro({
  tag, job, people, others, onStarted, onResume,
}: {
  tag: PpTag
  job: Job
  people: string[]
  others: OpenWalk[]
  onStarted: (s: OpenWalk) => void
  onResume: (s: OpenWalk) => void
}) {
  const [name, setName] = useState('')
  const [role, setRole] = useState<WalkRole | ''>('')
  const [number, setNumber] = useState(tag.job_number ?? '')
  const [typing, setTyping] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Pull the remembered name/role in an effect, not in useState's initialiser —
  // localStorage does not exist during the server render and reading it there
  // would make the first client render disagree with the HTML.
  useEffect(() => {
    const n = recall(`pp-walker:${tag.token}:name`)
    const r = recall(`pp-walker:${tag.token}:role`)
    if (n) { setName(n); if (!people.includes(n)) setTyping(true) }
    if (r) setRole(r as WalkRole)
  }, [tag.token, people])

  const start = async () => {
    const clean = name.trim()
    if (!clean) { setError('Put your name on it so engineering knows who to ask.'); return }
    if (!role) { setError('Say how you worked on this unit.'); return }
    const unit = tag.job_number ?? normalizeJobNumber(number)
    if (!unit) { setError('Which unit? The serial is on the nameplate.'); return }

    setBusy(true); setError('')
    const res = await fetch(`/api/walk/${tag.token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: clean, role, job_number: unit }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(json.error || 'Could not start.'); return }

    remember(`pp-walker:${tag.token}:name`, clean)
    remember(`pp-walker:${tag.token}:role`, role)
    onStarted({ walk: json.walkaround, findings: [] })
  }

  return (
    <Shell>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[560px] p-4 pb-16">
          {/* Confirm they scanned the right sticker BEFORE anybody talks. */}
          <div className="rounded-xl border border-hairline bg-surface p-5">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
              {tag.label}
            </p>
            {tag.job_number ? (
              <>
                <h1 className="mt-1 text-[26px] font-semibold text-ink tracking-tight tabular-nums">
                  Unit {tag.job_number}
                </h1>
                {job?.customer_name && (
                  <p className="mt-0.5 text-[13px] text-ink-muted">
                    {job.customer_name}{job.model_number ? ` · ${job.model_number}` : ''}
                  </p>
                )}
              </>
            ) : (
              <h1 className="mt-1 text-[22px] font-semibold text-ink tracking-tight">
                What did you notice?
              </h1>
            )}
            <p className="mt-2 text-[13.5px] text-ink-secondary leading-relaxed">
              Anything you would have done differently on this one. It goes to engineering with a
              two-week clock on it.
            </p>
          </div>

          {/* Somebody else's walk, offered rather than assumed. */}
          {others.length > 0 && (
            <div className="mt-3 rounded-xl border border-hairline bg-surface p-4">
              <p className="text-[12px] font-medium text-ink-secondary">Already open on this tag</p>
              <div className="mt-2 space-y-2">
                {others.map(o => (
                  <button
                    key={o.walk.id}
                    type="button"
                    onClick={() => onResume(o)}
                    className="w-full text-left px-3 py-2.5 rounded-lg border border-hairline bg-surface hover:bg-surface-soft hover:border-hairline-strong transition-colors"
                  >
                    <span className="block text-[13.5px] font-medium text-ink">
                      {o.walk.walked_by_name || 'Someone'}
                      <span className="ml-2 font-normal text-ink-muted tabular-nums">
                        unit {o.walk.job_number}
                      </span>
                    </span>
                    <span className="block text-[11.5px] text-ink-muted">
                      {o.findings.length} note{o.findings.length === 1 ? '' : 's'} so far — tap to carry on
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="mt-3 rounded-xl border border-hairline bg-surface p-5">
            <p className="text-[12px] font-medium text-ink-secondary">Who are you?</p>

            {people.length > 0 && !typing ? (
              <>
                <div className="mt-2 flex flex-wrap gap-2">
                  {people.map(p => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setName(p)}
                      className={`h-11 px-3.5 rounded-lg text-[14px] font-medium transition-colors ${
                        name === p ? 'bg-ink text-canvas' : 'bg-surface-strong text-ink-secondary hover:text-ink'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => { setTyping(true); setName('') }}
                  className="mt-2.5 text-[12.5px] text-ink-muted hover:text-ink transition-colors"
                >
                  Not on the list — type it
                </button>
              </>
            ) : (
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name"
                autoComplete="name"
                /* 16px: anything smaller and iOS Safari zooms the whole page in
                   on focus, which on a shop floor reads as the app breaking. */
                className="mt-2 w-full h-12 px-3 rounded-lg bg-surface border border-hairline text-[16px] text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
              />
            )}

            {/* The four perspectives, verbatim from the meeting. */}
            <p className="mt-5 text-[12px] font-medium text-ink-secondary">
              How did you work on this unit?
            </p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              {WALK_ROLES.map(r => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`h-12 rounded-lg text-[13.5px] font-medium transition-colors ${
                    role === r ? 'bg-ink text-canvas' : 'bg-surface-strong text-ink-secondary hover:text-ink'
                  }`}
                >
                  {WALK_ROLE_LABELS[r]}
                </button>
              ))}
            </div>

            {/* Only a standing tag asks for the number. A unit sticker already
                knows, and on a phone in a loud room every field you can delete
                is worth deleting. */}
            {!tag.job_number && (
              <>
                <p className="mt-5 text-[12px] font-medium text-ink-secondary">
                  Serial number <span className="text-ink-faint font-normal">— on the nameplate</span>
                </p>
                <input
                  value={number}
                  onChange={e => setNumber(e.target.value)}
                  inputMode="numeric"
                  placeholder="4153"
                  className="mt-2 w-full h-14 px-4 rounded-lg bg-surface border border-hairline text-[24px] font-medium text-ink tabular-nums placeholder:text-ink-faint focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
                />
              </>
            )}

            {error && <p className="mt-3 text-[13px] text-rose-600 dark:text-rose-400">{error}</p>}

            <button
              type="button"
              onClick={start}
              disabled={busy}
              className="mt-5 w-full h-13 min-h-[52px] rounded-lg bg-brand text-white text-[15px] font-medium hover:bg-brand-hover active:scale-[0.99] disabled:opacity-60 transition-all inline-flex items-center justify-center gap-2"
            >
              {busy ? <><Loader2 size={17} className="animate-spin" /> Starting…</> : 'Start'}
            </button>
          </div>
        </div>
      </div>
    </Shell>
  )
}

/* ── The walk ───────────────────────────────────────────────────────────────── */
function Walking({
  tag, session, transcriptionConfigured, onLeave, onSubmitted,
}: {
  tag: PpTag
  session: OpenWalk
  transcriptionConfigured: boolean
  onLeave: () => void
  onSubmitted: (n: number) => void
}) {
  const walk = session.walk
  const [findings, setFindings] = useState<Local[]>(session.findings)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  // findingId -> the upload in flight (or the one that failed, with its retry).
  const [uploads, setUploads] = useState<Record<string, UploadState>>({})

  const photoRef = useRef<HTMLInputElement | null>(null)
  const videoRef = useRef<HTMLInputElement | null>(null)
  const pendingKindRef = useRef<'photo' | 'video' | null>(null)
  const targetRef = useRef<string | null>(null)

  const base = `/api/walk/${tag.token}`
  // A fresh upload previews from a local object URL — instant, and it means the
  // page makes no read request at all for media it just wrote. The token-gated
  // read route is only for thumbnails that outlived a page reload.
  const freshUrls = useRef<Map<string, string>>(new Map())
  useEffect(() => () => { freshUrls.current.forEach(URL.revokeObjectURL) }, [])
  const mediaSrcFor = (path: string) =>
    freshUrls.current.get(path) ?? `${base}/media?path=${encodeURIComponent(path)}`

  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())
  useEffect(() => {
    const map = timers.current
    return () => { map.forEach(clearTimeout); map.clear() }
  }, [])

  const patch = useCallback(async (id: string, body: Record<string, unknown>) => {
    setFindings(cur => cur.map(f => (f.id === id ? { ...f, _saving: true, _error: undefined } : f)))
    const res = await fetch(`${base}/findings/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const json = await res.json().catch(() => ({}))
    setFindings(cur => cur.map(f => (f.id === id
      ? res.ok
        // Merge, never replace: a note somebody kept dictating while the request
        // was in flight must not be reverted to what the server echoed back.
        ? { ...f, ...json.finding, note: f.note, _saving: false, _error: undefined }
        : { ...f, _saving: false, _error: json.error || 'Not saved' }
      : f)))
  }, [base])

  const queueSave = useCallback((id: string, body: Record<string, unknown>) => {
    const map = timers.current
    const existing = map.get(id)
    if (existing) clearTimeout(existing)
    map.set(id, setTimeout(() => { map.delete(id); void patch(id, body) }, 700))
  }, [patch])

  const addFinding = useCallback(async (): Promise<Local | null> => {
    setError('')
    const res = await fetch(`${base}/findings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walkaround_id: walk.id }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) { setError(json.error || 'Could not add that.'); return null }
    const created: Local = { ...json.finding, media: json.finding.media ?? [] }
    setFindings(cur => [created, ...cur])
    return created
  }, [base, walk.id])

  const attach = useCallback((findingId: string, media: Media) => {
    setFindings(cur => {
      const next = cur.map(f => (f.id === findingId ? { ...f, media: [...f.media, media] } : f))
      const target = next.find(f => f.id === findingId)
      if (target) void patch(findingId, { media: target.media })
      return next
    })
  }, [patch])

  const pickFile = (kind: 'photo' | 'video', findingId: string | null) => {
    pendingKindRef.current = kind
    targetRef.current = findingId
    ;(kind === 'photo' ? photoRef : videoRef).current?.click()
  }

  /* Send one file, reporting progress against its finding.
   *
   * ⚠️ The error lands on the FINDING with a retry that re-sends the SAME bytes,
   * not in the page banner. This is the path most likely to fail — a phone at
   * the far end of the shop, on the worst wifi in the building — and the person
   * holding it has no portal account, no other way in, and no patience for
   * filming a two-minute clip twice. */
  const sendFile = useCallback(async (findingId: string, kind: 'photo' | 'video', file: File) => {
    setUploads(u => ({ ...u, [findingId]: { kind, pct: 0 } }))

    /* 🔴 A blocked microphone makes the phone film with NO AUDIO TRACK, and
       nothing about the clip looks wrong to whoever shot it. Say so here, at the
       unit, while re-filming still costs a minute — not days later when an
       engineer opens a silent finding on a unit that has shipped.
       This matters more on THIS page than on the admin one: a scanner is an
       electrician or a tester who opened the site once off a sticker, so a
       blocked microphone is the likely default rather than the exception.
       null means "cannot tell": stay quiet rather than accuse. */
    let warning: string | undefined
    if (kind === 'video') {
      const audio = await hasAudioTrack(file)
      if (audio === false) {
        warning = `This clip has no sound — the microphone is blocked for this site. It is uploading anyway. ${micHelpLine(navigator.userAgent)}`
      }
    }

    // The upload route refuses to mint a URL that is not destined for a note
    // this tag owns, so the finding id travels with the request.
    const res = await uploadMedia(kind, file, file.name || `${kind}.bin`, `${base}/upload-url`, {
      extraBody: { finding_id: findingId },
      onProgress: pct => setUploads(u => (u[findingId] ? { ...u, [findingId]: { ...u[findingId], pct } } : u)),
    })
    if (!res.ok) {
      setUploads(u => ({
        ...u,
        [findingId]: {
          kind,
          pct: 0,
          error: res.error,
          permanent: res.permanent,
          // Only a transient failure gets a retry — a permanent one re-runs the
          // identical check and looks like a dead button. See UploadStrip.
          retry: res.permanent ? undefined : () => { void sendFile(findingId, kind, file) },
        },
      }))
      return
    }
    // A silent clip keeps its warning on screen after a successful upload —
    // that is the whole point, since nothing else signals the problem.
    if (warning) setUploads(u => ({ ...u, [findingId]: { kind, pct: 1, warning } }))
    else setUploads(u => { const { [findingId]: _gone, ...rest } = u; return rest })
    if (res.previewUrl) freshUrls.current.set(res.media.path, res.previewUrl)
    attach(findingId, res.media)
  }, [base, attach])

  const onFile = async (file: File | undefined) => {
    const kind = pendingKindRef.current
    if (!file || !kind) return
    setError('')

    let id = targetRef.current
    if (!id) {
      setBusy(true)
      const created = await addFinding()
      setBusy(false)
      if (!created) return
      id = created.id
    }
    await sendFile(id, kind, file)
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
    await fetch(`${base}/findings/${id}`, { method: 'DELETE' })
  }

  const usable = findings.filter(f => f.note.trim() || f.media.length > 0)

  const send = async () => {
    timers.current.forEach(clearTimeout)
    timers.current.clear()
    for (const f of findings) {
      await patch(f.id, { note: f.note, note_source: f.note_source, category: f.category, severity: f.severity })
    }
    setBusy(true); setError('')
    const res = await fetch(`${base}/submit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ walkaround_id: walk.id }),
    })
    const json = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(json.error || 'Could not send it.'); return }
    onSubmitted(json.submitted)
  }

  return (
    <div className="min-h-[100dvh] flex flex-col bg-canvas">
      <div className="flex-shrink-0 border-b border-hairline bg-surface">
        <div className="mx-auto w-full max-w-[720px] px-4 py-3 flex items-center gap-3">
          <button
            type="button"
            onClick={onLeave}
            aria-label="Back"
            className="w-9 h-9 -ml-1 rounded-lg inline-flex items-center justify-center text-ink-muted hover:bg-surface-strong hover:text-ink transition-colors"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted truncate">
              {walk.walked_by_name}
            </p>
            <p className="text-[17px] font-semibold text-ink tabular-nums leading-tight">
              Unit {walk.job_number}
            </p>
          </div>
          <button
            type="button"
            onClick={send}
            disabled={busy || usable.length === 0}
            className="h-11 px-3.5 rounded-lg bg-brand text-white text-[13.5px] font-medium hover:bg-brand-hover active:scale-[0.98] disabled:opacity-40 disabled:active:scale-100 transition-all inline-flex items-center gap-1.5 flex-shrink-0"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <CloudUpload size={15} strokeWidth={1.75} />}
            Send{usable.length > 0 ? ` (${usable.length})` : ''}
          </button>
        </div>

        <MicBlockedBanner />

        {/* Add another one without scrolling to the bottom of a long walk. */}
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

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[720px] px-4 py-4 pb-32 space-y-3">
          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/10 px-3 py-2.5">
              <CircleAlert size={15} className="text-rose-600 dark:text-rose-400 mt-0.5 flex-shrink-0" />
              <p className="text-[13px] text-rose-700 dark:text-rose-300 leading-snug flex-1">{error}</p>
              <button type="button" onClick={() => setError('')} aria-label="Dismiss"><X size={14} className="text-rose-500" /></button>
            </div>
          )}

          {findings.length === 0 && (
            <div className="rounded-xl border border-dashed border-hairline-strong bg-surface/50 px-5 py-10 text-center">
              <p className="text-[14.5px] text-ink-secondary leading-relaxed">
                Walk the unit. Talk into it, photograph it, film it.
              </p>
              <p className="mt-2 text-[13px] text-ink-muted leading-relaxed">
                Everything saves as you go. Nothing goes to engineering until you press Send.
              </p>
            </div>
          )}

          {findings.map((f, i) => (
            <FindingCard
              key={f.id}
              finding={f}
              number={findings.length - i}
              transcriptionConfigured={transcriptionConfigured}
              uploadEndpoint={`${base}/upload-url`}
              mediaSrcFor={mediaSrcFor}
              upload={uploads[f.id]}
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
              onAudio={(m, preview) => { freshUrls.current.set(m.path, preview); attach(f.id, m) }}
              onRemoveMedia={p => removeMedia(f.id, p)}
              onRemove={() => removeFinding(f.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex-shrink-0 border-t border-hairline bg-surface pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto w-full max-w-[720px] px-3 py-2.5 grid grid-cols-3 gap-2">
          <Action icon={<Camera size={20} strokeWidth={1.75} />} label="Photo" busy={busy} onClick={() => pickFile('photo', null)} />
          <Action icon={<Video size={20} strokeWidth={1.75} />} label="Video" busy={busy} onClick={() => pickFile('video', null)} />
          <Action icon={<Pencil size={20} strokeWidth={1.75} />} label="Note" busy={busy} onClick={() => { void addFinding() }} />
        </div>
      </div>

      <input ref={photoRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
      <input ref={videoRef} type="file" accept="video/*" capture="environment" className="hidden"
        onChange={e => { void onFile(e.target.files?.[0]); e.target.value = '' }} />
    </div>
  )
}

function Action({
  icon, label, onClick, busy,
}: {
  icon: React.ReactNode; label: string; onClick: () => void; busy?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="h-16 rounded-lg border border-hairline-strong bg-surface flex flex-col items-center justify-center gap-0.5 text-ink-secondary hover:bg-surface-soft hover:text-ink active:scale-[0.97] disabled:opacity-50 transition-all"
    >
      {busy ? <Loader2 size={20} className="animate-spin" /> : icon}
      <span className="text-[11.5px] font-medium">{label}</span>
    </button>
  )
}

function Done({
  submitted, jobNumber, onAgain,
}: {
  submitted: number; jobNumber: string; onAgain: () => void
}) {
  return (
    <Shell>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-[560px] p-4">
          <div className="rounded-xl border border-hairline bg-surface p-6 text-center">
            <span className="inline-flex w-14 h-14 rounded-full bg-brand-soft items-center justify-center">
              <Check size={28} className="text-brand-ink" strokeWidth={2} />
            </span>
            <h1 className="mt-4 text-[21px] font-semibold text-ink tracking-tight">
              Thanks — that&rsquo;s with engineering
            </h1>
            <p className="mt-2 text-[14px] text-ink-secondary leading-relaxed">
              {submitted} note{submitted === 1 ? '' : 's'} on unit {jobNumber}. Somebody has two weeks
              to come back with what changes.
            </p>
            <button
              type="button"
              onClick={onAgain}
              className="mt-6 w-full h-12 rounded-lg border border-hairline-strong bg-surface text-[14px] font-medium text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <CheckCircle2 size={16} strokeWidth={1.75} /> Walk another one
            </button>
          </div>
        </div>
      </div>
    </Shell>
  )
}
