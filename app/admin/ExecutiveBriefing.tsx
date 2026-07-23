'use client'

import { useState, useEffect, useCallback } from 'react'
import { Sparkles, RefreshCw, AlertCircle } from 'lucide-react'

/* AI Executive Briefing — a plain-English read of the operation, written by
   Claude from live metrics. Fetched client-side (the model call is too slow to
   block the dashboard render) and cached server-side for an hour. */

type State =
  | { status: 'loading' }
  | { status: 'ready'; briefing: string; generatedAt: string }
  | { status: 'error'; message: string }

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export default function ExecutiveBriefing() {
  const [state, setState] = useState<State>({ status: 'loading' })
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    else setState({ status: 'loading' })
    try {
      const res = await fetch(`/api/admin/briefing${refresh ? '?refresh=1' : ''}`)
      const json = await res.json()
      if (res.ok && json.briefing) {
        setState({ status: 'ready', briefing: json.briefing, generatedAt: json.generatedAt })
      } else {
        setState({ status: 'error', message: json.error || 'Could not generate a briefing.' })
      }
    } catch {
      setState({ status: 'error', message: 'Could not reach the briefing service.' })
    } finally {
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  return (
    <div className="relative overflow-hidden rounded-xl border border-hairline bg-surface">
      <div className="relative px-5 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles size={15} />
            </span>
            <div>
              <h3 className="text-[13px] font-semibold text-ink leading-none">Executive Briefing</h3>
              <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium uppercase tracking-wider">
                AI-generated · live data
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || state.status === 'loading'}
            title="Regenerate briefing"
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium text-ink-muted hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-surface-soft transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Regenerate</span>
          </button>
        </div>

        {state.status === 'loading' ? (
          <div className="space-y-2 py-0.5" aria-label="Generating briefing">
            <div className="h-3 rounded bg-surface-strong animate-pulse w-[92%]" />
            <div className="h-3 rounded bg-surface-strong animate-pulse w-[78%]" />
            <div className="h-3 rounded bg-surface-strong animate-pulse w-[60%]" />
          </div>
        ) : state.status === 'error' ? (
          <div className="flex items-center gap-2 text-[13px] text-ink-secondary py-1">
            <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />
            <span>{state.message}</span>
            <button onClick={() => load(true)} className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">Retry</button>
          </div>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-ink-secondary">{state.briefing}</p>
            <p className="text-[10px] text-ink-faint mt-2.5">Briefed {timeAgo(state.generatedAt)}</p>
          </>
        )}
      </div>
    </div>
  )
}
