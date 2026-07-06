'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Responsive, WidthProvider, type Layout, type Layouts } from 'react-grid-layout'
import {
  Plus, RotateCcw, GripVertical, X, Pin, Palette, Grid3x3, Pencil, Check,
  Megaphone, CalendarClock, GraduationCap, FileText, Wrench, Users, StickyNote as StickyIcon,
  Flame, ArrowRight, MoreHorizontal, Home, UserCog, LogOut, LayoutGrid,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import ThemeToggle from '@/components/ThemeToggle'
import { saveBoardState } from './actions'
import {
  ALL_CARDS, PINNED_CARDS, PALETTE_IDS, MAX_NOTES, MAX_NOTE_CHARS,
  defaultState, noteSpawnLg, noteSpawnXs,
  type BoardCardId, type BoardState, type BoardBg, type PaletteId, type RGLItem, type StickyNote,
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

// ─── Post-it palette (paper bg, folded corner, dark same-family text) ─────────
type Paper = { bg: string; fold: string; text: string; accent: string; dot: string }
const PALETTE: Record<PaletteId, Paper> = {
  yellow: { bg: '#faf0c0', fold: '#eddf9b', text: '#5f4a08', accent: '#8a6d0b', dot: '#e8d576' },
  green:  { bg: '#eaf3de', fold: '#d6e8bf', text: '#27500a', accent: '#3b6d11', dot: '#b5d789' },
  blue:   { bg: '#e6f1fb', fold: '#cfe2f5', text: '#0c447c', accent: '#185fa5', dot: '#9cc3e8' },
  pink:   { bg: '#fbeaf0', fold: '#efd4e0', text: '#72243e', accent: '#993556', dot: '#e8a8c0' },
  orange: { bg: '#faece7', fold: '#f0d4c8', text: '#712b13', accent: '#993c1d', dot: '#eab296' },
  purple: { bg: '#eeedfe', fold: '#dad7f5', text: '#3c3489', accent: '#534ab7', dot: '#b9b3ec' },
  gray:   { bg: '#f1efe8', fold: '#ddd9cb', text: '#444441', accent: '#5f5e5a', dot: '#c6c2b4' },
}

const DEFAULT_COLOR: Record<BoardCardId, PaletteId> = {
  announcement: 'orange', timeoff: 'green', learning: 'yellow',
  forms: 'blue', tools: 'purple', directory: 'gray',
}

const META: Record<BoardCardId, { title: string; Icon: LucideIcon }> = {
  announcement: { title: 'Welcome',          Icon: Megaphone },
  timeoff:      { title: 'My time off',      Icon: CalendarClock },
  learning:     { title: 'My learning',      Icon: GraduationCap },
  forms:        { title: 'Quick forms',      Icon: FileText },
  tools:        { title: 'Tools & apps',     Icon: Wrench },
  directory:    { title: 'Team & org chart', Icon: Users },
}

// Deterministic slight tilt per card id so the board reads as paper, not tiles.
function rotFor(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0
  const r = ((Math.abs(h) % 29) / 10) - 1.4 // -1.4° … +1.4°
  return Math.round(r * 10) / 10
}

const BG_CYCLE: BoardBg[] = ['dots', 'lines', 'plain']

export default function BoardClient({
  cards, initialState, firstName, greetingText, dateText,
}: {
  cards: BoardCardData
  initialState: BoardState
  firstName: string
  greetingText: string
  dateText: string
}) {
  const router = useRouter()
  const [mounted, setMounted]     = useState(false)
  const [isDesktop, setIsDesktop] = useState(true)
  const [editing, setEditing]     = useState(false)          // mobile-only gate
  const [hidden, setHidden]       = useState<BoardCardId[]>(initialState.hidden)
  const [notes, setNotes]         = useState<StickyNote[]>(initialState.notes)
  const [colors, setColors]       = useState<Record<string, PaletteId>>(initialState.colors)
  const [bg, setBg]               = useState<BoardBg>(initialState.bg)
  const [title, setTitle]         = useState(initialState.title)
  const [layouts, setLayouts]     = useState<{ lg: RGLItem[]; xs: RGLItem[] }>(initialState.layouts)
  const [addOpen, setAddOpen]     = useState(false)
  const [menuOpen, setMenuOpen]   = useState(false)
  const [paletteFor, setPaletteFor] = useState<string | null>(null)
  const [justAdded, setJustAdded] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [toast, setToast]         = useState<{ msg: string; undo?: () => void } | null>(null)

  // Refs so drag/resize-stop handlers and undo always see current values.
  const layoutsRef = useRef(layouts)
  layoutsRef.current = layouts
  const stateRef = useRef({ hidden, notes, colors, bg, title })
  stateRef.current = { hidden, notes, colors, bg, title }

  useEffect(() => {
    setMounted(true)
    setIsDesktop(window.innerWidth >= 1024)
  }, [])

  // Debounced, best-effort persistence — saves on drop / edit / recolor, never on
  // every keystroke echo. The board stays fully usable if a save round-trips slowly.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const persist = useCallback((over?: Partial<BoardState>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      const s = stateRef.current
      const next: BoardState = {
        v: initialState.v, title: s.title, bg: s.bg, hidden: s.hidden,
        notes: s.notes, colors: s.colors, layouts: layoutsRef.current, ...over,
      }
      void saveBoardState(next).catch(() => {})
    }, 600)
  }, [initialState.v])

  const flashToast = (msg: string, undo?: () => void) => {
    setToast({ msg, undo })
    setTimeout(() => setToast(t => (t?.msg === msg ? null : t)), undo ? 5000 : 1800)
  }

  // ── Layout: keep local state in sync on every RGL change; PERSIST only on
  // user-initiated drag/resize stops (onLayoutChange also fires on mount and
  // breakpoint switches, which must not echo into the DB). ──
  const onLayoutChange = (_current: Layout[], all: Layouts) => {
    setLayouts(prev => ({
      lg: mergeBp(prev.lg, all.lg),
      xs: mergeBp(prev.xs, all.xs),
    }))
  }
  const onMoveOrResizeStop = () => persist()

  // ── Sticky notes ──
  const addNote = () => {
    if (notes.length >= MAX_NOTES) { flashToast(`Board limit: ${MAX_NOTES} notes`); return }
    const id = `n-${Date.now().toString(36)}${Math.floor(Math.random() * 100)}`
    const nextNotes = [...notes, { id, text: '' }]
    setNotes(nextNotes)
    setLayouts(prev => ({
      lg: [...prev.lg, { i: id, ...noteSpawnLg(notes.length) }],
      xs: [...prev.xs, { i: id, ...noteSpawnXs() }],
    }))
    setJustAdded(id)
    setTimeout(() => setJustAdded(j => (j === id ? null : j)), 500)
    flashToast('Fresh sticky on the board')
    if (!isDesktop && !editing) setEditing(true)
    // persist with explicit values (state setters haven't flushed yet)
    persist({ notes: nextNotes, layouts: {
      lg: [...layoutsRef.current.lg, { i: id, ...noteSpawnLg(notes.length) }],
      xs: [...layoutsRef.current.xs, { i: id, ...noteSpawnXs() }],
    } })
  }

  const deleteNote = (id: string) => {
    const note = notes.find(n => n.id === id)
    if (!note) return
    const keptNotes = notes.filter(n => n.id !== id)
    const keptLayouts = {
      lg: layoutsRef.current.lg.filter(o => o.i !== id),
      xs: layoutsRef.current.xs.filter(o => o.i !== id),
    }
    const lgEntry = layoutsRef.current.lg.find(o => o.i === id)
    const xsEntry = layoutsRef.current.xs.find(o => o.i === id)
    setNotes(keptNotes)
    setLayouts(keptLayouts)
    persist({ notes: keptNotes, layouts: keptLayouts })
    flashToast('Note tossed', () => {
      setNotes(prev => [...prev, note])
      setLayouts(prev => ({
        lg: [...prev.lg, lgEntry ?? { i: id, ...noteSpawnLg(prev.lg.length) }],
        xs: [...prev.xs, xsEntry ?? { i: id, ...noteSpawnXs() }],
      }))
      setToast(null)
      persist()
    })
  }

  const editNote = (id: string, text: string) => {
    setNotes(prev => prev.map(n => (n.id === id ? { ...n, text: text.slice(0, MAX_NOTE_CHARS) } : n)))
    persist()
  }

  // ── Feature cards ──
  const hideCard = (id: BoardCardId) => {
    if (PINNED_CARDS.includes(id)) return
    setHidden(prev => (prev.includes(id) ? prev : [...prev, id]))
    persist({ hidden: [...hidden, id] })
    flashToast('Card set aside — bring it back from Widgets')
  }
  const showCard = (id: BoardCardId) => {
    const next = hidden.filter(h => h !== id)
    setHidden(next)
    setAddOpen(false)
    setJustAdded(id)
    setTimeout(() => setJustAdded(j => (j === id ? null : j)), 500)
    persist({ hidden: next })
    flashToast('Added to your board')
  }

  const setColor = (id: string, pid: PaletteId) => {
    const next = { ...colors, [id]: pid }
    setColors(next)
    setPaletteFor(null)
    persist({ colors: next })
  }

  const cycleBg = () => {
    const next = BG_CYCLE[(BG_CYCLE.indexOf(bg) + 1) % BG_CYCLE.length]
    setBg(next)
    persist({ bg: next })
  }

  const resetBoard = () => {
    if (!confirmReset) {
      setConfirmReset(true)
      setTimeout(() => setConfirmReset(false), 3000)
      return
    }
    setConfirmReset(false)
    const def = defaultState()
    setHidden(def.hidden); setNotes(def.notes); setColors(def.colors)
    setBg(def.bg); setTitle(def.title); setLayouts(def.layouts)
    persist(def)
    flashToast('Board wiped clean')
  }

  const signOut = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const paperFor = (id: string): Paper =>
    PALETTE[colors[id] ?? DEFAULT_COLOR[id as BoardCardId] ?? 'yellow']

  const visibleFeatures = ALL_CARDS.filter(id => !hidden.includes(id))
  const hiddenAddable = ALL_CARDS.filter(id => hidden.includes(id) && !PINNED_CARDS.includes(id))
  const visibleIds = new Set<string>([...visibleFeatures, ...notes.map(n => n.id)])

  // Inject sizing constraints for RGL (kept out of the persisted shape).
  const rglLayouts: Layouts = {
    lg: layouts.lg.filter(o => visibleIds.has(o.i))
      .map(o => (o.static ? { ...o } : { ...o, minW: 2, maxW: 12, minH: 1, maxH: 6 })),
    xs: layouts.xs.filter(o => visibleIds.has(o.i)),
  }

  const canDrag = isDesktop || editing
  const boardEmpty = visibleFeatures.length === 0 && notes.length === 0

  return (
    <div className="board-root relative flex h-[100dvh] flex-col overflow-hidden bg-[#fafaf8] dark:bg-[#0a0a0c]">
      <style>{`
        .board-root{--board-dot:rgba(125,125,140,.20);--board-line:rgba(125,125,140,.10)}
        .dark .board-root{--board-dot:rgba(255,255,255,.11);--board-line:rgba(255,255,255,.06)}
        .board-bg-dots{background-image:radial-gradient(var(--board-dot) 1.15px,transparent 1.15px);background-size:19px 19px}
        .board-bg-lines{background-image:linear-gradient(var(--board-line) 1px,transparent 1px),linear-gradient(90deg,var(--board-line) 1px,transparent 1px);background-size:38px 38px}
        @keyframes boardPop{0%{opacity:0;transform:scale(.9) translateY(8px) rotate(-3deg)}100%{opacity:1;transform:none}}
        .board-pop{animation:boardPop .38s cubic-bezier(.2,.7,.2,1)}
        .board-root .react-grid-item.react-grid-placeholder{background:rgba(16,185,129,.16);border:1.5px dashed rgba(16,185,129,.5);border-radius:12px;opacity:1}
        .board-root .react-grid-item>.react-resizable-handle{background-image:none;opacity:0;transition:opacity .15s}
        .board-root .react-grid-item:hover>.react-resizable-handle{opacity:.75}
        .board-root .react-grid-item>.react-resizable-handle::after{border-right:2px solid rgba(0,0,0,.28);border-bottom:2px solid rgba(0,0,0,.28);width:7px;height:7px;right:5px;bottom:5px}
        .board-card .card-controls{opacity:0;transition:opacity .14s}
        .board-card:hover .card-controls,.board-card.controls-on .card-controls{opacity:1}
        .board-hand{font-family:var(--font-hand),'Segoe Print',cursive}
      `}</style>

      {/* ── Scrollable canvas ── */}
      <div className={cn('relative flex-1 overflow-y-auto overflow-x-hidden', bg === 'dots' && 'board-bg-dots', bg === 'lines' && 'board-bg-lines')}>

        {/* Marker greeting, written on the board */}
        <div className={cn('board-hand relative z-10 px-6 pt-5 sm:px-9 sm:pt-6', isDesktop && 'pointer-events-none')}>
          <p className="text-[19px] leading-none text-emerald-700/90 dark:text-emerald-400/90">{greetingText}, {firstName || 'there'} — {dateText}</p>
          <input
            value={title}
            onChange={e => setTitle(e.target.value.slice(0, 60))}
            onBlur={() => persist()}
            placeholder={`${firstName || 'My'}${firstName ? "'s" : ''} board`}
            aria-label="Board title"
            className="board-hand pointer-events-auto mt-1 w-full max-w-[70vw] border-0 bg-transparent p-0 text-[38px] font-semibold leading-tight text-zinc-800 outline-none placeholder:text-zinc-800/85 focus:ring-0 dark:text-zinc-100 dark:placeholder:text-zinc-100/85 sm:text-[44px]"
          />
        </div>

        {!mounted ? (
          <div className="flex h-64 items-center justify-center text-[12px] text-zinc-400 dark:text-zinc-600">Loading your board…</div>
        ) : boardEmpty ? (
          <div className="board-hand flex h-64 items-center justify-center text-[22px] text-zinc-400 dark:text-zinc-600">
            A blank board — grab a sticky from the tray below
          </div>
        ) : (
          <div className="pb-32">
            <Grid
              className="board-grid"
              layouts={rglLayouts}
              breakpoints={{ lg: 1024, xs: 0 }}
              cols={{ lg: 12, xs: 1 }}
              rowHeight={74}
              margin={[14, 14]}
              containerPadding={[22, 10]}
              isDraggable={canDrag}
              isResizable={isDesktop}
              draggableHandle=".drag-handle"
              draggableCancel=".no-drag"
              compactType={isDesktop ? null : 'vertical'}
              allowOverlap={isDesktop}
              preventCollision={false}
              onLayoutChange={onLayoutChange}
              onBreakpointChange={bp => setIsDesktop(bp === 'lg')}
              onDragStop={onMoveOrResizeStop}
              onResizeStop={onMoveOrResizeStop}
              useCSSTransforms
            >
              {visibleFeatures.map(id => (
                <div key={id}>
                  <div className={cn('h-full w-full', justAdded === id && 'board-pop')}>
                    <FeatureCard
                      id={id} paper={paperFor(id)} cards={cards}
                      canDrag={canDrag} controlsOn={editing}
                      paletteOpen={paletteFor === id}
                      onPalette={() => setPaletteFor(p => (p === id ? null : id))}
                      onColor={pid => setColor(id, pid)}
                      onHide={() => hideCard(id)}
                    />
                  </div>
                </div>
              ))}
              {notes.map(n => (
                <div key={n.id}>
                  <div className={cn('h-full w-full', justAdded === n.id && 'board-pop')}>
                    <NoteCard
                      note={n} paper={paperFor(n.id)}
                      canDrag={canDrag} controlsOn={editing} autoFocus={justAdded === n.id}
                      paletteOpen={paletteFor === n.id}
                      onPalette={() => setPaletteFor(p => (p === n.id ? null : n.id))}
                      onColor={pid => setColor(n.id, pid)}
                      onEdit={text => editNote(n.id, text)}
                      onDelete={() => deleteNote(n.id)}
                    />
                  </div>
                </div>
              ))}
            </Grid>
          </div>
        )}
      </div>

      {/* ── Marker-tray dock ── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center pb-[max(14px,env(safe-area-inset-bottom))]">
        <div className="pointer-events-auto relative flex items-center gap-1 rounded-full border border-zinc-200 bg-white/95 px-2 py-1.5 shadow-lg backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/95">

          <DockButton label="New sticky note" primary onClick={addNote}>
            <Plus size={16} /><span className="hidden sm:inline">Note</span>
          </DockButton>

          <div className="relative">
            <DockButton label="Widgets" onClick={() => { setAddOpen(o => !o); setMenuOpen(false) }} disabled={hiddenAddable.length === 0}>
              <LayoutGrid size={15} /><span className="hidden sm:inline">Widgets</span>
            </DockButton>
            {addOpen && hiddenAddable.length > 0 && (
              <Popover onClose={() => setAddOpen(false)}>
                <p className="px-2.5 pb-1 pt-1.5 text-[11px] text-zinc-400 dark:text-zinc-500">Put back on the board</p>
                {hiddenAddable.map(id => {
                  const { title: t, Icon } = META[id]
                  return (
                    <button key={id} onClick={() => showCard(id)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                      <Icon size={15} className="text-zinc-400" /> {t}
                    </button>
                  )
                })}
              </Popover>
            )}
          </div>

          <DockButton label={`Background: ${bg}`} onClick={cycleBg}>
            <Grid3x3 size={15} />
          </DockButton>

          <DockButton label="Reset board" onClick={resetBoard} danger={confirmReset}>
            <RotateCcw size={14} />{confirmReset && <span className="text-[11px] font-semibold">Sure?</span>}
          </DockButton>

          {!isDesktop && (
            <DockButton label={editing ? 'Done editing' : 'Edit board'} primary={editing} onClick={() => setEditing(e => !e)}>
              {editing ? <Check size={15} /> : <Pencil size={14} />}
            </DockButton>
          )}

          <div className="mx-0.5 h-5 w-px bg-zinc-200 dark:bg-zinc-700" />

          <div className="relative">
            <DockButton label="Menu" onClick={() => { setMenuOpen(o => !o); setAddOpen(false) }}>
              <MoreHorizontal size={16} />
            </DockButton>
            {menuOpen && (
              <Popover onClose={() => setMenuOpen(false)} align="right">
                <MenuLink href="/employee/profile" icon={Home} label="Portal home" />
                <MenuLink href="/employee/profile/edit" icon={UserCog} label="Edit profile" />
                <div className="flex items-center justify-between rounded-lg px-2.5 py-2">
                  <span className="text-[12.5px] text-zinc-600 dark:text-zinc-300">Theme</span>
                  <ThemeToggle />
                </div>
                <button onClick={signOut}
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[12.5px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
                  <LogOut size={14} className="text-zinc-400" /> Sign out
                </button>
              </Popover>
            )}
          </div>
        </div>
      </div>

      {/* ── Toast (with optional Undo) ── */}
      {toast && (
        <div className="absolute bottom-20 left-1/2 z-40 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-zinc-900 py-2 pl-4 pr-2.5 text-[12px] font-medium text-white shadow-lg dark:bg-white dark:text-zinc-900">
          <Pin size={12} className="text-emerald-400 dark:text-emerald-600" /> {toast.msg}
          {toast.undo
            ? <button onClick={toast.undo} className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-300 hover:bg-white/25 dark:bg-zinc-900/10 dark:text-emerald-700 dark:hover:bg-zinc-900/20">Undo</button>
            : <span className="w-1" />}
        </div>
      )}
    </div>
  )
}

// ─── Shared post-it chrome (paper, fold, tilt, header controls) ───────────────
function PostItShell({
  id, paper, pinned, canDrag, controlsOn, header, paletteOpen, onPalette, onColor, onRemove, removeLabel, children,
}: {
  id: string
  paper: Paper
  pinned?: boolean
  canDrag: boolean
  controlsOn: boolean
  header: React.ReactNode
  paletteOpen: boolean
  onPalette: () => void
  onColor: (pid: PaletteId) => void
  onRemove?: () => void
  removeLabel?: string
  children: React.ReactNode
}) {
  return (
    <div className={cn('board-card h-full w-full', controlsOn && 'controls-on')}>
      <div
        className="relative flex h-full w-full flex-col overflow-visible rounded-[3px] px-3.5 pb-3.5 pt-3 shadow-[0_2px_8px_rgba(0,0,0,0.10),0_10px_18px_-12px_rgba(0,0,0,0.22)]"
        style={{ background: paper.bg, color: paper.text, transform: `rotate(${rotFor(id)}deg)` }}
      >
        {/* folded paper corner */}
        <span aria-hidden className="pointer-events-none absolute bottom-0 right-0 h-0 w-0"
          style={{ borderStyle: 'solid', borderWidth: '0 0 20px 20px', borderColor: `transparent transparent ${paper.fold} transparent`, filter: 'brightness(.97)' }} />

        {pinned && (
          <>
            <span aria-hidden className="absolute -top-2 left-5 h-5 w-14 -rotate-6 rounded-[2px] border border-black/5 bg-white/45 backdrop-blur-[1px] dark:bg-white/25" />
            <span aria-hidden className="absolute -top-2 right-5 h-5 w-14 rotate-6 rounded-[2px] border border-black/5 bg-white/45 backdrop-blur-[1px] dark:bg-white/25" />
          </>
        )}

        {/* header — the drag handle */}
        <div className={cn('mb-1.5 flex items-center gap-2 text-[13px] font-medium', canDrag && !pinned && 'drag-handle cursor-grab active:cursor-grabbing')}>
          {header}
          <span className="card-controls no-drag ml-auto flex items-center gap-1">
            <button onClick={onPalette} aria-label="Change color"
              className="grid h-5 w-5 place-items-center rounded-full bg-white/55 transition-colors hover:bg-white/85">
              <Palette size={12} />
            </button>
            {onRemove && (
              <button onClick={onRemove} aria-label={removeLabel}
                className="grid h-5 w-5 place-items-center rounded-full bg-white/55 transition-colors hover:bg-white/85">
                <X size={13} />
              </button>
            )}
          </span>
        </div>

        {paletteOpen && (
          <div className="no-drag absolute right-2 top-8 z-20 flex items-center gap-1.5 rounded-full border border-black/10 bg-white px-2 py-1.5 shadow-md dark:border-white/10 dark:bg-zinc-900">
            {PALETTE_IDS.map(pid => (
              <button key={pid} onClick={() => onColor(pid)} aria-label={`Color ${pid}`}
                className="rounded-full border border-black/15 transition-transform hover:scale-125"
                style={{ background: PALETTE[pid].dot, width: 18, height: 18 }} />
            ))}
          </div>
        )}

        <div className="min-h-0 flex-1">{children}</div>
      </div>
    </div>
  )
}

// ─── Feature cards (live-data widgets) ────────────────────────────────────────
function FeatureCard({
  id, paper, cards, canDrag, controlsOn, paletteOpen, onPalette, onColor, onHide,
}: {
  id: BoardCardId
  paper: Paper
  cards: BoardCardData
  canDrag: boolean
  controlsOn: boolean
  paletteOpen: boolean
  onPalette: () => void
  onColor: (pid: PaletteId) => void
  onHide: () => void
}) {
  const { title, Icon } = META[id]
  const pinned = PINNED_CARDS.includes(id)
  return (
    <PostItShell
      id={id} paper={paper} pinned={pinned} canDrag={canDrag} controlsOn={controlsOn}
      paletteOpen={paletteOpen} onPalette={onPalette} onColor={onColor}
      onRemove={pinned ? undefined : onHide} removeLabel={`Hide ${title}`}
      header={<>
        {canDrag && !pinned && <GripVertical size={14} className="opacity-45" />}
        {pinned ? <Pin size={13} className="opacity-80" /> : <Icon size={14} className="opacity-80" />}
        <span className="truncate">{title}</span>
        {pinned && <span className="text-[10px] font-normal opacity-60">· pinned</span>}
      </>}
    >
      <FeatureBody id={id} cards={cards} paper={paper} />
    </PostItShell>
  )
}

function FeatureBody({ id, cards, paper }: { id: BoardCardId; cards: BoardCardData; paper: Paper }) {
  const accent = paper.accent

  if (id === 'announcement') {
    return (
      <p className="text-[12.5px] leading-snug" style={{ color: accent }}>
        Welcome to your board. Drag a note by its title, write on your stickies,
        recolor anything — it&apos;s yours, and it saves itself.
      </p>
    )
  }
  if (id === 'timeoff') {
    const { pto, sick, pending } = cards.timeoff
    return (
      <div className="flex h-full flex-col">
        <div className="flex flex-wrap items-center gap-1.5">
          <Pill paper={paper}>PTO {pto} h</Pill>
          <Pill paper={paper}>Sick {sick} h</Pill>
          {pending > 0 && <span className="text-[11px]" style={{ color: accent }}>{pending} pending</span>}
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
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full" style={{ background: paper.fold }}>
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
  return (
    <div className="flex h-full flex-col">
      <p className="text-[12px]" style={{ color: accent }}>See who&apos;s who — the company org chart and team directory.</p>
      <CardLink href="/employee/directory" accent={accent}>Open directory</CardLink>
    </div>
  )
}

// ─── Personal sticky note ─────────────────────────────────────────────────────
function NoteCard({
  note, paper, canDrag, controlsOn, autoFocus, paletteOpen, onPalette, onColor, onEdit, onDelete,
}: {
  note: StickyNote
  paper: Paper
  canDrag: boolean
  controlsOn: boolean
  autoFocus: boolean
  paletteOpen: boolean
  onPalette: () => void
  onColor: (pid: PaletteId) => void
  onEdit: (text: string) => void
  onDelete: () => void
}) {
  return (
    <PostItShell
      id={note.id} paper={paper} canDrag={canDrag} controlsOn={controlsOn}
      paletteOpen={paletteOpen} onPalette={onPalette} onColor={onColor}
      onRemove={onDelete} removeLabel="Delete note"
      header={<>
        {canDrag && <GripVertical size={14} className="opacity-45" />}
        <StickyIcon size={14} className="opacity-80" />
        <span className="truncate opacity-80">Sticky</span>
      </>}
    >
      <textarea
        value={note.text}
        onChange={e => onEdit(e.target.value)}
        placeholder="Write anything…"
        autoFocus={autoFocus}
        className="board-hand no-drag h-full w-full resize-none border-0 bg-transparent p-0 text-[19px] leading-snug outline-none placeholder:opacity-45 focus:ring-0"
        style={{ color: paper.text }}
      />
    </PostItShell>
  )
}

// ─── Small building blocks ────────────────────────────────────────────────────
function Pill({ paper, children }: { paper: Paper; children: React.ReactNode }) {
  return (
    <span className="rounded-full px-2 py-[2px] text-[11px] font-medium" style={{ background: paper.fold, color: paper.text }}>
      {children}
    </span>
  )
}

function CardLink({ href, accent, children }: { href: string; accent: string; children: React.ReactNode }) {
  return (
    <Link href={href}
      className="no-drag mt-auto inline-flex items-center gap-1 pt-2 text-[12px] font-medium transition-opacity hover:opacity-80"
      style={{ color: accent }}>
      {children} <ArrowRight size={12} />
    </Link>
  )
}

function DockButton({
  children, label, onClick, primary, danger, disabled,
}: {
  children: React.ReactNode
  label: string
  onClick?: () => void
  primary?: boolean
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick} disabled={disabled} aria-label={label} title={label}
      className={cn(
        'inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[12.5px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-35',
        primary
          ? 'bg-emerald-600 text-white hover:bg-emerald-500'
          : danger
            ? 'bg-rose-600 text-white hover:bg-rose-500'
            : 'text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800',
      )}
    >
      {children}
    </button>
  )
}

function Popover({ children, onClose, align }: { children: React.ReactNode; onClose: () => void; align?: 'right' }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div className={cn(
        'absolute bottom-11 z-40 w-56 overflow-hidden rounded-xl border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-800 dark:bg-zinc-900',
        align === 'right' ? 'right-0' : 'left-1/2 -translate-x-1/2',
      )}>
        {children}
      </div>
    </>
  )
}

function MenuLink({ href, icon: Icon, label }: { href: string; icon: LucideIcon; label: string }) {
  return (
    <Link href={href}
      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[12.5px] text-zinc-600 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800">
      <Icon size={14} className="text-zinc-400" /> {label}
    </Link>
  )
}

// Merge an incoming RGL breakpoint layout into the stored one, preserving stored
// entries for cards that aren't currently rendered (hidden) and the static flag
// on pinned cards.
function mergeBp(prev: RGLItem[], incoming?: Layout[]): RGLItem[] {
  if (!incoming) return prev
  const map = new Map(prev.map(o => [o.i, o]))
  incoming.forEach(o => {
    const ex = map.get(o.i)
    map.set(o.i, { i: o.i, x: o.x, y: o.y, w: o.w, h: o.h, static: ex?.static })
  })
  return Array.from(map.values())
}
