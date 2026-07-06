// Shared, serializable config + types for the employee "My Board" whiteboard.
// Imported by BOTH the server (page.tsx / actions.ts) and the client board, so it
// must stay free of any 'use client' or server-only imports — plain TS only.
//
// v2 (2026-07-06): the board went full-screen and the single "My notes" card
// became real multi sticky-notes. State adds: notes[], per-card color overrides,
// a board background, and an editable board title. normalizeState() still accepts
// a v1 payload (single `note` string) and converts it losslessly.

export type BoardCardId =
  | 'announcement' | 'timeoff' | 'learning' | 'forms' | 'tools' | 'directory'

export type PaletteId = 'yellow' | 'green' | 'blue' | 'pink' | 'orange' | 'purple' | 'gray'

export type BoardBg = 'dots' | 'lines' | 'plain'

export type StickyNote = { id: string; text: string }

export type RGLItem = { i: string; x: number; y: number; w: number; h: number; static?: boolean }

export type BoardLayouts = { lg: RGLItem[]; xs: RGLItem[] }

// Persisted per-user in employees.board_layout (jsonb). `v` lets us migrate the
// shape; `hidden` = feature cards the user removed; `notes` = their own sticky
// notes; `colors` = per-card palette overrides (feature cards AND notes, keyed by
// id); `layouts` = react-grid-layout positions per breakpoint (lg desktop canvas,
// xs mobile single column).
export type BoardState = {
  v: number
  title: string
  bg: BoardBg
  hidden: BoardCardId[]
  notes: StickyNote[]
  colors: Record<string, PaletteId>
  layouts: BoardLayouts
}

export const BOARD_VERSION = 2
export const MAX_NOTES = 20
export const MAX_NOTE_CHARS = 2000

export const ALL_CARDS: BoardCardId[] = [
  'announcement', 'timeoff', 'learning', 'forms', 'tools', 'directory',
]

// The announcement is the admin/onboarding layer: pinned (static), not removable.
export const PINNED_CARDS: BoardCardId[] = ['announcement']

export const PALETTE_IDS: PaletteId[] = ['yellow', 'green', 'blue', 'pink', 'orange', 'purple', 'gray']

// Desktop default: a taped notice top-center, feature cards loosely scattered the
// way someone would actually stick them up — staggered, not a tidy 3-across grid.
export const DEFAULT_LG: RGLItem[] = [
  { i: 'announcement', x: 3, y: 0, w: 6, h: 1, static: true },
  { i: 'timeoff',   x: 0, y: 1, w: 4, h: 2 },
  { i: 'learning',  x: 8, y: 1, w: 4, h: 2 },
  { i: 'forms',     x: 1, y: 4, w: 3, h: 2 },
  { i: 'directory', x: 4, y: 3, w: 4, h: 2 },
  { i: 'tools',     x: 8, y: 4, w: 4, h: 2 },
]

// Mobile: a single column in reading order (notes get appended after learning).
const XS_ORDER: BoardCardId[] = ['announcement', 'timeoff', 'learning', 'forms', 'tools', 'directory']
const CARD_H_XS: Record<BoardCardId, number> = {
  announcement: 2, timeoff: 2, learning: 2, forms: 2, tools: 2, directory: 2,
}
const NOTE_H_XS = 3

export function defaultXs(): RGLItem[] {
  let y = 0
  return XS_ORDER.map(id => {
    const h = CARD_H_XS[id]
    const item: RGLItem = { i: id, x: 0, y, w: 1, h, static: PINNED_CARDS.includes(id) }
    y += h
    return item
  })
}

export function defaultState(): BoardState {
  return {
    v: BOARD_VERSION,
    title: '',
    bg: 'dots',
    hidden: [],
    notes: [],
    colors: {},
    layouts: { lg: DEFAULT_LG.map(o => ({ ...o })), xs: defaultXs() },
  }
}

// Where a note lands when it has no saved position (fresh note, or a saved note
// whose layout entry went missing). Staggered so consecutive notes fan out.
export function noteSpawnLg(index: number): { x: number; y: number; w: number; h: number } {
  return { x: (2 + index * 3) % 10, y: 6 + Math.floor(index / 4), w: 3, h: 2 }
}
export function noteSpawnXs(): { x: number; y: number; w: number; h: number } {
  // y large → react-grid-layout drops it at the bottom of the stack.
  return { x: 0, y: 9999, w: 1, h: NOTE_H_XS }
}

// Defensive: take whatever is in the DB (v1, v2, junk, or nothing) and produce a
// valid v2 state so the board always renders. Unknown ids are dropped; pinned
// cards can never be hidden; note count/length are capped.
export function normalizeState(raw: unknown): BoardState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const s = raw as Record<string, unknown>

  // ── v1 → v2 conversion: the single `note` string becomes one sticky with the
  // legacy id 'notes', so its old layout entries keep applying to it. ──
  let notes: StickyNote[] = []
  if (Array.isArray(s.notes)) {
    notes = (s.notes as unknown[])
      .filter((n): n is { id: string; text: string } =>
        !!n && typeof n === 'object'
        && typeof (n as StickyNote).id === 'string'
        && typeof (n as StickyNote).text === 'string')
      .slice(0, MAX_NOTES)
      .map(n => ({ id: n.id, text: n.text.slice(0, MAX_NOTE_CHARS) }))
  } else if (typeof s.note === 'string' && s.note.trim().length > 0) {
    notes = [{ id: 'notes', text: s.note.slice(0, MAX_NOTE_CHARS) }]
  }

  const hidden = Array.isArray(s.hidden)
    ? (s.hidden as unknown[]).filter((id): id is BoardCardId =>
        ALL_CARDS.includes(id as BoardCardId) && !PINNED_CARDS.includes(id as BoardCardId))
    : []

  const colors: Record<string, PaletteId> = {}
  if (s.colors && typeof s.colors === 'object') {
    for (const [k, v] of Object.entries(s.colors as Record<string, unknown>)) {
      if (PALETTE_IDS.includes(v as PaletteId)) colors[k] = v as PaletteId
    }
  }

  const noteIds = notes.map(n => n.id)
  const savedLayouts = (s.layouts && typeof s.layouts === 'object')
    ? s.layouts as Partial<BoardLayouts>
    : undefined

  return {
    v: BOARD_VERSION,
    title: typeof s.title === 'string' ? s.title.slice(0, 60) : '',
    bg: s.bg === 'lines' || s.bg === 'plain' ? s.bg : 'dots',
    hidden,
    notes,
    colors,
    layouts: {
      lg: mergeLayout(base.layouts.lg, savedLayouts?.lg, noteIds, 'lg'),
      xs: mergeLayout(base.layouts.xs, savedLayouts?.xs, noteIds, 'xs'),
    },
  }
}

// Start from default feature positions, override with saved coords for known
// feature cards, and carry saved note positions (spawning any note that lacks
// one). The `static` flag always comes from defaults so pins can't be unpinned
// via a tampered payload.
function mergeLayout(def: RGLItem[], saved: RGLItem[] | undefined, noteIds: string[], bp: 'lg' | 'xs'): RGLItem[] {
  const byId = new Map(
    (Array.isArray(saved) ? saved : [])
      .filter(o => o && typeof o.i === 'string')
      .map(o => [o.i, o]),
  )
  const out: RGLItem[] = def.map(d => {
    const sv = byId.get(d.i)
    if (!sv) return { ...d }
    return { ...d, x: num(sv.x, d.x), y: num(sv.y, d.y), w: num(sv.w, d.w), h: num(sv.h, d.h) }
  })
  noteIds.forEach((id, idx) => {
    const sv = byId.get(id)
    const spawn = bp === 'lg' ? noteSpawnLg(idx) : noteSpawnXs()
    out.push(sv
      ? { i: id, x: num(sv.x, spawn.x), y: num(sv.y, spawn.y), w: num(sv.w, spawn.w), h: num(sv.h, spawn.h) }
      : { i: id, ...spawn })
  })
  return out
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
