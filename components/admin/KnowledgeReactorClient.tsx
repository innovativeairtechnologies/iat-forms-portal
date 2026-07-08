'use client'

// "Jerry's Brain" — the Doc-Ock reactor. Drag a document onto the desiccant-wheel
// reactor and it's absorbed into Jerry's knowledge: uploaded straight to Storage,
// read by Claude, chunked, and written into the RAG pool. The wheel grows a hair
// with every passage learned, IAT-emerald motes orbiting it, with an "absorb"
// pulse each time something lands. Below: everything currently in the brain.

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Brain, UploadCloud, FileText, Trash2, Loader2, Check, AlertCircle, Lock, Globe, Sparkles,
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
  status: 'uploading' | 'reading' | 'done' | 'error'
  message?: string
  chunks?: number
  isInternal: boolean
}

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.gif,.webp'
const MAX_BYTES = 20 * 1024 * 1024

// Miniscule, ever-so-slight growth: the wheel diameter creeps up with the log of
// how many passages Jerry has learned, capped so it never dominates the page.
function wheelSize(totalChunks: number) {
  const grow = Math.min(0.26, Math.log10(1 + Math.max(0, totalChunks)) * 0.03)
  return Math.round(184 * (1 + grow))
}

export default function KnowledgeReactorClient() {
  const [docs, setDocs] = useState<KbDoc[]>([])
  const [totalChunks, setTotalChunks] = useState(0)
  const [loaded, setLoaded] = useState(false)
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [visibility, setVisibility] = useState<'internal' | 'public'>('internal')
  const [dragOver, setDragOver] = useState(false)
  const [absorb, setAbsorb] = useState(0) // bump to replay the absorb pulse
  const [busy, setBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

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

  const feedOne = async (file: File, isInternal: boolean) => {
    const key = `${file.name}-${file.size}-${Math.random().toString(36).slice(2)}`
    setQueue((q) => [{ key, name: file.name, status: 'uploading', isInternal }, ...q])
    try {
      if (file.size > MAX_BYTES) throw new Error('That file is too large (max 20MB).')

      // 1) signed upload URL → bytes go straight to Storage (skips the body limit)
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

      // 2) ingest — Claude reads it, we chunk + store it in the pool
      updateItem(key, { status: 'reading' })
      const ingRes = await fetch('/api/admin/kb/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: urlJson.path,
          media_type: file.type || (file.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : ''),
          filename: file.name,
          is_internal: isInternal,
        }),
      })
      const ingJson = await ingRes.json().catch(() => ({}))
      if (!ingRes.ok) throw new Error(ingJson.error || 'Jerry couldn’t absorb that one.')

      updateItem(key, { status: 'done', chunks: Number(ingJson.chunks) || 0 })
      setTotalChunks((c) => c + (Number(ingJson.chunks) || 0)) // wheel grows immediately
      setAbsorb((n) => n + 1)
    } catch (e) {
      updateItem(key, { status: 'error', message: e instanceof Error ? e.message : 'Something went wrong.' })
    }
  }

  const feedFiles = async (files: File[]) => {
    if (!files.length || busy) return
    setBusy(true)
    const internal = visibility === 'internal'
    // Sequential so the reactor absorbs one doc at a time (nicer, and gentler on the API).
    for (const f of files) await feedOne(f, internal)
    await refresh() // reconcile the list + exact totals
    setBusy(false)
  }

  const removeDoc = async (id: string) => {
    const prev = docs
    setDocs((d) => d.filter((x) => x.id !== id)) // optimistic
    const res = await fetch(`/api/admin/kb/documents/${id}`, { method: 'DELETE' })
    if (!res.ok) { setDocs(prev); return }
    refresh()
  }

  const size = wheelSize(totalChunks)
  const internalCount = docs.filter((d) => d.is_internal).length
  const publicCount = docs.length - internalCount

  return (
    <div className="mx-auto max-w-3xl px-5 py-8">
      {/* ── The reactor ─────────────────────────────────────────────────────── */}
      <div
        className={`kb-reactor relative flex flex-col items-center rounded-2xl border border-zinc-200 bg-white px-6 py-10 dark:border-zinc-800 dark:bg-zinc-900 ${dragOver ? 'kb-reactor--drag' : ''}`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={(e) => { e.preventDefault(); setDragOver(false) }}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); feedFiles(Array.from(e.dataTransfer.files || [])) }}
      >
        <p className="mb-1 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
          <Brain size={13} /> Jerry&apos;s Knowledge
        </p>

        {/* The desiccant-wheel reactor. `key={absorb}` replays the absorb pulse. */}
        <div className="kb-wheel-wrap" style={{ width: size, height: size }}>
          <span className="kb-halo" />
          <span key={`pulse-${absorb}`} className="kb-pulse" />
          <span className={`kb-wheel ${busy ? 'is-charging' : ''}`} />
          <span className="kb-core" />
          <span className="kb-orbit"><i /></span>
          <span className="kb-orbit kb-orbit2"><i /></span>
          <span className="kb-orbit kb-orbit3"><i /></span>
          <span className="kb-wheel-icon"><Sparkles size={Math.round(size * 0.16)} strokeWidth={1.75} /></span>
        </div>

        <p className="mt-6 text-center text-[15px] font-semibold text-zinc-900 dark:text-white">
          {loaded ? (
            <>Jerry knows <span className="tabular-nums text-emerald-600 dark:text-emerald-400">{docs.length}</span> document{docs.length === 1 ? '' : 's'}</>
          ) : 'Warming up…'}
        </p>
        {loaded && (
          <p className="mt-0.5 text-center text-[12.5px] text-zinc-500 dark:text-zinc-400">
            <span className="tabular-nums">{totalChunks.toLocaleString()}</span> passages in memory · {internalCount} staff-only · {publicCount} customer-facing
          </p>
        )}

        {/* Visibility + feed controls */}
        <div className="mt-6 flex flex-col items-center gap-3">
          <div className="inline-flex overflow-hidden rounded-lg border border-zinc-200 text-[12px] dark:border-zinc-700">
            <button
              onClick={() => setVisibility('internal')}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${visibility === 'internal' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <Lock size={12} /> Staff only
            </button>
            <button
              onClick={() => setVisibility('public')}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${visibility === 'public' ? 'bg-emerald-600 text-white' : 'text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}
            >
              <Globe size={12} /> Customer-facing
            </button>
          </div>

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
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-[13px] font-medium text-white transition-all hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? <Loader2 size={15} className="animate-spin" /> : <UploadCloud size={15} />}
            {busy ? 'Absorbing…' : 'Feed the machine'}
          </button>
          <p className="text-center text-[11.5px] text-zinc-400">
            Drag a PDF or photo anywhere onto the reactor. Jerry reads it — even scanned pages — and learns it.
            <br />
            {visibility === 'internal'
              ? 'Staff-only: only the internal Jerry (admin) will use it.'
              : 'Customer-facing: the customer portal’s Jerry can use it too — no competitor names or private info.'}
          </p>
        </div>

        {dragOver && (
          <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-emerald-400 bg-emerald-50/85 backdrop-blur-sm dark:bg-emerald-500/10">
            <span className="flex items-center gap-2 text-[14px] font-semibold text-emerald-700 dark:text-emerald-300">
              <UploadCloud size={18} /> Drop it in — Jerry will absorb it
            </span>
          </div>
        )}
      </div>

      {/* ── In-flight queue ─────────────────────────────────────────────────── */}
      {queue.length > 0 && (
        <div className="mt-5 space-y-2">
          {queue.map((it) => (
            <div key={it.key} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-2.5 text-[12.5px] dark:border-zinc-800 dark:bg-zinc-900">
              <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center">
                {it.status === 'uploading' && <Loader2 size={15} className="animate-spin text-zinc-400" />}
                {it.status === 'reading' && <Loader2 size={15} className="animate-spin text-emerald-500" />}
                {it.status === 'done' && <Check size={15} className="text-emerald-600" />}
                {it.status === 'error' && <AlertCircle size={15} className="text-rose-500" />}
              </span>
              <span className="min-w-0 flex-1 truncate text-zinc-700 dark:text-zinc-200">{it.name}</span>
              <span className="flex-shrink-0 text-[11.5px] text-zinc-400">
                {it.status === 'uploading' && 'Uploading…'}
                {it.status === 'reading' && 'Jerry is reading it…'}
                {it.status === 'done' && `Learned · ${it.chunks?.toLocaleString()} passages`}
                {it.status === 'error' && (it.message || 'Failed')}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── What Jerry knows ────────────────────────────────────────────────── */}
      <div className="mt-8">
        <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-wide text-zinc-400">In Jerry&apos;s memory</h3>
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          {!loaded ? (
            <div className="px-4 py-6 text-center text-[12.5px] text-zinc-400">Loading…</div>
          ) : docs.length === 0 ? (
            <div className="px-4 py-8 text-center text-[12.5px] text-zinc-400">Nothing yet — feed Jerry his first document above.</div>
          ) : (
            <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {docs.map((d) => (
                <li key={d.id} className="group flex items-center gap-3 px-4 py-2.5">
                  <FileText size={15} className="flex-shrink-0 text-zinc-400" />
                  <span className="min-w-0 flex-1 truncate text-[13px] text-zinc-700 dark:text-zinc-200" title={d.title}>{d.title}</span>
                  {d.page_count ? <span className="flex-shrink-0 text-[11px] tabular-nums text-zinc-400">{d.page_count} pg</span> : null}
                  <span className={`flex-shrink-0 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] font-medium ${d.is_internal ? 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'}`}>
                    {d.is_internal ? <><Lock size={9} /> Staff</> : <><Globe size={9} /> Public</>}
                  </span>
                  <button
                    onClick={() => removeDoc(d.id)}
                    aria-label={`Remove ${d.title}`}
                    title="Forget this document"
                    className="flex-shrink-0 rounded-md p-1 text-zinc-300 opacity-0 transition-all hover:bg-rose-50 hover:text-rose-500 group-hover:opacity-100 dark:text-zinc-600 dark:hover:bg-rose-500/10"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
        <p className="mt-2 px-1 text-[11px] text-zinc-400">
          Removing a document makes Jerry forget it immediately. This is the same pool the manuals were loaded into — deletions are permanent.
        </p>
      </div>
    </div>
  )
}
