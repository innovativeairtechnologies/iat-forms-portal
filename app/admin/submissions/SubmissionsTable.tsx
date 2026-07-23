'use client'

import { useState, useRef, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Inbox, MoreHorizontal, CheckCheck, Clock, CheckCircle2, ExternalLink } from 'lucide-react'
import { markSubmissionRead, updateSubmissionStatus } from './actions'
import { StatusPill, timeAgo, SUBMISSION_STATUS } from '@/components/admin/list'
import { CardTable, Row, ToneAvatar, EmptyRow } from '@/components/admin/list-card'
import { BulkBar, BulkActionButton, BulkDeleteButton } from '@/components/admin/bulk-select'

export type SubmissionRow = {
  id: string
  form_title: string | null
  submitted_at: string
  is_read: boolean
  status?: string
  data: Record<string, unknown>
}

// Mobile keeps the identity / status / age trio so the row fits the viewport with
// no sideways scroll; the checkbox + kebab columns appear at sm+ (CardTable bakes
// in the min-width + overflow-x scroll for the wider desktop grid).
const COLS = 'grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[34px_2fr_140px_90px_40px]'

export default function SubmissionsTable({ submissions, emptyHint }: { submissions: SubmissionRow[]; emptyHint?: string }) {
  const router = useRouter()
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuFor) return
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuFor(null)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [menuFor])

  // Never carry a selection across a page change (pagination swaps the rows prop
  // without remounting) — a bulk delete must only ever touch visible rows.
  useEffect(() => { setSelected(new Set()) }, [submissions])

  const toggle = (id: string) =>
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  const allSelected = submissions.length > 0 && submissions.every(s => selected.has(s.id))
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(submissions.map(s => s.id)))

  const runBulk = (fn: (id: string) => Promise<void>) => {
    const ids = Array.from(selected)
    startTransition(async () => {
      await Promise.all(ids.map(fn))
      setSelected(new Set())
      router.refresh()
    })
  }

  const runOne = (id: string, fn: (id: string) => Promise<void>) => {
    setMenuFor(null)
    startTransition(async () => {
      await fn(id)
      router.refresh()
    })
  }

  return (
    <>
      <CardTable
        cols={COLS}
        minWidth={620}
        head={
          <>
            <div className="hidden sm:flex items-center justify-center">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all"
                className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer" />
            </div>
            <span>Submitter</span>
            <span>Status</span>
            <span>Created</span>
            <span className="hidden sm:block" />
          </>
        }
      >
        {submissions.length === 0 ? (
          <EmptyRow>
            <Inbox size={28} className="text-ink-faint mx-auto mb-3" />
            <p className="text-[13px] text-ink-muted">{emptyHint || 'No submissions found'}</p>
            <p className="text-[11px] text-ink-faint mt-1">Try adjusting your filters</p>
          </EmptyRow>
        ) : (
          submissions.map((sub) => {
            const name = String(sub.data?.['Employee Name'] || sub.data?.['Full Name'] || sub.data?.['Name'] || 'Anonymous')
            const st = SUBMISSION_STATUS[sub.status || 'open'] ?? SUBMISSION_STATUS.open
            const isSel = selected.has(sub.id)

            return (
              <Row key={sub.id} cols={COLS} href={`/admin/submissions/${sub.id}`} selected={isSel}>
                {/* Checkbox — presentational input; the cell drives the toggle so a
                    click toggles selection (over the whole hit area) and never
                    follows the row link. */}
                <div
                  className="hidden sm:flex items-center justify-center"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggle(sub.id) }}
                >
                  <input type="checkbox" checked={isSel} readOnly tabIndex={-1} aria-label="Select submission"
                    className="w-[15px] h-[15px] rounded accent-emerald-600 cursor-pointer pointer-events-none" />
                </div>

                {/* Identity — submitter over form; leading unread dot + colored avatar */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="flex items-center gap-2 flex-shrink-0">
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${sub.is_read ? 'bg-transparent' : 'bg-emerald-500'}`}
                      title={sub.is_read ? undefined : 'Unread'}
                    />
                    <ToneAvatar name={name} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{name}</p>
                    {sub.form_title && <p className="text-[11.5px] text-ink-muted truncate">{sub.form_title}</p>}
                  </div>
                </div>

                {/* Status */}
                <div><StatusPill tone={st.tone}>{st.label}</StatusPill></div>

                {/* Created */}
                <div className="text-[12.5px] text-ink-muted tabular-nums">{timeAgo(sub.submitted_at)}</div>

                {/* Kebab */}
                <div
                  className="hidden sm:flex justify-center relative"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
                >
                  <button onClick={() => setMenuFor(menuFor === sub.id ? null : sub.id)} aria-label="Row actions"
                    className="p-1.5 rounded-md text-ink-faint hover:text-ink-secondary hover:bg-surface-strong transition-colors">
                    <MoreHorizontal size={15} />
                  </button>
                  {menuFor === sub.id && (
                    <div ref={menuRef} className="absolute right-8 top-1/2 -translate-y-1/2 z-30 w-44 rounded-lg border border-hairline bg-surface shadow-xl dark:shadow-none dark:ring-1 dark:ring-white/10 py-1">
                      <MenuItem icon={<ExternalLink size={13} />} label="Open" onClick={() => { setMenuFor(null); router.push(`/admin/submissions/${sub.id}`) }} />
                      {!sub.is_read && <MenuItem icon={<CheckCheck size={13} />} label="Mark as read" onClick={() => runOne(sub.id, (id) => markSubmissionRead(id, { audit: true }))} />}
                      {sub.status !== 'in_progress' && <MenuItem icon={<Clock size={13} />} label="Mark In Progress" onClick={() => runOne(sub.id, (id) => updateSubmissionStatus(id, 'in_progress'))} />}
                      {sub.status !== 'resolved' && <MenuItem icon={<CheckCircle2 size={13} />} label="Resolve" onClick={() => runOne(sub.id, (id) => updateSubmissionStatus(id, 'resolved'))} />}
                    </div>
                  )}
                </div>
              </Row>
            )
          })
        )}
      </CardTable>

      {/* Floating bulk-action bar */}
      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <BulkActionButton icon={<CheckCheck size={13} />} label="Mark read" disabled={pending} onClick={() => runBulk(markSubmissionRead)} />
        <BulkActionButton icon={<Clock size={13} />} label="In Progress" disabled={pending} onClick={() => runBulk((id) => updateSubmissionStatus(id, 'in_progress'))} />
        <BulkActionButton icon={<CheckCircle2 size={13} />} label="Resolve" disabled={pending} onClick={() => runBulk((id) => updateSubmissionStatus(id, 'resolved'))} />
        <BulkDeleteButton entity="submissions" ids={Array.from(selected)} onDone={() => setSelected(new Set())} />
      </BulkBar>
    </>
  )
}

function MenuItem({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors text-left">
      <span className="text-ink-faint">{icon}</span>
      {label}
    </button>
  )
}
