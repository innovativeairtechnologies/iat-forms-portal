'use client'

import { useState, useEffect, type ReactNode, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { Compass, CalendarDays, X, PartyPopper } from 'lucide-react'
import { CORE_VALUES, CORE_VALUES_INTRO, type CoreValue } from '@/lib/home-content'

/* ────────────────────────────────────────────────────────────────────────────
   Interactive pieces of the Company Home (/home):

   • CoreValuesBand — the slim "core value of the week" ribbon (now sits directly
     under the hero); clicking it opens a modal listing ALL core values.
   • HolidaysModal + OpenHolidays — a single "all upcoming holidays" modal opened
     from more than one place (the holiday KPI and the This-Week highlight), so
     the modal listens on a window event and the triggers just dispatch it. That
     keeps one modal instance no matter how many holiday boxes link to it.

   Modal chrome mirrors the "Have an idea" modal in HomeTopBar (rounded-2xl white
   panel, dimmed backdrop, Escape / backdrop-click to close).
   ──────────────────────────────────────────────────────────────────────────── */

// Enter/Space activate a div[role=button] (used so we can wrap block content —
// KPI cards, the ribbon layout — without invalid <button><div> nesting).
const onKeyActivate = (fn: () => void) => (e: ReactKeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn() }
}

// ── shared modal shell ────────────────────────────────────────────────────────
function ModalShell({ title, icon, onClose, children }: {
  title: string; icon: ReactNode; onClose: () => void; children: ReactNode
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-xl dark:border-stone-800 dark:bg-stone-900">
        <div className="flex items-center gap-2 border-b border-stone-100 px-5 py-3.5 dark:border-stone-800">
          <span className="text-emerald-600 dark:text-emerald-400">{icon}</span>
          <h2 className="text-[15px] font-bold text-stone-900 dark:text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="ml-auto text-stone-400 transition-colors hover:text-stone-700 dark:hover:text-stone-200">
            <X size={16} />
          </button>
        </div>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
      </div>
    </div>
  )
}

// ── Core value of the week — ribbon + "all values" modal ──────────────────────
export function CoreValuesBand({ current, index, total }: {
  current: CoreValue; index: number; total: number
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <div
        role="button"
        tabIndex={0}
        onClick={() => setOpen(true)}
        onKeyDown={onKeyActivate(() => setOpen(true))}
        title="See all our core values"
        className="group cursor-pointer rounded-xl border border-emerald-200/60 bg-emerald-50/60 px-5 py-3.5 transition-colors hover:bg-emerald-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 dark:border-emerald-500/20 dark:bg-emerald-500/[0.06] dark:hover:bg-emerald-500/10"
      >
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex flex-shrink-0 items-center gap-2">
            <Compass size={15} className="text-emerald-600 dark:text-emerald-400" />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">Core value · this week</span>
          </div>
          <p className="min-w-0 text-[13px] leading-relaxed text-stone-700 dark:text-stone-200">
            <span className="font-bold text-stone-900 dark:text-white">{current.title}</span> — {current.body}
          </p>
          <span className="ml-auto hidden flex-shrink-0 items-center gap-1.5 text-[11px] tabular-nums text-emerald-700/70 dark:text-emerald-400/70 sm:flex">
            {index + 1} of {total}
            <span className="font-semibold text-emerald-700/60 group-hover:text-emerald-700 dark:text-emerald-400/60 dark:group-hover:text-emerald-400">· See all</span>
          </span>
        </div>
      </div>

      {open && (
        <ModalShell title="Our Core Values" icon={<Compass size={16} />} onClose={() => setOpen(false)}>
          <p className="mb-3 text-[12.5px] italic leading-relaxed text-stone-500 dark:text-stone-400">{CORE_VALUES_INTRO}</p>
          <ul className="space-y-2.5">
            {CORE_VALUES.map((v, i) => (
              <li
                key={v.title}
                className={`rounded-xl border px-3.5 py-2.5 ${
                  i === index
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
                    : 'border-stone-200/70 bg-stone-50/60 dark:border-stone-800 dark:bg-stone-800/30'
                }`}
              >
                <div className="flex items-center gap-2">
                  <p className="text-[13px] font-bold text-stone-900 dark:text-white">{v.title}</p>
                  {i === index && (
                    <span className="rounded-full bg-emerald-600 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white">This week</span>
                  )}
                </div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-stone-600 dark:text-stone-300">{v.body}</p>
              </li>
            ))}
          </ul>
        </ModalShell>
      )}
    </>
  )
}

// ── Holidays — one shared modal + lightweight triggers ────────────────────────
export type HolidayRow = { name: string; dateLabel: string; relLabel: string; isNext: boolean }
const HOLIDAYS_EVENT = 'home:holidays:open'

/** Wraps any content (a KPI card, the This-Week chip) to open the holidays modal. */
export function OpenHolidays({ children, className, title }: {
  children: ReactNode; className?: string; title?: string
}) {
  const open = () => window.dispatchEvent(new CustomEvent(HOLIDAYS_EVENT))
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={open}
      onKeyDown={onKeyActivate(open)}
      title={title}
      className={`cursor-pointer rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/40 ${className ?? ''}`}
    >
      {children}
    </div>
  )
}

export function HolidaysModal({ holidays }: { holidays: HolidayRow[] }) {
  const [open, setOpen] = useState(false)
  useEffect(() => {
    const onOpen = () => setOpen(true)
    window.addEventListener(HOLIDAYS_EVENT, onOpen)
    return () => window.removeEventListener(HOLIDAYS_EVENT, onOpen)
  }, [])
  if (!open) return null
  return (
    <ModalShell title="Upcoming Holidays" icon={<CalendarDays size={16} />} onClose={() => setOpen(false)}>
      {holidays.length === 0 ? (
        <p className="text-[12.5px] text-stone-500 dark:text-stone-400">No upcoming holidays scheduled.</p>
      ) : (
        <ul className="divide-y divide-stone-100 dark:divide-stone-800/60">
          {holidays.map((h) => (
            <li key={`${h.name}-${h.dateLabel}`} className="flex items-center gap-3 py-2.5">
              <PartyPopper size={15} className={`flex-shrink-0 ${h.isNext ? 'text-emerald-600 dark:text-emerald-400' : 'text-stone-300 dark:text-stone-600'}`} />
              <span className="flex-1 text-[13px] font-semibold text-stone-800 dark:text-stone-100">{h.name}</span>
              <span className="text-right text-[11.5px] text-stone-500 dark:text-stone-400">
                <span className="tabular-nums">{h.dateLabel}</span>
                <span className="ml-1.5 text-stone-400 dark:text-stone-500">· {h.relLabel}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </ModalShell>
  )
}
