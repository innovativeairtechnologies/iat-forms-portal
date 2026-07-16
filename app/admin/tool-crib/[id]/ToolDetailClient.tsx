'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Wrench, History, QrCode, Loader2, ArrowLeftRight, Undo2, AlertTriangle,
} from 'lucide-react'
import type { CribTool, CribEvent, CribToolStatus } from '@/lib/supabase'
import { CRIB_STATUS, CRIB_EVENT_LABEL, formatCost } from '@/lib/tool-crib'
import { StatusPill, timeAgo, Avatar } from '@/components/admin/list'
import { DetailTopBar, DetailShell, Card, CardHead, MetaRow } from '@/components/admin/detail-ui'
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
  const [mode, setMode] = useState<null | 'force' | 'transfer'>(null)
  const [reason, setReason] = useState('')
  const [target, setTarget] = useState('')

  const s = CRIB_STATUS[tool.status]
  const out = tool.status === 'checked_out'

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
              <div className="w-11 h-11 rounded-xl bg-surface-soft border border-hairline flex items-center justify-center flex-shrink-0 text-ink-faint">
                <Wrench size={18} strokeWidth={1.8} />
              </div>
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

            {/* Manager actions. Only meaningful while it's out — a tool sitting
                on the shelf has no custody to force or transfer. */}
            {out && (
              <div className="px-5 pb-5 pt-1 border-t border-hairline-soft">
                <div className="flex items-center gap-2 pt-4 flex-wrap">
                  <button onClick={() => { setMode(mode === 'force' ? null : 'force'); setError('') }}
                    className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
                    <Undo2 size={13} />Force return
                  </button>
                  <button onClick={() => { setMode(mode === 'transfer' ? null : 'transfer'); setError('') }}
                    className={`${btnCx} border border-hairline text-ink-secondary hover:bg-surface-soft`}>
                    <ArrowLeftRight size={13} />Transfer
                  </button>
                </div>

                {mode && (
                  <div className="mt-3 p-3 rounded-lg bg-canvas border border-hairline space-y-2.5">
                    <p className="text-[12px] text-ink-muted">
                      {mode === 'force'
                        ? 'Returns it without the holder scanning it in. Logged against your name.'
                        : 'Moves custody to someone else without a trip to the crib. Logged against your name.'}
                    </p>
                    {mode === 'transfer' && (
                      <select value={target} onChange={e => setTarget(e.target.value)}
                        className="w-full h-9 px-3 text-[16px] sm:text-[13px] bg-surface border border-hairline rounded-lg text-ink outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/15">
                        <option value="">Hand it to…</option>
                        {employees.filter(e => e.id !== tool.held_by).map(e => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    )}
                    <input value={reason} onChange={e => setReason(e.target.value)}
                      placeholder="Reason (required)"
                      className="w-full h-9 px-3 text-[16px] sm:text-[13px] bg-surface border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/15" />
                    <div className="flex justify-end gap-2">
                      <button onClick={() => { setMode(null); setError('') }}
                        className={`${btnCx} text-ink-muted hover:text-ink-secondary`}>Cancel</button>
                      <button
                        disabled={busy || !reason.trim() || (mode === 'transfer' && !target)}
                        onClick={() => post(
                          `/api/admin/tool-crib/${tool.id}/custody`,
                          mode === 'force'
                            ? { action: 'force_check_in', reason }
                            : { action: 'transfer', to: target, reason }
                        )}
                        className={`${btnCx} bg-brand hover:bg-brand-hover text-brand-ink`}>
                        {busy && <Loader2 size={13} className="animate-spin" />}
                        {mode === 'force' ? 'Force return' : 'Transfer'}
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

        {/* ── Right: details ── */}
        <div className="space-y-5">
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
                          ? 'border-brand/40 bg-brand-soft text-brand'
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
