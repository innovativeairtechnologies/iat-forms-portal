// ─────────────────────────────────────────────────────────────────────────────
// lib/diagrams.ts — data model + application templates for the Application
// Diagram Studio (/admin/diagram-studio).
//
// WHAT THIS IS: a sales rep picks an APPLICATION (hospital OR, ice rink, battery
// dry room, …), which loads a `Scene` — a declarative description of one of our
// airflow figures. Every string and number in that Scene is editable in the
// studio; the renderer (DiagramCanvas.tsx) turns it into SVG.
//
// TWO DESIGN DECISIONS WORTH KNOWING:
//
//  1. The APPLICATION picks the LAYOUT, not just the numbers. Each template lays
//     out its own equipment blocks and airflow paths — a rink is a recirculating
//     loop with no air handler, a dry room is a three-stage train, the hospital
//     is a desiccant DOAS bolted onto an existing AHU. Switching applications
//     genuinely redraws the figure. Within a template a rep edits content and
//     drags callouts; they do not re-plumb the equipment (see docs).
//
//  2. The artboard does NOT use the portal's design tokens. DESIGN.md governs the
//     app chrome around it; the figure itself is a CUSTOMER-FACING DOCUMENT that
//     ships into proposals and has to look like our existing printed figures —
//     navy header, gold rule, colour-coded airflow. So the palette below is
//     deliberately its own closed system, and it must not follow dark mode: an
//     exported PNG has to look identical no matter what theme the rep is in.
//
// Everything here is plain JSON-serialisable data, which is what makes
// localStorage autosave and the .json export/import in the studio one-liners.
// ─────────────────────────────────────────────────────────────────────────────

/** Fixed artboard. 2000×1150 ≈ 16:9.2 — reads well in a proposal at full width. */
export const ARTBOARD = { w: 2000, h: 1150 }
export const HEADER_H = 96
export const FOOTER_Y = 1072

// ─── Palette ─────────────────────────────────────────────────────────────────
// One entry per airflow role. `fill` paints arrows and accent bars, `ink` is the
// text colour (darkened for contrast on white), `soft` is the wash behind pills.

export const TONES = {
  oa:      { fill: '#E8A33D', ink: '#A9701A', soft: '#FBF1DF' },
  exhaust: { fill: '#C0392B', ink: '#A32C20', soft: '#FAE7E4' },
  process: { fill: '#E8703A', ink: '#BF521E', soft: '#FCEDE4' },
  return:  { fill: '#9CC3DF', ink: '#4E7B9E', soft: '#EDF4FA' },
  supply:  { fill: '#2277BB', ink: '#1A5D93', soft: '#E6F0F8' },
  water:   { fill: '#17879B', ink: '#0F6A7B', soft: '#E4F2F4' },
  slate:   { fill: '#8FA3B4', ink: '#4A5F72', soft: '#EEF2F6' },
  brand:   { fill: '#089447', ink: '#0B6B36', soft: '#E9F6EE' },
} as const

export type Tone = keyof typeof TONES
export const TONE_KEYS = Object.keys(TONES) as Tone[]
export const TONE_LABELS: Record<Tone, string> = {
  oa: 'Outside air (gold)',
  exhaust: 'Exhaust / regen (red)',
  process: 'Process air (orange)',
  return: 'Return air (pale blue)',
  supply: 'Supply air (blue)',
  water: 'Chilled water (teal)',
  slate: 'Neutral (slate)',
  brand: 'IAT green',
}

/** Non-airflow chrome: header, canvas, equipment shells. Not theme-aware, by design. */
export const PAPER = {
  headerFrom: '#123A61',
  headerTo: '#0A2340',
  headerRule: '#E8A33D',
  headerInk: '#FFFFFF',
  headerMuted: '#93B4CE',
  canvas: '#EFF4F8',
  grid: '#DFE9F1',
  card: '#FFFFFF',
  cardEdge: '#D7E1EA',
  equipFill: '#E5EBF1',
  equipEdge: '#93A9BC',
  equipInk: '#33465A',
  ink: '#1B2B3A',
  muted: '#6E8298',
  faint: '#93A9BC',
  leader: '#7D93A6',
}

// ─── Scene model ─────────────────────────────────────────────────────────────

export type Pt = [number, number]

export type AhuSection = { label: string; icon: 'none' | 'fan' | 'coil' }

export type DiagramNode =
  /** The dehumidifier: two stacked chambers with the desiccant rotor on the right edge. */
  | {
      kind: 'desiccant'
      id: string
      x: number; y: number; w: number; h: number
      /** 0–1 — where the regen/process divider sits. 0.5 = even split. */
      split: number
      topLabel: string
      bottomLabel: string
      rotor: boolean
      /** Draws a chilled-water coil glyph in the bottom (process) chamber. */
      precool: boolean
    }
  /** A section-by-section air handler. `inlet` adds the tapered mixing plenum. */
  | {
      kind: 'ahu'
      id: string
      x: number; y: number; w: number; h: number
      inlet: boolean
      sections: AhuSection[]
      /** Coil glyph hanging below the shell (the post-cooling coil in the reference figure). */
      underCoil: boolean
    }
  /** The conditioned space — a photo box with a caption underneath. */
  | { kind: 'room'; id: string; x: number; y: number; w: number; h: number; caption: string; photo: string | null }
  /** Generic labelled block: distribution duct, vestibule, plenum, anything else. */
  | { kind: 'box'; id: string; x: number; y: number; w: number; h: number; title: string; subtitle: string; tone: Tone }

export type Flow = {
  id: string
  tone: Tone
  /** `arrow` = a solid block arrow; `duct` = a plain grey run with a dashed centreline. */
  style: 'arrow' | 'duct'
  from: Pt
  to: Pt
  width: number
  /** Reversed out in white inside the shaft — 'OA', 'S/A', 'PROCESS'. '' hides it. */
  label: string
}

export type CalloutRow = { value: string; unit: string }

export type Callout = {
  id: string
  title: string
  tone: Tone
  x: number; y: number; w: number
  rows: CalloutRow[]
  /** Dashed leader line target. null = the card stands alone with no leader. */
  anchor: Pt | null
}

export type Note = {
  id: string
  x: number; y: number
  text: string
  tone: Tone
  size: number
  weight: number
  align: 'start' | 'middle' | 'end'
  caps: boolean
  /** Wraps the text in the dashed callout ellipse ("REHEAT ELIMINATED"). */
  ellipse: boolean
}

export type Scene = {
  figure: string
  title: string
  eyebrow: string
  footnote: string
  legend: { tone: Tone; label: string }[]
  showGrid: boolean
  nodes: DiagramNode[]
  flows: Flow[]
  callouts: Callout[]
  notes: Note[]
}

export type DiagramTemplate = {
  id: string
  name: string
  blurb: string
  /** A factory, not a constant — every load hands back a fresh, safely-mutable copy. */
  build: () => Scene
}

// ─── Layout helpers ──────────────────────────────────────────────────────────
// Callout height is derived, never stored, so adding a row in the studio grows
// the card and the renderer + leader-line maths stay in agreement.

export const CALLOUT_TITLE_H = 34
export const CALLOUT_ROW_H = 26
export const CALLOUT_PAD_B = 12

export function calloutHeight(c: Callout): number {
  return CALLOUT_TITLE_H + c.rows.length * CALLOUT_ROW_H + CALLOUT_PAD_B
}

/** Node bounding box, including the rotor overhang and the room's caption line. */
export function nodeBox(n: DiagramNode): { x: number; y: number; w: number; h: number } {
  if (n.kind === 'desiccant' && n.rotor) return { x: n.x, y: n.y, w: n.w + 26, h: n.h }
  if (n.kind === 'ahu' && n.inlet) return { x: n.x - 86, y: n.y, w: n.w + 86, h: n.h }
  if (n.kind === 'room') return { x: n.x, y: n.y, w: n.w, h: n.h + 34 }
  return { x: n.x, y: n.y, w: n.w, h: n.h }
}

export function nodeLabel(n: DiagramNode): string {
  switch (n.kind) {
    case 'desiccant': return 'Desiccant dehumidifier'
    case 'ahu': return 'Air handler'
    case 'room': return n.caption || 'Conditioned space'
    case 'box': return n.title || 'Block'
  }
}

// ─── Template construction shorthands ────────────────────────────────────────

const rows = (list: [string, string][]): CalloutRow[] => list.map(([value, unit]) => ({ value, unit }))

const callout = (
  id: string, title: string, tone: Tone, x: number, y: number,
  list: [string, string][], anchor: Pt | null = null, w = 196,
): Callout => ({ id, title, tone, x, y, w, rows: rows(list), anchor })

const flow = (id: string, tone: Tone, from: Pt, to: Pt, label = '', width = 30): Flow =>
  ({ id, tone, style: 'arrow', from, to, width, label })

const duct = (id: string, from: Pt, to: Pt, width = 16): Flow =>
  ({ id, tone: 'slate', style: 'duct', from, to, width, label: '' })

const note = (id: string, x: number, y: number, text: string, o: Partial<Note> = {}): Note => ({
  id, x, y, text, tone: 'slate', size: 17, weight: 600, align: 'start', caps: true, ellipse: false, ...o,
})

const DEFAULT_LEGEND: Scene['legend'] = [
  { tone: 'oa', label: 'Outside Air' },
  { tone: 'exhaust', label: 'Exhaust / Regen' },
  { tone: 'process', label: 'Process Air' },
  { tone: 'return', label: 'Return Air' },
  { tone: 'supply', label: 'Supply Air' },
  { tone: 'water', label: 'Chilled Water' },
]

const DEFAULT_FOOTNOTE =
  'DB = dry bulb · gr/lb = grains moisture / lb dry air · DPT = dew point · CWS = chilled water supply'

/** The two-line hand-lettered system name every figure carries in its lower left. */
const systemName = (line1: string, line2: string, x = 175, y = 918): Note[] => [
  note('n-sys1', x, y, line1, { caps: false, size: 24, weight: 650, tone: 'slate' }),
  note('n-sys2', x, y + 33, line2, { caps: false, size: 24, weight: 650, tone: 'process' }),
]

// ─── Templates ───────────────────────────────────────────────────────────────
// Coordinates are hand-placed against the 2000×1150 artboard. They are meant to
// be edited: adding an application is a data change in this file, nothing else.

/* 1 ─ Hospital operating rooms. The reference figure: a desiccant DOAS that
   pretreats 100% outside air and hands it to the hospital's EXISTING air
   handler, so the mixed air is dry enough that the cooling coil never has to
   overshoot — which is what lets the reheat come out. */
const hospitalOR = (): Scene => ({
  figure: 'FIGURE 5',
  title: 'Desiccant Dehumidification in Hospital Operating Rooms',
  eyebrow: 'Hybrid Desiccant DOAS System',
  footnote: DEFAULT_FOOTNOTE,
  legend: DEFAULT_LEGEND,
  showGrid: true,
  nodes: [
    { kind: 'desiccant', id: 'dh', x: 172, y: 455, w: 205, h: 200, split: 0.47, topLabel: 'Regeneration\nAir', bottomLabel: 'Process Air', rotor: true, precool: true },
    {
      kind: 'ahu', id: 'ahu', x: 655, y: 485, w: 675, h: 125, inlet: true, underCoil: true,
      sections: [
        { label: 'Prefilter', icon: 'none' },
        { label: 'Fan', icon: 'fan' },
        { label: 'Cooling', icon: 'coil' },
        { label: 'Final Filter', icon: 'none' },
      ],
    },
    { kind: 'room', id: 'room', x: 1370, y: 815, w: 385, h: 228, caption: '(12) Ortho Operating Suites', photo: null },
  ],
  flows: [
    flow('f-oa-p', 'oa', [92, 592], [172, 592], 'OA'),
    flow('f-ea', 'exhaust', [218, 455], [218, 380], 'EA'),
    flow('f-oa-r', 'oa', [338, 380], [338, 455], 'OA'),
    flow('f-proc', 'process', [412, 562], [512, 562], 'PROCESS'),
    duct('d-proc', [500, 545], [572, 545]),
    flow('f-ra', 'return', [762, 748], [762, 614], 'RA'),
    flow('f-roa', 'return', [1240, 412], [1240, 486], ''),
    duct('d-sa1', [1330, 545], [1557, 545]),
    duct('d-sa2', [1557, 545], [1557, 748]),
    flow('f-sa', 'supply', [1557, 745], [1557, 812], 'S/A'),
  ],
  callouts: [
    callout('c-ea', 'Exhaust Air', 'exhaust', 46, 176,
      [['85.5', '°F DB'], ['148.8', 'gr/lb'], ['78.6', '°F DPT'], ['11,250', 'CFM']], [218, 396]),
    callout('c-oa', 'Outside Air', 'slate', 40, 692, [['11,250', 'CFM']]),
    callout('c-proc', 'Process Air', 'process', 352, 686,
      [['101', '°F DB'], ['13.8', 'gr/lb'], ['18.2', '°F DPT'], ['11,250', 'CFM']]),
    callout('c-mix', 'Mixed Air', 'supply', 584, 292,
      [['70.3', '°F DB'], ['26.5', 'gr/lb'], ['32', '°F DPT'], ['45,000', 'CFM']], [606, 514]),
    callout('c-roa', 'Return / OA', 'return', 1124, 288, [['45,000', 'CFM']]),
    callout('c-post', 'Post-Cooling (sensible only)', 'water', 1316, 178, [['15.3', '°F DB']], null, 328),
    callout('c-off', 'Off-Coil Air', 'supply', 1524, 380,
      [['55', '°F DB'], ['26.5', 'gr/lb'], ['32', '°F DPT']], [1342, 540]),
    callout('c-sa', 'Supply Air', 'supply', 1190, 654,
      [['60', '°F DB'], ['30.7', 'gr/lb'], ['36', '°F DPT'], ['33,750', 'CFM']], [1545, 728]),
    callout('c-room', 'Room Design', 'brand', 1772, 894,
      [['60', '°F'], ['40', '% RH'], ['36', '°F DPT']], null, 160),
  ],
  notes: [
    note('n-dh', 152, 344, 'Desiccant Dehumidifier'),
    note('n-rotor', 366, 446, 'Rotor', { size: 13, tone: 'oa' }),
    note('n-pre', 262, 694, 'Precooling\n46°F CWS', { size: 14, tone: 'water', align: 'middle' }),
    note('n-ahu', 990, 396, 'Existing Air Handler', { align: 'middle' }),
    note('n-postc', 1072, 664, 'Post-Cooling\n46°F CWS', { size: 14, tone: 'water', align: 'middle' }),
    note('n-ra', 762, 844, 'Return Air', { size: 15, tone: 'return', align: 'middle' }),
    note('n-reheat', 1442, 550, 'Reheat\nEliminated', { size: 17, tone: 'exhaust', align: 'middle', ellipse: true }),
    ...systemName('Hybrid Desiccant Dehumidification', 'DOAS System'),
  ],
})

/* 2 ─ Pharmaceutical tablet coating. Same hybrid topology as the hospital, but
   the space is chasing a low grain depression for coating repeatability rather
   than reheat savings — so the callouts and the room design change, and the
   "reheat eliminated" note becomes a process-stability note. */
const pharmaCoating = (): Scene => {
  const s = hospitalOR()
  return {
    ...s,
    figure: 'FIGURE 1',
    title: 'Desiccant Dehumidification for Tablet Coating Suites',
    eyebrow: 'Hybrid Desiccant DOAS System',
    nodes: s.nodes.map((n) => (n.kind === 'room' ? { ...n, caption: '(4) Coating Suites — Class 100,000' } : n)),
    callouts: [
      callout('c-ea', 'Exhaust Air', 'exhaust', 46, 176,
        [['88.0', '°F DB'], ['152.0', 'gr/lb'], ['79.4', '°F DPT'], ['6,000', 'CFM']], [218, 396]),
      callout('c-oa', 'Outside Air', 'slate', 40, 692, [['6,000', 'CFM']]),
      callout('c-proc', 'Process Air', 'process', 352, 686,
        [['104', '°F DB'], ['8.4', 'gr/lb'], ['7.1', '°F DPT'], ['6,000', 'CFM']]),
      callout('c-mix', 'Mixed Air', 'supply', 584, 292,
        [['72.0', '°F DB'], ['21.0', 'gr/lb'], ['25', '°F DPT'], ['24,000', 'CFM']], [606, 514]),
      callout('c-roa', 'Return / OA', 'return', 1124, 288, [['24,000', 'CFM']]),
      callout('c-post', 'Post-Cooling (sensible only)', 'water', 1316, 178, [['12.0', '°F DB']], null, 328),
      callout('c-off', 'Off-Coil Air', 'supply', 1524, 380,
        [['54', '°F DB'], ['21.0', 'gr/lb'], ['25', '°F DPT']], [1342, 540]),
      callout('c-sa', 'Supply Air', 'supply', 1190, 654,
        [['64', '°F DB'], ['22.4', 'gr/lb'], ['26', '°F DPT'], ['24,000', 'CFM']], [1545, 728]),
      callout('c-room', 'Room Design', 'brand', 1772, 894,
        [['70', '°F'], ['20', '% RH'], ['26', '°F DPT']], null, 160),
    ],
    notes: [
      note('n-dh', 152, 344, 'Desiccant Dehumidifier'),
      note('n-rotor', 366, 446, 'Rotor', { size: 13, tone: 'oa' }),
      note('n-pre', 262, 694, 'Precooling\n46°F CWS', { size: 14, tone: 'water', align: 'middle' }),
      note('n-ahu', 990, 396, 'Existing Air Handler', { align: 'middle' }),
      note('n-postc', 1072, 664, 'Post-Cooling\n46°F CWS', { size: 14, tone: 'water', align: 'middle' }),
      note('n-ra', 762, 844, 'Return Air', { size: 15, tone: 'return', align: 'middle' }),
      note('n-reheat', 1442, 550, 'Stable\nGrain Depression', { size: 16, tone: 'brand', align: 'middle', ellipse: true }),
      ...systemName('Hybrid Desiccant Dehumidification', 'Pharmaceutical Process Air'),
    ],
  }
}

/* 3 ─ Ice rink. No air handler at all: a recirculating desiccant unit takes
   return air off the rink slab plus a small outside-air component, and blows dry
   air back down through overhead distribution ductwork. */
const iceRink = (): Scene => ({
  figure: 'FIGURE 2',
  title: 'Desiccant Dehumidification for Ice Arenas',
  eyebrow: 'Recirculating Desiccant System',
  footnote: DEFAULT_FOOTNOTE,
  legend: DEFAULT_LEGEND,
  showGrid: true,
  nodes: [
    { kind: 'desiccant', id: 'dh', x: 176, y: 430, w: 250, h: 236, split: 0.47, topLabel: 'Regeneration\nAir', bottomLabel: 'Process Air', rotor: true, precool: false },
    { kind: 'box', id: 'duct', x: 900, y: 384, w: 780, h: 62, title: 'Overhead Distribution Ductwork', subtitle: '', tone: 'slate' },
    { kind: 'room', id: 'room', x: 900, y: 622, w: 780, h: 300, caption: 'NHL-Size Sheet — 200 ft × 85 ft', photo: null },
  ],
  flows: [
    flow('f-oa-p', 'oa', [72, 600], [176, 600], 'OA'),
    flow('f-ea', 'exhaust', [232, 430], [232, 352], 'EA'),
    flow('f-oa-r', 'oa', [382, 352], [382, 430], 'OA'),
    flow('f-proc', 'process', [462, 548], [576, 548], 'PROCESS'),
    duct('d-1', [566, 532], [700, 532]),
    duct('d-2', [700, 540], [700, 415]),
    duct('d-3', [692, 415], [900, 415]),
    flow('f-sa1', 'supply', [1040, 446], [1040, 618], ''),
    flow('f-sa2', 'supply', [1290, 446], [1290, 618], 'S/A'),
    flow('f-sa3', 'supply', [1540, 446], [1540, 618], ''),
    duct('d-r1', [900, 878], [318, 878]),
    flow('f-ra', 'return', [318, 878], [318, 672], 'RA'),
  ],
  callouts: [
    callout('c-oa', 'Outside Air', 'oa', 40, 150,
      [['92', '°F DB'], ['124', 'gr/lb'], ['76', '°F DPT'], ['1,500', 'CFM']], [120, 578]),
    callout('c-ea', 'Regen Exhaust', 'exhaust', 300, 150,
      [['96', '°F DB'], ['138', 'gr/lb'], ['77', '°F DPT'], ['4,000', 'CFM']], [232, 368]),
    callout('c-proc', 'Process / Supply Air', 'process', 476, 672,
      [['74', '°F DB'], ['11.8', 'gr/lb'], ['14', '°F DPT'], ['15,000', 'CFM']], [520, 570], 232),
    callout('c-ra', 'Return Air', 'return', 470, 900,
      [['48', '°F DB'], ['38', 'gr/lb'], ['32', '°F DPT'], ['13,500', 'CFM']], [400, 878]),
    callout('c-rink', 'Rink Design', 'brand', 1720, 620,
      [['50', '°F'], ['30', '% RH'], ['18', '°F DPT']], null, 172),
    callout('c-ice', 'Ice Surface', 'water', 1720, 830, [['22', '°F']], null, 172),
  ],
  notes: [
    note('n-dh', 176, 336, 'Desiccant Dehumidifier'),
    note('n-rotor', 416, 420, 'Rotor', { size: 13, tone: 'oa' }),
    note('n-duct', 1290, 366, 'Supply Plenum', { size: 14, align: 'middle', tone: 'supply' }),
    note('n-ra', 760, 852, 'Return Air From Rink', { size: 15, tone: 'return', align: 'middle' }),
    note('n-fog', 1290, 1008, 'No Fog\nNo Condensation Drip', { size: 17, tone: 'brand', align: 'middle', ellipse: true }),
    ...systemName('Ice Arena Dehumidification', 'Recirculating Desiccant', 60, 986),
  ],
})

/* 4 ─ Lithium battery dry room. A three-stage train: precool AHU knocks the
   latent load down, the desiccant takes it to deep dew point, a post-cool/fan
   section trims the sensible back before it enters the room. */
const dryRoom = (): Scene => ({
  figure: 'FIGURE 3',
  title: 'Ultra-Low Dew Point Dry Rooms for Battery Manufacturing',
  eyebrow: 'Three-Stage Desiccant Train',
  footnote: DEFAULT_FOOTNOTE,
  legend: DEFAULT_LEGEND,
  showGrid: true,
  nodes: [
    {
      kind: 'ahu', id: 'pre', x: 168, y: 486, w: 250, h: 122, inlet: true, underCoil: true,
      sections: [{ label: 'Filter', icon: 'none' }, { label: 'Pre-Cool', icon: 'coil' }],
    },
    { kind: 'desiccant', id: 'dh', x: 556, y: 436, w: 246, h: 224, split: 0.47, topLabel: 'Regeneration\nAir', bottomLabel: 'Process Air', rotor: true, precool: false },
    {
      kind: 'ahu', id: 'post', x: 1010, y: 486, w: 264, h: 122, inlet: false, underCoil: true,
      sections: [{ label: 'Post-Cool', icon: 'coil' }, { label: 'Fan', icon: 'fan' }],
    },
    { kind: 'room', id: 'room', x: 1424, y: 560, w: 430, h: 260, caption: 'Class 10k Dry Room — Electrode Assembly', photo: null },
  ],
  flows: [
    flow('f-oa', 'oa', [16, 547], [82, 547], 'OA'),
    duct('d-1', [418, 547], [500, 547]),
    flow('f-proc-in', 'process', [498, 547], [556, 547], ''),
    flow('f-ea', 'exhaust', [610, 436], [610, 360], 'EA'),
    flow('f-oa-r', 'oa', [756, 360], [756, 436], 'OA'),
    flow('f-proc', 'process', [838, 548], [940, 548], 'PROCESS'),
    duct('d-2', [930, 547], [1010, 547]),
    duct('d-3', [1274, 547], [1360, 547]),
    flow('f-sa', 'supply', [1352, 547], [1424, 547], 'S/A'),
    duct('d-r1', [1424, 762], [1330, 762]),
    duct('d-r2', [1338, 762], [1338, 900]),
    duct('d-r3', [1338, 892], [140, 892]),
    // straight into the mixing plenum's lower edge, which slopes from (82,584) to (168,608)
    flow('f-ra', 'return', [140, 892], [140, 600], 'RA'),
  ],
  callouts: [
    callout('c-oa', 'Outside Air', 'oa', 40, 214,
      [['95', '°F DB'], ['118', 'gr/lb'], ['75', '°F DPT'], ['3,000', 'CFM']], [120, 528]),
    callout('c-pre', 'Off Pre-Cool', 'water', 300, 232,
      [['45', '°F DB'], ['42', 'gr/lb'], ['44', '°F DPT']], [372, 470]),
    callout('c-ea', 'Regen Exhaust', 'exhaust', 620, 158,
      [['118', '°F DB'], ['164', 'gr/lb'], ['81', '°F DPT'], ['4,500', 'CFM']], [610, 348]),
    callout('c-proc', 'Off Desiccant', 'process', 856, 692,
      [['128', '°F DB'], ['0.8', 'gr/lb'], ['−45', '°F DPT'], ['18,000', 'CFM']], [890, 572], 212),
    callout('c-sa', 'Supply Air', 'supply', 1148, 216,
      [['62', '°F DB'], ['0.8', 'gr/lb'], ['−45', '°F DPT'], ['18,000', 'CFM']], [1180, 470]),
    callout('c-room', 'Dry Room Design', 'brand', 1440, 208,
      [['68', '°F'], ['0.6', '% RH'], ['−40', '°F DPT']], null, 208),
    callout('c-ra', 'Return Air', 'return', 690, 902,
      [['70', '°F DB'], ['1.1', 'gr/lb'], ['−38', '°F DPT'], ['15,000', 'CFM']], [740, 892]),
  ],
  notes: [
    note('n-pre', 292, 452, 'Pre-Cool Air Handler', { align: 'middle' }),
    note('n-dh', 556, 344, 'Desiccant Dehumidifier'),
    note('n-rotor', 794, 426, 'Rotor', { size: 13, tone: 'oa' }),
    note('n-post', 1142, 452, 'Post-Cool + Fan', { align: 'middle' }),
    note('n-dp', 1639, 462, 'Dew Point Held\nThrough Shift Change', { size: 16, tone: 'brand', align: 'middle', ellipse: true }),
    ...systemName('Ultra-Low Dew Point', 'Battery Dry Room'),
  ],
})

/* 5 ─ Cold storage. The unit doesn't condition the freezer directly — it dries
   the dock vestibule, so the moisture never rides through the door in the first
   place. That's the point of the figure, so the vestibule is its own block. */
const coldStorage = (): Scene => ({
  figure: 'FIGURE 4',
  title: 'Frost Control for Cold Storage & Freezer Docks',
  eyebrow: 'Dock Vestibule Desiccant System',
  footnote: DEFAULT_FOOTNOTE,
  legend: DEFAULT_LEGEND,
  showGrid: true,
  nodes: [
    { kind: 'desiccant', id: 'dh', x: 190, y: 452, w: 244, h: 230, split: 0.47, topLabel: 'Regeneration\nAir', bottomLabel: 'Process Air', rotor: true, precool: false },
    { kind: 'box', id: 'vest', x: 840, y: 500, w: 268, h: 300, title: 'Dock Vestibule', subtitle: '35°F · 12 gr/lb', tone: 'supply' },
    { kind: 'room', id: 'room', x: 1236, y: 500, w: 500, h: 300, caption: '−10°F Freezer Warehouse', photo: null },
  ],
  flows: [
    flow('f-oa-p', 'oa', [84, 622], [190, 622], 'OA'),
    flow('f-ea', 'exhaust', [246, 452], [246, 374], 'EA'),
    flow('f-oa-r', 'oa', [394, 374], [394, 452], 'OA'),
    flow('f-proc', 'process', [470, 570], [578, 570], 'PROCESS'),
    duct('d-1', [568, 570], [706, 570]),
    flow('f-sa', 'supply', [700, 570], [840, 570], 'S/A'),
    flow('f-door', 'supply', [1108, 690], [1236, 690], ''),
    duct('d-r1', [974, 800], [974, 884]),
    duct('d-r2', [982, 876], [300, 876]),
    flow('f-ra', 'return', [300, 876], [300, 686], 'RA'),
  ],
  callouts: [
    callout('c-oa', 'Outside Air', 'oa', 40, 200,
      [['90', '°F DB'], ['132', 'gr/lb'], ['77', '°F DPT'], ['2,400', 'CFM']], [130, 600]),
    callout('c-ea', 'Regen Exhaust', 'exhaust', 246, 160,
      [['104', '°F DB'], ['158', 'gr/lb'], ['80', '°F DPT'], ['3,200', 'CFM']], [246, 362]),
    callout('c-proc', 'Process Air', 'process', 452, 700,
      [['96', '°F DB'], ['4.2', 'gr/lb'], ['−12', '°F DPT'], ['9,000', 'CFM']], [512, 594]),
    callout('c-vest', 'Vestibule Design', 'supply', 828, 300,
      [['35', '°F'], ['12', 'gr/lb'], ['9', '°F DPT']], [974, 500], 208),
    callout('c-frz', 'Freezer Design', 'brand', 1240, 300,
      [['−10', '°F'], ['1.5', 'gr/lb'], ['−22', '°F DPT']], [1440, 500], 208),
    callout('c-door', 'Door Infiltration', 'slate', 1096, 916, [['1,800', 'CFM']], [1170, 690]),
  ],
  notes: [
    note('n-dh', 256, 352, 'Desiccant Dehumidifier'),
    note('n-rotor', 426, 442, 'Rotor', { size: 13, tone: 'oa' }),
    note('n-frost', 1490, 920, 'No Coil Frost\nNo Ice At The Doors', { size: 17, tone: 'brand', align: 'middle', ellipse: true }),
    ...systemName('Cold Storage Frost Control', 'Dock Vestibule Drying'),
  ],
})

/* 6 ─ Natatorium. The load is evaporation off the pool surface, so the figure
   leads with the pool/air temperature relationship and the perimeter supply
   that keeps the glass and the structure dry. */
const natatorium = (): Scene => ({
  figure: 'FIGURE 6',
  title: 'Natatorium Dehumidification & Envelope Protection',
  eyebrow: 'Desiccant + Sensible Recovery',
  footnote: DEFAULT_FOOTNOTE,
  legend: DEFAULT_LEGEND,
  showGrid: true,
  nodes: [
    { kind: 'desiccant', id: 'dh', x: 182, y: 442, w: 248, h: 232, split: 0.47, topLabel: 'Regeneration\nAir', bottomLabel: 'Process Air', rotor: true, precool: true },
    { kind: 'box', id: 'duct', x: 1000, y: 402, w: 700, h: 58, title: 'Perimeter Supply — Glass & Wall Wash', subtitle: '', tone: 'slate' },
    { kind: 'room', id: 'room', x: 1000, y: 626, w: 700, h: 292, caption: 'Competition Pool — 25 m × 8 Lanes', photo: null },
  ],
  flows: [
    flow('f-oa-p', 'oa', [78, 612], [182, 612], 'OA'),
    flow('f-ea', 'exhaust', [238, 442], [238, 366], 'EA'),
    flow('f-oa-r', 'oa', [388, 366], [388, 442], 'OA'),
    flow('f-proc', 'process', [466, 558], [578, 558], 'PROCESS'),
    duct('d-1', [568, 542], [780, 542]),
    duct('d-2', [780, 550], [780, 431]),
    duct('d-3', [772, 431], [1000, 431]),
    flow('f-sa1', 'supply', [1130, 460], [1130, 622], ''),
    flow('f-sa2', 'supply', [1350, 460], [1350, 622], 'S/A'),
    flow('f-sa3', 'supply', [1570, 460], [1570, 622], ''),
    duct('d-r1', [1000, 874], [330, 874]),
    flow('f-ra', 'return', [330, 874], [330, 680], 'RA'),
  ],
  callouts: [
    callout('c-oa', 'Outside Air', 'oa', 40, 150,
      [['91', '°F DB'], ['126', 'gr/lb'], ['76', '°F DPT'], ['4,000', 'CFM']], [124, 590]),
    callout('c-ea', 'Regen Exhaust', 'exhaust', 300, 150,
      [['102', '°F DB'], ['150', 'gr/lb'], ['79', '°F DPT'], ['5,000', 'CFM']], [238, 354]),
    callout('c-proc', 'Supply Air', 'process', 470, 686,
      [['92', '°F DB'], ['48', 'gr/lb'], ['46', '°F DPT'], ['22,000', 'CFM']], [520, 580]),
    callout('c-ra', 'Return Air', 'return', 470, 900,
      [['84', '°F DB'], ['74', 'gr/lb'], ['62', '°F DPT'], ['22,000', 'CFM']], [400, 874]),
    callout('c-air', 'Air Design', 'brand', 1738, 620,
      [['84', '°F'], ['55', '% RH'], ['66', '°F DPT']], null, 176),
    callout('c-water', 'Pool Water', 'water', 1738, 830, [['82', '°F']], null, 176),
  ],
  notes: [
    note('n-dh', 182, 340, 'Desiccant Dehumidifier'),
    note('n-rotor', 420, 430, 'Rotor', { size: 13, tone: 'oa' }),
    note('n-pre', 236, 714, 'Precooling\n46°F CWS', { size: 14, tone: 'water', align: 'middle' }),
    note('n-duct', 1350, 384, 'Perimeter Supply', { size: 14, align: 'middle', tone: 'supply' }),
    note('n-ra', 760, 848, 'Return Air Above Pool Deck', { size: 15, tone: 'return', align: 'middle' }),
    note('n-env', 1350, 1010, 'Dry Glass\nNo Structural Condensation', { size: 16, tone: 'brand', align: 'middle', ellipse: true }),
    ...systemName('Natatorium Dehumidification', 'Envelope Protection', 60, 986),
  ],
})

export const TEMPLATES: DiagramTemplate[] = [
  { id: 'hospital-or', name: 'Hospital operating rooms', blurb: 'Desiccant DOAS ahead of an existing air handler — reheat eliminated.', build: hospitalOR },
  { id: 'pharma-coating', name: 'Pharmaceutical coating suite', blurb: 'Same hybrid train, tuned for a repeatable low grain depression.', build: pharmaCoating },
  { id: 'ice-rink', name: 'Ice arena', blurb: 'Recirculating unit with overhead distribution — no air handler.', build: iceRink },
  { id: 'dry-room', name: 'Battery dry room', blurb: 'Three-stage precool → desiccant → post-cool train at −40°F DPT.', build: dryRoom },
  { id: 'cold-storage', name: 'Cold storage dock', blurb: 'Dries the dock vestibule so moisture never rides through the door.', build: coldStorage },
  { id: 'natatorium', name: 'Natatorium / indoor pool', blurb: 'Perimeter supply protecting glass and structure from condensation.', build: natatorium },
]

export const DEFAULT_TEMPLATE_ID = 'hospital-or'

export function templateById(id: string): DiagramTemplate {
  return TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]
}

export function buildScene(id: string): Scene {
  return templateById(id).build()
}

// ─── Persistence ─────────────────────────────────────────────────────────────
// The studio autosaves to localStorage and can round-trip a .json file so a rep
// can hand a figure to a colleague. Both go through this envelope, and both come
// back through isScene() — a hand-edited or stale file must fail closed to the
// template rather than render a half-scene and throw inside the SVG.

export const STORAGE_KEY = 'iat.diagram-studio.v1'
export const FILE_VERSION = 1

export type DiagramFile = { version: number; templateId: string; scene: Scene }

export function isScene(v: unknown): v is Scene {
  if (!v || typeof v !== 'object') return false
  const s = v as Partial<Scene>
  return (
    typeof s.figure === 'string' &&
    typeof s.title === 'string' &&
    Array.isArray(s.nodes) &&
    Array.isArray(s.flows) &&
    Array.isArray(s.callouts) &&
    Array.isArray(s.notes) &&
    Array.isArray(s.legend)
  )
}

export function parseDiagramFile(raw: string): DiagramFile | null {
  try {
    const parsed = JSON.parse(raw) as Partial<DiagramFile>
    if (!parsed || !isScene(parsed.scene)) return null
    return {
      version: typeof parsed.version === 'number' ? parsed.version : FILE_VERSION,
      templateId: typeof parsed.templateId === 'string' ? parsed.templateId : DEFAULT_TEMPLATE_ID,
      scene: parsed.scene,
    }
  } catch {
    return null
  }
}

/** Filesystem-safe slug for the exported PNG/SVG/JSON filename. */
export function fileSlug(scene: Scene): string {
  const base = `${scene.figure} ${scene.title}`.trim() || 'iat-diagram'
  return base.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 70)
}

export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 8)}`
}
