// Shared, serializable config + types for the employee "My Board" whiteboard.
// Imported by BOTH the server (page.tsx / actions.ts) and the client board, so it
// must stay free of any 'use client' or server-only imports — plain TS only.

export type BoardCardId =
  | 'announcement' | 'timeoff' | 'learning' | 'forms' | 'tools' | 'directory' | 'notes'

export type RGLItem = { i: string; x: number; y: number; w: number; h: number; static?: boolean }

export type BoardLayouts = { lg: RGLItem[]; xs: RGLItem[] }

// Persisted per-user in employees.board_layout (jsonb). `v` lets us migrate the
// shape later; `hidden` is the set of cards the user removed; `note` backs the
// editable "My notes" sticky; `layouts` are the react-grid-layout positions per
// breakpoint (lg = desktop grid, xs = mobile/tablet single column).
export type BoardState = {
  v: number
  hidden: BoardCardId[]
  note: string
  layouts: BoardLayouts
}

export const BOARD_VERSION = 1

// Every card the board can show. The announcement is the admin/onboarding layer:
// it's pinned (static) and can't be removed for now.
export const ALL_CARDS: BoardCardId[] = [
  'announcement', 'timeoff', 'learning', 'forms', 'tools', 'directory', 'notes',
]

export const PINNED_CARDS: BoardCardId[] = ['announcement']

// Card heights (in grid rows) for the mobile single-column stack. Desktop heights
// live in DEFAULT_LG below (the banner is short and full-width on desktop, taller
// when it wraps on a narrow phone).
const CARD_H_XS: Record<BoardCardId, number> = {
  announcement: 2, timeoff: 2, learning: 2, forms: 2, tools: 2, directory: 2, notes: 3,
}

// Desktop default: a pinned full-width banner across the top, then a tidy 3-across
// scatter (12-col grid, each card 4 wide).
export const DEFAULT_LG: RGLItem[] = [
  { i: 'announcement', x: 0, y: 0, w: 12, h: 1, static: true },
  { i: 'timeoff',   x: 0, y: 1, w: 4, h: 2 },
  { i: 'learning',  x: 4, y: 1, w: 4, h: 2 },
  { i: 'forms',     x: 8, y: 1, w: 4, h: 2 },
  { i: 'tools',     x: 0, y: 3, w: 4, h: 2 },
  { i: 'directory', x: 4, y: 3, w: 4, h: 2 },
  { i: 'notes',     x: 8, y: 3, w: 4, h: 3 },
]

// Mobile default: a single column in a sensible reading order.
const XS_ORDER: BoardCardId[] = [
  'announcement', 'timeoff', 'learning', 'notes', 'forms', 'tools', 'directory',
]

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
    hidden: [],
    note: '',
    layouts: { lg: DEFAULT_LG.map(o => ({ ...o })), xs: defaultXs() },
  }
}

// Defensive: take whatever is in the DB (or nothing) and fill in anything missing
// so the board always renders. Cards added in a future deploy fall back to their
// defaults; unknown / pinned ids can never be "hidden".
export function normalizeState(raw: unknown): BoardState {
  const base = defaultState()
  if (!raw || typeof raw !== 'object') return base
  const s = raw as Partial<BoardState>
  const hidden = Array.isArray(s.hidden)
    ? s.hidden.filter((id): id is BoardCardId =>
        ALL_CARDS.includes(id as BoardCardId) && !PINNED_CARDS.includes(id as BoardCardId))
    : []
  return {
    v: BOARD_VERSION,
    hidden,
    note: typeof s.note === 'string' ? s.note : '',
    layouts: {
      lg: mergeLayout(base.layouts.lg, s.layouts?.lg),
      xs: mergeLayout(base.layouts.xs, s.layouts?.xs),
    },
  }
}

// Start from the default positions, override with any saved coords for known cards.
// The `static` flag always comes from defaults so pins can't be unpinned via the DB.
function mergeLayout(def: RGLItem[], saved?: RGLItem[]): RGLItem[] {
  if (!Array.isArray(saved)) return def.map(o => ({ ...o }))
  const byId = new Map(saved.filter(o => o && typeof o.i === 'string').map(o => [o.i, o]))
  return def.map(d => {
    const s = byId.get(d.i)
    if (!s) return { ...d }
    return { ...d, x: num(s.x, d.x), y: num(s.y, d.y), w: num(s.w, d.w), h: num(s.h, d.h) }
  })
}

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback
}
