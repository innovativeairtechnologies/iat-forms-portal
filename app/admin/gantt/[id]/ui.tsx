'use client'

import { Info } from 'lucide-react'
import type { TaskCat } from '@/lib/gantt'

/* Shared tokens + micro-components for the Gantt editor family. */

export const AXIS_H = 26
export const ROW_H = 34
export const MAX_ANCHOR = 40

export const BAR_CLS: Record<TaskCat, string> = {
  routine: 'bg-zinc-100 dark:bg-zinc-800 border-zinc-300 dark:border-zinc-600',
  uncertain: 'bg-amber-100 dark:bg-amber-500/20 border-amber-400 dark:border-amber-500/50',
  build: 'bg-emerald-100 dark:bg-emerald-500/20 border-emerald-400 dark:border-emerald-500/50',
}

export const DOT_CLS: Record<string, string> = {
  routine: 'bg-zinc-400',
  uncertain: 'bg-amber-500',
  build: 'bg-emerald-500',
  milestone: 'bg-zinc-900 dark:bg-zinc-100',
}

export const fieldCls =
  'w-full rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-2.5 py-1.5 text-[13px] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20'

export const toolBtn =
  'text-[12.5px] px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-white dark:hover:bg-zinc-800 inline-flex items-center gap-1.5'

export function Stat({ label, value, sub, tone, tip }: { label: string; value: string; sub?: string; tone?: 'emerald' | 'amber' | 'rose'; tip?: React.ReactNode }) {
  const toneCls =
    tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400'
    : tone === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : tone === 'rose' ? 'text-rose-600 dark:text-rose-400'
    : 'text-zinc-900 dark:text-zinc-100'
  return (
    <div className="rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 px-3.5 py-3">
      <div className="text-[11px] text-zinc-400 dark:text-zinc-500 flex items-center gap-1">{label}{tip && <InfoTip text={tip} />}</div>
      <div className={`text-[20px] font-semibold tabular-nums mt-0.5 ${toneCls}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-400 dark:text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  )
}

/**
 * A small hoverable "?" reminder. Plain-English, non-technical — a nudge so the
 * Sales/PM reader remembers what a control is for without asking. Reveals on
 * hover AND keyboard focus; hidden in print. Popover is left-aligned + narrow so
 * it stays inside `overflow-hidden` cards (Confidence/Assumptions/Tasks headers)
 * and never runs off the page edge.
 */
export function InfoTip({ text, className }: { text: React.ReactNode; className?: string }) {
  return (
    <span className={`group/tip relative inline-flex align-middle no-print print:hidden ${className ?? ''}`}>
      <button
        type="button"
        aria-label="What is this?"
        className="inline-flex text-zinc-300 hover:text-zinc-500 dark:text-zinc-600 dark:hover:text-zinc-300 focus:outline-none focus-visible:text-emerald-500 rounded-full"
      >
        <Info size={12.5} strokeWidth={2} />
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-0 top-full z-50 mt-1.5 w-[230px] rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 px-3 py-2 text-[11.5px] font-normal normal-case leading-[1.5] tracking-normal text-zinc-600 dark:text-zinc-300 opacity-0 shadow-[0_6px_20px_-6px_rgba(0,0,0,0.18)] transition-opacity duration-150 group-hover/tip:opacity-100 group-focus-within/tip:opacity-100"
      >
        {text}
      </span>
    </span>
  )
}

export function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-[9px] h-[9px] rounded-sm ${cls}`} />
      {label}
    </span>
  )
}

export function IconBtn({ children, label, onClick, disabled, danger }: {
  children: React.ReactNode
  label: string
  onClick: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <button
      aria-label={label} title={label} onClick={onClick} disabled={disabled}
      className={`p-1 rounded-md text-zinc-400 disabled:opacity-30 disabled:cursor-not-allowed ${danger ? 'hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10' : 'hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800'}`}
    >
      {children}
    </button>
  )
}
