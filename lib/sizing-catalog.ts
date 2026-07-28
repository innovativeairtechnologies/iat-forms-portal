/* IAT product catalog — the typed source of truth for unit sizes, reactivation
 * options, wheel types, and the model-number grammar.
 *
 * Transcribed from `scripts/kb-reference/iat-unit-nomenclature.md` (the 2022 IAT
 * "Unit Nomenclature" sheet). That file is prose for Jerry's RAG pool; this file is
 * the machine-readable form the Sizing Studio selects against and the model-number
 * builder/parser work from.
 *
 * Keep the two in sync. If the lineup changes, edit BOTH — the .md so Jerry answers
 * correctly, and this file so sizing selects correctly.
 *
 * Model-number grammar:
 *   IAT-<nominalCFM><system><reactivation>[HC][C][-IDP][-<actualCFM>]
 *   e.g. IAT-600REHC/IDP-450 — nominal 600 CFM, Rotor, Electric reactivation,
 *        High-Capacity wheel, IDP package, actually moving 450 CFM.
 */

// ─── Reactivation ────────────────────────────────────────────────────────────

/** How the desiccant wheel is regenerated. */
export type ReactivationCode = 'E' | 'S' | 'G' | 'HW'

export type ReactivationType = {
  code: ReactivationCode
  label: string
  /** Short note shown under the option in the Studio. */
  note: string
}

export const REACTIVATION_TYPES: ReactivationType[] = [
  { code: 'E', label: 'Electric', note: 'Simplest install; highest operating cost per BTU.' },
  { code: 'G', label: 'Gas', note: 'Lowest operating cost at scale; needs gas service and venting.' },
  { code: 'S', label: 'Steam', note: 'Suits plants with existing steam; capped by available steam temp.' },
  { code: 'HW', label: 'Hot Water', note: 'Lowest reactivation temperature — limits achievable dry-side grains.' },
]

export function reactivationLabel(code: ReactivationCode): string {
  return REACTIVATION_TYPES.find((r) => r.code === code)?.label ?? code
}

// ─── System type ─────────────────────────────────────────────────────────────

/** `D` (Drum) and `B` (Bed) exist in the nomenclature but are obsolete — parse-only. */
export type SystemTypeCode = 'R' | 'AHU' | 'D' | 'B'

export const SYSTEM_TYPES: { code: SystemTypeCode; label: string; obsolete?: boolean }[] = [
  { code: 'R', label: 'Rotor' },
  { code: 'AHU', label: 'Air Handling Unit' },
  { code: 'D', label: 'Drum', obsolete: true },
  { code: 'B', label: 'Bed', obsolete: true },
]

// ─── Wheel type ──────────────────────────────────────────────────────────────

export type WheelType = 'standard' | 'high-capacity'

/**
 * Preliminary desiccant-wheel performance coefficients.
 *
 * ⚠️ These are PLANNING figures, not published rotor curves. IAT's real performance
 * data (grain depression vs. entering condition vs. reactivation temperature vs. wheel
 * RPM) lives in the DryWare calculator and engineering's wheel selection charts, and
 * is not yet in this repo. Every Sizing Studio output is therefore stamped
 * "Preliminary — engineering confirms rotor performance" (see lib/sizing.ts).
 *
 * When engineering supplies the real curves, replace `removalFraction` / `floorGrains`
 * with a proper lookup and the rest of the engine keeps working unchanged.
 */
export type WheelSpec = {
  type: WheelType
  label: string
  /** Fraction of entering moisture a wheel of this type removes at design reactivation. */
  removalFraction: number
  /** Practical floor on leaving-air grains, regardless of how wet the entering air is. */
  floorGrains: number
  /** Model-number segment (`HC`), empty for a standard wheel. */
  segment: string
}

export const WHEEL_SPECS: Record<WheelType, WheelSpec> = {
  standard: {
    type: 'standard',
    label: 'Standard wheel',
    removalFraction: 0.8,
    floorGrains: 3,
    segment: '',
  },
  'high-capacity': {
    type: 'high-capacity',
    label: 'High-capacity wheel (HC)',
    removalFraction: 0.9,
    floorGrains: 1.5,
    segment: 'HC',
  },
}

// ─── Series & nominal sizes ──────────────────────────────────────────────────

export type SeriesKey = 'compact' | 'rotor' | 'idp'

export const SERIES: { key: SeriesKey; label: string; blurb: string }[] = [
  {
    key: 'compact',
    label: 'Compact',
    blurb: 'Small packaged rotor units, designated REC (Rotor / Electric / Compact).',
  },
  {
    key: 'rotor',
    label: 'Rotor',
    blurb: 'Standard rotor dehumidifiers, sized by nominal CFM.',
  },
  {
    key: 'idp',
    label: 'IDP',
    blurb:
      'Integrated Dehumidification Package — any Compact or Rotor unit customised with integrated components (pre-cooling, post-cooling, heating, filtration).',
  },
]

export type CatalogSize = {
  /** Nominal (catalog) airflow in CFM — the number that appears in the model number. */
  nominalCfm: number
  /** Series this size is offered in. Compacts top out at 600; rotors start there. */
  series: SeriesKey[]
  /**
   * Whether this size appears in the current standard rotor lineup. 25,000 CFM is a
   * valid nominal size on the nomenclature sheet but is NOT in the lineup IAT
   * leadership listed, so the Studio flags it as a build-to-order size.
   */
  standardLineup: boolean
}

/** Nominal CFM catalog sizes, per the nomenclature sheet. Ascending — selection relies on it. */
export const CATALOG_SIZES: CatalogSize[] = [
  { nominalCfm: 75, series: ['compact', 'idp'], standardLineup: true },
  { nominalCfm: 150, series: ['compact', 'idp'], standardLineup: true },
  { nominalCfm: 300, series: ['compact', 'idp'], standardLineup: true },
  { nominalCfm: 600, series: ['compact', 'rotor', 'idp'], standardLineup: true },
  { nominalCfm: 1000, series: ['rotor', 'idp'], standardLineup: true },
  { nominalCfm: 1500, series: ['rotor', 'idp'], standardLineup: true },
  { nominalCfm: 3000, series: ['rotor', 'idp'], standardLineup: true },
  { nominalCfm: 5000, series: ['rotor', 'idp'], standardLineup: true },
  { nominalCfm: 7500, series: ['rotor', 'idp'], standardLineup: true },
  { nominalCfm: 10000, series: ['rotor', 'idp'], standardLineup: true },
  { nominalCfm: 15000, series: ['rotor', 'idp'], standardLineup: true },
  { nominalCfm: 20000, series: ['rotor', 'idp'], standardLineup: true },
  // On the nomenclature sheet's size list, but absent from the standard rotor lineup.
  { nominalCfm: 25000, series: ['rotor', 'idp'], standardLineup: false },
  { nominalCfm: 30000, series: ['rotor', 'idp'], standardLineup: true },
]

export const NOMINAL_CFM_SIZES: number[] = CATALOG_SIZES.map((s) => s.nominalCfm)

export const MIN_CATALOG_CFM = NOMINAL_CFM_SIZES[0]
export const MAX_CATALOG_CFM = NOMINAL_CFM_SIZES[NOMINAL_CFM_SIZES.length - 1]

/**
 * Smallest catalog size that covers `requiredCfm`, or null if the requirement
 * exceeds the largest single unit (the caller then proposes multiple units).
 */
export function selectNominalSize(requiredCfm: number): CatalogSize | null {
  return CATALOG_SIZES.find((s) => s.nominalCfm >= requiredCfm) ?? null
}

/** Compacts are the 75–600 CFM packaged units. */
export function isCompactSize(nominalCfm: number): boolean {
  return CATALOG_SIZES.some((s) => s.nominalCfm === nominalCfm && s.series.includes('compact'))
}

// ─── Model-number builder & parser ───────────────────────────────────────────

export type ModelSpec = {
  nominalCfm: number
  system: SystemTypeCode
  reactivation: ReactivationCode
  wheel: WheelType
  /** Compact series (`C` segment). Only valid on 75–600. */
  compact?: boolean
  /** Integrated Dehumidification Package. */
  idp?: boolean
  /** Actual airflow, emitted only when it differs from the nominal size. */
  actualCfm?: number
}

/**
 * Compose an IAT model number from a spec.
 * Segment order follows the nomenclature sheet's worked example IAT-600REHC/IDP-450:
 * CFM → system → reactivation → HC → C → IDP → actual CFM.
 */
export function buildModelNumber(spec: ModelSpec): string {
  const wheel = WHEEL_SPECS[spec.wheel].segment
  const compact = spec.compact ? 'C' : ''
  const idp = spec.idp ? '-IDP' : ''
  const actual =
    spec.actualCfm && spec.actualCfm !== spec.nominalCfm ? `-${spec.actualCfm}` : ''
  return `IAT-${spec.nominalCfm}${spec.system}${spec.reactivation}${wheel}${compact}${idp}${actual}`
}

export type ParsedModel = ModelSpec & { raw: string; valid: boolean }

// `HW` must precede the single letters so it isn't split into H + W, and `HC`
// must be tried before the bare compact `C`.
const MODEL_RE =
  /^IAT-(\d+)(AHU|R|D|B)?(HW|E|S|G)?(HC)?(C)?(?:[/-]IDP)?(?:-(\d+))?$/i

/**
 * Decode an IAT model number into its parts. Returns `valid: false` (with whatever
 * could be read) rather than throwing, so callers can show a soft warning — model
 * numbers arrive from customers and tickets and are frequently mistyped.
 *
 * Useful beyond the Sizing Studio: the equipment registry stores `model_number` as
 * free text, so this can decode installed-base records too.
 */
export function parseModelNumber(raw: string): ParsedModel {
  const trimmed = raw.trim().replace(/\s+/g, '')
  const m = MODEL_RE.exec(trimmed)
  const idp = /[/-]IDP/i.test(trimmed)

  if (!m) {
    return {
      raw,
      valid: false,
      nominalCfm: 0,
      system: 'R',
      reactivation: 'E',
      wheel: 'standard',
      idp,
    }
  }

  const [, cfm, system, react, hc, compact, actual] = m
  return {
    raw,
    valid: true,
    nominalCfm: Number(cfm),
    system: (system?.toUpperCase() as SystemTypeCode) ?? 'R',
    reactivation: (react?.toUpperCase() as ReactivationCode) ?? 'E',
    wheel: hc ? 'high-capacity' : 'standard',
    compact: !!compact,
    idp,
    actualCfm: actual ? Number(actual) : undefined,
  }
}

/** Plain-English breakdown of a model number, for tooltips and the results panel. */
export function describeModel(spec: ModelSpec): string[] {
  const parts: string[] = [`Nominal ${spec.nominalCfm.toLocaleString()} CFM`]
  const sys = SYSTEM_TYPES.find((s) => s.code === spec.system)
  if (sys) parts.push(sys.label + (sys.obsolete ? ' (obsolete)' : ''))
  parts.push(`${reactivationLabel(spec.reactivation)} reactivation`)
  if (spec.wheel === 'high-capacity') parts.push('High-capacity wheel')
  if (spec.compact) parts.push('Compact series')
  if (spec.idp) parts.push('Integrated Dehumidification Package')
  if (spec.actualCfm && spec.actualCfm !== spec.nominalCfm) {
    parts.push(`Actual airflow ${spec.actualCfm.toLocaleString()} CFM`)
  }
  return parts
}
