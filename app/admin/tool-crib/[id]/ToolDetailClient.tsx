'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  History, QrCode, Loader2, ArrowLeftRight, Undo2, AlertTriangle, UserPlus,
} from 'lucide-react'
import type { CribTool, CribEvent, CribToolStatus } from '@/lib/supabase'
import { CRIB_STATUS, CRIB_EVENT_LABEL, formatCost, toolThumbPath, photoSrc, CRIB_SHORT_LABEL_MAX } from '@/lib/tool-crib'
import { StatusPill, timeAgo, Avatar } from '@/components/admin/list'
import { DetailTopBar, DetailShell, Card, CardHead, MetaRow } from '@/components/admin/detail-ui'
import ToolPhotos from '@/components/admin/ToolPhotos'
import { ToolThumb } from '@/components/admin/ToolThumb'
import type { EmployeeOption } from './page'

const LIFECYCLE: { value: Exclude<CribToolStatus, 'checked_out'>; label: string }[] = [
  { value: 'available', label: 'Available' },
  { value: 'maintenance', label: 'In maintenance' },
  { value: 'lost', label: 'Lost' },
  { value: 'retired', label: 'Retired' },
]

const btnCx = 'flex items-center gap-2 px-3 py-2 text-[12.5px] font-semibold rounded-lg transition-colors disabled:opacity-60'

function fmtDate(s: string | null) {
  if (!s) return '—'
  return new Date(s).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

/* One row of the custody trail. Names come from the snapshot columns, not a
   live join — so the history still reads correctly after an account is deleted,
   which is the whole reason those columns exist. */
function EventRow({ e }: { e: CribEvent }) {
  const who = e.actor_name ?? 'Someone'
  const detail =
    e.action === 'check_out'      ? `${who} took it out`
    : e.action === 'check_in'     ? `${who} brought it back`
    : e.action === 'force_check_in' ? `${who} force-returned it${e.subject_name ? ` from ${e.subject_name}` : ''}`
    : e.action === 'transfer'     ? `${who} handed it to ${e.subject_name ?? 'someone'}`
    : e.action === 'assign'       ? `${who} assigned it to ${e.subject_name ?? 'someone'}`
    : e.action === 'status_change' ? `${who} marked it ${e.to_status?.replace('_', ' ')}`
    : e.action === 'created'      ? `${who} added it to the crib`
    : who

  const flagged = e.action === 'force_check_in' || e.to_status === 'lost'

  return (
    <div className="flex gap-3 px-5 py-3 border-t border-hairline-soft first:border-t-0">
      <div className="pt-0.5"><Avatar name={who} size={22} /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-ink-secondary">
          {detail}
          {flagged && (
            <AlertTriangle size={11} className="inline ml-1.5 -mt-0.5 text-amber-500" />
          )}
        </p>
        {e.reason && (
          <p className="text-[12px] text-ink-muted mt-0.5 italic">“{e.reason}”</p>
        )}
        {e.condition_note && (
          <p className="text-[12px] text-ink-muted mt-0.5">Condition: {e.condition_note}</p>
        )}
        <p className="text-[11px] text-ink-faint mt-0.5 tabular-nums">
          {timeAgo(e.created_at)} · {CRIB_EVENT_LABEL[e.action] ?? e.action}
        </p>
      </div>
    </div>
  )
}

export default function ToolDetailClient({
  tool, holderName, events, employees,
}: {
  tool: CribTool
  holderName: string | null
  events: CribEvent[]
  employees: EmployeeOption[]
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [mode, setMode] = useState<null | 'force' | 'transfer' | 'assign'>(null)
  const [reason, setReason] = useState('')
  const [target, setTarget] = useState('')
  const [photos, setPhotos] = useState<string[]>(tool.photo_urls ?? [])
  const [shortLabel, setShortLabel] = useState(tool.short_label ?? '')
  const [labelSaved, setLabelSaved] = useState<'idle' | 'saving' | 'saved'>('idle')

  const s = CRIB_STATUS[tool.status]
  const out = tool.status === 'checked_out'

  // Sticker descriptor. Saved on blur so there's no extra button; the printed
  // label and the list pick it up on their next load.
  const saveShortLabel = async () => {
    const next = shortLabel.trim()
    if (next === (tool.short_label ?? '')) return // unchanged
    setLabelSaved('saving')
    const res = await fetch(`/api/admin/tool-crib/${tool.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ short_label: next }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not save the label.')
      setLabelSaved('idle')
      return
    }
    setLabelSaved('saved')
    router.refresh()
  }

  // Persist a photo add/remove immediately — no separate Save button. The list
  // thumbnail and scan page pick it up on their next load.
  const savePhotos = async (next: string[]) => {
    const prev = photos
    setPhotos(next) // optimistic; ToolPhotos is controlled off this, so a revert flows back
    const res = await fetch(`/api/admin/tool-crib/${tool.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photo_urls: next }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Could not save photos.')
      setPhotos(prev) // roll back — otherwise a failed remove silently commits on the next save
      return
    }
    setError('')
    router.refresh()
  }

  const post = async (url: string, body: unknown) => {
    setBusy(true); setError('')
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error || 'That didn’t work.'); return false }
    setMode(null); setReason(''); setTarget('')
    router.refresh()
    return true
  }

  const setStatus = async (status: string) => {
    setBusy(true); setError('')
    const res = await fetch(`/api/admin/tool-crib/${tool.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error || 'Could not change status.'); return }
    router.refresh()
  }

  return (
    <DetailShell>
      <DetailTopBar
        crumbs={[
          { label: 'Tool Crib', href: '/admin/tool-crib' },
          { label: tool.name },
        ]}
      >
        <a
          href={`/admin/tool-crib/labels?ids=${tool.id}`}
          className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}
        >
          <QrCode size={13} />Label
        </a>
      </DetailTopBar>

      <div className="p-4 sm:p-6 grid gap-5 lg:grid-cols-[1fr_320px] max-w-6xl">
        {/* ── Left: identity + custody + history ── */}
        <div className="space-y-5 min-w-0">
          <Card>
            <div className="p-5 flex items-start gap-4">
              <ToolThumb path={toolThumbPath(photos)} size={44} rounded="rounded-xl" />
              <div className="min-w-0 flex-1">
                <h1 className="text-[18px] text-ink" style={{ fontWeight: 620 }}>{tool.name}</h1>
                <p className="text-[12.5px] text-ink-muted mt-0.5 font-mono">{tool.tag_code}</p>
                <div className="mt-2.5 flex items-center gap-2 flex-wrap">
                  <StatusPill tone={s.tone}>{s.label}</StatusPill>
                  {out && (
                    <span className="text-[12.5px] text-ink-secondary">
                      {holderName
                        ? <>with <strong style={{ fontWeight: 600 }}>{holderName}</strong></>
                        : <span className="italic text-ink-faint">holder’s account was deleted</span>}
                      {tool.held_since && <span className="text-ink-faint"> · {timeAgo(tool.held_since)}</span>}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Manager actions. When it's out: force-return or transfer. When
                it's on the shelf (available): assign it to someone — for people
                who take tools without scanning them out. */}
            {(out || tool.status === 'available') && (
              <div className="px-5 pb-5 pt-1 border-t border-hairline-soft">
                <div className="flex items-center gap-2 pt-4 flex-wrap">
                  {out && (
                    <>
                      <button onClick={() => { setMode(mode === 'force' ? null : 'force'); setError('') }}
                        className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
                        <Undo2 size={13} />Force return
                      </button>
                      <button onClick={() => { setMode(mode === 'transfer' ? null : 'transfer'); setError('') }}
                        className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
                        <ArrowLeftRight size={13} />Transfer
                      </button>
                    </>
                  )}
                  {tool.status === 'available' && (
                    <button onClick={() => { setMode(mode === 'assign' ? null : 'assign'); setError('') }}
                      className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
                      <UserPlus size={13} />Assign to…
                    </button>
                  )}
                </div>

                {mode && (
                  <div className="mt-3 p-3 rounded-lg bg-canvas border border-hairline space-y-2.5">
                    <p className="text-[12px] text-ink-muted">
                      {mode === 'force'
                        ? 'Returns it without the holder scanning it in. Logged against your name.'
                        : mode === 'transfer'
                          ? 'Moves custody to someone else without a trip to the crib. Logged against your name.'
                          : 'Checks it out to someone on their behalf — for when they take tools without scanning. Logged against your name.'}
                    </p>
                    {(mode === 'transfer' || mode === 'assign') && (
                      <select value={target} onChange={e => setTarget(e.target.value)}
                        className="w-full h-9 px-3 text-[16px] sm:text-[13px] bg-surface border border-hairline rounded-lg text-ink outline-none focus-visible:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
                        <option value="">{mode === 'assign' ? 'Assign it to…' : 'Hand it to…'}</option>
                        {employees.filter(e => e.id !== tool.held_by).map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    )}
                    <input value={reason} onChange={e => setReason(e.target.value)}
                      placeholder={mode === 'assign' ? 'Reason (optional)' : 'Reason (required)'}
                      className="w-full h-9 px-3 text-[16px] sm:text-[13px] bg-surface border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none focus-visible:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setMode(null); setError('') }}
                        className={`${btnCx} text-ink-muted hover:text-ink-secondary`}>Cancel</button>
                      <button
                        disabled={busy || (mode !== 'assign' && !reason.trim()) || ((mode === 'transfer' || mode === 'assign') && !target)}
                        onClick={() => post(
                          `/api/admin/tool-crib/${tool.id}/custody`,
                          mode === 'force'
                            ? { action: 'force_check_in', reason }
                            : mode === 'transfer'
                              ? { action: 'transfer', to: target, reason }
                              : { action: 'assign', to: target, reason }
                        )}
                        className={`${btnCx} bg-brand hover:bg-brand-hover text-brand-ink`}>
                        {busy && <Loader2 size={13} className="animate-spin" />}
                        {mode === 'force' ? 'Force return' : mode === 'transfer' ? 'Transfer' : 'Assign'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && <p className="px-5 pb-4 text-[12.5px] text-rose-500">{error}</p>}
          </Card>

          <Card>
            <CardHead title="History" icon={<History size={14} />} />
            {events.length === 0
              ? <p className="px-5 py-8 text-center text-[13px] text-ink-muted">Nothing yet.</p>
              : <div>{events.map(e => <EventRow key={e.id} e={e} />)}</div>}
          </Card>
        </div>

        {/* ── Right: photos + details ── */}
        <div className="space-y-5">
          <Card>
            <CardHead title="Sticker label" />
            <div className="p-4">
              <input
                value={shortLabel}
                onChange={e => { setShortLabel(e.target.value); setLabelSaved('idle') }}
                onBlur={saveShortLabel}
                maxLength={CRIB_SHORT_LABEL_MAX}
                placeholder="e.g. Meter kit"
                className="w-full h-9 px-3 text-[16px] sm:text-[13px] bg-canvas border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none transition-all focus-visible:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              />
              <p className="mt-1.5 text-[11px] text-ink-faint">
                {labelSaved === 'saving' ? 'Saving…'
                  : labelSaved === 'saved' ? 'Saved.'
                  : `Up to ${CRIB_SHORT_LABEL_MAX} chars — runs up the side of the QR. Falls back to the name if blank.`}
              </p>
            </div>
          </Card>

          <Card>
            <CardHead title="Photos" />
            <div className="p-4 space-y-3">
              {/* Enlarged hero of the profile photo, when there is one. */}
              {toolThumbPath(photos) && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={photoSrc(toolThumbPath(photos)!)}
                  alt={tool.name}
                  className="w-full aspect-[4/3] object-cover rounded-lg border border-hairline bg-surface-soft"
                />
              )}
              <ToolPhotos paths={photos} onChange={savePhotos} />
            </div>
          </Card>

          <Card>
            <CardHead title="Details" />
            <div className="py-1.5 divide-y divide-hairline-soft">
              <MetaRow label="Code"><span className="font-mono">{tool.tag_code}</span></MetaRow>
              <MetaRow label="Category">{tool.category || '—'}</MetaRow>
              <MetaRow label="Make">{tool.make || '—'}</MetaRow>
              <MetaRow label="Model">{tool.model || '—'}</MetaRow>
              <MetaRow label="Serial">{tool.serial_number || '—'}</MetaRow>
              <MetaRow label="Home">{tool.home_location || '—'}</MetaRow>
              <MetaRow label="Cost"><span className="tabular-nums">{formatCost(tool.purchase_cost)}</span></MetaRow>
              <MetaRow label="Purchased">{fmtDate(tool.purchase_date)}</MetaRow>
              {tool.condition_note && <MetaRow label="Condition">{tool.condition_note}</MetaRow>}
              {tool.notes && <MetaRow label="Notes">{tool.notes}</MetaRow>}
            </div>
          </Card>

          <Card>
            <CardHead title="Status" />
            <div className="p-4">
              {out ? (
                <p className="text-[12px] text-ink-muted">
                  Force-return it before changing status — otherwise the trail
                  would show it going from someone’s hands to the shelf with no
                  return.
                </p>
              ) : (
                <div className="flex flex-col gap-1.5">
                  {LIFECYCLE.map(l => (
                    <button key={l.value} disabled={busy || tool.status === l.value}
                      onClick={() => setStatus(l.value)}
                      className={`text-left px-3 py-2 text-[12.5px] rounded-lg border transition-colors ${
                        tool.status === l.value
                          ? 'border-brand bg-brand-soft text-brand'
                          : 'border-hairline text-ink-secondary hover:bg-surface-soft'
                      }`}>
                      {l.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </Card>
        </div>
      </div>
    </DetailShell>
  )
}
