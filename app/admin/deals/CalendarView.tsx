'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, format, isSameMonth, isSameDay, isToday,
} from 'date-fns'
import {
  ChevronLeft, ChevronRight, CalendarDays, Check, RotateCcw, Trash2, ArrowUpRight, Bell,
} from 'lucide-react'
import type { Deal, DealFollowUp } from '@/lib/supabase'

/* ────────────────────────────────────────────────────────────────────────────
   Follow-up calendar — the CRM's reminder board. New deals auto-schedule one
   2 weeks out; the deal modal's "Schedule Follow-up" adds dated ones. Overdue
   (past + not done) reminders are the point, so they're loud (rose); done ones
   fade. Clicking a reminder opens its deal.

   Date-sensitive rendering (today, overdue) is gated behind a mounted `now` so
   the server-rendered HTML (this tab is always mounted, just hidden) can't
   disagree with the client on what "today" is — no hydration mismatch.
   ──────────────────────────────────────────────────────────────────────────── */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// due_date is a bare 'YYYY-MM-DD' — parse to local midnight (TZ-drift trap).
function parseDay(d: string): Date {
  return new Date(d + 'T00:00:00')
}

type Tone = 'overdue' | 'today' | 'upcoming' | 'done'

function toneOf(f: DealFollowUp, now: Date): Tone {
  if (f.done) return 'done'
  const due = parseDay(f.due_date)
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  if (due < midnight) return 'overdue'
  if (isSameDay(due, now)) return 'today'
  return 'upcoming'
}

// Canonical soft-wash Tone recipe (DESIGN.md §2.4), matching the selected-day
// BADGE below and StatusPill app-wide.
const CHIP_CLS: Record<Tone, string> = {
  overdue: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  today: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
  upcoming: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
  done: 'bg-zinc-100 text-zinc-400 line-through dark:bg-zinc-800 dark:text-zinc-500',
}

const BADGE: Record<Tone, { label: string; cls: string }> = {
  overdue: { label: 'Overdue', cls: 'bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400' },
  today: { label: 'Due today', cls: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' },
  upcoming: { label: 'Scheduled', cls: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400' },
  done: { label: 'Done', cls: 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400' },
}

export default function CalendarView({
  deals, followUps, onToggleDone, onRemove, onOpenDeal,
}: {
  deals: Deal[]
  followUps: DealFollowUp[]
  onToggleDone: (id: string) => void
  onRemove: (id: string) => void
  onOpenDeal: (id: string) => void
}) {
  const [now, setNow] = useState<Date | null>(null)
  const [cursor, setCursor] = useState<Date | null>(null)
  const [showDone, setShowDone] = useState(false)
  const [selectedKey, setSelectedKey] = useState<string | null>(null) // 'YYYY-MM-DD'

  useEffect(() => {
    const n = new Date()
    setNow(n)
    setCursor(startOfMonth(n))
  }, [])

  const customerOf = useMemo(() => {
    const m = new Map(deals.map((d) => [d.id, d]))
    return (dealId: string) => m.get(dealId) ?? null
  }, [deals])

  const visible = useMemo(
    () => followUps.filter((f) => showDone || !f.done),
    [followUps, showDone],
  )

  const byDay = useMemo(() => {
    const m = new Map<string, DealFollowUp[]>()
    for (const f of visible) {
      const list = m.get(f.due_date) ?? []
      list.push(f)
      m.set(f.due_date, list)
    }
    return m
  }, [visible])

  const counts = useMemo(() => {
    if (!now) return { overdue: 0, upcoming: 0 }
    let overdue = 0
    let upcoming = 0
    for (const f of followUps) {
      if (f.done) continue
      const t = toneOf(f, now)
      if (t === 'overdue') overdue++
      else upcoming++ // today + upcoming
    }
    return { overdue, upcoming }
  }, [followUps, now])

  const days = useMemo(() => {
    if (!cursor) return []
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [cursor])

  if (!now || !cursor) {
    return <div className="py-16 text-center text-[13px] text-zinc-400 dark:text-zinc-500">Loading calendar…</div>
  }

  const selectedDay = selectedKey ? parseDay(selectedKey) : null
  const selectedItems = selectedKey ? (byDay.get(selectedKey) ?? []) : []
  const dayKey = (d: Date) => format(d, 'yyyy-MM-dd')

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCursor((c) => subMonths(c!, 1))}
            className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
            aria-label="Previous month"
          >
            <ChevronLeft size={16} />
          </button>
          <h2 className="text-[16px] font-bold text-zinc-900 dark:text-white tracking-tight w-[150px] text-center tabular-nums">
            {format(cursor, 'MMMM yyyy')}
          </h2>
          <button
            onClick={() => setCursor((c) => addMonths(c!, 1))}
            className="w-8 h-8 rounded-lg border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-all"
            aria-label="Next month"
          >
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setCursor(startOfMonth(now))}
            className="ml-1 text-[12px] font-semibold text-zinc-500 hover:text-[#089447] border border-zinc-200 dark:border-zinc-700 rounded-lg px-3 h-8 transition-all"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {counts.overdue > 0 && (
            <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 h-8 rounded-lg bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
              <Bell size={13} /> {counts.overdue} overdue
            </span>
          )}
          <span className="text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">{counts.upcoming} upcoming</span>
          <button
            onClick={() => setShowDone((v) => !v)}
            className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 h-8 rounded-lg border transition-all ${
              showDone
                ? 'border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-200 bg-white dark:bg-zinc-800'
                : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900'
            }`}
          >
            <Check size={13} /> Show completed
          </button>
        </div>
      </div>

      {/* Grid */}
      <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 overflow-hidden">
        <div className="grid grid-cols-7 border-b border-zinc-100 dark:border-zinc-800">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-2.5 text-[11px] font-semibold text-zinc-400 uppercase tracking-wide text-center">{w}</div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((day) => {
            const inMonth = isSameMonth(day, cursor)
            const key = dayKey(day)
            const items = byDay.get(key) ?? []
            const isSelected = selectedDay && isSameDay(day, selectedDay)
            const today = isToday(day)
            return (
              <button
                key={day.toISOString()}
                onClick={() => setSelectedKey(isSelected ? null : key)}
                className={`min-h-[100px] text-left p-1.5 border-b border-r border-zinc-100 dark:border-zinc-800 [&:nth-child(7n)]:border-r-0 transition-colors align-top ${
                  inMonth ? 'bg-white dark:bg-zinc-900' : 'bg-zinc-50/60 dark:bg-zinc-950/40'
                } ${isSelected ? 'ring-2 ring-inset ring-[#089447]' : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50'}`}
              >
                <div className="flex items-center justify-between px-1 mb-1">
                  <span className={`text-[12px] font-semibold tabular-nums ${
                    today
                      ? 'w-5 h-5 rounded-full bg-[#089447] text-white flex items-center justify-center'
                      : inMonth ? 'text-zinc-600 dark:text-zinc-300' : 'text-zinc-300 dark:text-zinc-600'
                  }`}>
                    {format(day, 'd')}
                  </span>
                </div>
                <div className="space-y-1">
                  {items.slice(0, 3).map((f) => {
                    const deal = customerOf(f.deal_id)
                    return (
                      <div
                        key={f.id}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate ${CHIP_CLS[toneOf(f, now)]}`}
                        title={`${deal?.customer ?? 'Deal'}${f.note ? ` — ${f.note}` : ''}`}
                      >
                        {deal?.customer ?? 'Deal'}
                      </div>
                    )
                  })}
                  {items.length > 3 && (
                    <div className="text-[10px] font-medium text-zinc-400 px-1.5">+{items.length - 3} more</div>
                  )}
                </div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Selected day detail */}
      {selectedDay && (
        <div className="mt-5 bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-100 dark:border-zinc-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays size={16} className="text-zinc-400" />
            <h3 className="text-[14px] font-bold text-zinc-900 dark:text-white">{format(selectedDay, 'EEEE, MMMM d, yyyy')}</h3>
          </div>
          {selectedItems.length === 0 ? (
            <p className="text-[13px] text-zinc-400">No follow-ups on this day.</p>
          ) : (
            <div className="space-y-2">
              {selectedItems.map((f) => {
                const deal = customerOf(f.deal_id)
                const tone = toneOf(f, now)
                return (
                  <div key={f.id} className="flex items-center gap-3 rounded-xl border border-zinc-100 dark:border-zinc-800 px-4 py-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className={`text-[13px] font-semibold truncate ${f.done ? 'text-zinc-400 line-through' : 'text-zinc-800 dark:text-white'}`}>
                          {deal?.customer ?? 'Deal'}
                        </p>
                        <span className={`inline-flex items-center text-[10px] font-semibold uppercase tracking-wider px-1.5 py-[2px] rounded ${BADGE[tone].cls}`}>
                          {BADGE[tone].label}
                        </span>
                        {f.auto_generated && !f.done && (
                          <span className="text-[10px] text-zinc-400 dark:text-zinc-500">auto</span>
                        )}
                      </div>
                      <p className="text-[11px] text-zinc-400 dark:text-zinc-500 truncate">
                        {f.note || (deal?.group_name ? `${deal.group_name} · follow up` : 'Follow up')}
                      </p>
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => onToggleDone(f.id)}
                        title={f.done ? 'Mark not done' : 'Mark done'}
                        className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                          f.done
                            ? 'text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800'
                            : 'text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-500/10'
                        }`}
                      >
                        {f.done ? <RotateCcw size={14} /> : <Check size={14} />}
                      </button>
                      {deal && (
                        <button
                          onClick={() => onOpenDeal(f.deal_id)}
                          title="Open deal"
                          className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-400 hover:text-emerald-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          <ArrowUpRight size={14} />
                        </button>
                      )}
                      <button
                        onClick={() => onRemove(f.id)}
                        title="Delete follow-up"
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-zinc-300 dark:text-zinc-600 hover:text-rose-500 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {followUps.length === 0 && (
        <p className="mt-5 text-center text-[12.5px] text-zinc-400 dark:text-zinc-500">
          No follow-ups scheduled yet. New deals auto-schedule one 2 weeks out, or use{' '}
          <span className="font-medium text-zinc-500 dark:text-zinc-400">Schedule Follow-up</span> inside any deal.
        </p>
      )}

      {/* Legend */}
      <div className="flex items-center gap-5 mt-5 text-[11px] text-zinc-400">
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-rose-100 dark:bg-rose-500/20" /> Overdue</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-100 dark:bg-emerald-500/20" /> Due today</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-sky-100 dark:bg-sky-500/20" /> Scheduled</span>
        <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-zinc-100 dark:bg-zinc-800" /> Done</span>
      </div>
    </div>
  )
}
