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
    <div className="relative overflow-hidden rounded-xl border border-emerald-200/70 dark:border-emerald-500/20 bg-gradient-to-br from-emerald-50/80 via-white to-white dark:from-emerald-500/[0.07] dark:via-zinc-900/40 dark:to-zinc-900/40 shadow-sm dark:shadow-none">
      {/* ambient glow */}
      <div className="pointer-events-none absolute -top-16 -right-10 w-56 h-56 rounded-full blur-3xl opacity-25 dark:opacity-20" style={{ background: 'radial-gradient(circle,#10b981,transparent 70%)' }} />

      <div className="relative px-5 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Sparkles size={15} />
            </span>
            <div>
              <h3 className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 leading-none">Executive Briefing</h3>
              <p className="text-[10px] text-emerald-700/70 dark:text-emerald-400/70 mt-1 font-medium uppercase tracking-wider">
                AI-generated · live data
              </p>
            </div>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing || state.status === 'loading'}
            title="Regenerate briefing"
            className="flex items-center gap-1.5 h-7 px-2.5 rounded-lg text-[11px] font-medium text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-white/60 dark:hover:bg-zinc-800/60 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Regenerate</span>
          </button>
        </div>

        {state.status === 'loading' ? (
          <div className="space-y-2 py-0.5" aria-label="Generating briefing">
            <div className="h-3 rounded bg-zinc-200/80 dark:bg-zinc-700/50 animate-pulse w-[92%]" />
            <div className="h-3 rounded bg-zinc-200/80 dark:bg-zinc-700/50 animate-pulse w-[78%]" />
            <div className="h-3 rounded bg-zinc-200/80 dark:bg-zinc-700/50 animate-pulse w-[60%]" />
          </div>
        ) : state.status === 'error' ? (
          <div className="flex items-center gap-2 text-[13px] text-zinc-500 dark:text-zinc-400 py-1">
            <AlertCircle size={15} className="text-amber-500 flex-shrink-0" />
            <span>{state.message}</span>
            <button onClick={() => load(true)} className="text-emerald-600 dark:text-emerald-400 font-medium hover:underline">Retry</button>
          </div>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-zinc-700 dark:text-zinc-200">{state.briefing}</p>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-600 mt-2.5">Briefed {timeAgo(state.generatedAt)}</p>
          </>
        )}
      </div>
    </div>
  )
}
