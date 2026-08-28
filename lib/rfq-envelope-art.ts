// ─── RFQ step 5 — envelope illustration artwork ───────────────────────────────
//
// 🔴 THIS FILE IS DRAWING DATA ONLY. Nothing here reaches a calculation, a
// stored record, or the PDF. The permeance that prices a survey comes from
// WALL_MATERIALS / CEILING_MATERIALS / FLOOR_MATERIALS in lib/rfq.ts and is
// resolved by retarderPermOf() + assemblyPermOf() there. If you find yourself
// wanting a number from this file for anything but a picture, stop.
//
// The build-ups below are a plausible construction for each material — the kind
// of thing the three "Good / Better / Best" cut-away photos showed — chosen so a
// customer can recognise their own building. They are NOT specifications and
// have not been through engineering review. Thicknesses are relative and are
// normalised at render time; only their proportions matter.
//
// ⚠️ Keyed by material LABEL, the same exact-string match permOf() uses. A
// rename in lib/rfq.ts without a matching rename here silently drops that
// material onto GENERIC_STACK — a visible-but-wrong picture rather than a
// crash. Rename in both places, and see LEGACY_MATERIAL_LABELS in lib/rfq.ts
// for why the labels are load-bearing at all.

/** name, relative thickness, pattern id, isRetarder? */
export type ArtLayer = readonly [string, number, string, boolean?]

/** Shown when a label has no entry here — deliberately bland, never wrong-looking. */
export const GENERIC_STACK: readonly ArtLayer[] = [
  ['Outer face', 0.16, 'concrete'],
  ['Core', 0.62, 'void'],
  ['Inner face', 0.18, 'gypsum'],
]

export const WALL_ART: Record<string, readonly ArtLayer[]> = {
  'Insulated metal panel':      [['Steel face sheet', .10, 'metalRib'], ['Foam core', .68, 'foam'], ['Steel liner', .14, 'metalFlat']],
  'Sheet metal / steel siding': [['Corrugated steel', .14, 'metalRib'], ['Girt cavity', .60, 'void'], ['Steel liner panel', .14, 'metalFlat']],
  'Concrete block, 8"':         [['Block face', .16, 'cmu'], ['Hollow core', .54, 'cmuCore'], ['Parge coat', .14, 'gypsum'], ['Paint', .07, 'paint']],
  'Poured concrete, 8"':        [['Form face', .12, 'concrete'], ['8" poured concrete', .64, 'concrete2'], ['Paint', .09, 'paint']],
  'Brick masonry, 8.5"':        [['Brick veneer', .26, 'brick'], ['Mortar / air gap', .10, 'void'], ['Block backup', .40, 'cmu'], ['Plaster', .11, 'gypsum']],
  'Gypsum board, painted':      [['Paint film', .07, 'paint'], ['Gypsum board', .16, 'gypsum'], ['Stud cavity', .54, 'void'], ['Gypsum board', .16, 'gypsum']],
  'Plywood sheathing, 1/2"':    [['Building wrap', .07, 'wrap'], ['1/2" plywood', .19, 'plywood'], ['Stud bay', .51, 'void'], ['Interior board', .15, 'gypsum']],
  'Wood frame + insulation':    [['Wood siding', .15, 'wood'], ['Sheathing', .13, 'plywood'], ['Batt insulation', .48, 'batt'], ['Gypsum board', .16, 'gypsum']],
  'Tilt-up concrete panel':     [['Tilt-up panel', .45, 'concrete2'], ['Rigid insulation', .30, 'foam'], ['Liner panel', .14, 'metalFlat']],
  'Fabric / tent structure':    [['PVC-coated fabric', .17, 'fabric'], ['Open span', .68, 'void']],
}

export const ROOF_ART: Record<string, readonly ArtLayer[]> = {
  'Insulated metal panel':        [['Standing-seam skin', .13, 'metalSeam'], ['Foam core', .66, 'foam'], ['Steel liner', .14, 'metalFlat']],
  'Metal deck / built-up roof':   [['Cap sheet', .09, 'membrane'], ['Rigid insulation', .48, 'foam'], ['Cover board', .11, 'plywood'], ['Steel deck', .20, 'deck']],
  'Concrete slab above':          [['Topping', .14, 'concrete'], ['Structural slab', .58, 'concrete2'], ['Soffit finish', .13, 'gypsum']],
  'Gypsum board, painted':        [['Paint film', .07, 'paint'], ['Gypsum board', .17, 'gypsum'], ['Joist cavity', .62, 'void']],
  'Suspended tile (open plenum)': [['Deck above', .16, 'deck'], ['Open plenum', .58, 'void'], ['Ceiling tile', .18, 'tile']],
  'Open to structure':            [['Metal deck', .21, 'deck'], ['Purlin zone', .66, 'void']],
}

export const FLOOR_ART: Record<string, readonly ArtLayer[]> = {
  'Concrete slab on grade':         [['Concrete slab', .42, 'concrete2'], ['Granular base', .28, 'gravel'], ['Subgrade', .28, 'soil']],
  'Concrete slab, sealed / coated': [['Sealer / coating', .08, 'coating'], ['Concrete slab', .39, 'concrete2'], ['Granular base', .26, 'gravel'], ['Subgrade', .25, 'soil']],
  'Concrete over vapor barrier':    [['Concrete slab', .38, 'concrete2'], ['Poly vapor sheet', .07, 'poly'], ['Granular base', .28, 'gravel'], ['Subgrade', .25, 'soil']],
  'Elevated concrete deck':         [['Concrete topping', .35, 'concrete2'], ['Steel deck', .18, 'deck'], ['Open below', .45, 'void']],
  'Wood / raised floor':            [['Plank decking', .21, 'wood'], ['Joists', .34, 'woodDark'], ['Crawl space', .43, 'void']],
}

/** Pattern id for the retarder sheet, by class. Custom borrows Class I's look. */
export const RETARDER_PATTERN: Record<string, string> = {
  'Class I': 'poly', 'Class II': 'kraft', 'Class III': 'film', Custom: 'poly',
}

/** Flat tone behind each pattern, for the legend chips. */
export const SWATCH: Record<string, string> = {
  metalRib: '#C9CDD2', metalFlat: '#DCDFE3', metalSeam: '#C4C9CF', foam: '#EADFC4',
  cmu: '#B9B7B0', cmuCore: '#A8A69F', concrete: '#C6C4BE', concrete2: '#BCBAB3',
  brick: '#A6503A', gypsum: '#EFEDE6', paint: '#F6F5F0', plywood: '#D6B583',
  wood: '#C09257', woodDark: '#9C7442', batt: '#DEBE35', void: '#EFEFEC',
  wrap: '#E4E7E2', membrane: '#4A4E52', deck: '#B4B9BE', tile: '#E8E7E0',
  gravel: '#B5B2AA', soil: '#9A8467', fabric: '#E6E4DC', coating: '#8FA3A8',
  poly: '#2E3338', kraft: '#B08A55', film: '#DCE8DF',
}

/**
 * The SVG <pattern> library, as markup.
 *
 * ⚠️ These are HEX LITERALS and deliberately NOT semantic tokens, which
 * DESIGN.md otherwise forbids in components. Brick is brick-coloured; a token
 * cannot express that, and re-toning the materials for dark mode would
 * misrepresent them. Same call the live step already makes for the cut-away
 * photos, which stay on white in dark mode. The CHROME around the drawing —
 * card, borders, type, pills — uses tokens like everything else.
 */
export function envelopePatternDefs(): string {
  const out: string[] = []
  const P = (id: string, w: number, h: number, body: string) =>
    out.push(`<pattern id="rfqp-${id}" width="${w}" height="${h}" patternUnits="userSpaceOnUse">${body}</pattern>`)
  const bg = (c: string) => `<rect width="100%" height="100%" fill="${c}"/>`

  P('brick', 25, 14, bg('#93462F')
    + `<g fill="#B2573C"><rect x=".7" y=".7" width="11.1" height="5.6" rx="1"/>`
    + `<rect x="13.2" y=".7" width="11.1" height="5.6" rx="1"/>`
    + `<rect x="-5.3" y="7.7" width="11.1" height="5.6" rx="1"/>`
    + `<rect x="7.2" y="7.7" width="11.1" height="5.6" rx="1"/>`
    + `<rect x="19.7" y="7.7" width="11.1" height="5.6" rx="1"/></g>`
    + `<g fill="#C36A4C" opacity=".45"><rect x=".7" y=".7" width="11.1" height="1.8" rx="1"/>`
    + `<rect x="13.2" y=".7" width="11.1" height="1.8" rx="1"/>`
    + `<rect x="7.2" y="7.7" width="11.1" height="1.8" rx="1"/></g>`)
  P('cmu', 32, 19, bg('#9B9992')
    + `<g fill="#BCBAB3"><rect x="1" y="1" width="29.5" height="7.2" rx="1"/>`
    + `<rect x="-14" y="10.2" width="29.5" height="7.2" rx="1"/>`
    + `<rect x="17" y="10.2" width="29.5" height="7.2" rx="1"/></g>`
    + `<g fill="#000" opacity=".055"><circle cx="8" cy="5" r="1.1"/><circle cx="21" cy="14" r="1.2"/>`
    + `<circle cx="26" cy="4" r=".9"/><circle cx="4" cy="14" r="1"/></g>`)
  P('cmuCore', 32, 19, bg('#8D8B84')
    + `<g fill="#A8A69F"><rect x="1" y="1" width="29.5" height="7.2" rx="1"/>`
    + `<rect x="-14" y="10.2" width="29.5" height="7.2" rx="1"/>`
    + `<rect x="17" y="10.2" width="29.5" height="7.2" rx="1"/></g>`
    + `<g fill="#6C6A64" opacity=".5"><rect x="5" y="2.5" width="9.5" height="4.2" rx="1"/>`
    + `<rect x="17" y="2.5" width="9.5" height="4.2" rx="1"/>`
    + `<rect x="21" y="11.7" width="9.5" height="4.2" rx="1"/>`
    + `<rect x="-1" y="11.7" width="9.5" height="4.2" rx="1"/></g>`)
  P('concrete', 21, 21, bg('#C6C4BE')
    + `<g fill="#ACAAA4" opacity=".75"><circle cx="4" cy="6" r="1.5"/><circle cx="14" cy="3" r="1.1"/>`
    + `<circle cx="17" cy="13" r="1.6"/><circle cx="8" cy="16" r="1.2"/>`
    + `<circle cx="19" cy="19" r=".9"/><circle cx="2" cy="18" r="1"/><circle cx="11" cy="10" r=".8"/></g>`)
  P('concrete2', 21, 21, bg('#BCBAB3')
    + `<g fill="#A2A099" opacity=".8"><circle cx="6" cy="4" r="1.8"/><circle cx="16" cy="8" r="1.3"/>`
    + `<circle cx="3" cy="13" r="1.5"/><circle cx="12" cy="18" r="1.7"/>`
    + `<circle cx="19" cy="16" r="1.1"/><circle cx="18" cy="2" r="1"/></g>`
    + `<g fill="#D2D0C9" opacity=".5"><circle cx="9" cy="8" r="1.2"/><circle cx="16" cy="20" r=".9"/></g>`)
  P('metalRib', 10, 10, bg('#C9CDD2')
    + `<rect width="3.8" height="10" fill="#DCE0E4"/><rect x="3.8" width="1.4" height="10" fill="#EDEFF2"/>`
    + `<rect x="7.9" width="2.1" height="10" fill="#A9AEB4"/>`)
  P('metalSeam', 19, 10, bg('#C4C9CF')
    + `<rect width="14" height="10" fill="#D5DAE0"/><rect x="14" width="2.5" height="10" fill="#EDF0F3"/>`
    + `<rect x="16.5" width="2.5" height="10" fill="#9EA4AB"/>`)
  P('metalFlat', 13, 13, bg('#DCDFE3')
    + `<rect width="13" height="1" fill="#C8CCD1"/><rect y="6.5" width="13" height=".7" fill="#EBEDF0"/>`)
  P('deck', 15, 15, bg('#B4B9BE')
    + `<rect width="6.5" height="15" fill="#CBD0D5"/><rect x="6.5" width="1.9" height="15" fill="#E2E6EA"/>`
    + `<rect x="11.8" width="3.2" height="15" fill="#9AA0A6"/>`)
  P('foam', 14, 14, bg('#EADFC4')
    + `<g fill="#D9C9A4" opacity=".85"><circle cx="3" cy="3" r="1.7"/><circle cx="9.5" cy="6" r="1.8"/>`
    + `<circle cx="6" cy="11" r="1.6"/><circle cx="12.5" cy="11.5" r="1.3"/>`
    + `<circle cx="1" cy="9" r="1.1"/><circle cx="12" cy="1" r="1.1"/></g>`
    + `<g fill="#F5EEDC" opacity=".7"><circle cx="7" cy="2" r="1"/><circle cx="2" cy="12.5" r="1"/></g>`)
  P('batt', 16, 12, bg('#D6B32C')
    + `<path d="M0 3q4 -3 8 0t8 0" fill="none" stroke="#E9CD55" stroke-width="2.3"/>`
    + `<path d="M0 8q4 -3 8 0t8 0" fill="none" stroke="#F2DC80" stroke-width="1.9"/>`
    + `<g fill="#C0A020" opacity=".55"><circle cx="4" cy="10.8" r="1"/><circle cx="12" cy="5.6" r=".9"/></g>`)
  P('gypsum', 17, 17, bg('#EFEDE6')
    + `<g fill="#DFDCD2" opacity=".8"><circle cx="4" cy="5" r="1"/><circle cx="12" cy="10" r=".9"/>`
    + `<circle cx="8" cy="14" r=".8"/><circle cx="15" cy="3" r=".7"/></g>`)
  P('paint', 10, 10, bg('#F6F5F0') + `<rect width="10" height="1" fill="#E9E7E0"/>`)
  P('film', 10, 10, bg('#DCE8DF') + `<rect width="10" height="1.4" fill="#C2D8C9"/>`)
  P('coating', 10, 10, bg('#8FA3A8') + `<rect width="10" height="1.4" fill="#A6BABF"/>`)
  P('wrap', 12, 12, bg('#E4E7E2')
    + `<path d="M-2 12 L12 -2 M2 16 L16 2" stroke="#CDD2CB" stroke-width="1" fill="none"/>`)
  P('plywood', 22, 11, bg('#D6B583')
    + `<g stroke="#C09F6C" stroke-width="1.1" fill="none">`
    + `<path d="M0 3q5.5 -2 11 0t11 0"/><path d="M0 8q5.5 2 11 0t11 0"/></g>`
    + `<path d="M0 10.5h22" stroke="#A98551" stroke-width="1.1"/>`)
  P('wood', 21, 12, bg('#C09257')
    + `<path d="M0 0h21" stroke="#A57A43" stroke-width="1.3"/>`
    + `<g stroke="#CDA268" stroke-width="1" fill="none">`
    + `<path d="M0 4.6q5.2 -1.7 10.5 0t10.5 0"/><path d="M0 8.8q5.2 1.5 10.5 0t10.5 0"/></g>`)
  P('woodDark', 21, 12, bg('#9C7442')
    + `<path d="M0 0h21" stroke="#7E5C33" stroke-width="1.3"/>`
    + `<g stroke="#B08A55" stroke-width="1" fill="none"><path d="M0 5q5.2 -1.7 10.5 0t10.5 0"/></g>`)
  P('tile', 19, 19, bg('#E8E7E0')
    + `<rect width="19" height="1" fill="#D6D4CB"/><rect width="1" height="19" fill="#D6D4CB"/>`
    + `<g fill="#CFCDC3" opacity=".7"><circle cx="6" cy="7" r=".9"/><circle cx="13" cy="12" r=".8"/>`
    + `<circle cx="9" cy="16" r=".7"/><circle cx="15" cy="5" r=".7"/></g>`)
  P('fabric', 9, 9, bg('#E6E4DC')
    + `<path d="M0 0h9M0 4.5h9" stroke="#D3D0C6" stroke-width=".9"/>`
    + `<path d="M0 0v9M4.5 0v9" stroke="#DAD7CE" stroke-width=".9"/>`)
  P('membrane', 13, 13, bg('#4A4E52')
    + `<g fill="#5C6165" opacity=".9"><circle cx="3" cy="4" r="1.2"/><circle cx="9" cy="9" r="1"/>`
    + `<circle cx="6" cy="12" r=".8"/></g>`)
  P('gravel', 17, 17, bg('#B5B2AA')
    + `<g fill="#98958D"><circle cx="4" cy="4" r="2.2"/><circle cx="12" cy="7" r="2.4"/>`
    + `<circle cx="7" cy="13" r="2"/><circle cx="15" cy="14" r="1.7"/>`
    + `<circle cx="15" cy="2" r="1.4"/><circle cx="1" cy="11" r="1.5"/></g>`
    + `<g fill="#CBC8C0" opacity=".7"><circle cx="9" cy="3" r="1.1"/><circle cx="3" cy="16" r="1"/></g>`)
  P('soil', 15, 15, bg('#9A8467')
    + `<g fill="#836F55"><circle cx="3" cy="5" r="1.9"/><circle cx="11" cy="3" r="1.5"/>`
    + `<circle cx="12" cy="11" r="2"/><circle cx="5" cy="12" r="1.7"/></g>`
    + `<g fill="#AD9878" opacity=".8"><circle cx="8" cy="8" r="1.2"/><circle cx="14" cy="6" r=".9"/></g>`)
  P('poly', 8, 8, bg('#2E3338') + `<rect width="8" height="1.6" fill="#454B52"/>`)
  P('kraft', 11, 11, bg('#B08A55') + `<path d="M0 4h11M0 8.5h11" stroke="#9C7847" stroke-width=".9"/>`)
  P('void', 12, 12, bg('#F1F1EE')
    + `<path d="M-2 12 L12 -2" stroke="#E2E2DD" stroke-width="1" fill="none"/>`)

  return out.join('')
}
