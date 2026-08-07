/* Colours for the HVAC/R 3D models and schematic diagrams.
 *
 * ⚠️ Deliberate DESIGN.md §2.1 exception, same precedent as
 * `components/customer/srv/UnitScene.tsx` and the `.cpco-*` LCD hex in
 * globals.css. Two reasons, both structural:
 *
 *   1. WebGL materials take numeric colours. A three.js `MeshStandardMaterial`
 *      cannot consume `var(--brand)`, so a token is not available at all.
 *   2. These hues carry physics, not brand. Blue is cold refrigerant and orange
 *      is hot refrigerant in every HVAC/R textbook and on every gauge set —
 *      re-toning them per theme, or collapsing them onto the single brand
 *      accent, would make the models teach the wrong thing.
 *
 * So this file is the whole exception, and it is the only place these values
 * live. Chrome around the models (frames, buttons, captions, result pills)
 * uses semantic tokens like everything else.
 */

/** three.js material colours (numeric literals). */
export const MODEL = {
  compressor: 0xd03b3b,
  condenser: 0xec835a,
  metering: 0x4a3aa7,
  evaporator: 0x1baf7a,

  hotGas: 0xec835a,
  warmLiquid: 0xeda100,
  coldMix: 0x2a78d6,
  coolVapor: 0x1baf7a,

  /** Flow particles — lighter so they read against the tube they ride. */
  particleHot: 0xffb199,
  particleWarm: 0xffd699,
  particleCold: 0x9ec5f4,
  particleCool: 0x9be8cf,

  steel: 0x898781,
  darkSteel: 0x383835,
  fin: 0xc3c2b7,
  glass: 0x9ec5f4,
  brass: 0xeda100,
} as const

/** `0x1baf7a` → `#1baf7a`, for legends and swatches in the DOM. */
export const cssHex = (n: number): string => `#${n.toString(16).padStart(6, '0')}`

/** Atom colours for the refrigerant molecule models. */
export const ELEMENT = {
  C: 0x555555,
  H: 0xdddddd,
  F: 0x1baf7a,
  Cl: 0xeda100,
  O: 0xd03b3b,
} as const

/** SVG schematic strokes/fills. CSS strings, not numbers.
 *
 *  These sit on a `--surface` card in both themes, so they are chosen to hold
 *  contrast on white and on the dark surface without switching. */
export const SVG = {
  compressor: '#d03b3b',
  condenser: '#ec835a',
  metering: '#4a3aa7',
  evaporator: '#1baf7a',
  wire: '#8a867c',
  wireLive: '#2a78d6',
  neutral: '#b3afa5',
} as const

/** Matching soft washes for the SVG blocks above. */
export const SVG_WASH = {
  compressor: 'rgba(208,59,59,.10)',
  condenser: 'rgba(236,131,90,.10)',
  metering: 'rgba(74,58,167,.10)',
  evaporator: 'rgba(27,175,122,.10)',
  cold: 'rgba(158,197,244,.25)',
  live: 'rgba(42,120,214,.15)',
} as const
