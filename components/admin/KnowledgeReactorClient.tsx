'use client'

// "Jerry's Brain" — the Doc-Ock reactor, full-page. The desiccant wheel lives
// alone mid-screen: ambient motes drift around it, it tilts toward the mouse,
// charges up while Jerry reads, and pulses when it absorbs a document. The wheel
// grows a hair with every passage learned. Everything else — the explainer, the
// in-flight activity, the full inventory of what Jerry knows — lives in a
// collapsible panel pinned to the top-right corner.
//
// SCRUB PREVIEW GATE: nothing enters the pool without approval. Feeding a file
// runs upload → /api/admin/kb/analyze (Claude transcribes + flags competitor
// names, emails/phones, customer & person names) → a review card. Approve
// (choosing Staff-only vs Customer-facing right there) → /api/admin/kb/ingest
// commits it; Discard throws the transcript away. The competitor auto-scrub at
// commit time is unconditional — the preview is a human gate on top of it.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Brain, UploadCloud, FileText, Trash2, Loader2, Check, AlertCircle, Lock, Globe,
  Sparkles, X, ChevronRight, ShieldCheck, Mail, Phone, Building2, User, EyeOff,
} from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

type KbDoc = {
  id: string
  title: string
  category: string | null
  is_internal: boolean
  page_count: number | null
  created_at: string
}

type QueueItem = {
  key: string
  name: string
  status: 'uploading' | 'reading' | 'review' | 'saving' | 'done' | 'discarded' | 'error'
  message?: string
  chunks?: number
}

type Findings = {
  summary: string
  competitors: string[]
  customers: string[]
  people: string[]
  emails: string[]
  phones: string[]
}

type ReviewItem = {
  key: string // matches the queue item
  filename: string
  title: string
  transcript: string
  pageCount: number
  chunkCount: number
  findings: Findings
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp'
const MAX_BYTES = 20 * 1024 * 1024

// Miniscule, ever-so-slight growth: diameter creeps up with the log of how many
// passages Jerry has learned, capped so it never dominates the page.
function wheelSize(totalChunks: number) {
  const grow = Math.min(0.24, Math.log10(1 + Math.max(0, totalChunks)) * 0.028)
  return Math.round(236 * (1 + grow))
}

// Ambient motes — fixed values (no Math.random: SSR/client markup must match).
const MOTES = [
  { left: '8%', top: '22%', size: 5, dur: 19, delay: 0 },
  { left: '16%', top: '68%', size: 4, dur: 23, delay: 3 },
  { left: '24%', top: '38%', size: 3, dur: 17, delay: 7 },
  { left: '33%', top: '80%', size: 5, dur: 26, delay: 1 },
  { left: '42%', top: '14%', size: 3, dur: 21, delay: 9 },
  { left: '55%', top: '86%', size: 4, dur: 18, delay: 5 },
  { left: '63%', top: '24%', size: 3, dur: 24, delay: 2 },
  { left: '71%', top: '62%', size: 5, dur: 20, delay: 11 },
  { left: '79%', top: '35%', size: 4, dur: 25, delay: 6 },
  { left: '87%', top: '74%', size: 3, dur: 22, delay: 4 },
  { left: '92%', top: '18%', size: 4, dur: 19, delay: 8 },
  { left: '12%', top: '88%', size: 3, dur: 27, delay: 10 },
]

function FindingGroup({ icon, label, items, tone }: {
  icon: React.ReactNode; label: string; items: string[]; tone: 'emerald' | 'amber'
}) {
  if (!items.length) return null
  const chip = tone === 'emerald'
    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
    : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400'
  return (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
        {icon} {label}
      </p>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it, i) => (
          <span key={i} className={`rounded-md px-1.5 py-0.5 text-[11.5px] font-medium ${chip}`}>{it}</span>
        ))}
      </div>
    </div>
  )
}

export default function KnowledgeReactorClient() {
  const [docs, setDocs] = useState<KbDoc[]>([])
  const [totalChunks, setTotalChunks] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [reviews, setReviews] = useState<ReviewItem[]>([])
  const [reviewVisibility, setReviewVisibility] = useState<'internal' | 'public'>('internal')
  const [panelOpen, setPanelOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [absorb, setAbsorb] = useState(0) // bump to replay the absorb pulse
  const [busy, setBusy] = useState(false) // a file is uploading / being read
  const [saving, setSaving] = useState(false) // a review is being committed
  const [tilt, setTilt] = useState({ x: 0, y: 0 })
  const fileRef = useRef<HTMLInputElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)

  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/kb/documents')
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        setDocs(Array.isArray(json.documents) ? json.documents : [])
        setTotalChunks(Number(json.totalChunks) || 0)
      }
    } finally {
      setLoaded(true)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const updateItem = (key: string, patch: Partial<QueueItem>) =>
    setQueue((q) => q.map((it) => (it.key === key ? { ...it, ...patch } : it)))

  // ── phase 1: upload + analyze (scrub preview) ────────────────────────────────
  const analyzeOne = async (file: File) => {
    const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`
    setQueue((q) => [{ key, name: file.name, status: 'uploading' }, ...q])
    try {
      if (file.size > MAX_BYTES) throw new Error('That file is too large (max 20MB).')

      const urlRes = await fetch('/api/admin/kb/upload-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: file.name, size: file.size }),
      })
      const urlJson = await urlRes.json().catch(() => ({}))
      if (!urlRes.ok) throw new Error(urlJson.error || 'Could not start the upload.')

      const sb = createSupabaseBrowser()
      const { error: upErr } = await sb.storage
        .from('kb-uploads')
        .uploadToSignedUrl(urlJson.path, urlJson.token, file, { contentType: file.type || undefined })
      if (upErr) throw new Error(upErr.message || 'Upload failed.')

      updateItem(key, { status: 'reading' })
      const res = await fetch('/api/admin/kb/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: urlJson.path,
          media_type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : ''),
          filename: file.name,
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Jerry couldn’t read that one.')

      updateItem(key, { status: 'review' })
      setReviews((r) => [...r, {
        key,
        filename: file.name,
        title: json.title || file.name,
        transcript: json.transcript || '',
        pageCount: Number(json.pageCount) || 0,
        chunkCount: Number(json.chunkCount) || 0,
        findings: json.findings || { summary: '', competitors: [], customers: [], people: [], emails: [], phones: [] },
      }])
    } catch (e) {
      updateItem(key, { status: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' })
    }
  }

  const feedFiles = async (files: File[]) => {
    if (!files.length || busy) return
    setBusy(true)
    for (const f of files) await analyzeOne(f) // one at a time — the reactor reads one doc at a time
    setBusy(false)
  }

  // ── phase 2: approve / discard the review ───────────────────────────────────
  const currentReview = reviews[0] ?? null

  const approveReview = async () => {
    if (!currentReview || saving) return
    setSaving(true)
    updateItem(currentReview.key, { status: 'saving' })
    try {
      const res = await fetch('/api/admin/kb/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript: currentReview.transcript,
          filename: currentReview.filename,
          is_internal: reviewVisibility === 'internal',
        }),
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Jerry couldn’t absorb that one.')
      updateItem(currentReview.key, { status: 'done', chunks: Number(json.chunks) || 0 })
      setTotalChunks((c) => c + (Number(json.chunks) || 0)) // the wheel grows immediately
      setAbsorb((n) => n + 1)
      setReviews((r) => r.slice(1))
      setReviewVisibility('internal') // reset the safe default for the next review
      refresh()
    } catch (e) {
      updateItem(currentReview.key, { status: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' })
      setReviews((r) => r.slice(1))
    } finally {
      setSaving(false)
    }
  }

  const discardReview = () => {
    if (!currentReview || saving) return
    updateItem(currentReview.key, { status: 'discarded' })
    setReviews((r) => r.slice(1))
    setReviewVisibility('internal')
  }

  const removeDoc = async (id: string) => {
    const prev = docs
    setDocs((d) => d.filter((x) => x.id !== id)) // optimistic
    const res = await fetch(`/api/admin/kb/documents/${id}`, { method: 'DELETE' })
    if (!res.ok) { setDocs(prev); return }
    refresh()
  }

  // Subtle 3D tilt toward the pointer — the "alive" feel.
  const onSceneMouseMove = (e: React.MouseEvent) => {
    const el = sceneRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const nx = (e.clientX - r.left) / r.width - 0.5   // -0.5 … 0.5
    const ny = (e.clientY - r.top) / r.height - 0.5
    setTilt({ x: nx * 14, y: ny * -14 })
  }

  const size = wheelSize(totalChunks)
  const internalCount = docs.filter((d) => d.is_internal).length
  const publicCount = docs.length - internalCount
  const reading = queue.some((it) => it.status === 'uploading' || it.status === 'reading')
  const activity = queue.filter((it) => it.status !== 'done' && it.status !== 'discarded')
  const sensitiveCount = currentReview
    ? currentReview.findings.customers.length + currentReview.findings.people.length +
      currentReview.findings.emails.length + currentReview.findings.phones.length
    : 0

  return (
    <div
      ref={sceneRef}
      className="kb-scene relative h-full overflow-hidden"
      onMouseMove={onSceneMouseMove}
      onMouseLeave={() => setTilt({ x: 0, y: 0 })}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
      onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
      onDrop={(e) => { e.preventDefault(); setDragOver(false); feedFiles(Array.from(e.dataTransfer.files || [])) }}
    >
      {/* Ambient drifting motes */}
      {MOTES.map((m, i) => (
        <span
          key={i}
          className="kb-mote"
          style={{ left: m.left, top: m.top, width: m.size, height: m.size, animationDuration: `${m.dur}s`, animationDelay: `${m.delay}s` }}
          aria-hidden="true"
        />
      ))}

      {/* ── The reactor, alone mid-page ─────────────────────────────────────── */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center px-6">
        <div
          className="kb-tilt"
          style={{ transform: `perspective(1000px) rotateY(${tilt.x}deg) rotateX(${tilt.y}deg)` }}
        >
          <div className="kb-wheel-wrap" style={{ width: size, height: size }}>
            <span className="kb-halo" />
            <span key={`pulse-${absorb}`} className="kb-pulse" />
            <span className={`kb-wheel ${reading || saving ? 'is-charging' : ''}`} />
            <span className="kb-core" />
            <span className="kb-orbit"><i /></span>
            <span className="kb-orbit kb-orbit2"><i /></span>
            <span className="kb-orbit kb-orbit3"><i /></span>
            <span className="kb-wheel-icon"><Sparkles size={Math.round(size * 0.15)} strokeWidth={1.75} /></span>
          </div>
        </div>

        <p className="mt-8 text-center text-[17px] font-semibold text-zinc-900 dark:text-white">
          {!loaded ? 'Warming up…' : reading ? 'Reading…' : (
            <>Jerry knows <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{docs.length}</span> document{docs.length === 1 ? '' : 's'}</>
          )}
        </p>
        {loaded && (
          <p className="mt-1 text-center text-[12.5px] text-zinc-500 dark:text-zinc-400">
            <span className="tabular-nums">{totalChunks.toLocaleString()}</span> passages in memory
          </p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          multiple
          className="hidden"
          onChange={(e) => { feedFiles(Array.from(e.target.files || [])); e.target.value = '' }}
        />
        <button
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-[13.5px] font-medium text-white transition-all hover:bg-emerald-700 hover:shadow-lg hover:shadow-emerald-600/20 disabled:opacity-50"
        >
          {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
          {busy ? 'Absorbing…' : 'Feed the machine'}
        </button>
        <p className="mt-3 text-center text-[11.5px] text-zinc-400">
          or drop a PDF or photo anywhere on this page — you approve every document before Jerry learns it
        </p>
      </div>

      {/* ── Top-right knowledge panel ────────────────────────────────────────── */}
      <div className="absolute right-4 top-4 z-20 flex flex-col items-end">
        {!panelOpen ? (
          <button
            onClick={() => setPanelOpen(true)}
            className="flex items-center gap-2 rounded-full border border-zinc-200 bg-white/90 px-3.5 py-2 text-[12.5px] font-medium text-zinc-700 shadow-sm backdrop-blur transition-all hover:border-emerald-400 hover:text-emerald-700 dark:border-zinc-700 dark:bg-zinc-900/90 dark:text-zinc-200 dark:hover:text-emerald-400"
          >
            <Brain size={15} className="text-emerald-600 dark:text-emerald-400" />
            Jerry&apos;s knowledge
            <span className="rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-semibold tabular-nums text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400">
              {docs.length}
            </span>
          </button>
        ) : (
          <div className="flex max-h-[calc(100vh-8rem)] w-[340px] flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white/95 shadow-xl backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">
            <div className="flex items-center gap-2 border-b border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <Brain size={15} className="text-emerald-600 dark:text-emerald-400" />
              <h3 className="text-[13px] font-bold text-zinc-900 dark:text-white">Jerry&apos;s knowledge</h3>
              <button
                onClick={() => setPanelOpen(false)}
                aria-label="Close panel"
                className="ml-auto flex h-6 w-6 items-center justify-center rounded-full text-zinc-400 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <ChevronRight size={14} />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {/* How it works */}
              <div className="border-b border-zinc-100 px-4 py-3 text-[11.5px] leading-relaxed text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                Drop in a PDF or photo and Jerry reads it — even scanned pages — then splits it into
                searchable passages. You review a <span className="font-medium text-zinc-700 dark:text-zinc-300">scrub preview</span> before
                anything is learned: competitor names are removed automatically, and any emails, phone
                numbers, or customer names are flagged for your call. Once absorbed, Jerry cites the
                document and page in his answers. <span className="font-medium text-zinc-700 dark:text-zinc-300">Staff-only</span> docs
                never reach the customer portal&apos;s Jerry.
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 divide-x divide-zinc-100 border-b border-zinc-100 text-center dark:divide-zinc-800 dark:border-zinc-800">
                {[
                  { n: docs.length, l: 'documents' },
                  { n: internalCount, l: 'staff-only' },
                  { n: publicCount, l: 'customer' },
                ].map((s) => (
                  <div key={s.l} className="px-2 py-2.5">
                    <p className="text-[15px] font-bold tabular-nums text-zinc-900 dark:text-white">{s.n}</p>
                    <p className="text-[10px] uppercase tracking-wide text-zinc-400">{s.l}</p>
                  </div>
                ))}
              </div>

              {/* In-flight activity */}
              {activity.length > 0 && (
                <div className="border-b border-zinc-100 px-4 py-2.5 dark:border-zinc-800">
                  <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-400">Activity</p>
                  <ul className="space-y-1.5">
                    {activity.map((it) => (
                      <li key={it.key} className="flex items-center gap-2 text-[12px]">
                        <span className="flex h-5 w-5 flex-shrink-0 items-center justify-center">
                          {(it.status === 'uploading' || it.status === 'saving') && <Loader2 size={13} className="animate-spin text-zinc-400" />}
                          {it.status === 'reading' && <Loader2 size={13} className="animate-spin text-emerald-500" />}
                          {it.status === 'review' && <ShieldCheck size={13} className="text-amber-500" />}
                          {it.status === 'error' && <AlertCircle size={13} className="text-rose-500" />}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-zinc-600 dark:text-zinc-300">{it.name}</span>
                        <span className="flex-shrink-0 text-[10.5px] text-zinc-400">
                          {it.status === 'uploading' && 'Uploading'}
                          {it.status === 'reading' && 'Reading'}
                          {it.status === 'review' && 'Awaiting review'}
                          {it.status === 'saving' && 'Absorbing'}
                          {it.status === 'error' && (it.message || 'Failed')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Document inventory */}
              <div className="px-4 py-2.5">
                <p className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-zinc-400">In memory</p>
                {!loaded ? (
                  <p className="py-3 text-center text-[12px] text-zinc-400">Loading…</p>
                ) : docs.length === 0 ? (
                  <p className="py-3 text-center text-[12px] text-zinc-400">Nothing yet — feed Jerry his first document.</p>
                ) : (
                  <ul className="space-y-0.5">
                    {docs.map((d) => (
                      <li key={d.id} className="group flex items-center gap-2 rounded-lg px-1.5 py-1.5 hover:bg-zinc-50 dark:hover:bg-zinc-800/60">
                        <FileText size={13} className="flex-shrink-0 text-zinc-400" />
                        <span className="min-w-0 flex-1 truncate text-[12px] text-zinc-700 dark:text-zinc-200" title={d.title}>{d.title}</span>
                        <span className={`flex-shrink-0 inline-flex items-center gap-1 rounded px-1 py-0.5 text-[9.5px] font-medium ${d.is_internal ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
                          {d.is_internal ? <Lock size={8} /> : <Globe size={8} />}
                        </span>
                        <button
                          onClick={() => removeDoc(d.id)}
                          aria-label={`Remove ${d.title}`}
                          title="Forget this document (permanent)"
                          className="flex-shrink-0 rounded p-0.5 text-zinc-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:text-zinc-600 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 size={12} />
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Drag overlay ─────────────────────────────────────────────────────── */}
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center border-2 border-dashed border-emerald-400 bg-emerald-50/80 backdrop-blur-sm dark:bg-emerald-500/10">
          <span className="flex items-center gap-2 text-[15px] font-semibold text-emerald-700 dark:text-emerald-300">
            <UploadCloud size={19} /> Drop it in — Jerry will read it first
          </span>
        </div>
      )}

      {/* ── Scrub preview / review card ─────────────────────────────────────── */}
      {currentReview && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-zinc-900/40 p-4 backdrop-blur-sm">
          <div className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900">
            <div className="flex items-center gap-2.5 border-b border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
              <ShieldCheck size={17} className="text-emerald-600 dark:text-emerald-400" />
              <div className="leading-tight">
                <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white">Review before Jerry learns it</h3>
                <p className="text-[11px] text-zinc-400">{currentReview.filename}</p>
              </div>
              {reviews.length > 1 && (
                <span className="ml-auto rounded-full bg-zinc-100 px-2 py-0.5 text-[10.5px] font-medium text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
                  1 of {reviews.length}
                </span>
              )}
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div>
                <p className="text-[13px] font-semibold text-zinc-900 dark:text-white">{currentReview.title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-zinc-500 dark:text-zinc-400">
                  {currentReview.findings.summary || 'No summary available.'}
                </p>
                <p className="mt-1 text-[11px] tabular-nums text-zinc-400">
                  {currentReview.pageCount} page{currentReview.pageCount === 1 ? '' : 's'} · {currentReview.chunkCount} passage{currentReview.chunkCount === 1 ? '' : 's'}
                </p>
              </div>

              {/* Findings */}
              <div className="space-y-3">
                {currentReview.findings.competitors.length > 0 && (
                  <div>
                    <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
                      <EyeOff size={11} /> Competitor names — removed automatically
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {currentReview.findings.competitors.map((c, i) => (
                        <span key={i} className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11.5px] font-medium text-emerald-700 line-through dark:bg-emerald-500/10 dark:text-emerald-400">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
                <FindingGroup icon={<Building2 size={11} />} label="Customer names" items={currentReview.findings.customers} tone="amber" />
                <FindingGroup icon={<User size={11} />} label="People" items={currentReview.findings.people} tone="amber" />
                <FindingGroup icon={<Mail size={11} />} label="Emails" items={currentReview.findings.emails} tone="amber" />
                <FindingGroup icon={<Phone size={11} />} label="Phone numbers" items={currentReview.findings.phones} tone="amber" />
                {sensitiveCount === 0 && currentReview.findings.competitors.length === 0 && (
                  <p className="flex items-center gap-1.5 text-[12px] text-emerald-600 dark:text-emerald-400">
                    <Check size={13} /> Nothing sensitive found.
                  </p>
                )}
              </div>

              {/* Visibility */}
              <div>
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">Who can Jerry use this for?</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setReviewVisibility('internal')}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12px] transition-colors ${reviewVisibility === 'internal' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700'}`}
                  >
                    <Lock size={13} className="flex-shrink-0" />
                    <span><span className="font-semibold">Staff only</span><br /><span className="text-[10.5px] opacity-75">internal Jerry only</span></span>
                  </button>
                  <button
                    onClick={() => setReviewVisibility('public')}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-left text-[12px] transition-colors ${reviewVisibility === 'public' ? 'border-emerald-500 bg-emerald-50 text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300' : 'border-zinc-200 text-zinc-500 hover:border-zinc-300 dark:border-zinc-700'}`}
                  >
                    <Globe size={13} className="flex-shrink-0" />
                    <span><span className="font-semibold">Customer-facing</span><br /><span className="text-[10.5px] opacity-75">customer portal too</span></span>
                  </button>
                </div>
                {reviewVisibility === 'public' && sensitiveCount > 0 && (
                  <p className="mt-2 flex items-start gap-1.5 text-[11.5px] text-amber-600 dark:text-amber-400">
                    <AlertCircle size={13} className="mt-0.5 flex-shrink-0" />
                    This document mentions {sensitiveCount} name{sensitiveCount === 1 ? '' : 's'}/contact detail{sensitiveCount === 1 ? '' : 's'} and would be visible to customers. Consider Staff only.
                  </p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 border-t border-zinc-100 px-5 py-3.5 dark:border-zinc-800">
              <button
                onClick={discardReview}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-zinc-200 px-3.5 py-2 text-[12.5px] font-medium text-zinc-600 transition-colors hover:border-rose-300 hover:text-rose-600 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
              >
                <X size={13} /> Discard
              </button>
              <button
                onClick={approveReview}
                disabled={saving}
                className="ml-auto inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[12.5px] font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                {saving ? 'Absorbing…' : 'Feed it to Jerry'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
