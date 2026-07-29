'use client'

import { useState, useTransition } from 'react'
import { ShieldCheck, Save, Check } from 'lucide-react'
import { setSafetyStreakDate } from './actions'

/* Company-home settings card — the shop-floor "days incident-free" streak start
   date. Drives the home KPI; stored in app_settings, falling back to the
   lib/home-content SAFETY.since constant when unset. */

export function HomeSettings({ current }: { current: string }) {
  const [date, setDate] = useState(current)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [pending, startTransition] = useTransition()

  const save = () => {
    setError(''); setDone(false)
    startTransition(async () => {
      try {
        await setSafetyStreakDate(date)
        setDone(true)
        setTimeout(() => setDone(false), 2500)
      } catch (e: any) {
        setError(e?.message || 'Could not save.')
      }
    })
  }

  const days = date ? Math.max(0, Math.floor((Date.now() - Date.parse(date + 'T00:00:00')) / 864e5)) : 0

  return (
    <div className="mb-6 rounded-xl border border-hairline bg-surface p-4 sm:p-5">
      <div className="mb-1 flex items-center gap-2">
        <ShieldCheck size={15} className="text-emerald-600 dark:text-emerald-400" />
        <h2 className="text-[14px] font-semibold text-ink">Safety streak</h2>
      </div>
      <p className="mb-3 text-[12px] leading-relaxed text-ink-muted">
        The home page shows <b className="tabular-nums text-ink-secondary">{days}</b> days incident-free,
        counting up from this date. Reset it (to the day after) whenever the streak breaks; clear it to use the default.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={date}
          onChange={(e) => { setDate(e.target.value); setError('') }}
          className="rounded-lg border border-hairline bg-surface px-3 py-2 text-[13px] text-ink transition-colors hover:border-hairline-strong focus:border-brand focus:outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <button
          onClick={save}
          disabled={pending}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
        >
          <Save size={13} /> {pending ? 'Saving…' : 'Save'}
        </button>
        {done && (
          <span className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 dark:text-emerald-400">
            <Check size={13} /> Saved
          </span>
        )}
      </div>
      {error && <p className="mt-2 text-[12px] text-rose-500">{error}</p>}
    </div>
  )
}
