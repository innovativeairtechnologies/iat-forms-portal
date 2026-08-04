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
 * Desiccant-wheel types.
 *
 * `depthMm` is REAL, taken from DryWare's rotor catalog: it offers 100 / 200 / 400 mm
 * depths, and every standard IAT unit ships a 200 mm rotor. A "high-capacity" wheel is
 * therefore a **400 mm rotor** — double the depth, so roughly double the air-to-desiccant
 * contact time. That is the physical reason HC dries deeper; it was previously modelled
 * here as an abstract efficiency bump.
 *
 * ⚠️ `removalFraction` / `floorGrains` are still PLANNING figures. DryWare's product API
 * gives geometry (diameter, depth, effective area) but NOT performance curves — grain
 * depression vs. entering condition vs. reactivation temperature vs. RPH still lives in
 * the wheel calculator and engineering's selection charts. Every Sizing Studio output is
 * therefore still stamped "Preliminary" (see lib/sizing.ts).
 *
 * When the real curves land, replace these two numbers with a proper lookup; the rest of
 * the engine keeps working unchanged.
 */
export type WheelSpec = {
  type: WheelType
  label: string
  /** Rotor depth, mm — real, from the DryWare rotor catalog. */
  depthMm: number
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
    label: 'Standard wheel (200 mm)',
    depthMm: 200,
    removalFraction: 0.8,
    floorGrains: 3,
    segment: '',
  },
  'high-capacity': {
    type: 'high-capacity',
    label: 'High-capacity wheel (400 mm, HC)',
    depthMm: 400,
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
  /** Base model number as it appears in DryWare, e.g. `IAT-3000`. */
  model: string
  /** Nominal (catalog) airflow in CFM — DryWare's `numericQualifier`. */
  nominalCfm: number
  /** Desiccant wheel diameter, mm. */
  wheelDiameterMm: number
  /** Wheel depth, mm. 200 on every standard unit; an HC build swaps in a 400 mm rotor. */
  wheelDepthMm: number
  /** Effective wheel face area, ft² — DryWare's own figure, NOT derived from diameter. */
  effectiveAreaFt2: number
  /** Series this size is offered in. Compacts top out at 600; rotors start there. */
  series: SeriesKey[]
}

/**
 * The real IAT product line, transcribed from DryWare's product API
 * (`/api/Product/getProductsForProductType?id=4`) on 2026-07-28 — the same catalog the
 * DryWare wheel calculator matches against. Ascending by CFM; selection relies on it.
 *
 * ⚠️ There is **no 25,000 CFM product**. An earlier version of this file carried one,
 * taken from the size list on the 2022 nomenclature sheet, and flagged it "build to
 * order". The product data has 13 CFM values / 14 SKUs (600 ships as both `IAT-600` and
 * `IAT-600REC`, same geometry), and 25,000 is not among them. A ~22,000 CFM job
 * correctly selects the 30,000 unit.
 *
 * Keep this in sync with `scripts/kb-reference/iat-unit-nomenclature.md` (prose, for
 * Jerry) — and prefer the API over the nomenclature sheet where they disagree, because
 * the sheet lists *nomenclature* sizes, not shipping products.
 */
export const CATALOG_SIZES: CatalogSize[] = [
  { model: 'IAT-75REC', nominalCfm: 75, wheelDiameterMm: 220, wheelDepthMm: 100, effectiveAreaFt2: 0.38, series: ['compact', 'idp'] },
  { model: 'IAT-150REC', nominalCfm: 150, wheelDiameterMm: 320, wheelDepthMm: 100, effectiveAreaFt2: 0.828, series: ['compact', 'idp'] },
  { model: 'IAT-300REC', nominalCfm: 300, wheelDiameterMm: 320, wheelDepthMm: 200, effectiveAreaFt2: 0.828, series: ['compact', 'idp'] },
  { model: 'IAT-600', nominalCfm: 600, wheelDiameterMm: 440, wheelDepthMm: 200, effectiveAreaFt2: 1.591, series: ['compact', 'rotor', 'idp'] },
  { model: 'IAT-1000', nominalCfm: 1000, wheelDiameterMm: 550, wheelDepthMm: 200, effectiveAreaFt2: 2.504, series: ['rotor', 'idp'] },
  { model: 'IAT-1500', nominalCfm: 1500, wheelDiameterMm: 660, wheelDepthMm: 200, effectiveAreaFt2: 3.623, series: ['rotor', 'idp'] },
  { model: 'IAT-3000', nominalCfm: 3000, wheelDiameterMm: 965, wheelDepthMm: 200, effectiveAreaFt2: 7.298, series: ['rotor', 'idp'] },
  { model: 'IAT-5000', nominalCfm: 5000, wheelDiameterMm: 1220, wheelDepthMm: 200, effectiveAreaFt2: 11.866, series: ['rotor', 'idp'] },
  { model: 'IAT-7500', nominalCfm: 7500, wheelDiameterMm: 1525, wheelDepthMm: 200, effectiveAreaFt2: 18.717, series: ['rotor', 'idp'] },
  { model: 'IAT-10000', nominalCfm: 10000, wheelDiameterMm: 1730, wheelDepthMm: 200, effectiveAreaFt2: 23.328, series: ['rotor', 'idp'] },
  { model: 'IAT-15000', nominalCfm: 15000, wheelDiameterMm: 2190, wheelDepthMm: 200, effectiveAreaFt2: 36.938, series: ['rotor', 'idp'] },
  { model: 'IAT-20000', nominalCfm: 20000, wheelDiameterMm: 2438, wheelDepthMm: 200, effectiveAreaFt2: 46.179, series: ['rotor', 'idp'] },
  { model: 'IAT-30000', nominalCfm: 30000, wheelDiameterMm: 3050, wheelDepthMm: 200, effectiveAreaFt2: 73.531, series: ['rotor', 'idp'] },
]

export const NOMINAL_CFM_SIZES: number[] = CATALOG_SIZES.map((s) => s.nominalCfm)

export const MIN_CATALOG_CFM = NOMINAL_CFM_SIZES[0]
export const MAX_CATALOG_CFM = NOMINAL_CFM_SIZES[NOMINAL_CFM_SIZES.length - 1]

// ─── Wheel face velocity ─────────────────────────────────────────────────────

/**
 * Fraction of the wheel face given to the process airstream. DryWare's wheel calculator
 * defaults to a 270° process / 90° reactivation split, i.e. three quarters of the face.
 */
export const PROCESS_SECTOR_FRACTION = 270 / 360

/**
 * Face velocity through the process sector, ft/min.
 *
 * This is the constraint that actually picks a wheel diameter: too fast and the air has
 * too little residence time in the desiccant (poor removal, high pressure drop).
 */
export function faceVelocityFpm(
  cfm: number,
  size: Pick<CatalogSize, 'effectiveAreaFt2'>,
  sectorFraction: number = PROCESS_SECTOR_FRACTION,
): number {
  const area = size.effectiveAreaFt2 * sectorFraction
  return area > 0 ? cfm / area : 0
}

/**
 * Design ceiling on process face velocity, ft/min — DERIVED from the catalog above
 * rather than assumed: every unit from 1,000 CFM up sits in a tight 530–580 fpm band at
 * its nominal airflow (the compacts deliberately run slower, 240–500). 600 fpm is the
 * top of that observed band, so exceeding it means the job is pushing a unit past how
 * IAT actually rates it.
 */
export const MAX_DESIGN_FACE_VELOCITY_FPM = 600

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
