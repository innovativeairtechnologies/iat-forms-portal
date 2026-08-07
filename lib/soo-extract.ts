// ─────────────────────────────────────────────────────────────────────────────
// lib/soo-extract.ts — reading a DryWare Sales Submittal into UnitFacts.
//
// Pure and dependency-free (types only from ./soo), so the API route, the
// browser and scripts/verify-soo-extract.mjs all use the same code path and the
// parsers can be tested against the real 45-page PDF with no network.
//
// ── The shape of the problem ────────────────────────────────────────────────
// The submittal is born-digital and its text layer is good, but it is three
// different documents stapled together, and only some of it is ours:
//
//   pp. 1        cover              identity
//   pp. 2–3      flow diagrams      IMAGES — 37 words each, header only.
//                                   NO FACT MAY COME FROM HERE.
//   p.  4        weather data       ASHRAE design conditions
//   p.  5        Features           bullets: media, controls, options
//   p.  6        Humidity Control   bullets: control basis, sensors, protocol
//   pp. 7–25     per-component      bullets, interleaved with vendor cut sheets
//   p.  26       Duct Connections   per-opening dampers  ← authoritative
//   p.  27       Static Pressure     the process train, in order
//   pp. 28–31    Schedule           flat key/value dump  ← authoritative
//   pp. 32–44    guide spec         13 pages of BOILERPLATE
//   p.  45       project flow chart
//
// ── Why the guide spec is dropped in code, not by prompting ─────────────────
// Section 23 84 19 is a generic master specification. It says things like
// "provide freezestat set at 35°F" and "Filters: MERV 8" for a hypothetical
// unit, not this one. Feeding it to a model and asking it to ignore those pages
// is asking it to resist thirteen pages of authoritative-sounding, wrong,
// on-topic text. Deleting them by regex is verifiable; a prompt is not.
//
// ── Why the Schedule parser matches LABELS, not positions ───────────────────
// Schedule lines are `Label Value` with no delimiter — "Desiccant Wheel Size
// 965 X 200", "Filter Efficiency (MERV) MERV 8". There is no reliable rule for
// where the label ends, so the parser matches against a known label set scoped
// by the current group heading. A line that matches nothing becomes an UNMAPPED
// entry surfaced in the UI, which is the early-warning signal for DryWare
// changing its output — rather than a plausible mis-split nobody notices.
// ─────────────────────────────────────────────────────────────────────────────

import {
  FACT_SPECS,
  blankFacts,
  type FactKey,
  type UnitFacts,
} from './soo'

// ─── Page classification ─────────────────────────────────────────────────────

export type PageKind =
  | 'cover'
  | 'flow-diagram'
  | 'weather'
  | 'features'
  | 'humidity-control'
  | 'component'
  | 'duct-connections'
  | 'static-pressure'
  | 'schedule'
  | 'guide-spec'
  | 'vendor'
  | 'project-flow'
  | 'unknown'

export type ClassifiedPage = { page: number; kind: PageKind; text: string }

/** Pages we read facts from. Everything else is dropped before any model sees it. */
export const FACT_BEARING: ReadonlySet<PageKind> = new Set<PageKind>([
  'cover', 'weather', 'features', 'humidity-control', 'component',
  'duct-connections', 'static-pressure', 'schedule',
])

/** Every page DryWare itself lays out carries the IAT footer. Nothing else does. */
const IAT_FOOTER = /info@dehumidifiers\.com/i

/**
 * Classify by CONTENT, never by page index.
 *
 * Page numbers are not stable — the number of vendor cut sheets varies with how
 * many filters and fans a unit has, so the Schedule can sit anywhere. Every
 * marker below is something DryWare prints, not a position.
 *
 * ── Ours vs theirs comes FIRST, and it is not keyword-based ─────────────────
 * Matching "New York Blower" to spot vendor literature also matches our own
 * Process Fan page, which names the manufacturer in its spec list. So the split
 * is structural: a page with the IAT footer is one DryWare laid out; a page
 * without it is somebody else's paper. That distinction is stable across
 * whatever vendors get stapled in next.
 */
export function classifyPages(pageTexts: string[]): ClassifiedPage[] {
  const pages: ClassifiedPage[] = pageTexts.map((raw, i) => {
    const text = (raw ?? '').trim()
    const ours = IAT_FOOTER.test(text)
    const kind = ((): PageKind => {
      if (/SECTION 23 84 19|Master Guide Specifications/i.test(text)) return 'guide-spec'
      if (!ours) {
        // The cover sheet is the one page of ours with no footer — but it is
        // four lines of identity, nothing like a vendor data sheet, which is a
        // dense page of tables. Length separates them cleanly.
        return text.length < 300 ? 'cover' : 'vendor'
      }
      if (/Standard IAT Project Flow/i.test(text)) return 'project-flow'

      // A per-component page always carries "Specs/Features", and several share
      // a heading with a Schedule group ("Final Filter", "Process Fan"), so this
      // test must come BEFORE the Schedule one or the component pages are read
      // as Schedule and their flow-diagram labels flood the key/value parser.
      if (/Duct Connection Features/i.test(text)) return 'duct-connections'
      if (/Static Pressure Calculations/i.test(text)) return 'static-pressure'
      if (/Weather Station|ASHRAE Design Conditions/i.test(text)) return 'weather'
      if (/Special Instructions\/Notes/i.test(text) || /^\s*Features\s*$/im.test(text)) return 'features'
      if (/Specs\/Features/i.test(text)) {
        return /^\s*Humidity Control\s*$/im.test(text) ? 'humidity-control' : 'component'
      }
      if (/^\s*Schedule\s*$/im.test(text)) return 'schedule'
      if (/(Summer|Winter) Conditions/i.test(text)) return 'flow-diagram'
      return 'unknown'
    })()
    return { page: i + 1, kind, text }
  })

  // ── Two post-passes, and the ORDER matters ────────────────────────────────
  // The Schedule runs to four pages but only the first says "Schedule"; the
  // rest open mid-table with a group heading. So a still-unknown page directly
  // after a Schedule page is a continuation of it. This has to run BEFORE the
  // catch-all below, or the continuation pages get absorbed as components and
  // every Schedule group after page one silently disappears.
  for (let i = 1; i < pages.length; i++) {
    if (pages[i].kind === 'unknown' && pages[i - 1].kind === 'schedule') pages[i].kind = 'schedule'
  }
  // Anything left on our own letterhead is a per-component spec page laid out
  // without the "Specs/Features" banner (the General page is one). Reading it
  // costs nothing — the bullet parser finds no bullets there.
  for (const p of pages) {
    if (p.kind === 'unknown' && IAT_FOOTER.test(p.text)) p.kind = 'component'
  }
  return pages
}

/** Human-readable summary for the review UI ("dropped 13 pages of guide spec"). */
export function classificationSummary(pages: ClassifiedPage[]): Record<PageKind, number> {
  const out = {} as Record<PageKind, number>
  for (const p of pages) out[p.kind] = (out[p.kind] ?? 0) + 1
  return out
}

// ─── Sources ─────────────────────────────────────────────────────────────────

export type SourceMethod = 'schedule' | 'duct' | 'bullet' | 'model_number' | 'llm' | 'human'

export type FactSource = {
  method: SourceMethod
  fact: FactKey
  value: unknown
  page: number
  /** The literal text this came from — shown in the review table. */
  snippet: string
}

/**
 * Highest wins. The Schedule is DryWare's own structured dump; the duct page is
 * the only place dampers are stated per-opening; the Features bullets are prose
 * and can be loose; the model number is a strong but narrow cross-check; the
 * model call is the redundant second reader and never overrides a parser.
 */
export const PRECEDENCE: readonly SourceMethod[] = ['human', 'schedule', 'duct', 'bullet', 'model_number', 'llm']

const rank = (m: SourceMethod) => PRECEDENCE.indexOf(m)

// ─── Schedule ────────────────────────────────────────────────────────────────

/** Group headings DryWare prints in the Schedule. Bare lines, no colon. */
export const SCHEDULE_GROUPS = [
  'Humidity Control', 'General', 'Dehumidifier',
  'Hot Water Post-Heating', 'Steam Post-Heating', 'Electric Post-Heating',
  'Steam React Heat', 'Gas React Heat', 'Electric React Heat', 'Hot Water React Heat',
  'Process Filter', 'React Filter', 'Final Filter',
  'Post-Cooling', 'Pre-Cooling', 'Process Fan', 'React Fan',
] as const

export type ScheduleGroup = (typeof SCHEDULE_GROUPS)[number]

/**
 * Every label the parser knows, longest-first at match time so
 * "Entering Airflow (CFM)" wins over "Airflow (CFM)".
 */
const SCHEDULE_LABELS = [
  // General
  'Aluminum Casing Thickness and Type', 'Mounting Location', 'Electrical Enclosure Rating',
  'Altitude', 'Voltage', 'FLA', 'MCA', 'MOCP', 'React Heater Type',
  'Moisture Removal Rate of System (Lbs./Hr)', 'Humidity Control',
  // Dehumidifier
  'Desiccant Wheel Size', 'Moisture Removal (lbs/hr)',
  'Pressure Drop Process ("W.C.)', 'Pressure Drop React ("W.C.)',
  // Coils / heat
  'Entering Airflow (CFM)', 'Leaving Airflow (CFM)', 'Entering Temp (°F)', 'Leaving Temp (°F)',
  'Entering Moisture (gr)', 'Leaving Moisture (gr)', 'Entering Water (°F)', 'Leaving Water (°F)',
  'Heat to Temp (°F)', 'Airflow (CFM)', 'Temp (°F)', 'Moisture (gr)',
  'Btuh (Sensible)', 'Btuh (Latent)', 'Btuh', 'GPM', 'PSI', 'Condensate',
  // Filters
  'Filter Efficiency (MERV)', 'Filter Pressure Drop (Design, "WC)', 'Filter Pressure Drop (Final, "WC)',
  'Filter Height (in)', 'Filter Width (in)', 'Filter Depth (in)', 'Filter Quantity',
  'Filter Area (Ft2)', 'Face Velocity (FPM)',
  // Fans
  'Manufacturer', 'Size', 'Type', 'RPM', 'HP', 'ESP', 'VFD',
  // Misc
  'Model',
].sort((a, b) => b.length - a.length)

export type ScheduleEntry = { group: string; label: string; value: string; page: number }
export type UnmappedLine = { group: string; text: string; page: number }

const NOISE = /^(info@dehumidifiers\.com|Customer:|Project:|Contact:|Date:|Schedule\s*$)/i

/**
 * Walk the Schedule pages into (group, label, value) triples.
 *
 * A line that matches no known label is KEPT as unmapped rather than
 * force-parsed. That list is the drift alarm: when DryWare renames a field, it
 * shows up as "3 schedule values weren't recognised" instead of a fact quietly
 * going null.
 */
export function parseSchedule(pages: ClassifiedPage[]): { entries: ScheduleEntry[]; unmapped: UnmappedLine[] } {
  const entries: ScheduleEntry[] = []
  const unmapped: UnmappedLine[] = []
  const groups = new Set<string>(SCHEDULE_GROUPS)

  let group = ''
  for (const p of pages.filter((x) => x.kind === 'schedule')) {
    for (const rawLine of p.text.split('\n')) {
      const line = rawLine.trim()
      if (!line || NOISE.test(line)) continue

      if (groups.has(line)) { group = line; continue }
      // "Model: IAT-3000RS-IDP" on the Schedule header block — identity, kept.
      const colon = line.match(/^([A-Za-z][^:]{0,60}):\s*(.+)$/)
      if (colon) {
        const [, label, value] = colon
        if (SCHEDULE_LABELS.includes(label.trim())) {
          entries.push({ group, label: label.trim(), value: value.trim(), page: p.page })
          continue
        }
      }

      const label = SCHEDULE_LABELS.find((l) => line.startsWith(l))
      if (label) {
        const value = line.slice(label.length).replace(/^[:\s]+/, '').trim()
        if (value) { entries.push({ group, label, value, page: p.page }); continue }
      }

      unmapped.push({ group, text: line, page: p.page })
    }
  }
  return { entries, unmapped }
}

// ─── Bullets (Features, Humidity Control, component pages) ───────────────────

export type BulletEntry = { label: string; value: string | null; page: number; raw: string }

/**
 * DryWare's bullets come in three shapes — `· Label - Value`, `· Label: Value`
 * and a bare `· Flag` — and the two-column layout puts SEVERAL on one text line
 * ("· Model - 3176 iControl Premium PLC · Control Based On - Room Conditions").
 * So split on the bullet glyph, not on newlines.
 */
export function parseBullets(pages: ClassifiedPage[]): BulletEntry[] {
  const out: BulletEntry[] = []
  const kinds: PageKind[] = ['features', 'humidity-control', 'component', 'cover']
  for (const p of pages.filter((x) => kinds.includes(x.kind))) {
    // Drop the footer BEFORE splitting. It is itself bullet-separated
    // ("info@… • 770-788-6744 • …"), so the last real bullet on the page would
    // otherwise swallow it — "Manufacturer - New York Blower info@dehumidifiers.com".
    const body = p.text.replace(/info@dehumidifiers\.com[\s\S]*$/i, '')
    for (const frag of body.split(/[·•]/).slice(1)) {
      const raw = frag.replace(/\s+/g, ' ').trim()
      if (!raw || raw.length > 300) continue
      const dash = raw.match(/^(.{2,60}?)\s+[-–]\s+(.+)$/)
      const colon = raw.match(/^(.{2,60}?):\s+(.+)$/)
      if (dash) out.push({ label: dash[1].trim(), value: dash[2].trim(), page: p.page, raw })
      else if (colon) out.push({ label: colon[1].trim(), value: colon[2].trim(), page: p.page, raw })
      else out.push({ label: raw, value: null, page: p.page, raw })
    }
  }
  return out
}

// ─── Duct connections ────────────────────────────────────────────────────────

export type DuctOpening = { opening: string; options: Record<string, string>; flags: string[]; page: number }

/** `· Outside Air` then `o Damper - Motorized (Requires PLC)` sub-items. */
export function parseDuctConnections(pages: ClassifiedPage[]): DuctOpening[] {
  const out: DuctOpening[] = []
  for (const p of pages.filter((x) => x.kind === 'duct-connections')) {
    let current: DuctOpening | null = null
    for (const rawLine of p.text.split('\n')) {
      const line = rawLine.trim()
      if (!line || NOISE.test(line)) continue
      const opening = line.match(/^[·•]\s*(.+)$/)
      if (opening) {
        current = { opening: opening[1].trim(), options: {}, flags: [], page: p.page }
        out.push(current)
        continue
      }
      const sub = line.match(/^o\s+(.+)$/)
      if (sub && current) {
        const body = sub[1].trim()
        const kv = body.match(/^(.{2,50}?)\s+[-–]\s+(.+)$/)
        if (kv) current.options[kv[1].trim()] = kv[2].trim()
        else current.flags.push(body)
      }
    }
  }
  return out
}

// ─── Value coercion ──────────────────────────────────────────────────────────

/** `240.0(S) / 120.0(W)` → { summer: 240, winter: 120 }. */
export function splitSeasonal(value: string): { summer: number | null; winter: number | null } {
  const s = value.match(/([-\d.,]+)\s*\(S\)/i)
  const w = value.match(/([-\d.,]+)\s*\(W\)/i)
  return { summer: s ? num(s[1]) : null, winter: w ? num(w[1]) : null }
}

export function num(v: string | null | undefined): number | null {
  if (v == null) return null
  const cleaned = String(v).replace(/,/g, '').replace(/[^\d.\-]/g, '')
  // Number('') is 0, not NaN — so without this guard an empty or wholly
  // non-numeric field would extract as a confident zero.
  if (!/\d/.test(cleaned)) return null
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : null
}

const yes = (v: string) => /^(yes|true|included|standard)$/i.test(v.trim())

// ─── Schedule → facts ────────────────────────────────────────────────────────

export function factsFromSchedule(entries: ScheduleEntry[]): FactSource[] {
  const out: FactSource[] = []
  const add = (fact: FactKey, value: unknown, e: ScheduleEntry) => {
    if (value === null || value === undefined || value === '') return
    out.push({ method: 'schedule', fact, value, page: e.page, snippet: `${e.label} ${e.value}` })
  }

  const seenGroups = new Set(entries.map((e) => e.group))

  for (const e of entries) {
    const key = `${e.group}|${e.label}`
    switch (key) {
      case 'General|Voltage': add('voltage', e.value, e); break
      case 'General|Altitude': break // altitude lives on `weather`, set below
      case 'General|Moisture Removal Rate of System (Lbs./Hr)': add('moisture_removal_lb_hr', num(e.value), e); break
      case 'General|React Heater Type': add('reactivation', reactivationFrom(e.value), e); break
      case 'General|Humidity Control':
      case 'Humidity Control|Model': add('controls_package', controlsPackageFrom(e.value), e); break
      case 'Steam React Heat|PSI': add('steam_pressure_psi', num(e.value), e); break
      case 'Process Fan|ESP': add('process_esp_inwc', num(e.value), e); break
      case 'React Fan|ESP': add('react_esp_inwc', num(e.value), e); break
      case 'Process Fan|VFD': add('process_fan_drive', yes(e.value) ? 'vfd' : 'across_line', e); break
      case 'React Fan|VFD': add('react_fan_drive', yes(e.value) ? 'vfd' : 'across_line', e); break
      case 'Process Fan|Entering Airflow (CFM)': add('process_cfm', num(e.value), e); break
      case 'React Fan|Airflow (CFM)': add('react_cfm', num(e.value), e); break
    }

    // React heat-to, from whichever react-heat group this unit has.
    if (/React Heat$/.test(e.group) && e.label === 'Heat to Temp (°F)') {
      const { summer, winter } = splitSeasonal(e.value)
      add('react_heat_to_f_summer', summer, e)
      add('react_heat_to_f_winter', winter, e)
    }
  }

  // Group headings are themselves facts: DryWare only prints the section a unit
  // actually has, and names the medium in the heading.
  const groupFact = (g: string, fact: FactKey, value: unknown) => {
    if (!seenGroups.has(g)) return
    const e = entries.find((x) => x.group === g)!
    out.push({ method: 'schedule', fact, value, page: e.page, snippet: `Schedule section “${g}”` })
  }
  groupFact('Dehumidifier', 'has_desiccant_wheel', true)
  groupFact('Process Filter', 'has_process_filter', true)
  groupFact('React Filter', 'has_react_filter', true)
  groupFact('Final Filter', 'has_final_filter', true)
  groupFact('Process Fan', 'has_process_fan', true)
  groupFact('React Fan', 'has_react_fan', true)
  groupFact('Hot Water Post-Heating', 'post_heat_medium', 'hot_water')
  groupFact('Steam Post-Heating', 'post_heat_medium', 'steam')
  groupFact('Electric Post-Heating', 'post_heat_medium', 'electric')
  groupFact('Steam React Heat', 'reactivation', 'steam')
  groupFact('Gas React Heat', 'reactivation', 'gas')
  groupFact('Electric React Heat', 'reactivation', 'electric')
  groupFact('Hot Water React Heat', 'reactivation', 'hot_water')

  // Process airflow: the fan section is preferred, but any 3,000-CFM process
  // component states it, so fall back rather than leaving it unknown.
  if (!out.some((s) => s.fact === 'process_cfm')) {
    const e = entries.find((x) => x.group === 'Process Filter' && x.label === 'Airflow (CFM)')
    if (e) add('process_cfm', num(e.value), e)
  }
  if (!out.some((s) => s.fact === 'react_cfm')) {
    const e = entries.find((x) => x.group === 'React Filter' && x.label === 'Airflow (CFM)')
    if (e) add('react_cfm', num(e.value), e)
  }
  return out
}

function reactivationFrom(v: string): string | null {
  const s = v.toLowerCase()
  if (s.includes('steam')) return 'steam'
  if (s.includes('gas')) return 'gas'
  if (s.includes('electric')) return 'electric'
  if (s.includes('hot water') || s.includes('hw')) return 'hot_water'
  return null
}

function controlsPackageFrom(v: string): string | null {
  const s = v.toLowerCase()
  if (s.includes('premium')) return 'icontrol_premium'
  if (s.includes('icontrol')) return 'icontrol_standard'
  return v.trim() ? 'other' : null
}

// ─── Bullets → facts ─────────────────────────────────────────────────────────

export function factsFromBullets(bullets: BulletEntry[]): { sources: FactSource[]; notes: UnmappedLine[] } {
  const sources: FactSource[] = []
  const notes: UnmappedLine[] = []
  const add = (fact: FactKey, value: unknown, b: BulletEntry) => {
    if (value === null || value === undefined || value === '') return
    sources.push({ method: 'bullet', fact, value, page: b.page, snippet: b.raw })
  }

  for (const b of bullets) {
    const label = b.label.toLowerCase().replace(/\s+/g, ' ')
    const value = b.value ?? ''

    // Labelled bullets
    if (label === 'react heat') add('reactivation', reactivationFrom(value), b)
    else if (label === 'voltage') add('voltage', value, b)
    else if (label === 'model' && /icontrol|plc/i.test(value)) add('controls_package', controlsPackageFrom(value), b)
    else if (label === 'control based on') {
      add('humidity_sensor_location', /room|space/i.test(value) ? 'space' : /leaving|post/i.test(value) ? 'post_desiccant' : null, b)
    }
    else if (label === 'space sensor') add('space_sensor_ships_loose', /ships loose|loose/i.test(value), b)
    else if (label === 'controls communication protocol') {
      const p = basProtocolFrom(value)
      if (p) add('bas_protocol', p, b)
      else {
        // "BACnet" alone does not say MS/TP or IP. Refusing to guess is the
        // point: the fact stays unknown, its clauses block, and a human picks.
        notes.push({ group: 'Controls', text: `“${b.raw}” — does not say MS/TP or IP, so the protocol is left for you to set`, page: b.page })
      }
    }
    // Bare flags
    else if (b.value === null) {
      if (/rotor rotation alarm/i.test(label)) add('has_rotor_rotation_alarm', true, b)
      else if (/afms|air flow monitoring/i.test(label)) add('has_afms', true, b)
      else if (/dirty filter alarm/i.test(label)) add('dirty_filter_alarms', true, b)
      else if (/^cw pre-cooling/i.test(label)) {
        add('pre_cool_medium', 'chilled_water', b)
        if (/post-cooling/i.test(label)) add('post_cool_medium', 'chilled_water', b)
      }
      else if (/^dx pre-cooling/i.test(label)) {
        add('pre_cool_medium', 'dx', b)
        if (/post-cooling/i.test(label)) add('post_cool_medium', 'dx', b)
      }
      else if (/^cw post-cooling/i.test(label)) add('post_cool_medium', 'chilled_water', b)
      else if (/^dx post-cooling/i.test(label)) add('post_cool_medium', 'dx', b)
      else if (/hot water post-heat/i.test(label)) add('post_heat_medium', 'hot_water', b)
      else if (/steam post-heat/i.test(label)) add('post_heat_medium', 'steam', b)
      else if (/electric post-heat/i.test(label)) add('post_heat_medium', 'electric', b)
      else if (/desiccant wheel cassette/i.test(label)) add('has_desiccant_wheel', true, b)
      else if (/^process & react fans/i.test(label)) { add('has_process_fan', true, b); add('has_react_fan', true, b) }
      else if (/^process & react filters/i.test(label)) { add('has_process_filter', true, b); add('has_react_filter', true, b) }
      else if (/^\d+ icontrol|icontrol .*plc/i.test(label)) add('controls_package', controlsPackageFrom(label), b)
    }
  }
  return { sources, notes }
}

function basProtocolFrom(v: string): string | null {
  const s = v.toLowerCase()
  if (/ms\/?tp/.test(s)) return 'bacnet_mstp'
  if (/bacnet\s*ip/.test(s)) return 'bacnet_ip'
  if (/modbus/.test(s)) return 'modbus'
  if (/none/.test(s)) return 'none'
  return null // bare "BACnet" — ambiguous, see the caller
}

// ─── Duct → facts ────────────────────────────────────────────────────────────

export function factsFromDuct(openings: DuctOpening[]): FactSource[] {
  const out: FactSource[] = []
  const damperOf = (o: DuctOpening): string | null => {
    const raw = o.options['Damper']
    if (!raw) return null
    const s = raw.toLowerCase()
    if (/none/.test(s)) return 'none'
    if (/manual/.test(s)) return 'manually_set'
    if (/motoriz/.test(s)) {
      const ctrl = (o.options['Control Option'] ?? '').toLowerCase()
      return /modulat/.test(ctrl) ? 'motorized_modulating' : 'two_position'
    }
    return null
  }

  for (const o of openings) {
    const name = o.opening.toLowerCase()
    const fact: FactKey | null =
      /outside air/.test(name) ? 'oa_damper' :
      /return air/.test(name) ? 'ra_damper' :
      /react outlet/.test(name) ? 'react_outlet_damper' : null
    if (fact) {
      const d = damperOf(o)
      if (d) {
        out.push({
          method: 'duct', fact, value: d, page: o.page,
          snippet: `${o.opening} — Damper: ${o.options['Damper']}${o.options['Control Option'] ? `, ${o.options['Control Option']}` : ''}`,
        })
      }
    }
    // The AFMS is stated on whichever opening carries it, and the Features page
    // sometimes disagrees about which. Either way the unit HAS one.
    for (const f of [...o.flags, ...Object.values(o.options)]) {
      if (/air flow monitoring station|ebtron/i.test(f)) {
        out.push({ method: 'duct', fact: 'has_afms', value: true, page: o.page, snippet: `${o.opening} — ${f}` })
      }
    }
  }
  return out
}

// ─── Identity + model number ─────────────────────────────────────────────────

/**
 * Identity comes from a page whose header block is CLEAN. The per-component
 * pages scramble reading order — "Patrick GallagherContact:", value before
 * label — so they are excluded even though they carry the same fields.
 */
export function factsFromIdentity(pages: ClassifiedPage[]): FactSource[] {
  const out: FactSource[] = []
  const ordered = [...pages]
    .filter((p) => p.kind === 'schedule' || p.kind === 'cover' || p.kind === 'features')
    .sort((a, b) => (a.kind === 'schedule' ? -1 : b.kind === 'schedule' ? 1 : 0))

  const want: [RegExp, FactKey][] = [
    [/^Customer:\s*(.+)$/im, 'customer'],
    [/^Project:\s*(.+)$/im, 'project_name'],
    [/^Model:\s*(.+)$/im, 'model_number'],
  ]
  for (const [re, fact] of want) {
    for (const p of ordered) {
      const m = p.text.match(re)
      if (m?.[1]?.trim()) {
        out.push({ method: 'schedule', fact, value: m[1].trim(), page: p.page, snippet: m[0].trim() })
        break
      }
    }
  }
  return out
}

/**
 * An independent third reading of the model string. Narrow but strong: it
 * cannot be wrong in the same way the page text can, so a disagreement here is
 * a real signal rather than noise.
 */
export function factsFromModelNumber(
  model: string | null,
  parse: (m: string) => { valid: boolean; reactivation?: string | null; idp?: boolean | null }
): FactSource[] {
  if (!model) return []
  const parsed = parse(model)
  if (!parsed.valid) return []
  const out: FactSource[] = []
  const REACT: Record<string, string> = { E: 'electric', S: 'steam', G: 'gas', HW: 'hot_water' }
  if (parsed.reactivation && REACT[parsed.reactivation]) {
    out.push({ method: 'model_number', fact: 'reactivation', value: REACT[parsed.reactivation], page: 0, snippet: `model number ${model}` })
  }
  if (typeof parsed.idp === 'boolean') {
    out.push({ method: 'model_number', fact: 'has_idp', value: parsed.idp, page: 0, snippet: `model number ${model}` })
  }
  return out
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export type FactProvenance = { page: number; snippet: string; method: SourceMethod }
export type FactConflict = {
  fact: FactKey
  label: string
  sources: { method: SourceMethod; value: unknown; page: number; snippet: string }[]
}

export type UnitFactsRecord = {
  facts: UnitFacts
  provenance: Partial<Record<FactKey, FactProvenance>>
  /** How many independent readings agreed. 2+ ⇒ safe to skim; 1 ⇒ read it. */
  agreement: Partial<Record<FactKey, number>>
  conflicts: FactConflict[]
  unmapped: UnmappedLine[]
  pages: Record<string, number>
}

/**
 * Merge every source into one fact set.
 *
 * Highest precedence wins, but a disagreement is RECORDED rather than resolved
 * away — that list is the first thing the review table shows. The reviewer sees
 * "the Schedule and the model number disagree about reactivation type" instead
 * of a single confident value that happens to be wrong.
 */
export function reconcile(sources: FactSource[], unmapped: UnmappedLine[], pages: ClassifiedPage[]): UnitFactsRecord {
  const facts = blankFacts()
  const provenance: Partial<Record<FactKey, FactProvenance>> = {}
  const agreement: Partial<Record<FactKey, number>> = {}
  const conflicts: FactConflict[] = []

  const byFact = new Map<FactKey, FactSource[]>()
  for (const s of sources) {
    if (!(s.fact in FACT_SPECS)) continue
    const list = byFact.get(s.fact) ?? []
    list.push(s)
    byFact.set(s.fact, list)
  }

  for (const [fact, list] of byFact) {
    const sorted = [...list].sort((a, b) => rank(a.method) - rank(b.method))
    const winner = sorted[0]
    ;(facts as Record<string, unknown>)[fact] = winner.value
    provenance[fact] = { page: winner.page, snippet: winner.snippet, method: winner.method }

    const distinct = new Set(list.map((s) => JSON.stringify(s.value)))
    agreement[fact] = list.filter((s) => JSON.stringify(s.value) === JSON.stringify(winner.value)).length

    if (distinct.size > 1) {
      conflicts.push({
        fact,
        label: FACT_SPECS[fact].label,
        sources: sorted.map((s) => ({ method: s.method, value: s.value, page: s.page, snippet: s.snippet })),
      })
    }
  }

  const pageCounts: Record<string, number> = {}
  for (const p of pages) pageCounts[p.kind] = (pageCounts[p.kind] ?? 0) + 1

  return { facts, provenance, agreement, conflicts, unmapped, pages: pageCounts }
}

/**
 * The whole deterministic pass. No network, no model — everything here is
 * reproducible from the PDF's text layer alone, which is what makes it testable
 * against the real submittal in scripts/verify-soo-extract.mjs.
 */
export function extractDeterministic(
  pageTexts: string[],
  parseModel: (m: string) => { valid: boolean; reactivation?: string | null; idp?: boolean | null }
): UnitFactsRecord {
  const pages = classifyPages(pageTexts)
  const { entries, unmapped: schedUnmapped } = parseSchedule(pages)
  const bullets = parseBullets(pages)
  const { sources: bulletSources, notes } = factsFromBullets(bullets)
  const duct = parseDuctConnections(pages)
  const identity = factsFromIdentity(pages)

  const modelSource = identity.find((s) => s.fact === 'model_number')
  const modelFacts = factsFromModelNumber(
    typeof modelSource?.value === 'string' ? modelSource.value : null,
    parseModel
  )

  const sources = [
    ...identity,
    ...factsFromSchedule(entries),
    ...factsFromDuct(duct),
    ...bulletSources,
    ...modelFacts,
  ]
  return reconcile(sources, [...schedUnmapped, ...notes], pages)
}
