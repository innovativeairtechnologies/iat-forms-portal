'use client'

import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'

/* AI Executive Briefing — a plain-English read of the operation, written by
   Claude from live metrics. Fetched client-side (the model call is too slow to
   block the dashboard render) and cached server-side for an hour.

   Renders BARE — no card chrome, title, or badge — because it lives folded under
   the dashboard's "Welcome back" hero as an inconspicuous summary of the day. */

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

  if (state.status === 'loading') {
    return (
      <div className="space-y-2" aria-label="Generating briefing">
        <div className="h-2.5 w-[94%] animate-pulse rounded bg-surface-strong" />
        <div className="h-2.5 w-[81%] animate-pulse rounded bg-surface-strong" />
        <div className="h-2.5 w-[64%] animate-pulse rounded bg-surface-strong" />
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex items-center gap-2 text-[13px] text-ink-secondary">
        <AlertCircle size={14} className="flex-shrink-0 text-amber-500" />
        <span>{state.message}</span>
        <button onClick={() => load(true)} className="font-medium text-emerald-600 hover:underline dark:text-emerald-400">Retry</button>
      </div>
    )
  }

  return (
    <>
      <p className="text-[13.5px] leading-relaxed text-ink-secondary">{state.briefing}</p>
      <div className="mt-2 flex items-center gap-2 text-[10px] text-ink-faint">
        <span>Briefed {timeAgo(state.generatedAt)}</span>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          title="Regenerate briefing"
          className="inline-flex items-center gap-1 transition-colors hover:text-emerald-600 disabled:opacity-50 dark:hover:text-emerald-400"
        >
          <RefreshCw size={11} className={refreshing ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Refresh</span>
        </button>
      </div>
    </>
  )
}
