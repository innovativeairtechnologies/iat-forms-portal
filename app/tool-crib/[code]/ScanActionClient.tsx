'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Loader2, Check, LogOut, LogIn } from 'lucide-react'
import type { CribTool } from '@/lib/supabase'
import { CRIB_STATUS, toolThumbPath } from '@/lib/tool-crib'
import { StatusPill, timeAgo } from '@/components/admin/list'
import { ToolThumb } from '@/components/admin/ToolThumb'
import LostFoundNote from './LostFoundNote'

/* One tool, one decision, one button.

   Sized for someone standing at a shelf holding a drill: 56px touch targets,
   16px text (anything smaller makes iOS zoom the viewport on focus), and no
   competing actions. DESIGN.md's "single primary action per view" is not a
   style preference here — a second green button would cost real seconds. */
export default function ScanActionClient({
  tool, holderName, isMine,
}: {
  tool: CribTool
  holderName: string | null
  isMine: boolean
}) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState<null | 'check_out' | 'check_in'>(null)
  const [note, setNote] = useState('')

  const s = CRIB_STATUS[tool.status]
  const out = tool.status === 'checked_out'
  const canCheckOut = tool.status === 'available'
  const blocked = !canCheckOut && !isMine

  const act = async (action: 'check_out' | 'check_in') => {
    setBusy(true); setError('')
    const res = await fetch('/api/tool-crib/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: tool.tag_code, action, condition_note: note || undefined }),
    })
    const data = await res.json().catch(() => ({}))
    setBusy(false)
    if (!res.ok) { setError(data.error || 'That didn’t work.'); return }
    setDone(action)
    router.refresh()
  }

  if (done) {
    return (
      <div className="p-6 text-center">
        <div className="w-14 h-14 rounded-full bg-brand-soft flex items-center justify-center mx-auto mt-10 mb-4">
          <Check size={26} className="text-brand" />
        </div>
        <h1 className="text-[18px] text-ink" style={{ fontWeight: 620 }}>
          {done === 'check_out' ? 'It’s yours' : 'Checked back in'}
        </h1>
        <p className="text-[13px] text-ink-muted mt-1.5">{tool.name}</p>
        <div className="mt-6 flex flex-col gap-2 max-w-xs mx-auto">
          <Link href="/tool-crib/scan"
            className="h-12 flex items-center justify-center text-[15px] font-semibold bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors">
            Scan another
          </Link>
          <Link href="/tool-crib"
            className="h-12 flex items-center justify-center text-[15px] font-semibold text-ink-secondary border border-hairline rounded-lg hover:bg-surface-soft transition-colors">
            My tools
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto">
      <div className="bg-surface border border-hairline rounded-xl p-5">
        <div className="flex items-start gap-3.5">
          <ToolThumb path={toolThumbPath(tool.photo_urls)} size={56} rounded="rounded-xl" />
          <div className="min-w-0 flex-1">
            <h1 className="text-[18px] text-ink leading-tight" style={{ fontWeight: 620 }}>{tool.name}</h1>
            <p className="text-[12.5px] text-ink-muted mt-0.5 font-mono">{tool.tag_code}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <StatusPill tone={s.tone}>{s.label}</StatusPill>
          {out && (
            <span className="text-[13px] text-ink-secondary">
              {isMine
                ? 'You have it'
                : holderName
                  ? <>with <strong style={{ fontWeight: 600 }}>{holderName}</strong></>
                  : <span className="italic text-ink-faint">holder unknown</span>}
              {tool.held_since && <span className="text-ink-faint"> · {timeAgo(tool.held_since)}</span>}
            </span>
          )}
        </div>

        {tool.home_location && !out && (
          <p className="mt-3 text-[12.5px] text-ink-muted">Lives at {tool.home_location}</p>
        )}

        {/* Check-in gets an optional condition note so a broken tool doesn't get
            scanned silently back into circulation. */}
        {isMine && (
          <input
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="Anything wrong with it? (optional)"
            className="mt-4 w-full h-11 px-3 text-[16px] bg-canvas border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none focus-visible:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          />
        )}

        {error && <p className="mt-3 text-[13px] text-rose-500">{error}</p>}

        <div className="mt-5">
          {isMine ? (
            <button onClick={() => act('check_in')} disabled={busy}
              className="w-full h-14 flex items-center justify-center gap-2 text-[16px] font-semibold bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors disabled:opacity-60">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <LogIn size={18} />}
              Check it back in
            </button>
          ) : canCheckOut ? (
            <button onClick={() => act('check_out')} disabled={busy}
              className="w-full h-14 flex items-center justify-center gap-2 text-[16px] font-semibold bg-brand hover:bg-brand-hover text-white rounded-lg transition-colors disabled:opacity-60">
              {busy ? <Loader2 size={18} className="animate-spin" /> : <LogOut size={18} />}
              Check it out
            </button>
          ) : (
            <div className="text-center py-2">
              <p className="text-[13px] text-ink-muted">
                {out
                  ? `${holderName ?? 'Someone else'} has this one — ask them, or a manager can return it.`
                  : `This tool is marked ${s.label.toLowerCase()} and can’t be taken out.`}
              </p>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Link href="/tool-crib/scan"
          className="flex-1 h-11 flex items-center justify-center text-[14px] font-semibold text-ink-secondary border border-hairline rounded-lg hover:bg-surface-soft transition-colors">
          Scan another
        </Link>
        <Link href="/tool-crib"
          className="flex-1 h-11 flex items-center justify-center text-[14px] font-semibold text-ink-secondary border border-hairline rounded-lg hover:bg-surface-soft transition-colors">
          My tools
        </Link>
      </div>

      <LostFoundNote />
    </div>
  )
}
