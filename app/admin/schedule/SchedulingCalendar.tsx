'use client'

import { useMemo, useState } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  addMonths, subMonths, format, isSameMonth, isSameDay, isToday,
} from 'date-fns'
import { ChevronLeft, ChevronRight, Calendar as CalIcon, Clock, CalendarDays } from 'lucide-react'
import type { TimeOffRequest, Employee } from '@/lib/supabase'

type RequestWithEmployee = TimeOffRequest & { employees: Employee | null }

// Date columns are 'YYYY-MM-DD' — parse to local midnight to avoid TZ drift.
function parseDay(d: string): Date {
  return new Date(d + 'T00:00:00')
}

function activeOn(req: RequestWithEmployee, day: Date): boolean {
  const start = parseDay(req.start_date)
  const end = parseDay(req.end_date)
  const lo = start <= end ? start : end
  const hi = start <= end ? end : start
  return day >= lo && day <= hi
}

function firstName(e: Employee | null): string {
  if (!e) return 'Employee'
  return (e.name?.trim().split(' ')[0]) || e.email || 'Employee'
}

function initials(e: Employee | null): string {
  if (!e?.name) return '?'
  return e.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

// ─── Type / status styling ─────────────────────────────────────────────────────

const TYPE_LABEL = { pto: 'PTO', sick: 'Sick Time' } as const

function chipClass(type: 'pto' | 'sick', status: string): string {
  const base = 'border'
  if (type === 'pto') {
    return status === 'pending'
      ? `${base} border-dashed bg-blue-50 text-blue-600 border-blue-300 dark:bg-blue-950/20 dark:text-blue-300 dark:border-blue-800`
      : `${base} bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-950/50 dark:text-blue-300 dark:border-blue-900`
  }
  return status === 'pending'
    ? `${base} border-dashed bg-amber-50 text-amber-700 border-amber-300 dark:bg-amber-950/20 dark:text-amber-300 dark:border-amber-800`
    : `${base} bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:border-amber-900`
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Component ─────────────────────────────────────────────────────────────────

export default function SchedulingCalendar({ requests }: { requests: RequestWithEmployee[] }) {
  const [cursor, setCursor] = useState(() => startOfMonth(new Date()))
  const [showPto, setShowPto] = useState(true)
  const [showSick, setShowSick] = useState(true)
  const [showPending, setShowPending] = useState(true)
  const [selectedDay, setSelectedDay] = useState<Date | null>(null)

  const filtered = useMemo(() => requests.filter(r => {
    if (r.type === 'pto' && !showPto) return false
    if (r.type === 'sick' && !showSick) return false
    if (r.status === 'pending' && !showPending) return false
    return true
  }), [requests, showPto, showSick, showPending])

  const days = useMemo(() => {
    const gridStart = startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 })
    const gridEnd = endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 })
    return eachDayOfInterval({ start: gridStart, end: gridEnd })
  }, [cursor])

  const requestsOn = (day: Date) => filtered.filter(r => activeOn(r, day))

  // People with any time off touching this month (for the summary line).
  const monthCount = useMemo(() => {
    const monthDays = eachDayOfInterval({ start: startOfMonth(cursor), end: endOfMonth(cursor) })
    const ids = new Set<string>()
    for (const r of filtered) {
      if (monthDays.some(d => activeOn(r, d))) ids.add(r.id)
    }
    return ids.size
  }, [filtered, cursor])

  const selectedRequests = selectedDay ? requestsOn(selectedDay) : []

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">HR</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Scheduling</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">
          {monthCount > 0 ? `${monthCount} ${monthCount === 1 ? 'person' : 'people'} with time off this month` : 'No time off scheduled this month'}
        </p>
      </div>

      <div className="p-4 sm:p-8">

        {/* Toolbar: month nav + filters */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-5">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setCursor(c => subMonths(c, 1))}
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
              aria-label="Previous month"
            >
              <ChevronLeft size={16} />
            </button>
            <h2 className="text-[16px] font-bold text-gray-900 dark:text-white tracking-tight w-[150px] text-center tabular-nums">
              {format(cursor, 'MMMM yyyy')}
            </h2>
            <button
              onClick={() => setCursor(c => addMonths(c, 1))}
              className="w-8 h-8 rounded-lg border border-gray-200 dark:border-zinc-700 flex items-center justify-center text-gray-500 hover:bg-gray-50 dark:hover:bg-zinc-800 transition-all"
              aria-label="Next month"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCursor(startOfMonth(new Date()))}
              className="ml-1 text-[12px] font-semibold text-gray-500 hover:text-[#089447] border border-gray-200 dark:border-zinc-700 rounded-lg px-3 h-8 transition-all"
            >
              Today
            </button>
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <FilterToggle active={showPto} onClick={() => setShowPto(v => !v)} dot="bg-blue-500" label="PTO" />
            <FilterToggle active={showSick} onClick={() => setShowSick(v => !v)} dot="bg-amber-500" label="Sick" />
            <FilterToggle active={showPending} onClick={() => setShowPending(v => !v)} dashed label="Pending" />
          </div>
        </div>

        {/* Calendar grid */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          {/* Weekday header */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-zinc-800">
            {WEEKDAYS.map(w => (
              <div key={w} className="px-2 py-2.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wide text-center">
                {w}
              </div>
            ))}
          </div>

          {/* Days */}
          <div className="grid grid-cols-7">
            {days.map(day => {
              const inMonth = isSameMonth(day, cursor)
              const dayReqs = requestsOn(day)
              const isSelected = selectedDay && isSameDay(day, selectedDay)
              const today = isToday(day)
              return (
                <button
                  key={day.toISOString()}
                  onClick={() => setSelectedDay(isSelected ? null : day)}
                  className={`min-h-[104px] text-left p-1.5 border-b border-r border-gray-100 dark:border-zinc-800 [&:nth-child(7n)]:border-r-0 transition-colors align-top ${
                    inMonth ? 'bg-white dark:bg-zinc-900' : 'bg-gray-50/60 dark:bg-zinc-950/40'
                  } ${isSelected ? 'ring-2 ring-inset ring-[#089447]' : 'hover:bg-gray-50 dark:hover:bg-zinc-800/50'}`}
                >
                  <div className="flex items-center justify-between px-1 mb-1">
                    <span className={`text-[12px] font-semibold tabular-nums ${
                      today
                        ? 'w-5 h-5 rounded-full bg-[#089447] text-white flex items-center justify-center'
                        : inMonth ? 'text-gray-600 dark:text-gray-300' : 'text-gray-300 dark:text-gray-600'
                    }`}>
                      {format(day, 'd')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    {dayReqs.slice(0, 3).map(r => (
                      <div
                        key={r.id}
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md truncate ${chipClass(r.type, r.status)}`}
                        title={`${firstName(r.employees)} — ${TYPE_LABEL[r.type]}${r.status === 'pending' ? ' (pending)' : ''}`}
                      >
                        {firstName(r.employees)}
                      </div>
                    ))}
                    {dayReqs.length > 3 && (
                      <div className="text-[10px] font-medium text-gray-400 px-1.5">+{dayReqs.length - 3} more</div>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Selected day detail */}
        {selectedDay && (
          <div className="mt-5 bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-5">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays size={16} className="text-gray-400" />
              <h3 className="text-[14px] font-bold text-gray-900 dark:text-white">{format(selectedDay, 'EEEE, MMMM d, yyyy')}</h3>
            </div>
            {selectedRequests.length === 0 ? (
              <p className="text-[13px] text-gray-400">No time off on this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedRequests.map(r => (
                  <div key={r.id} className="flex items-center gap-3 rounded-xl border border-gray-100 dark:border-zinc-800 px-4 py-3">
                    <div className="w-8 h-8 rounded-full bg-gray-800 dark:bg-zinc-700 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
                      {initials(r.employees)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-gray-800 dark:text-white truncate">{r.employees?.name || r.employees?.email || 'Employee'}</p>
                      <p className="text-[11px] text-gray-400">
                        {format(parseDay(r.start_date), 'MMM d')} → {format(parseDay(r.end_date), 'MMM d')} · {r.hours_requested} hrs
                      </p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full ${chipClass(r.type, r.status)}`}>
                      {r.type === 'pto' ? <CalIcon size={11} /> : <Clock size={11} />}
                      {TYPE_LABEL[r.type]}{r.status === 'pending' ? ' · Pending' : ''}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-5 mt-5 text-[11px] text-gray-400">
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-100 border border-blue-200 dark:bg-blue-950/50 dark:border-blue-900" /> PTO</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-200 dark:bg-amber-950/50 dark:border-amber-900" /> Sick Time</span>
          <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border border-dashed border-gray-400" /> Pending (dashed)</span>
        </div>
      </div>
    </div>
  )
}

// ─── Filter pill ───────────────────────────────────────────────────────────────

function FilterToggle({
  active, onClick, label, dot, dashed,
}: {
  active: boolean; onClick: () => void; label: string; dot?: string; dashed?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 text-[12px] font-semibold px-3 h-8 rounded-lg border transition-all ${
        active
          ? 'border-gray-300 dark:border-zinc-600 text-gray-700 dark:text-gray-200 bg-white dark:bg-zinc-800'
          : 'border-gray-200 dark:border-zinc-800 text-gray-300 dark:text-gray-600 bg-gray-50 dark:bg-zinc-900 line-through'
      }`}
    >
      {dot && <span className={`w-2.5 h-2.5 rounded-full ${dot} ${!active && 'opacity-40'}`} />}
      {dashed && <span className={`w-2.5 h-2.5 rounded-full border border-dashed border-current`} />}
      {label}
    </button>
  )
}
