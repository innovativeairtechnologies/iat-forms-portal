/* Renders a screen + panel state into the pGD's character grid.

   The pGD1 is a 132x64 pixel matrix (manual §10.3). At the 6x8 font that is
   exactly 22 columns by 8 rows — confirmed against the source screenshots,
   where "OffLine Timeout: 10000" fills a row edge to edge at 22 characters.

   Menus use a double-height font, so a menu row consumes two of the eight
   slots and fits 11 characters. That is why rows carry a scale rather than the
   grid being a flat 22x8 array of cells.

   Everything here is pure: (screen, values, cursor) in, cells out. No React. */

import type {
  AlarmLine,
  Field,
  Format,
  RenderedCell,
  RenderedRow,
  RowSpec,
  Screen,
  Values,
} from './types'

export const COLS = 22
export const ROWS = 8

/** Columns available on a double-height (menu) row.

    Not COLS/2. The pGD's menu font is 8px wide against the 6px body font, so
    132px gives 16 columns rather than 11. The screenshots settle it: the
    subheader "Manufacturer Password" is 21 characters in the body font (fits
    22), while the menu entry "Communications" is 14 in the large font — which
    is impossible at 11 columns and comfortable at 16. Height is unchanged: a
    16px row still costs two of the eight 8px slots. */
export const COLS_LARGE = 16

export type RenderContext = {
  values: Values
  /** Index into the screen's cursorable fields, or -1 for "cursor at the top of
      the mask", which is where a form starts before the first Enter. */
  cursor: number
  /** Index of the digit being edited, within a `digits` field. */
  digit: number
  /** Index of the highlighted menu item. */
  selection: number
  /** Drives the `alarms` mask. Empty when the unit is healthy. */
  alarms?: AlarmLine[]
}

const BLANK: RenderedCell = { ch: ' ', inverse: false, cursor: false }

function cell(ch: string, inverse = false, cursor = false): RenderedCell {
  return { ch, inverse, cursor }
}

function cells(text: string, inverse = false): RenderedCell[] {
  return Array.from(text, ch => cell(ch, inverse))
}

function blanks(n: number, inverse = false): RenderedCell[] {
  return Array.from({ length: Math.max(0, n) }, () => (inverse ? cell(' ', true) : BLANK))
}

/** Pads (or clips) a row of cells to the given width. */
function fit(row: RenderedCell[], width: number, inverse = false): RenderedCell[] {
  if (row.length >= width) return row.slice(0, width)
  return [...row, ...blanks(width - row.length, inverse)]
}

function emptyRow(scale: 1 | 2 = 1): RenderedRow {
  return { cells: fit([], scale === 2 ? COLS_LARGE : COLS), scale }
}

export function readValue(values: Values, path: string): string | number | boolean | undefined {
  return values[path]
}

export function formatValue(v: string | number | boolean | undefined, format?: Format): string {
  if (v === undefined || v === null) return ''
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') {
    if (format === 'temp1') return v.toFixed(1)
    if (format === 'int') return String(Math.round(v))
    return String(v)
  }
  return v
}

/** Zero-pads a digits field to its fixed width, which is how the pGD shows it
    (`0000000`, cursor walking left to right). */
export function digitsText(v: string | number | boolean | undefined, width: number): string {
  const n = typeof v === 'number' ? v : Number(v ?? 0)
  const safe = Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0
  return String(safe).padStart(width, '0').slice(-width)
}

/** Replaces `{path}` tokens in static row text with values. */
function interpolate(text: string, values: Values): string {
  return text.replace(/\{([^}]+)\}/g, (_m, path: string) => formatValue(values[path]))
}

/** The cursor skips readouts — only editable fields take focus. */
export function cursorableFields(screen: Screen): Field[] {
  if (screen.kind !== 'form') return []
  return screen.fields.filter(f => f.kind !== 'readout')
}

/** Builds the cells for a field's value, including the cursor.

    Two different cursor treatments, both taken from the source screenshots:
    - enum / number — a solid block sits immediately *left* of the value
      ("Protocol:  ▮ NONE").
    - digits — the block sits *on* the digit being edited, inverting it. */
function valueCells(f: Field, ctx: RenderContext, focused: boolean): RenderedCell[] {
  if (f.kind === 'digits') {
    const text = digitsText(ctx.values[f.path], f.digits)
    // The block sits *on* the digit being edited, so the character stays
    // readable through it — mark it both inverse and cursor.
    return Array.from(text, (ch, i) => {
      const on = focused && i === ctx.digit
      return cell(ch, on, on)
    })
  }

  const text = formatValue(ctx.values[f.path], f.kind === 'readout' ? f.format : undefined)
  if (!focused) return cells(text)
  // Here the block sits in the space to the left of the value, replacing it.
  return [cell(' ', true, true), ...cells(text)]
}

function fieldRows(f: Field, ctx: RenderContext, focused: boolean): RenderedRow[] {
  const label = `${f.label}:`
  const value = valueCells(f, ctx, focused)

  if (f.layout === 'stacked') {
    // Label on its own row, value right-aligned on the next — how the pGD lays
    // out Device Instance.
    return [
      { cells: fit(cells(f.label), COLS), scale: 1 },
      { cells: fit([...blanks(COLS - value.length), ...value], COLS), scale: 1 },
    ]
  }

  const gap = COLS - label.length - value.length
  return [{ cells: fit([...cells(label), ...blanks(gap), ...value], COLS), scale: 1 }]
}

function staticRow(spec: RowSpec, values: Values): RenderedRow {
  if (spec.kind === 'blank') return emptyRow()

  if (spec.kind === 'pair') {
    const label = spec.left
    const value = formatValue(values[spec.path], spec.format)
    const gap = COLS - label.length - value.length
    return { cells: fit([...cells(label), ...blanks(gap), ...cells(value)], COLS), scale: 1 }
  }

  const scale = spec.scale ?? 1
  const width = scale === 2 ? COLS_LARGE : COLS
  const text = interpolate(spec.text, values).slice(0, width)
  const body =
    spec.align === 'right'
      ? [...blanks(width - text.length, spec.inverse), ...cells(text, spec.inverse)]
      : cells(text, spec.inverse)
  return { cells: fit(body, width, spec.inverse), scale }
}

/** The "1/7" pager the pGD prints at the right of a menu header. */
function headerRow(header: string, counter?: string): RenderedRow {
  const right = counter ?? ''
  const gap = COLS - header.length - right.length
  return {
    cells: fit([...cells(header, true), ...blanks(gap, true), ...cells(right, true)], COLS, true),
    scale: 1,
  }
}

/** How far a menu is scrolled, given the selection.

    The pGD keeps the selection in the *middle* of the three visible items once
    it has moved off the first. Verified against four independent screenshots
    (Main Menu 1/7 and 6/7, Settings 1/7 and 3/7, Comm 1/6, 2/6 and 5/6) — a
    naive "scroll only when it would leave the window" rule disagrees with all
    but the first. */
export function menuScroll(selection: number, total: number, visible: number): number {
  const max = Math.max(0, total - visible)
  return Math.min(Math.max(selection - 1, 0), max)
}

export function renderScreen(screen: Screen, ctx: RenderContext): RenderedRow[] {
  const rows: RenderedRow[] = []

  if (screen.kind === 'static') {
    for (const spec of screen.rows) rows.push(staticRow(spec, ctx.values))
  }

  if (screen.kind === 'menu') {
    const caret = screen.style === 'caret'
    const visible = screen.visible ?? (caret ? 6 : 3)
    const total = screen.items.length
    const scroll = menuScroll(ctx.selection, total, visible)

    if (screen.header) rows.push(headerRow(screen.header, `${ctx.selection + 1}/${total}`))
    if (screen.subheader) rows.push({ cells: fit(cells(screen.subheader), COLS), scale: 1 })

    for (let i = scroll; i < Math.min(scroll + visible, total); i++) {
      const item = screen.items[i]
      const on = i === ctx.selection

      if (caret) {
        // The operating system's own menu marks the selection with a caret in
        // the body font rather than an inverse bar (manual Fig. 7.a).
        rows.push({ cells: fit(cells(`${on ? '>' : ' '}${item.label}`), COLS), scale: 1 })
        continue
      }

      // The pGD prints a bitmap icon in the left gutter. We can't reproduce
      // those glyphs in a character cell without breaking the grid illusion on
      // font fallback, so the gutter is just an indent. `MenuItem.icon` is kept
      // on the type for when the capture pass gives us real artwork.
      rows.push({ cells: fit(cells(` ${item.label}`, on), COLS_LARGE, on), scale: 2 })
    }
  }

  if (screen.kind === 'form') {
    rows.push(headerRow(screen.header))
    rows.push(emptyRow())
    const focusable = cursorableFields(screen)
    for (const f of screen.fields) {
      const focused = ctx.cursor >= 0 && focusable[ctx.cursor]?.id === f.id
      rows.push(...fieldRows(f, ctx, focused))
    }
  }

  if (screen.kind === 'alarms') {
    const list = ctx.alarms ?? []
    if (list.length === 0) {
      rows.push(headerRow(screen.header))
      rows.push(emptyRow())
      rows.push(staticRow({ kind: 'text', text: screen.empty }, ctx.values))
    } else {
      const visible = 5
      const scroll = menuScroll(ctx.selection, list.length, visible)
      rows.push(headerRow(screen.header, `${ctx.selection + 1}/${list.length}`))
      rows.push(emptyRow())
      for (let i = scroll; i < Math.min(scroll + visible, list.length); i++) {
        const on = i === ctx.selection
        const a = list[i]
        rows.push(staticRow({ kind: 'text', text: `${a.code} ${a.label}`, inverse: on }, ctx.values))
      }
    }
  }

  if (screen.kind === 'confirm') {
    rows.push(headerRow(screen.header))
    rows.push(emptyRow())
    for (const line of screen.body) rows.push(staticRow({ kind: 'text', text: line }, ctx.values))
    const footer = screen.footer ?? []
    // The footer is pinned to the bottom, inverse — "Press ENTER to reboot".
    while (rows.length < ROWS - footer.length) rows.push(emptyRow())
    for (const line of footer) {
      rows.push(staticRow({ kind: 'text', text: line, inverse: true }, ctx.values))
    }
  }

  // A screen never renders taller than the glass. Double-height rows count twice.
  const out: RenderedRow[] = []
  let used = 0
  for (const row of rows) {
    const cost = row.scale === 2 ? 2 : 1
    if (used + cost > ROWS) break
    out.push(row)
    used += cost
  }
  while (used < ROWS) {
    out.push(emptyRow())
    used += 1
  }
  return out
}
