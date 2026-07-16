'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Wrench, ScanLine, ChevronRight, AlertCircle } from 'lucide-react'
import type { CribTool } from '@/lib/supabase'
import { normalizeTagCode } from '@/lib/tool-crib'
import { timeAgo } from '@/components/admin/list'

export default function MyToolsClient({ mine, badCode }: { mine: CribTool[]; badCode: boolean }) {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  /* The typed-code path. Three jobs:
       1. the label is scratched, oily, or peeled off
       2. the camera won't cooperate
       3. a USB wedge scanner "types" the code + Enter into this focused field —
          so plugging one in at a kiosk works later with zero code changes.
     Resolution happens client-side so a typo costs no round trip. */
  const go = (e: React.FormEvent) => {
    e.preventDefault()
    const c = normalizeTagCode(code)
    if (!c) { setError('That doesn’t look like a tool code.'); return }
    router.push(`/tool-crib/${c}`)
  }

  return (
    <div className="p-4 sm:p-6 max-w-md mx-auto">
      {badCode && (
        <div className="mb-4 flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20">
          <AlertCircle size={15} className="text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-[12.5px] text-amber-700 dark:text-amber-300">
            That label didn’t scan cleanly. Type the code printed under the QR.
          </p>
        </div>
      )}

      <Link
        href="/tool-crib/scan"
        className="w-full h-14 flex items-center justify-center gap-2.5 text-[16px] font-semibold bg-brand hover:bg-brand-hover text-brand-ink rounded-lg transition-colors"
      >
        <ScanLine size={19} />
        Scan a tool
      </Link>

      <form onSubmit={go} className="mt-3 flex gap-2">
        <input
          value={code}
          onChange={e => { setCode(e.target.value); setError('') }}
          placeholder="…or type a code (IAT-0042)"
          /* inputMode text, not numeric: the code has letters, and a numeric pad
             would block someone typing the full 'IAT-0042' off the label. */
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          className="flex-1 h-11 px-3 text-[16px] bg-surface border border-hairline rounded-lg text-ink placeholder:text-ink-faint outline-none focus:border-brand/50 focus:ring-2 focus:ring-brand/15 font-mono"
        />
        <button type="submit"
          className="px-4 h-11 text-[14px] font-semibold text-ink-secondary border border-hairline rounded-lg hover:bg-surface-soft transition-colors">
          Go
        </button>
      </form>
      {error && <p className="mt-2 text-[12.5px] text-rose-500">{error}</p>}

      <div className="mt-7">
        <h2 className="text-[11px] uppercase tracking-wide text-ink-faint mb-2.5">
          What you have out
        </h2>

        {mine.length === 0 ? (
          <div className="py-10 text-center bg-surface border border-hairline rounded-xl">
            <Wrench size={24} className="text-ink-faint/40 mx-auto mb-2.5" />
            <p className="text-[13px] text-ink-muted">Nothing checked out.</p>
          </div>
        ) : (
          <div className="bg-surface border border-hairline rounded-xl overflow-hidden">
            {mine.map((t, i) => (
              <Link
                key={t.id}
                href={`/tool-crib/${t.tag_code}`}
                className={`flex items-center gap-3 px-4 py-3.5 hover:bg-surface-soft transition-colors ${i > 0 ? 'border-t border-hairline-soft' : ''}`}
              >
                <div className="w-9 h-9 rounded-lg bg-surface-soft border border-hairline flex items-center justify-center flex-shrink-0 text-ink-faint">
                  <Wrench size={15} strokeWidth={1.8} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] text-ink truncate" style={{ fontWeight: 600 }}>{t.name}</p>
                  <p className="text-[12px] text-ink-faint mt-0.5">
                    <span className="font-mono">{t.tag_code}</span>
                    {t.held_since && <> · since {timeAgo(t.held_since)}</>}
                  </p>
                </div>
                <ChevronRight size={15} className="text-ink-faint/50 flex-shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
