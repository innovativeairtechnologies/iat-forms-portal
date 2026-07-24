'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { QRCodeSVG } from 'qrcode.react'
import {
  Plus, QrCode, Copy, Check, RefreshCw, ChevronRight, X, Factory, ExternalLink,
} from 'lucide-react'
import { StatusPill } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar,
  CardTable, Row, EmptyRow, Meter, Pagination, usePagedList, ListSearch,
} from '@/components/admin/list-card'
import { boardProgress } from '@/lib/production'
import type { DeptRow } from './page'

const btnCx =
  'flex items-center gap-2 px-3 py-2 text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-60'
const inputCx =
  'w-full h-9 px-3 text-[16px] sm:text-[13px] bg-canvas border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-1 focus-visible:outline-brand transition-all'

/** Absolute URL for the printed QR. Built from the browser's own origin so a
 *  preview deploy prints preview links and prod prints prod links — a hard-coded
 *  origin is how you end up with 200 labels pointing at the wrong host. */
const boardUrl = (token: string) =>
  typeof window === 'undefined' ? `/board/${token}` : `${window.location.origin}/board/${token}`

// Department · Status · Progress today · Board-link actions
const COLS = 'grid-cols-[minmax(220px,2.4fr)_100px_minmax(160px,1.2fr)_220px]'

export default function ProductionClient({
  departments,
  today,
}: {
  departments: DeptRow[]
  today: string
}) {
  const [adding, setAdding] = useState(false)
  const [qrFor, setQrFor] = useState<DeptRow | null>(null)
  const [query, setQuery] = useState('')

  const live = departments.filter((d) => d.is_active).length

  // Search over name + blurb → the working view (before pagination).
  const view = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return departments
    return departments.filter((d) =>
      [d.name, d.blurb].filter(Boolean).join(' ').toLowerCase().includes(q),
    )
  }, [departments, query])

  // Today's shop work, aggregated across the boards in view.
  const stats = useMemo(() => {
    let done = 0, total = 0, unassigned = 0, liveInView = 0
    for (const d of view) {
      const p = boardProgress(d.tasks, today)
      done += p.done
      total += p.total
      unassigned += p.unassigned
      if (d.is_active) liveInView++
    }
    return {
      boards: view.length,
      live: liveInView,
      done,
      total,
      unassigned,
      pct: total ? Math.round((done / total) * 100) : 0,
    }
  }, [view, today])

  const { page, setPage, perPage, setPerPage, totalPages, start, end } =
    usePagedList(view.length, { initialPerPage: 10, resetKey: query })
  const pageRows = view.slice(start, end)

  const addButton = (
    <button
      onClick={() => setAdding(true)}
      className={`${btnCx} bg-brand hover:bg-brand-hover text-white px-4 py-2.5 text-[13px]`}
    >
      <Plus size={15} />
      Add department
    </button>
  )

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Operations"
          title="Production Board"
          count={`${live} ${live === 1 ? 'board' : 'boards'} live`}
          actions={addButton}
        />

        {/* Guidance — private links, honor-system, keep it to shop work. */}
        <p className="border-b border-hairline px-5 py-3 text-[12.5px] leading-relaxed text-ink-muted">
          Each department gets its own board at a private link. Print the QR, stick it on the
          wall, and the team scans it to see their work — <strong className="font-semibold text-ink-secondary">no login</strong>.
          Anyone with the link can read the board and check items off, so keep boards to shop
          work: no customer names, no pricing.
        </p>

        {departments.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-16 text-center">
            <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-surface-strong text-ink-muted">
              <Factory size={20} />
            </span>
            <p className="text-[15px] font-semibold text-ink">No departments yet</p>
            <p className="mb-4 mt-1 max-w-sm text-[13px] text-ink-muted">
              Add a department to spin up its board and print a QR for the shop floor.
            </p>
            {addButton}
          </div>
        ) : (
          <>
            <StatStrip>
              <Stat tone="sky"     label="Boards"      value={stats.boards.toLocaleString()} sub={`${stats.live} live`} />
              <Stat tone="violet"  label="Tasks today" value={stats.total.toLocaleString()} />
              <Stat tone="emerald" label="Done today"  value={`${stats.pct}%`} sub={`${stats.done} of ${stats.total}`} />
              <Stat tone="amber"   label="Unassigned"  value={stats.unassigned.toLocaleString()} />
            </StatStrip>

            <Toolbar>
              <ListSearch value={query} onChange={setQuery} placeholder="Search boards…" />
              <div className="flex-1" />
              {query && (
                <span className="text-[12px] text-ink-muted tabular-nums">
                  {view.length} match{view.length === 1 ? '' : 'es'}
                </span>
              )}
            </Toolbar>

            <CardTable
              cols={COLS}
              minWidth={800}
              head={
                <>
                  <span>Department</span>
                  <span>Status</span>
                  <span>Progress</span>
                  <span className="justify-self-end">Board link</span>
                </>
              }
            >
              {pageRows.map((d) => {
                const p = boardProgress(d.tasks, today)
                return (
                  <Row key={d.id} cols={COLS}>
                    {/* Department */}
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg bg-surface-strong text-ink-muted">
                        <Factory size={14} />
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={`/admin/production/${d.id}`}
                          className="group/name flex min-w-0 items-center gap-1 rounded text-[13px] font-medium text-ink transition-colors hover:text-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                        >
                          <span className="truncate">{d.name}</span>
                          <ChevronRight size={13} className="flex-shrink-0 text-ink-faint transition-transform group-hover/name:translate-x-0.5" />
                        </Link>
                        <p className="truncate text-[11.5px] text-ink-muted">
                          {d.tasks.length} {d.tasks.length === 1 ? 'task' : 'tasks'}
                          {p.unassigned > 0 && ` · ${p.unassigned} unassigned`}
                        </p>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="min-w-0">
                      <StatusPill tone={d.is_active ? 'emerald' : 'slate'}>
                        {d.is_active ? 'Live' : 'Off'}
                      </StatusPill>
                    </div>

                    {/* Progress today */}
                    <div className="min-w-0">
                      <Meter value={p.pct} />
                      <p className="mt-1 text-[11px] text-ink-muted tabular-nums">
                        {p.done} of {p.total} done today
                      </p>
                    </div>

                    {/* Board-link actions */}
                    <div className="flex items-center gap-1.5 justify-self-end">
                      <button
                        onClick={() => setQrFor(d)}
                        className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}
                      >
                        <QrCode size={14} />
                        QR
                      </button>
                      <CopyLink token={d.token} />
                      <a
                        href={`/board/${d.token}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${btnCx} text-ink-muted hover:text-ink-secondary`}
                        title="Open the board as the floor sees it"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>
                  </Row>
                )
              })}

              {pageRows.length === 0 && <EmptyRow>No boards match your search.</EmptyRow>}
            </CardTable>

            <Pagination
              page={page}
              perPage={perPage}
              total={view.length}
              totalPages={totalPages}
              onPage={setPage}
              onPerPage={setPerPage}
              unit="boards"
            />
          </>
        )}
      </ListCard>

      {adding && <AddDeptModal onClose={() => setAdding(false)} />}
      {qrFor && <QrModal dept={qrFor} onClose={() => setQrFor(null)} />}
    </ListCardPage>
  )
}

function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(boardUrl(token))
          setCopied(true)
          setTimeout(() => setCopied(false), 1600)
        } catch {
          /* clipboard blocked (insecure origin / permission) — the QR modal
             shows the URL as selectable text as a fallback */
        }
      }}
      className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}
    >
      {copied ? <Check size={14} className="text-brand" /> : <Copy size={14} />}
      {copied ? 'Copied' : 'Link'}
    </button>
  )
}

function AddDeptModal({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [name, setName] = useState('')
  const [blurb, setBlurb] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return setError('Give the department a name.')
    setSaving(true)
    setError('')
    const res = await fetch('/api/admin/production/departments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, blurb }),
    })
    const data = await res.json().catch(() => ({}))
    setSaving(false)
    if (!res.ok) return setError(data.error || 'Could not add that department.')
    onClose()
    router.refresh()
  }

  return (
    <ModalShell
      title="Add a department"
      subtitle="Its board link is generated automatically."
      onClose={onClose}
    >
      <form onSubmit={submit} className="space-y-4 p-5">
        <label className="block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-ink-faint">Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputCx} placeholder="Electrical" autoFocus />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-[11px] uppercase tracking-wide text-ink-faint">
            What this board covers
          </span>
          <input
            value={blurb}
            onChange={(e) => setBlurb(e.target.value)}
            className={inputCx}
            placeholder="Panels, wiring and controls."
          />
          <span className="mt-1 block text-[11px] text-ink-faint">Shown to the team under the heading.</span>
        </label>
        {error && <p className="text-[12.5px] text-rose-500">{error}</p>}
        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={`${btnCx} bg-brand hover:bg-brand-hover text-white`}>
            {saving ? 'Adding…' : 'Add department'}
          </button>
        </div>
      </form>
    </ModalShell>
  )
}

function QrModal({ dept, onClose }: { dept: DeptRow; onClose: () => void }) {
  const router = useRouter()
  const [rotating, setRotating] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const url = boardUrl(dept.token)

  const rotate = async () => {
    setRotating(true)
    const res = await fetch('/api/admin/production/departments', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: dept.id, rotate: true }),
    })
    setRotating(false)
    if (res.ok) {
      onClose()
      router.refresh()
    }
  }

  return (
    <ModalShell title={dept.name} subtitle="Print this and stick it on the wall." onClose={onClose}>
      <div className="p-5">
        {/* White plate regardless of theme — a QR must stay high-contrast to
            scan, and the dark surface token would tank it. */}
        <div className="flex justify-center rounded-xl border border-hairline bg-white p-6 print:border-0">
          <QRCodeSVG value={url} size={200} level="M" />
        </div>

        <p className="mt-4 break-all rounded-lg border border-hairline bg-canvas px-3 py-2 text-center text-[11.5px] text-ink-muted">
          {url}
        </p>

        <div className="mt-4 flex items-center gap-2 print:hidden">
          <button onClick={() => window.print()} className={`${btnCx} flex-1 justify-center border border-hairline text-ink-secondary hover:bg-surface-soft`}>
            <QrCode size={14} />
            Print
          </button>
          {confirming ? (
            <button onClick={rotate} disabled={rotating} className={`${btnCx} flex-1 justify-center bg-rose-600 text-white hover:bg-rose-700`}>
              <RefreshCw size={14} className={rotating ? 'animate-spin' : ''} />
              {rotating ? 'Issuing…' : 'Yes — kill old QRs'}
            </button>
          ) : (
            <button onClick={() => setConfirming(true)} className={`${btnCx} flex-1 justify-center border border-hairline text-ink-secondary hover:bg-surface-soft`}>
              <RefreshCw size={14} />
              New link
            </button>
          )}
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint print:hidden">
          {confirming
            ? 'Every printed QR for this board stops working immediately. You’ll need to re-print.'
            : 'Issue a new link if a printout goes missing. The old QR stops working.'}
        </p>
      </div>
    </ModalShell>
  )
}

function ModalShell({
  title,
  subtitle,
  onClose,
  children,
}: {
  title: string
  subtitle?: string
  onClose: () => void
  children: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90vh] w-full max-w-md overflow-auto rounded-xl border border-hairline bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-start justify-between border-b border-hairline bg-surface px-5 py-4 print:hidden">
          <div>
            <h2 className="text-[15px] text-ink" style={{ fontWeight: 620 }}>
              {title}
            </h2>
            {subtitle && <p className="mt-0.5 text-[12px] text-ink-muted">{subtitle}</p>}
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 text-ink-faint transition-colors hover:text-ink-secondary">
            <X size={16} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
