// ─────────────────────────────────────────────────────────────────────────────
// lib/territories.ts — shared config for the rep territory map (/admin/territories).
//
// Dependency-free and serializable (no maplibre imports) so it can be used by
// the server page, the API routes, AND the client map — the board-config.ts
// precedent. Geometry lives in public/geo/*.json (see scripts/build-geo.mjs);
// this file owns the codes, names, and colors those geometries key off.
// ─────────────────────────────────────────────────────────────────────────────

export const TERRITORY_LEVELS = ['state', 'province', 'county'] as const
export type TerritoryLevel = (typeof TERRITORY_LEVELS)[number]

// ── Fill palette ──────────────────────────────────────────────────────────────
// Stored per-firm in companies.map_color (068), auto-assigned least-used-first
// when a firm gets its first territory, overridable from the swatch picker.
// Same color language as the dashboard CATEGORICAL palette (sales-charts.tsx):
// Tailwind-500 tone hues — colorful on the muted positron/dark basemaps without
// going off-system. Hex is fine here: these are data-driven map fills (chart
// palette precedent), not component styling.
export const MAP_PALETTE = [
  '#0ea5e9', // sky
  '#8b5cf6', // violet
  '#10b981', // emerald
  '#f59e0b', // amber
  '#f43f5e', // rose
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#ec4899', // pink
  '#84cc16', // lime
  '#f97316', // orange
  '#06b6d4', // cyan
  '#d946ef', // fuchsia
] as const

/** Fill when >1 firm owns a territory (owners listed on click) or the firm has no color. */
export const SHARED_FILL = '#94a3b8' // slate-400

export function isMapColor(v: unknown): v is string {
  return typeof v === 'string' && (MAP_PALETTE as readonly string[]).includes(v)
}

/** The palette color used by the fewest of `used` (first wins ties). */
export function pickLeastUsedColor(used: (string | null | undefined)[]): string {
  const counts = new Map<string, number>()
  for (const c of used) if (c) counts.set(c, (counts.get(c) ?? 0) + 1)
  let best: string = MAP_PALETTE[0]
  let bestCount = Infinity
  for (const c of MAP_PALETTE) {
    const n = counts.get(c) ?? 0
    if (n < bestCount) { best = c; bestCount = n }
  }
  return best
}

// ── Geography codes ───────────────────────────────────────────────────────────
// company_territories.code: USPS state code, Canadian postal province code, or
// 5-digit county FIPS. These tables are the display-name + validation source;
// the matching geometries carry the same code in properties.code.

export const US_STATES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', DC: 'District of Columbia',
  FL: 'Florida', GA: 'Georgia', HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois',
  IN: 'Indiana', IA: 'Iowa', KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana',
  ME: 'Maine', MD: 'Maryland', MA: 'Massachusetts', MI: 'Michigan',
  MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri', MT: 'Montana',
  NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota',
  OH: 'Ohio', OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania',
  RI: 'Rhode Island', SC: 'South Carolina', SD: 'South Dakota', TN: 'Tennessee',
  TX: 'Texas', UT: 'Utah', VT: 'Vermont', VA: 'Virginia', WA: 'Washington',
  WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
}

export const CA_PROVINCES: Record<string, string> = {
  AB: 'Alberta', BC: 'British Columbia', MB: 'Manitoba', NB: 'New Brunswick',
  NL: 'Newfoundland and Labrador', NS: 'Nova Scotia', NT: 'Northwest Territories',
  NU: 'Nunavut', ON: 'Ontario', PE: 'Prince Edward Island', QC: 'Quebec',
  SK: 'Saskatchewan', YT: 'Yukon',
}

// County FIPS → owning state (first 2 digits). Needed to label counties
// ("Harris County, TX") and to scope county paint to the state being edited.
export const STATE_FIPS_TO_USPS: Record<string, string> = {
  '01': 'AL', '02': 'AK', '04': 'AZ', '05': 'AR', '06': 'CA', '08': 'CO',
  '09': 'CT', '10': 'DE', '11': 'DC', '12': 'FL', '13': 'GA', '15': 'HI',
  '16': 'ID', '17': 'IL', '18': 'IN', '19': 'IA', '20': 'KS', '21': 'KY',
  '22': 'LA', '23': 'ME', '24': 'MD', '25': 'MA', '26': 'MI', '27': 'MN',
  '28': 'MS', '29': 'MO', '30': 'MT', '31': 'NE', '32': 'NV', '33': 'NH',
  '34': 'NJ', '35': 'NM', '36': 'NY', '37': 'NC', '38': 'ND', '39': 'OH',
  '40': 'OK', '41': 'OR', '42': 'PA', '44': 'RI', '45': 'SC', '46': 'SD',
  '47': 'TN', '48': 'TX', '49': 'UT', '50': 'VT', '51': 'VA', '53': 'WA',
  '54': 'WV', '55': 'WI', '56': 'WY',
}

export function isValidTerritoryCode(level: TerritoryLevel, code: string): boolean {
  if (level === 'state') return code in US_STATES
  if (level === 'province') return code in CA_PROVINCES
  return /^\d{5}$/.test(code) && code.slice(0, 2) in STATE_FIPS_TO_USPS
}

/** Display name for a territory code. County names live in the geo file, so the
 *  caller passes what it knows; falls back to the bare FIPS. */
export function territoryLabel(level: TerritoryLevel, code: string, countyName?: string | null): string {
  if (level === 'state') return US_STATES[code] ?? code
  if (level === 'province') return CA_PROVINCES[code] ?? code
  const st = STATE_FIPS_TO_USPS[code.slice(0, 2)]
  return countyName ? `${countyName} County, ${st ?? '??'}` : `county ${code}${st ? ` (${st})` : ''}`
}

// ── Map fill expression ───────────────────────────────────────────────────────
/**
 * A maplibre `fill-color` match expression over feature `properties.code`:
 * sole owner → that firm's color, multiple owners → the neutral shared wash,
 * unassigned → transparent. Plain JSON (maplibre expressions are arrays), so
 * this stays engine-agnostic and testable.
 */
export function buildFillExpr(colorsByCode: Record<string, string[]>): unknown {
  const entries = Object.entries(colorsByCode)
  if (entries.length === 0) return 'rgba(0,0,0,0)'
  const expr: unknown[] = ['match', ['get', 'code']]
  for (const [code, colors] of entries) {
    expr.push(code, colors.length === 1 ? colors[0] : SHARED_FILL)
  }
  expr.push('rgba(0,0,0,0)')
  return expr
}
