'use client'

import { useEffect, useState } from 'react'
import { addMonths, startOfMonth, subMonths } from 'date-fns'
import type { MarketingEvent } from '@/lib/supabase'
import { dayKey, parseDay } from '@/lib/marketing'
import CalendarGrid from './CalendarGrid'
import EventPanel, { type Draft, type PanelMode } from './EventPanel'

/* ────────────────────────────────────────────────────────────────────────────
   /admin/marketing — the content calendar. Three quarters month grid, one
   quarter floating panel; the panel is where events are created, read and
   edited, so adding something never covers the calendar you are adding it to.

   Writes are AWAITED rather than optimistic, unlike the CRM's calendar. That's
   deliberate: the CRM board is a high-frequency surface where a temp-id
   reconciliation dance earns its complexity, and this is a handful of writes a
   week. Awaiting means state is always the server's row — no temp ids, no
   revert paths, no way for a failed write to leave a phantom chip on the grid.

   `now`/`cursor` stay null until mounted so the server-rendered HTML (which
   runs in UTC) can't disagree with the browser about which day is today —
   the same hydration guard the CRM calendar carries.
   ──────────────────────────────────────────────────────────────────────────── */

export default function MarketingClient({ initialEvents }: { initialEvents: MarketingEvent[] }) {
  const [events, setEvents] = useState<MarketingEvent[]>(initialEvents)
  const [today, setToday] = useState<Date | null>(null)
  const [cursor, setCursor] = useState<Date | null>(null)
  const [mode, setMode] = useState<PanelMode | null>(null)
  const [channelFilter, setChannelFilter] = useState('all')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const n = new Date()
    setToday(n)
    setCursor(startOfMonth(n))
    setMode({ kind: 'compose', date: dayKey(n) })
  }, [])

  const upsert = (row: MarketingEvent) =>
    setEvents((prev) => {
      const i = prev.findIndex((e) => e.id === row.id)
      if (i === -1) return [...prev, row]
      const next = [...prev]
      next[i] = row
      return next
    })

  /** Shared fetch wrapper: one place that owns `saving`, error text, and the
   *  "route returned HTML/nothing" case a bare res.json() would throw on. */
  const send = async (url: string, init: RequestInit): Promise<MarketingEvent | null | false> => {
    setSaving(true)
    try {
      const res = await fetch(url, {
        headers: { 'Content-Type': 'application/json' },
        ...init,
      })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(json.error || 'That did not save. Try again.')
        return false
      }
      setError(null)
      return (json.event as MarketingEvent) ?? null
    } catch {
      setError('Network error — nothing was saved.')
      return false
    } finally {
      setSaving(false)
    }
  }

  const createEvent = async (d: Draft): Promise<boolean> => {
    const row = await send('/api/admin/marketing/events', {
      method: 'POST',
      body: JSON.stringify(toPayload(d)),
    })
    if (row === false || !row) return false
    upsert(row)
    // Jump the grid to the month the event landed in — scheduling next month's
    // posts from this month's view is normal, and a chip you can't see reads as
    // a write that didn't happen.
    setCursor(startOfMonth(parseDay(row.event_date)))
    return true
  }

  const updateEvent = async (id: string, patch: Partial<Draft>): Promise<boolean> => {
    const row = await send(`/api/admin/marketing/events/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(toPayload(patch)),
    })
    if (row === false || !row) return false
    upsert(row)
    if (patch.event_date) setCursor(startOfMonth(parseDay(row.event_date)))
    return true
  }

  const deleteEvent = async (id: string) => {
    const ok = await send(`/api/admin/marketing/events/${id}`, { method: 'DELETE' })
    if (ok === false) return
    const removed = events.find((e) => e.id === id)
    setEvents((prev) => prev.filter((e) => e.id !== id))
    setMode({ kind: 'compose', date: removed?.event_date ?? dayKey(new Date()) })
  }

  if (!today || !cursor || !mode) {
    return (
      <div className="flex h-[calc(100dvh_-_3.5rem)] items-center justify-center bg-canvas">
        <p className="text-[13px] text-ink-muted">Loading calendar…</p>
      </div>
    )
  }

  const selectedDay = mode.kind === 'event'
    ? events.find((e) => e.id === mode.id)?.event_date ?? null
    : mode.date

  return (
    // Definite viewport height (100dvh minus the h-14 AdminTopBar, which equals
    // the mobile pt-14 spacer) — the DealsClient precedent. At `lg` NOTHING here
    // scrolls: the height flows down unbroken to the calendar's week rows, which
    // absorb the slack, and the grid's default `stretch` makes the panel column
    // exactly as tall as the calendar column. That definite height is what lets
    // the panel drop its own scrollbar and switch to tabs instead. Below `lg` the
    // columns stack and this container scrolls normally.
    <div className="flex h-[calc(100dvh_-_3.5rem)] shrink-0 flex-col overflow-hidden bg-canvas">
      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:overflow-hidden">
        <div className="mx-auto grid max-w-[1280px] gap-5 lg:h-full lg:grid-cols-[minmax(0,3fr)_minmax(300px,1fr)]">
          <CalendarGrid
            cursor={cursor}
            today={today}
            events={events}
            selectedDay={selectedDay}
            selectedEventId={mode.kind === 'event' ? mode.id : null}
            onPrev={() => setCursor((c) => subMonths(c!, 1))}
            onNext={() => setCursor((c) => addMonths(c!, 1))}
            onToday={() => setCursor(startOfMonth(today))}
            onSelectDay={(key) => setMode({ kind: 'day', date: key })}
            onSelectEvent={(id) => setMode({ kind: 'event', id })}
            channelFilter={channelFilter}
            onChannelFilter={setChannelFilter}
          />

          {/* The floating quarter. `min-h-0` lets it be shorter than its content
              would ask for, so the panel's internal flex chain can constrain and
              the tab panes size themselves to the space that's actually there. */}
          <aside className="lg:min-h-0">
            <EventPanel
              mode={mode}
              events={events}
              saving={saving}
              error={error}
              onMode={setMode}
              onCreate={createEvent}
              onUpdate={updateEvent}
              onDelete={deleteEvent}
              onDismissError={() => setError(null)}
            />
          </aside>
        </div>
      </div>
    </div>
  )
}

/** Draft → API body. Blank strings become nulls; `platform` rides along with
 *  `channel` because the PATCH route rejects one without the other (a platform
 *  is only meaningful on a social post, so the two must move together). */
function toPayload(d: Partial<Draft>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  if (d.event_date !== undefined) out.event_date = d.event_date
  if (d.title !== undefined) out.title = d.title
  if (d.status !== undefined) out.status = d.status
  if (d.owner !== undefined) out.owner = d.owner || null
  if (d.link !== undefined) out.link = d.link || null
  if (d.notes !== undefined) out.notes = d.notes || null
  if (d.channel !== undefined) {
    out.channel = d.channel
    out.platform = d.platform || null
  }
  return out
}
