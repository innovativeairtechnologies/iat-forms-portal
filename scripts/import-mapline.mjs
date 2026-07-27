/**
 * IAT Forms Portal — one-off Mapline → territory-map import (migration 068).
 *
 * Usage:
 *   node scripts/import-mapline.mjs <mapline-export.csv> <curated.json>            # dry-run (default)
 *   node scripts/import-mapline.mjs <mapline-export.csv> <curated.json> --apply    # write to DB
 *   ... --apply --geocode   # also geocode pins (city-level, Nominatim, ~1 req/s)
 *
 * The CSV and the curated JSON are DATA and must never be committed — this repo
 * is PUBLIC. This script is generic; everything business-specific (firm renames,
 * territory assignments derived from the sheet's free-text notes, note
 * overrides) lives in the curated JSON, which stays local.
 *
 * Curated JSON shape:
 *   {
 *     "rename":        { "<raw sheet name>": "<canonical display name>", ... },
 *     "territories":   { "<canonical>": [ { "level": "state|province|county",
 *                                           "code": "TX|ON|36001",
 *                                           "exclusivity": "Yes, ..." | null } ] },
 *     "noteOverrides": { "<canonical>": "note text stored instead of the sheet note" }
 *   }
 *   Firms absent from "territories" default to one state/province assignment
 *   for each office's state, exclusivity from the sheet column.
 *
 * Idempotent: companies find-or-create by normalized_name; territories and
 * locations are skipped when an equal row already exists. Requires .env.local
 * with NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY (clear-demo.mjs
 * pattern). Geocoding sends ONLY city/region/postal/country (never street).
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const args = process.argv.slice(2)
const csvPath = args[0]
const curatedPath = args[1]
const APPLY = args.includes('--apply')
const GEOCODE = args.includes('--geocode')
if (!csvPath || !curatedPath) {
  console.error('usage: node scripts/import-mapline.mjs <csv> <curated.json> [--apply] [--geocode]')
  process.exit(1)
}

const env = Object.fromEntries(
  readFileSync(resolve(__dirname, '../.env.local'), 'utf8')
    .split('\n').filter((l) => l.includes('=') && !l.startsWith('#'))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()] })
)
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

// ── Kept in sync with lib/crm-normalize.ts normalizeCompany() (TS, can't import
//    from .mjs). If that changes, change this — divergent normalizers = dupes.
const LEGAL_SUFFIXES = new Set(['inc', 'incorporated', 'llc', 'corp', 'corporation', 'co', 'company', 'ltd', 'limited', 'lp', 'llp', 'pllc', 'pc'])
function normalizeCompany(raw) {
  const trimmed = raw.trim()
  const paren = trimmed.match(/^(.*\S)\s*\(([^)]*)\)\s*$/)
  const base = paren ? paren[1].trim() : trimmed
  const tokens = base.toLowerCase().replace(/&/g, ' and ').replace(/[.,'’"`!/\\\-_+#:;]+/g, ' ').split(/\s+/).filter(Boolean)
  if (tokens.length > 1 && tokens[0] === 'the') tokens.shift()
  while (tokens.length > 1 && LEGAL_SUFFIXES.has(tokens[tokens.length - 1])) tokens.pop()
  return { base, normalized: tokens.join(' ') || trimmed.toLowerCase() }
}

// Kept in sync with lib/territories.ts MAP_PALETTE.
const MAP_PALETTE = ['#0ea5e9', '#8b5cf6', '#10b981', '#f59e0b', '#f43f5e', '#14b8a6', '#6366f1', '#ec4899', '#84cc16', '#f97316', '#06b6d4', '#d946ef']
const CA_PROVINCE_BY_NAME = {
  alberta: 'AB', 'british columbia': 'BC', manitoba: 'MB', 'new brunswick': 'NB',
  'newfoundland and labrador': 'NL', 'nova scotia': 'NS', 'northwest territories': 'NT',
  nunavut: 'NU', ontario: 'ON', 'prince edward island': 'PE', quebec: 'QC', saskatchewan: 'SK', yukon: 'YT',
}
const US_STATE_BY_NAME = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', 'district of columbia': 'DC', florida: 'FL', georgia: 'GA',
  hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY',
  louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
  'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND',
  ohio: 'OH', oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI',
  'south carolina': 'SC', 'south dakota': 'SD', tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT',
  virginia: 'VA', washington: 'WA', 'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY',
}

// ── Tiny CSV parser (quoted fields, embedded commas/newlines) ────────────────
function parseCsv(text) {
  const rows = []
  let row = [], field = '', inQ = false
  for (let i = 0; i < text.length; i++) {
    const c = text[i]
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++ } else inQ = false }
      else field += c
    } else if (c === '"') inQ = true
    else if (c === ',') { row.push(field); field = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++
      row.push(field); field = ''
      rows.push(row); row = []
    } else field += c
  }
  if (field !== '' || row.length) { row.push(field); rows.push(row) }
  return rows
}

// ── Parse the sheet ──────────────────────────────────────────────────────────
const curated = JSON.parse(readFileSync(curatedPath, 'utf8'))
const raw = parseCsv(readFileSync(csvPath, 'utf8'))
const header = raw[0].map((h) => h.trim().toLowerCase())
const col = (name) => header.findIndex((h) => h.startsWith(name))
const C = {
  name: col('customer'), excl: col('exclusive'), street: col('street'), city: col('city'),
  state: col('state'), zip: col('zip'), county: col('county'), notes: col('notes'), date: col('date'),
}

const firms = new Map() // canonical -> { exclDefault, notes:Set, locations:Map, website }
for (const r of raw.slice(1)) {
  const rawName = (r[C.name] ?? '').trim()
  if (!rawName) continue
  const canonical = (curated.rename?.[rawName] ?? rawName).trim()
  let f = firms.get(canonical)
  if (!f) { f = { exclDefault: null, notes: new Set(), locations: new Map(), website: null }; firms.set(canonical, f) }

  const excl = (r[C.excl] ?? '').trim()
  if (excl && !f.exclDefault) f.exclDefault = excl

  const note = (r[C.notes] ?? '').trim().replace(/,\s*$/, '')
  if (note) f.notes.add(note)
  // A URL anywhere in the unnamed trailing columns = the firm's website.
  for (const cell of r) if (/^https?:\/\//.test((cell ?? '').trim()) && !f.website) f.website = cell.trim()

  const street = (r[C.street] ?? '').trim()
  const city = (r[C.city] ?? '').trim()
  const stateName = (r[C.state] ?? '').trim()
  const postal = (r[C.zip] ?? '').trim()
  if (city || street) {
    const country = CA_PROVINCE_BY_NAME[stateName.toLowerCase()] ? 'CA' : 'US'
    const key = `${street.toLowerCase().replace(/\s+/g, ' ')}|${city.toLowerCase()}`
    if (!f.locations.has(key)) {
      f.locations.set(key, { label: city || 'Office', address: street || null, city: city || null, region: stateName || null, postal: postal || null, country })
    }
  }
}

// Territories: curated wins; fallback = one assignment per office state/province.
function territoriesFor(canonical, f) {
  const cur = curated.territories?.[canonical]
  if (cur) return cur
  const out = new Map()
  for (const loc of f.locations.values()) {
    const nm = (loc.region ?? '').toLowerCase()
    const prov = CA_PROVINCE_BY_NAME[nm]
    const st = US_STATE_BY_NAME[nm]
    if (prov) out.set(`province|${prov}`, { level: 'province', code: prov, exclusivity: f.exclDefault })
    else if (st) out.set(`state|${st}`, { level: 'state', code: st, exclusivity: f.exclDefault })
  }
  return [...out.values()]
}

// ── Dry-run report ───────────────────────────────────────────────────────────
let totalTerr = 0, totalLoc = 0
console.log(`\n=== Mapline import plan — ${firms.size} rep firms ===\n`)
for (const [name, f] of [...firms.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
  const terr = territoriesFor(name, f)
  totalTerr += terr.length; totalLoc += f.locations.size
  const note = curated.noteOverrides?.[name] ?? [...f.notes].join('; ')
  console.log(`• ${name}${curated.territories?.[name] ? '' : '  [fallback: office state]'}`)
  console.log(`    territories: ${terr.map((t) => t.code + (t.level === 'county' ? '(cty)' : '')).join(', ') || '(none)'}`)
  console.log(`    locations:   ${[...f.locations.values()].map((l) => l.city ?? l.address).join(' / ')}`)
  if (note) console.log(`    notes:       ${note.slice(0, 110)}${note.length > 110 ? '…' : ''}`)
}
console.log(`\nTotals: ${firms.size} firms, ${totalTerr} territory assignments, ${totalLoc} locations`)

// Collision check against existing companies (any kind).
const { data: existing } = await sb.from('companies').select('id, name, normalized_name, kind, map_color, website, notes')
const byNorm = new Map((existing ?? []).map((c) => [c.normalized_name, c]))
for (const name of firms.keys()) {
  const hit = byNorm.get(normalizeCompany(name).normalized)
  if (hit && hit.kind !== 'rep_firm') {
    console.log(`\n⚠ "${name}" collides with existing ${hit.kind} company "${hit.name}" — rename it in curated.rename or resolve manually. SKIPPING this firm on --apply.`)
  } else if (hit) {
    console.log(`\n(i) "${name}" already exists as a rep_firm — territories/locations will be added idempotently.`)
  }
}

if (!APPLY) { console.log('\nDry run only — pass --apply to write.'); process.exit(0) }

// ── Apply ────────────────────────────────────────────────────────────────────
console.log('\n=== Applying ===')
const colorCounts = new Map()
for (const c of existing ?? []) if (c.map_color) colorCounts.set(c.map_color, (colorCounts.get(c.map_color) ?? 0) + 1)
const nextColor = () => {
  let best = MAP_PALETTE[0], bestN = Infinity
  for (const c of MAP_PALETTE) { const n = colorCounts.get(c) ?? 0; if (n < bestN) { best = c; bestN = n } }
  colorCounts.set(best, (colorCounts.get(best) ?? 0) + 1)
  return best
}

let created = 0, terrIns = 0, locIns = 0, skipped = 0
const geocodeQueue = []
for (const [name, f] of firms.entries()) {
  const { normalized } = normalizeCompany(name)
  let company = byNorm.get(normalized)
  if (company && company.kind !== 'rep_firm') { skipped++; continue }

  const note = curated.noteOverrides?.[name] ?? ([...f.notes].join('; ') || null)
  if (!company) {
    const { data, error } = await sb.from('companies').insert({
      name, normalized_name: normalized, kind: 'rep_firm',
      website: f.website, notes: note, map_color: nextColor(),
    }).select('*').single()
    if (error) { console.error(`  ✗ create ${name}: ${error.message}`); continue }
    company = data; created++
  } else if (!company.map_color) {
    await sb.from('companies').update({ map_color: nextColor() }).eq('id', company.id)
  }

  const { data: existingTerr } = await sb.from('company_territories').select('level, code').eq('company_id', company.id)
  const have = new Set((existingTerr ?? []).map((t) => `${t.level}|${t.code}`))
  for (const t of territoriesFor(name, f)) {
    if (have.has(`${t.level}|${t.code}`)) continue
    const { error } = await sb.from('company_territories').insert({
      company_id: company.id, level: t.level, code: String(t.code), exclusivity: t.exclusivity ?? f.exclDefault ?? null,
    })
    if (error) console.error(`  ✗ terr ${name} ${t.code}: ${error.message}`)
    else terrIns++
  }

  const { data: existingLocs } = await sb.from('company_locations').select('id, address, city, lat, lng').eq('company_id', company.id)
  for (const loc of f.locations.values()) {
    const dupe = (existingLocs ?? []).find((l) =>
      (l.address ?? '').toLowerCase() === (loc.address ?? '').toLowerCase() && (l.city ?? '').toLowerCase() === (loc.city ?? '').toLowerCase())
    if (dupe) { if (dupe.lat == null && GEOCODE) geocodeQueue.push({ id: dupe.id, ...loc, firm: name }); continue }
    const { data, error } = await sb.from('company_locations').insert({ company_id: company.id, ...loc }).select('id').single()
    if (error) console.error(`  ✗ loc ${name} ${loc.city}: ${error.message}`)
    else { locIns++; if (GEOCODE) geocodeQueue.push({ id: data.id, ...loc, firm: name }) }
  }
}
console.log(`companies created: ${created} (skipped on collision: ${skipped}), territories inserted: ${terrIns}, locations inserted: ${locIns}`)

// ── Geocode (city-level only — never the street address) ─────────────────────
if (GEOCODE && geocodeQueue.length) {
  console.log(`\n=== Geocoding ${geocodeQueue.length} pins via Nominatim (city-level, ~1 req/s) ===`)
  const UA = 'IAT-Portal/1.0 (one-time territory-map import; jacob.younker@dehumidifiers.com)'
  for (const loc of geocodeQueue) {
    const q = [loc.city, loc.region, loc.postal, loc.country === 'CA' ? 'Canada' : 'USA'].filter(Boolean).join(', ')
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=${encodeURIComponent(q)}`, { headers: { 'User-Agent': UA } })
      const json = await res.json()
      if (Array.isArray(json) && json[0]) {
        await sb.from('company_locations').update({ lat: Number(json[0].lat), lng: Number(json[0].lon) }).eq('id', loc.id)
        console.log(`  ✓ ${loc.firm} — ${q} → ${Number(json[0].lat).toFixed(3)}, ${Number(json[0].lon).toFixed(3)}`)
      } else {
        console.log(`  ? no result for ${q} — place manually in the UI`)
      }
    } catch (e) {
      console.log(`  ✗ ${q}: ${e.message}`)
    }
    await new Promise((r) => setTimeout(r, 1200))
  }
}
console.log('\ndone.')
