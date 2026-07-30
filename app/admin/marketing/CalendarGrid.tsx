'use client'

import { useMemo } from 'react'
import {
  startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval,
  format, isSameMonth, isSameDay,
} from 'date-fns'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { MarketingEvent } from '@/lib/supabase'
import { CHANNELS, TONE_WASH, TONE_DOT, channelMeta, dayKey } from '@/lib/marketing'

/* ────────────────────────────────────────────────────────────────────────────
   The month grid — three quarters of the marketing calendar. Hand-rolled on
   date-fns like the CRM's CalendarView (no calendar library in the portal), but
   re-tokened to DESIGN.md: semantic surfaces/hairlines, brand green reserved for
   today + the selected ring.

   Chips are coloured by CHANNEL, not status: "what kind of thing is this" is the
   axis you scan a content calendar on. Status shows on the chip only when it
   changes how you read the row (published = a check, cancelled = struck through).

   Cell interaction without nested buttons: the cell is a plain div with a
   full-bleed underlay <button> for "select this day", and the content layer sits
   above it as `pointer-events-none` so the chips can opt back in individually.
   Nesting a chip button inside a cell button is invalid HTML and breaks keyboard
   nav; this keeps both hit targets real.

   HEIGHT: at `lg` this is a flex column that fills its grid cell, and the week
   rows share the leftover space (`repeat(N, minmax(112px,1fr))`) rather than
   being a fixed 104px each. That's what lets the calendar and the side panel end
   on the same line — the panel is a definite height only because this column is.

   112px is the floor because that is a FULL cell: date row + three chips + the
   "+N more" line. Sizing it to the chips alone (96px) clips exactly that
   overflow hint, which is the one thing telling you the day has more on it.
   Below the floor — a genuinely short window — the grid body scrolls; the panel
   never does, so the calendar is deliberately the side that absorbs the squeeze.
   ──────────────────────────────────────────────────────────────────────────── */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MAX_CHIPS = 3

export default function CalendarGrid({
  cursor, today, events, selectedDay, selectedEventId,
  onPrev, onNext, onToday, onSelectDay, onSelectEvent,
  channelFilter, onChannelFilter,
}: {
  cursor: Date
  today: Date
  events: MarketingEvent[]
  selectedDay: string | null
  selectedEventId: string | null
  onPrev: () => void
  onNext: () => void
  onToday: () => void
  onSelectDay: (key: string) => void
  onSelectEvent: (id: string) => void
  channelFilter: string
  onChannelFilter: (v: string) => void
}) {
  const days = useMemo(() => eachDayOfInterval({
    start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 0 }),
    end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 0 }),
  }), [cursor])

  const visible = useMemo(
    () => (channelFilter === 'all' ? events : events.filter((e) => e.channel === channelFilter)),
    [events, channelFilter],
  )

  const byDay = useMemo(() => {
    const m = new Map<string, MarketingEvent[]>()
    for (const e of visible) {
      const list = m.get(e.event_date) ?? []
      list.push(e)
      m.set(e.event_date, list)
    }
    // Stable order within a day: cancelled sinks, then alphabetical — the grid
    // has no time column, so there is no chronological order to honour.
    for (const list of m.values()) {
      list.sort((a, b) =>
        Number(a.status === 'cancelled') - Number(b.status === 'cancelled') ||
        a.title.localeCompare(b.title))
    }
    return m
  }, [visible])

  const monthCount = useMemo(
    () => visible.filter((e) => isSameMonth(new Date(e.event_date + 'T00:00:00'), cursor)).length,
    [visible, cursor],
  )

  const weeks = days.length / 7

  return (
    <div className="flex flex-col lg:min-h-0">
      {/* Toolbar */}
      <div className="mb-4 flex flex-shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={onPrev}
            aria-label="Previous month"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <ChevronLeft size={16} strokeWidth={1.75} />
          </button>
          <h2 className="w-[150px] text-center text-[16px] font-semibold tracking-tight text-ink tabular-nums">
            {format(cursor, 'MMMM yyyy')}
          </h2>
          <button
            onClick={onNext}
            aria-label="Next month"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-hairline text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <ChevronRight size={16} strokeWidth={1.75} />
          </button>
          <button
            onClick={onToday}
            className="ml-1 h-8 rounded-lg border border-hairline px-3 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            Today
          </button>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-[12px] text-ink-muted tabular-nums">
            {monthCount} {monthCount === 1 ? 'item' : 'items'} this month
          </span>
          <select
            value={channelFilter}
            onChange={(e) => onChannelFilter(e.target.value)}
            aria-label="Filter by channel"
            className="h-8 rounded-lg border border-hairline bg-surface px-2.5 text-[12px] text-ink-secondary transition-colors hover:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <option value="all">All channels</option>
            {CHANNELS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="animate-fade-up flex flex-col overflow-hidden rounded-xl border border-hairline bg-surface motion-reduce:animate-none lg:min-h-0 lg:flex-1">
        <div className="grid flex-shrink-0 grid-cols-7 border-b border-hairline bg-surface-soft">
          {WEEKDAYS.map((w) => (
            <div key={w} className="px-2 py-2.5 text-center text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              {w}
            </div>
          ))}
        </div>
        <div
          className="grid grid-cols-7 lg:min-h-0 lg:flex-1 lg:overflow-y-auto"
          style={{ gridTemplateRows: `repeat(${weeks}, minmax(112px, 1fr))` }}
        >
          {days.map((day) => {
            const key = dayKey(day)
            const items = byDay.get(key) ?? []
            const inMonth = isSameMonth(day, cursor)
            const isToday = isSameDay(day, today)
            const isSelected = selectedDay === key
            const hidden = items.length - MAX_CHIPS

            return (
              <div
                key={key}
                className={`relative min-h-0 overflow-hidden border-b border-r border-hairline-soft [&:nth-child(7n)]:border-r-0 ${
                  inMonth ? 'bg-surface' : 'bg-surface-soft'
                } ${isSelected ? 'ring-2 ring-inset ring-brand' : ''}`}
              >
                {/* Full-bleed "select this day" target, painted under the content. */}
                <button
                  onClick={() => onSelectDay(key)}
                  aria-label={`${format(day, 'EEEE, MMMM d, yyyy')} — ${items.length} scheduled`}
                  className="absolute inset-0 h-full w-full transition-colors hover:bg-surface-strong focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand"
                />

                <div className="pointer-events-none relative p-1.5">
                  <div className="mb-1 flex items-center justify-between px-1">
                    <span
                      className={`text-[12px] font-semibold tabular-nums ${
                        isToday
                          ? 'flex h-5 w-5 items-center justify-center rounded-full bg-brand text-white'
                          : inMonth ? 'text-ink-secondary' : 'text-ink-faint'
                      }`}
                    >
                      {format(day, 'd')}
                    </span>
                  </div>

                  <div className="space-y-1">
                    {items.slice(0, MAX_CHIPS).map((e) => {
                      const meta = channelMeta(e.channel)
                      const active = selectedEventId === e.id
                      return (
                        <button
                          key={e.id}
                          onClick={() => onSelectEvent(e.id)}
                          title={`${meta.label} — ${e.title}`}
                          className={`pointer-events-auto block w-full truncate rounded-md px-1.5 py-0.5 text-left text-[10px] font-medium transition-opacity hover:opacity-80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand ${TONE_WASH[meta.tone]} ${
                            e.status === 'cancelled' ? 'line-through opacity-60' : ''
                          } ${active ? 'ring-1 ring-inset ring-brand' : ''}`}
                        >
                          {e.status === 'published' ? '✓ ' : ''}{e.title}
                        </button>
                      )
                    })}
                    {hidden > 0 && (
                      <div className="px-1.5 text-[10px] font-medium text-ink-muted">+{hidden} more</div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Legend — channel is what the chip colour means. */}
      <div className="mt-3 flex flex-shrink-0 flex-wrap items-center gap-x-4 gap-y-2">
        {CHANNELS.filter((c) => c.value !== 'other').map((c) => (
          <span key={c.value} className="flex items-center gap-1.5 text-[11px] text-ink-muted">
            <span className={`h-2.5 w-2.5 rounded-[3px] ${TONE_DOT[c.tone]}`} />
            {c.short}
          </span>
        ))}
      </div>
    </div>
  )
}
