'use client'

import { useEffect, useRef, useState } from 'react'
import { format } from 'date-fns'
import {
  ArrowLeft, CalendarPlus, ExternalLink, Pencil, Plus, Trash2, User, X,
} from 'lucide-react'
import type { MarketingEvent } from '@/lib/supabase'
import { Tabs } from '@/components/ui/Tabs'
import {
  CHANNELS, PLATFORMS, STATUSES, TONE_WASH, TONE_DOT,
  DEFAULT_CHANNEL, DEFAULT_STATUS, LIMITS,
  channelMeta, statusMeta, platformLabel, parseDay,
} from '@/lib/marketing'

/* ────────────────────────────────────────────────────────────────────────────
   The right-hand quarter: one floating card that is both the composer and the
   record view. Three modes —

     compose  the new-event form (the panel's resting state, so "add something"
              is always one click away and never behind a modal)
     day      a day was clicked: everything on it, plus add-to-this-day
     event    a chip was clicked: the record, with inline edit + status set

   Deliberately NOT components/ui/Drawer: a drawer is modal (scrim, focus trap,
   body-scroll lock) and would black out the very calendar you are scheduling
   against. This is the /admin/territories RepDetail posture — the Drawer's
   visual language (inset rounded-2xl surface, hairline border) with none of its
   modality — except that it sits in the grid as a real column rather than
   overlaying, so it needs no shadow to separate from what's behind it
   (DESIGN.md §5: cards are Level 1, promote the border, never a resting shadow).

   NO SCROLLING BODY. The panel is exactly as tall as the calendar beside it
   (`lg:h-full` against a grid row the calendar column makes definite), and the
   body is `lg:overflow-hidden` — so content has to FIT, it can't spill. That is
   what the tab strip is for: eight form fields do not fit a panel sized to a
   month grid, but "Basics" (5) and "Details" (3) each do, on any viewport tall
   enough to show the calendar at all. Tabs are the shared kit's, so the strip
   matches the deals drawer.

   Two regions keep an `overflow-y-auto` as a safety valve — the day list and a
   record's notes — because their length is genuinely unbounded and silently
   clipping an event or a paragraph is worse than a scrollbar. Both are sized so
   that in real use they never reach it (the day list fits ~14 rows).

   Below `lg` the grid stacks and the page scrolls, so every height constraint
   here is `lg:`-prefixed and the panel is natural-height on mobile.
   ──────────────────────────────────────────────────────────────────────────── */

export type PanelMode =
  | { kind: 'compose'; date: string }
  | { kind: 'day'; date: string }
  | { kind: 'event'; id: string }

type FormTab = 'basics' | 'details'
type ViewTab = 'details' | 'notes'

const labelCx = 'mb-1.5 block text-[12px] font-medium text-ink-secondary'
const inputCx =
  'h-9 w-full rounded-lg border border-hairline bg-surface px-3 text-[13px] text-ink placeholder:text-ink-faint transition-colors hover:border-hairline-strong focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

const primaryCx =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover active:scale-[0.98] disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const secondaryCx =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'
const ghostCx =
  'inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

export type Draft = {
  event_date: string
  title: string
  channel: string
  platform: string
  status: string
  owner: string
  link: string
  notes: string
}

const emptyDraft = (date: string): Draft => ({
  event_date: date, title: '', channel: DEFAULT_CHANNEL, platform: '',
  status: DEFAULT_STATUS, owner: '', link: '', notes: '',
})

const draftOf = (e: MarketingEvent): Draft => ({
  event_date: e.event_date, title: e.title, channel: e.channel,
  platform: e.platform ?? '', status: e.status, owner: e.owner ?? '',
  link: e.link ?? '', notes: e.notes ?? '',
})

function Pill({ tone, children }: { tone: keyof typeof TONE_WASH; children: React.ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-[3px] text-[10px] font-semibold ${TONE_WASH[tone]}`}>
      {children}
    </span>
  )
}

export default function EventPanel({
  mode, events, saving, error,
  onMode, onCreate, onUpdate, onDelete, onDismissError,
}: {
  mode: PanelMode
  events: MarketingEvent[]
  saving: boolean
  error: string | null
  onMode: (m: PanelMode) => void
  onCreate: (d: Draft) => Promise<boolean>
  onUpdate: (id: string, patch: Partial<Draft>) => Promise<boolean>
  onDelete: (id: string) => void
  onDismissError: () => void
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    emptyDraft(mode.kind === 'event' ? '' : mode.date))
  const [editing, setEditing] = useState(false)
  const [formTab, setFormTab] = useState<FormTab>('basics')
  const [viewTab, setViewTab] = useState<ViewTab>('details')
  const [formError, setFormError] = useState<string | null>(null)
  const titleRef = useRef<HTMLInputElement>(null)

  const event = mode.kind === 'event' ? events.find((e) => e.id === mode.id) ?? null : null

  // Reset whenever the panel switches subject. Keyed on the mode identity (not
  // `mode` itself) so re-renders from an unrelated state change — a sibling save,
  // say — don't wipe half-typed input or bounce the user off their tab.
  const modeKey = mode.kind === 'event' ? `event:${mode.id}` : `${mode.kind}:${mode.date}`
  useEffect(() => {
    setEditing(false)
    setFormTab('basics')
    setViewTab('details')
    setFormError(null)
    if (mode.kind === 'compose') {
      setDraft(emptyDraft(mode.date))
      titleRef.current?.focus()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modeKey])

  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => {
    setDraft((d) => ({ ...d, [k]: v }))
    if (k === 'title' && formError) setFormError(null)
  }

  const startEdit = () => {
    if (!event) return
    setDraft(draftOf(event))
    setEditing(true)
    setFormTab('basics')
  }

  const submit = async () => {
    if (saving) return
    // Title lives on Basics. Rather than leave a mysteriously disabled button
    // when the user is on the Details tab, take them to the offending field.
    if (!draft.title.trim()) {
      setFormTab('basics')
      setFormError('Give it a title.')
      requestAnimationFrame(() => titleRef.current?.focus())
      return
    }
    if (editing && event) {
      if (await onUpdate(event.id, draft)) setEditing(false)
    } else if (await onCreate(draft)) {
      // Stay in compose on the same day — scheduling a week of posts is a run of
      // adds, not one-and-done; clearing the title is the whole reset needed.
      setDraft((d) => ({ ...emptyDraft(d.event_date), channel: d.channel, owner: d.owner }))
      setFormTab('basics')
      titleRef.current?.focus()
    }
  }

  const dayEvents = mode.kind !== 'event'
    ? events.filter((e) => e.event_date === mode.date)
    : []

  const showForm = mode.kind === 'compose' || (mode.kind === 'event' && !!event && editing)
  const showDetail = mode.kind === 'event' && !!event && !editing
  const shownError = formError ?? error

  // Discoverability: the optional fields sit on a second tab, so surface how many
  // are filled rather than letting them hide.
  const filledExtras = [draft.link, draft.notes].filter((v) => v.trim()).length

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-hairline bg-surface lg:h-full">
      {/* Header */}
      <div className="flex flex-shrink-0 items-center gap-2 border-b border-hairline-soft px-4 py-3">
        {mode.kind !== 'compose' && (
          <button
            onClick={() => onMode({ kind: 'compose', date: headerDate(mode, event) })}
            aria-label="Back to new event"
            className="-ml-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <ArrowLeft size={15} strokeWidth={1.75} />
          </button>
        )}
        <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-ink">
          {mode.kind === 'compose' ? 'New event'
            : mode.kind === 'day' ? format(parseDay(mode.date), 'EEEE, MMM d')
            : editing ? 'Edit event' : 'Event'}
        </h2>
        {showDetail && (
          <button onClick={startEdit} aria-label="Edit"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand">
            <Pencil size={14} strokeWidth={1.75} />
          </button>
        )}
      </div>

      {/* Tab strip — only where there's more than one pane of content. */}
      {showForm && (
        <Tabs<FormTab>
          tabs={[
            { key: 'basics', label: 'Basics' },
            { key: 'details', label: 'Details', count: filledExtras || undefined },
          ]}
          active={formTab}
          onChange={setFormTab}
        />
      )}
      {showDetail && (
        <Tabs<ViewTab>
          tabs={[
            { key: 'details', label: 'Details' },
            { key: 'notes', label: 'Notes', count: event!.notes ? 1 : undefined },
          ]}
          active={viewTab}
          onChange={setViewTab}
        />
      )}

      {/* Body — no scrollbar of its own; each pane is sized to fit. */}
      <div className="flex min-h-0 flex-1 flex-col px-4 py-4 lg:overflow-hidden">
        {shownError && (
          <div className="mb-3 flex flex-shrink-0 items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
            <span className="flex-1">{shownError}</span>
            <button
              onClick={() => { setFormError(null); onDismissError() }}
              aria-label="Dismiss"
              className="text-rose-400 hover:text-rose-600"
            >
              <X size={13} strokeWidth={1.75} />
            </button>
          </div>
        )}

        {mode.kind === 'day' ? (
          <DayList events={dayEvents} onSelect={(id) => onMode({ kind: 'event', id })} />
        ) : mode.kind === 'event' && !event ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">That event was deleted.</p>
        ) : showDetail ? (
          viewTab === 'details'
            ? <EventDetail event={event!} saving={saving} onStatus={(s) => onUpdate(event!.id, { status: s })} />
            : <NotesPane text={event!.notes} />
        ) : formTab === 'basics' ? (
          <BasicsPane draft={draft} set={set} titleRef={titleRef} onSubmit={submit} />
        ) : (
          <DetailsPane draft={draft} set={set} />
        )}
      </div>

      {/* Footer */}
      <div className="flex flex-shrink-0 items-center gap-2 border-t border-hairline-soft px-4 py-3">
        {mode.kind === 'day' ? (
          <button onClick={() => onMode({ kind: 'compose', date: mode.date })} className={`${primaryCx} w-full`}>
            <Plus size={15} strokeWidth={1.75} /> Add to this day
          </button>
        ) : showDetail ? (
          <>
            <button onClick={() => onDelete(event!.id)} className={`${ghostCx} hover:text-rose-600`}>
              <Trash2 size={15} strokeWidth={1.75} /> Delete
            </button>
            <button
              onClick={() => onMode({ kind: 'compose', date: event!.event_date })}
              className={`${secondaryCx} ml-auto`}
            >
              <CalendarPlus size={15} strokeWidth={1.75} /> New
            </button>
          </>
        ) : mode.kind === 'event' && !event ? (
          <button onClick={() => onMode({ kind: 'compose', date: todayKey() })} className={`${secondaryCx} w-full`}>
            New event
          </button>
        ) : (
          <>
            {editing && <button onClick={() => setEditing(false)} className={ghostCx}>Cancel</button>}
            <button onClick={submit} disabled={saving} className={`${primaryCx} ${editing ? 'ml-auto' : 'w-full'}`}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add to calendar'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function headerDate(mode: PanelMode, event: MarketingEvent | null): string {
  if (mode.kind === 'event') return event?.event_date ?? todayKey()
  return mode.date
}

function todayKey(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/* ── Compose / edit: pane 1, the fields that define the event ─────────────── */

function BasicsPane({
  draft, set, titleRef, onSubmit,
}: {
  draft: Draft
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void
  titleRef: React.Ref<HTMLInputElement>
  onSubmit: () => void
}) {
  return (
    <div className="flex-shrink-0 space-y-3.5">
      <div>
        <label htmlFor="mk-title" className={labelCx}>Title</label>
        <input
          id="mk-title"
          ref={titleRef}
          value={draft.title}
          maxLength={LIMITS.title}
          onChange={(e) => set('title', e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onSubmit() } }}
          placeholder="LinkedIn post — new IDP launch"
          className={inputCx}
        />
      </div>

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label htmlFor="mk-date" className={labelCx}>Date</label>
          <input
            id="mk-date"
            type="date"
            value={draft.event_date}
            onChange={(e) => set('event_date', e.target.value)}
            className={inputCx}
          />
        </div>
        <div>
          <label htmlFor="mk-status" className={labelCx}>Status</label>
          <select
            id="mk-status"
            value={draft.status}
            onChange={(e) => set('status', e.target.value)}
            className={inputCx}
          >
            {STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="mk-channel" className={labelCx}>Channel</label>
        <select
          id="mk-channel"
          value={draft.channel}
          onChange={(e) => set('channel', e.target.value)}
          className={inputCx}
        >
          {CHANNELS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
      </div>

      {/* Platform only exists for a social post — the API drops it for every
          other channel, so hiding it here keeps the form honest. */}
      {draft.channel === 'social' && (
        <div>
          <span className={labelCx}>Platform</span>
          <div className="flex flex-wrap gap-1.5">
            {PLATFORMS.map((p) => {
              const on = draft.platform === p.value
              return (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set('platform', on ? '' : p.value)}
                  className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                    on ? 'bg-ink text-canvas' : 'bg-surface-strong text-ink-muted hover:text-ink'
                  }`}
                >
                  {p.label}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Owner sits with the what/when rather than on the second tab: it's the
          "who's making it" half of the same question, and keeping it here evens
          out two panes that were badly lopsided. */}
      <div>
        <label htmlFor="mk-owner" className={labelCx}>Owner <span className="text-ink-faint">(optional)</span></label>
        <input
          id="mk-owner"
          value={draft.owner}
          maxLength={LIMITS.owner}
          onChange={(e) => set('owner', e.target.value)}
          placeholder="Who's making it?"
          className={inputCx}
        />
      </div>
    </div>
  )
}

/* ── Compose / edit: pane 2, the optional trimmings ───────────────────────── */

function DetailsPane({
  draft, set,
}: {
  draft: Draft
  set: <K extends keyof Draft>(k: K, v: Draft[K]) => void
}) {
  return (
    // flex column so the notes box absorbs whatever height is left instead of
    // the pane needing a scrollbar.
    <div className="flex min-h-0 flex-1 flex-col gap-3.5">
      <div className="flex-shrink-0">
        <label htmlFor="mk-link" className={labelCx}>Link</label>
        <input
          id="mk-link"
          value={draft.link}
          maxLength={LIMITS.link}
          onChange={(e) => set('link', e.target.value)}
          placeholder="Draft, asset, or campaign URL"
          className={inputCx}
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col">
        <label htmlFor="mk-notes" className={labelCx}>Notes</label>
        <textarea
          id="mk-notes"
          value={draft.notes}
          maxLength={LIMITS.notes}
          onChange={(e) => set('notes', e.target.value)}
          placeholder="Copy, hashtags, target list…"
          className={`${inputCx} h-auto min-h-[96px] flex-1 resize-none py-2 leading-[1.45]`}
        />
      </div>
    </div>
  )
}

/* ── Day mode ──────────────────────────────────────────────────────────────── */

function DayList({ events, onSelect }: { events: MarketingEvent[]; onSelect: (id: string) => void }) {
  if (events.length === 0) {
    return (
      <div className="py-8 text-center">
        <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-surface-strong">
          <CalendarPlus size={18} strokeWidth={1.75} className="text-ink-muted" />
        </div>
        <p className="text-[13px] text-ink-muted">Nothing scheduled this day.</p>
      </div>
    )
  }
  return (
    // Compact rows (~44px) so a realistic day — even a busy one — fits without
    // the safety-valve scroll ever engaging.
    <div className="-mx-1 min-h-0 flex-1 space-y-1.5 overflow-y-auto px-1">
      {events.map((e) => {
        const ch = channelMeta(e.channel)
        const st = statusMeta(e.status)
        return (
          <button
            key={e.id}
            onClick={() => onSelect(e.id)}
            className="flex w-full items-center gap-2 rounded-lg border border-hairline px-2.5 py-2 text-left transition-colors hover:border-hairline-strong hover:bg-surface-soft focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            <span className={`h-2 w-2 flex-shrink-0 rounded-full ${TONE_DOT[ch.tone]}`} />
            <span className={`min-w-0 flex-1 truncate text-[13px] font-medium text-ink ${e.status === 'cancelled' ? 'text-ink-muted line-through' : ''}`}>
              {e.title}
            </span>
            <Pill tone={st.tone}>{st.label}</Pill>
          </button>
        )
      })}
    </div>
  )
}

/* ── Event mode ────────────────────────────────────────────────────────────── */

function NotesPane({ text }: { text: string | null }) {
  if (!text) {
    return <p className="py-8 text-center text-[13px] text-ink-muted">No notes on this one.</p>
  }
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <p className="whitespace-pre-wrap text-[13px] leading-[1.5] text-ink-secondary">{text}</p>
    </div>
  )
}

function EventDetail({
  event, saving, onStatus,
}: {
  event: MarketingEvent
  saving: boolean
  onStatus: (s: string) => void
}) {
  const ch = channelMeta(event.channel)
  const platform = platformLabel(event.platform)

  return (
    <div className="space-y-4">
      <div>
        <h3 className={`text-[15px] font-semibold leading-snug text-ink ${event.status === 'cancelled' ? 'line-through' : ''}`}>
          {event.title}
        </h3>
        <p className="mt-1 text-[12px] text-ink-muted tabular-nums">
          {format(parseDay(event.event_date), 'EEEE, MMMM d, yyyy')}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <Pill tone={ch.tone}>{ch.short}</Pill>
        {platform && (
          <span className="inline-flex items-center rounded-full bg-surface-strong px-2.5 py-[3px] text-[10px] font-semibold text-ink-muted">
            {platform}
          </span>
        )}
      </div>

      {/* Status is the field that actually changes day to day — one click, no
          round trip through the edit form. */}
      <div>
        <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Status</span>
        <div className="flex flex-wrap gap-1.5">
          {STATUSES.map((s) => {
            const on = event.status === s.value
            return (
              <button
                key={s.value}
                onClick={() => !on && onStatus(s.value)}
                disabled={saving}
                className={`rounded-md px-2.5 py-1 text-[12px] font-medium transition-colors disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  on ? 'bg-ink text-canvas' : 'bg-surface-strong text-ink-muted hover:text-ink'
                }`}
              >
                {s.label}
              </button>
            )
          })}
        </div>
      </div>

      {event.owner && (
        <div className="flex items-center gap-2 text-[13px] text-ink-secondary">
          <User size={14} strokeWidth={1.75} className="flex-shrink-0 text-ink-muted" />
          <span className="truncate">{event.owner}</span>
        </div>
      )}

      {event.link && (
        <a
          href={event.link}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 text-[13px] text-ink-secondary transition-colors hover:text-brand-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <ExternalLink size={14} strokeWidth={1.75} className="flex-shrink-0 text-ink-muted" />
          <span className="truncate">{event.link.replace(/^https?:\/\//, '')}</span>
        </a>
      )}
    </div>
  )
}
