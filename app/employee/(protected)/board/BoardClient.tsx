'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Responsive, WidthProvider, type Layout, type Layouts } from 'react-grid-layout'
import {
  Pencil, Check, Plus, RotateCcw, GripVertical, X, Pin,
  Megaphone, CalendarClock, GraduationCap, FileText, Wrench, Users, NotebookPen,
  Flame, ArrowRight, type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { saveBoardState } from './actions'
import {
  ALL_CARDS, PINNED_CARDS, defaultState, type BoardCardId, type BoardState, type RGLItem,
} from './board-config'

import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'

const Grid = WidthProvider(Responsive)

// ─── Live data passed down from the server page ───────────────────────────────
export type BoardCardData = {
  timeoff: { pto: number; sick: number; pending: number }
  learning: {
    level: number; title: string; progressPct: number; totalXp: number
    lessonsCompleted: number; totalLessons: number; streak: number
  } | null
}

// ─── Per-card look (pastel post-it paper, dark same-family text) ──────────────
type Theme = { bg: string; fold: string; text: string; accent: string }
const THEME: Record<BoardCardId, Theme> = {
  announcement: { bg: '#faece7', fold: '#f0d4c8', text: '#712b13', accent: '#993c1d' },
  timeoff:      { bg: '#eaf3de', fold: '#d6e8bf', text: '#27500a', accent: '#3b6d11' },
  learning:     { bg: '#faeeda', fold: '#ecd9b3', text: '#633806', accent: '#854f0b' },
  forms:        { bg: '#e6f1fb', fold: '#cfe2f5', text: '#0c447c', accent: '#185fa5' },
  tools:        { bg: '#eeedfe', fold: '#dad7f5', text: '#3c3489', accent: '#534ab7' },
  directory:    { bg: '#f1efe8', fold: '#ddd9cb', text: '#444441', accent: '#5f5e5a' },
  notes:        { bg: '#fbeaf0', fold: '#efd4e0', text: '#72243e', accent: '#993556' },
}

const META: Record<BoardCardId, { title: string; Icon: LucideIcon }> = {
  announcement: { title: 'Welcome',          Icon: Megaphone },
  timeoff:      { title: 'My time off',      Icon: CalendarClock },
  learning:     { title: 'My learning',      Icon: GraduationCap },
  forms:        { title: 'Quick forms',      Icon: FileText },
  tools:        { title: 'Tools & apps',     Icon: Wrench },
  directory:    { title: 'Team & org chart', Icon: Users },
  notes:        { title: 'My notes',         Icon: NotebookPen },
}

// Subtle, deterministic tilt so the board reads as paper, not a grid of tiles.
const ROT: Record<BoardCardId, number> = {
  announcement: -0.5, timeoff: -1.4, learning: 1.2, forms: -1, tools: 1.4, directory: -0.9, notes: 1,
}

const GRID_DOTS: React.CSSProperties = {
  backgroundImage: 'radial-gradient(rgba(140,140,150,0.16) 1.1px, transparent 1.1px)',
  backgroundSize: '18px 18px',
}

export default function BoardClient({
  cards,
  initialState,
}: {
  cards: BoardCardData
  initialState: BoardState
}) {
  const [mounted, setMounted]   = useState(false)
  const [editing, setEditing]   = useState(false)
  const [hidden, setHidden]     = useState<BoardCardId[]>(initialState.hidden)
  const [note, setNote]         = useState(initialState.note)
  const [layouts, setLayouts]   = useState<{ lg: RGLItem[]; xs: RGLItem[] }>(initialState.layouts)
  const [addOpen, setAddOpen]   = useState(false)
  const [justAdded, setJustAdded] = useState<BoardCardId | null>(null)
  const [toast, setToast]       = useState<string | null>(null)

  useEffect(() => setMounted(true), [])

  // Debounced, best-effort persistence — saves on drop / hide / note edit, never
  // on every pixel. The board stays fully usable if a save round-trips slowly.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persist = useCallback((next: BoardState) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      void saveBoardState(next).catch(() => {})
    }, 600)
  }, [])

  const snapshot = (over: Partial<BoardState>): BoardState =>
    ({ v: initialState.v, hidden, note, layouts, ...over })

  const flashToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(t => (t === msg ? null : t)), 1700)
  }

  // ── Layout changes (only while editing — RGL also fires this on mount) ──
  const onLayoutChange = (_current: Layout[], all: Layouts) => {
    if (!editing) return
    setLayouts(prev => {
      const next = { lg: mergeBp(prev.lg, all.lg), xs: mergeBp(prev.xs, all.xs) }
      persist(snapshot({ layouts: next }))
      return next
    })
  }

  const removeCard = (id: BoardCardId) => {
    if (PINNED_CARDS.includes(id)) return
    setHidden(prev => {
      const next = prev.includes(id) ? prev : [...prev, id]
      persist(snapshot({ hidden: next }))
      return next
    })
  }

  const addCard = (id: BoardCardId) => {
    setHidden(prev => {
      const next = prev.filter(h => h !== id)
      persist(snapshot({ hidden: next }))
      return next
    })
    setAddOpen(false)
    setJustAdded(id)
    setTimeout(() => setJustAdded(j => (j === id ? null : j)), 450)
    flashToast('Added to your board')
  }

  const resetBoard = () => {
    const def = defaultState()
    setHidden(def.hidden)
    setNote(def.note)
    setLayouts(def.layouts)
    persist(def)
    flashToast('Board reset to default')
  }

  const onNote = (v: string) => {
    setNote(v)
    persist(snapshot({ note: v }))
  }

  const visible = ALL_CARDS.filter(id => !hidden.includes(id))
  const hiddenAddable = ALL_CARDS.filter(id => hidden.includes(id) && !PINNED_CARDS.includes(id))
  const rglLayouts = {
    lg: layouts.lg.filter(o => visible.includes(o.i as BoardCardId)),
    xs: layouts.xs.filter(o => visible.includes(o.i as BoardCardId)),
  } as Layouts

  return (
    <div className="relative">
      {/* entrance animation for newly-added notes (kept off the rotated element) */}
      <style>{`@keyframes iatBoardPop{0%{opacity:0;transform:scale(.92) translateY(6px)}100%{opacity:1;transform:none}}.iat-pop{animation:iatBoardPop .34s cubic-bezier(.2,.7,.2,1)}.iat-board .react-grid-item.react-grid-placeholder{background:rgba(16,185,129,.18);border:1.5px dashed rgba(16,185,129,.5);border-radius:12px;opacity:1}`}</style>

      {/* ── Toolbar ── */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-[12px] text-zinc-400 dark:text-zinc-500">
          {editing ? 'Drag a note by its handle · changes save automatically' : 'Your personal board'}
        </p>
        <div className="relative flex items-center gap-2">
          {editing && (
            <div className="relative">
              <ToolbarButton onClick={() => setAddOpen(o => !o)} disabled={hiddenAddable.length === 0}>
                <Plus size={14} /> Add
              </ToolbarButton>
              {addOpen && hiddenAddable.length > 0 && (
                <div className="absolute right-0 z-20 mt-1.5 w-52 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
                  {hiddenAddable.map(id => {
                    const { title, Icon } = META[id]
                    return (
                      <button key={id} onClick={() => addCard(id)}
                        className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                        <Icon size={15} className="text-zinc-400" /> {title}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          )}
          {editing && (
            <ToolbarButton onClick={resetBoard}>
              <RotateCcw size={13} /> Reset
            </ToolbarButton>
          )}
          <ToolbarButton onClick={() => { setEditing(e => !e); setAddOpen(false) }} primary={editing}>
            {editing ? <><Check size={14} /> Done</> : <><Pencil size={13} /> Edit board</>}
          </ToolbarButton>
        </div>
      </div>

      {/* ── The whiteboard canvas ── */}
      <div
        className="relative min-h-[480px] rounded-2xl border border-zinc-200 bg-white p-1 dark:border-zinc-800 dark:bg-[#0c0c0e] sm:p-2"
        style={GRID_DOTS}
      >
        {!mounted ? (
          <div className="flex h-[460px] items-center justify-center text-[12px] text-zinc-400 dark:text-zinc-600">
            Loading your board…
          </div>
        ) : (
          <Grid
            className="iat-board"
            layouts={rglLayouts}
            breakpoints={{ lg: 1024, xs: 0 }}
            cols={{ lg: 12, xs: 1 }}
            rowHeight={76}
            margin={[16, 16]}
            containerPadding={[10, 10]}
            isResizable={false}
            isDraggable={editing}
            draggableHandle=".drag-handle"
            compactType={null}
            onLayoutChange={onLayoutChange}
            useCSSTransforms
          >
            {visible.map(id => (
              <div key={id}>
                <div className={cn('h-full w-full', justAdded === id && 'iat-pop')}>
                  <PostIt
                    id={id}
                    editing={editing}
                    cards={cards}
                    note={note}
                    onNote={onNote}
                    onRemove={removeCard}
                  />
                </div>
              </div>
            ))}
          </Grid>
        )}

        {toast && (
          <div className="pointer-events-none absolute bottom-4 left-1/2 z-30 -translate-x-1/2 rounded-full bg-zinc-900 px-3.5 py-2 text-[12px] font-medium text-white shadow-lg dark:bg-white dark:text-zinc-900">
            <Pin size={12} className="mr-1.5 -mt-0.5 inline" /> {toast}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── A single post-it ─────────────────────────────────────────────────────────
function PostIt({
  id, editing, cards, note, onNote, onRemove,
}: {
  id: BoardCardId
  editing: boolean
  cards: BoardCardData
  note: string
  onNote: (v: string) => void
  onRemove: (id: BoardCardId) => void
}) {
  const t = THEME[id]
  const { title, Icon } = META[id]
  const pinned = PINNED_CARDS.includes(id)

  return (
    <div className="h-full w-full">
      <div
        className="relative flex h-full w-full flex-col overflow-hidden rounded-[12px] px-3.5 pb-3.5 pt-3"
        style={{ background: t.bg, color: t.text, transform: `rotate(${ROT[id]}deg)` }}
      >
        {/* folded paper corner */}
        <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-0 w-0"
          style={{ borderStyle: 'solid', borderWidth: '0 0 18px 18px', borderColor: `transparent transparent ${t.fold} transparent` }} />

        {/* header — doubles as the drag handle while editing */}
        <div
          className={cn(
            'mb-2 flex items-center gap-2 text-[13px] font-medium',
            editing && !pinned && 'drag-handle cursor-grab active:cursor-grabbing',
          )}
        >
          {editing && !pinned && <GripVertical size={14} className="opacity-45" />}
          {pinned
            ? <Pin size={13} className="opacity-80" />
            : <Icon size={14} className="opacity-80" />}
          <span className="truncate">{title}</span>
          {pinned && <span className="ml-auto text-[10px] font-normal opacity-60">pinned</span>}
          {editing && !pinned && (
            <button onClick={() => onRemove(id)} aria-label={`Hide ${title}`}
              className="ml-auto grid h-5 w-5 place-items-center rounded-full bg-white/55 transition-colors hover:bg-white/85">
              <X size={13} />
            </button>
          )}
        </div>

        {/* body */}
        <div className="min-h-0 flex-1">
          <Body id={id} cards={cards} theme={t} note={note} onNote={onNote} />
        </div>
      </div>
    </div>
  )
}

function Body({
  id, cards, theme, note, onNote,
}: {
  id: BoardCardId
  cards: BoardCardData
  theme: Theme
  note: string
  onNote: (v: string) => void
}) {
  const accent = theme.accent

  if (id === 'announcement') {
    return (
      <p className="text-[12.5px] leading-snug" style={{ color: accent }}>
        Welcome to your board. In <span className="font-semibold">Edit</span> mode, drag a note by its
        handle, hide what you don&apos;t need, and add it back anytime. Everything saves automatically.
      </p>
    )
  }

  if (id === 'timeoff') {
    const { pto, sick, pending } = cards.timeoff
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill theme={theme}>PTO {pto} h</Pill>
          <Pill theme={theme}>Sick {sick} h</Pill>
          {pending > 0 && (
            <span className="text-[11px]" style={{ color: accent }}>{pending} pending</span>
          )}
        </div>
        <CardLink href="/employee/requests" accent={accent}>Request time off</CardLink>
      </div>
    )
  }

  if (id === 'learning') {
    if (!cards.learning) {
      return (
        <div className="flex h-full flex-col">
          <p className="text-[12px]" style={{ color: accent }}>Start your first lesson to earn XP and build a streak.</p>
          <CardLink href="/learn" accent={accent}>Explore IAT Learn</CardLink>
        </div>
      )
    }
    const l = cards.learning
    return (
      <div className="flex h-full flex-col">
        <div className="flex items-baseline gap-1.5">
          <span className="text-[15px] font-bold">Level {l.level}</span>
          <span className="text-[11px] opacity-75">{l.title}</span>
          {l.streak > 0 && (
            <span className="ml-auto inline-flex items-center gap-0.5 text-[11px] font-semibold" style={{ color: accent }}>
              <Flame size={11} /> {l.streak}
            </span>
          )}
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: theme.fold }}>
          <div className="h-full rounded-full" style={{ width: `${l.progressPct}%`, background: accent }} />
        </div>
        <div className="mt-1.5 flex items-center justify-between text-[10.5px] tabular-nums opacity-75">
          <span>{l.totalXp.toLocaleString()} XP</span>
          <span>{l.lessonsCompleted}/{l.totalLessons} lessons</span>
        </div>
        <CardLink href="/learn/me" accent={accent}>View my progress</CardLink>
      </div>
    )
  }

  if (id === 'forms') {
    return (
      <div className="flex h-full flex-col">
        <p className="text-[12px]" style={{ color: accent }}>Browse and submit employee forms — PTO, expenses, incident reports, and more.</p>
        <CardLink href="/employee/resources" accent={accent}>Open forms</CardLink>
      </div>
    )
  }

  if (id === 'tools') {
    return (
      <div className="flex h-full flex-col">
        <p className="text-[12px]" style={{ color: accent }}>Order status card, voltage scaling, and pricing calculators.</p>
        <CardLink href="/employee/resources/tools" accent={accent}>Open tools</CardLink>
      </div>
    )
  }

  if (id === 'directory') {
    return (
      <div className="flex h-full flex-col">
        <p className="text-[12px]" style={{ color: accent }}>See who&apos;s who — the company org chart and team directory.</p>
        <CardLink href="/employee/directory" accent={accent}>Open directory</CardLink>
      </div>
    )
  }

  // notes — the editable sticky
  return (
    <textarea
      value={note}
      onChange={e => onNote(e.target.value)}
      placeholder="Jot something down…"
      className="h-full w-full resize-none border-0 bg-transparent text-[12.5px] leading-snug outline-none placeholder:opacity-50 focus:ring-0"
      style={{ color: theme.text }}
    />
  )
}

// ─── small building blocks ────────────────────────────────────────────────────
function Pill({ theme, children }: { theme: Theme; children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2 py-[2px] text-[11px] font-medium"
      style={{ background: theme.fold, color: theme.text }}>
      {children}
    </span>
  )
}

function CardLink({ href, accent, children }: { href: string; accent: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="mt-auto inline-flex items-center gap-1 pt-2 text-[12px] font-medium transition-opacity hover:opacity-80"
      style={{ color: accent }}>
      {children} <ArrowRight size={12} />
    </Link>
  )
}

function ToolbarButton({
  children, onClick, primary, disabled,
}: {
  children: React.ReactNode
  onClick?: () => void
  primary?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40',
        primary
          ? 'border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-500'
          : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-300 dark:hover:bg-zinc-800',
      )}
    >
      {children}
    </button>
  )
}

// Merge an incoming RGL breakpoint layout into the stored one, preserving the
// stored entries for cards that aren't currently rendered (hidden) and the static
// flag on pinned cards.
function mergeBp(prev: RGLItem[], incoming?: Layout[]): RGLItem[] {
  if (!incoming) return prev
  const map = new Map(prev.map(o => [o.i, o]))
  incoming.forEach(o => {
    const ex = map.get(o.i)
    map.set(o.i, { i: o.i, x: o.x, y: o.y, w: o.w, h: o.h, static: ex?.static })
  })
  return Array.from(map.values())
}
