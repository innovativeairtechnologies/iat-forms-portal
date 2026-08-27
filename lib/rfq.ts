// ─── RFQ / Moisture Survey: shared model, presets and load math ───────────────
//
// One module shared by the public wizard (components/support/RfqWizard.tsx), the
// PDF generator (lib/rfq-pdf.ts) and the API route (app/api/rfq/route.ts), so the
// numbers a customer sees on screen are byte-for-byte the numbers in their PDF
// and in the record our sales desk receives.
//
// The load equations are the standard moisture-load set (ASHRAE Fundamentals —
// permeation, infiltration, occupancy, product, combustion, wet surface, fresh
// air) in the same arrangement as IAT's internal moisture-load workbook, so a
// wizard estimate and a hand-worked sheet land in the same place.
//
// IMPORTANT: the wizard estimate is PRELIMINARY, always. It exists to tell a
// customer whether they are describing a 200 lb/hr problem or a 5 lb/hr problem
// while they type — not to size equipment. Every surface that renders it also
// renders LOAD_DISCLAIMER.

import {
  GRAINS_PER_LB,
  airDensity,
  dewPointF,
  grains,
  rhFromDewPoint,
  rhFromGrains,
  rhFromWetBulb,
  vaporPressureFromGrains,
  vaporPressureInHg,
  wetBulbF,
} from './rfq-psych'

export const LOAD_DISCLAIMER =
  'This is a preliminary estimate generated from the information entered above. Final verification is required by the owner or a qualified mechanical engineer. IAT does not guarantee the estimate due to potential differences between the information provided and actual facility conditions, and does not guarantee compliance with state or local codes or standards.'

export type Track = 'room' | 'process'

// ─── Moisture units ───────────────────────────────────────────────────────────
//
// Nobody writes a humidity spec the same way. A room spec is usually %rh, a dry
// room is a dew point, a process wheel is grains, and a mechanical contractor
// reading off a sling psychrometer has a wet bulb. Making customers convert
// before they can answer is how you get a wrong number typed confidently.
//
// So every temperature/moisture pair carries a MODE and the value AS TYPED,
// while the canonical field beside it (`…RhPct`, or `leavingGrains` for the
// process track) is kept in sync and is the only thing the load engine reads.
// Nothing downstream of here — estimateLoad, the PDF, the admin page — knows or
// cares which unit was used.
//
// Rows written before this existed have no mode at all; `normalizeMode()` treats
// a missing mode as the canonical one, so those submissions still render.

/**
 * Which unit the customer types temperatures in.
 *
 * EVERYTHING IS STORED IN °F. This is a display-and-entry choice only: every
 * psychrometric function here takes °F, `setCondition()` is canonical in °F, and
 * the stored record, the PDF and the admin view are all °F. Celsius is converted
 * at the input and converted straight back — nothing downstream ever sees it.
 *
 * ⚠️ Dew point and wet bulb are TEMPERATURES too. A survey showing a °C dry bulb
 * beside a °F dew point is not a cosmetic problem — it is someone typing 15
 * meaning 15°C into a field that stores 15°F. Both follow this unit.
 */
export type TempUnit = 'F' | 'C'

export const TEMP_UNITS: { value: TempUnit; label: string }[] = [
  { value: 'F', label: '°F' },
  { value: 'C', label: '°C' },
]

export const fToC = (f: number): number => (f - 32) * 5 / 9
export const cToF = (c: number): number => c * 9 / 5 + 32

/** Canonical °F string → what the customer sees. Blank stays blank. */
export function tempToDisplay(f: string, unit: TempUnit): string {
  if (unit === 'F') return f ?? ''
  const n = num(f, NaN)
  if (!Number.isFinite(n)) return ''
  // One decimal: enough that 71.6°F reads as 22°C, not so much that it looks measured.
  return String(Math.round(fToC(n) * 10) / 10)
}

/** What the customer typed → canonical °F string. Blank stays blank. */
export function tempFromDisplay(shown: string, unit: TempUnit): string {
  if (unit === 'F') return shown ?? ''
  const t = String(shown ?? '').trim()
  if (t === '') return ''
  const n = num(t, NaN)
  if (!Number.isFinite(n)) return ''
  // One decimal. A value TYPED in Celsius survives a round trip exactly, which is
  // the case that matters — 21.7C -> 71.1F -> 21.7C.
  //
  // ⚠️ The reverse is NOT exact and cannot be: 0.1°C is 0.18°F, so tenths in the
  // two scales do not line up (105F displays as 40.6C, which re-enters as 105.1F).
  // That is harmless ONLY because flipping the unit is a VIEW change that writes
  // nothing — storage keeps the °F the customer typed, and a conversion is applied
  // for display alone. Never write a converted value back on a unit toggle.
  return String(Math.round(cToF(n) * 10) / 10)
}

/** True when this moisture unit is itself a temperature and must follow TempUnit. */
export const modeIsTemperature = (m: MoistureMode): boolean => m === 'dp' || m === 'wb'

export type MoistureMode = 'rh' | 'dp' | 'gr' | 'wb'

export const MOISTURE_MODES: { value: MoistureMode; label: string; short: string; suffix: string; hint: string }[] = [
  { value: 'rh', label: 'Relative humidity', short: '% rh', suffix: '% rh', hint: 'The everyday unit. Means a different amount of water at every temperature.' },
  { value: 'dp', label: 'Dew point', short: '°F dp', suffix: '°F dp', hint: 'The temperature at which this air starts to condense. Does not move when the dry bulb does.' },
  { value: 'gr', label: 'Grains', short: 'gr/lb', suffix: 'gr/lb', hint: 'Grains of water per pound of dry air. This is what equipment is actually sized on.' },
  { value: 'wb', label: 'Wet bulb', short: '°F wb', suffix: '°F wb', hint: "What a sling psychrometer reads. Handy if that's the instrument you have." },
]

export const MOISTURE_SUFFIX: Record<MoistureMode, string> =
  Object.fromEntries(MOISTURE_MODES.map(m => [m.value, m.suffix])) as Record<MoistureMode, string>

/** A stored mode, defaulting a missing/unknown one to `fallback` (pre-selector rows). */
export function normalizeMode(mode: unknown, fallback: MoistureMode): MoistureMode {
  return MOISTURE_MODES.some(m => m.value === mode) ? (mode as MoistureMode) : fallback
}

// ─── How the room's size was given ──────────────────────────────────────────
//
// Plenty of people know their building as "about 30,000 cubic feet" and have to
// go and measure to answer length × width × height. Volume mode lets them answer
// the question they can actually answer.
//
// ⚠️ Volume alone is NOT enough for the physics. L, W and H do not just make a
// volume here — they make the wall, ceiling and floor AREAS that the permeation
// term needs (`wallArea = 2(L+W)H`, `ceil = floor = L×W`). Two rooms of identical
// volume can have very different envelope areas, so a single number cannot
// determine the load on its own.
//
// So volume mode also takes a CEILING HEIGHT — the one dimension almost everyone
// knows without measuring — and derives a SQUARE footprint from it:
//
//     H = ceiling height (default DEFAULT_CEILING_FT when blank)
//     L = W = sqrt(volume / H)
//
// That reproduces the volume exactly and the floor/ceiling area exactly. Only the
// footprint SHAPE is assumed, and a square is the minimum-perimeter case, so wall
// area is the low end for a given footprint — an elongated room has more wall than
// this predicts. The survey is explicitly preliminary and carries a disclaimer, but
// `roomDimsAreDerived()` exists so every surface that shows these numbers can say
// they were assumed rather than measured.
// ─── Where the dimension callouts sit on a room render ──────────────────────
//
// Every image in the `rooms` set is the same 1920x1080 isometric cutaway shot
// from the same camera, so three edges of the near-left wall land in the same
// place in every one. Callouts drawn along those edges read as part of the room
// instead of as rules floating outside the picture.
//
// Fractions of the IMAGE BOX (not the padded overlay), so they survive any
// scale. MEASURED, not eyeballed: candidate lines were composited onto real
// renders with sharp and checked by eye until they hugged the edges in all of
// them. Re-run that check if the renders are ever re-exported — a new camera
// angle silently misaligns every line.
//
// ⚠️ FIT THE FLOOR EDGE ACROSS MANY RENDERS, NOT ONE — it has now been wrong
// twice for exactly that reason. The first pass was fitted to `battery` alone and
// ran 2.5° steep on the warehouse; the correction that followed was checked on
// four renders and was still 3.9° shallow, so the length line started clear of
// the slab on the left and had drifted onto the concrete by the right-hand end.
// The floor edge is the sensitive one; the top edge and the vertical tolerate
// far more error, which is why only this line has ever looked wrong.
//
// The current floor figures come from measuring the slab's front-lower boundary
// on ALL 39 room renders (strongest vertical gradient per column, line fit,
// outliers dropped). 27 fitted cleanly at rms < 1.5px and agreed tightly:
// **24.75°–24.98°, median 24.80°**, with the slab's far corner at x ≈ 0.4786.
// The 12 that did not fit are renders whose floor edge is occluded by contents —
// a detector failure, not different geometry; the corrected line was composited
// onto them and hugs the edge there too.
//
// `floor` is therefore derived rather than eyeballed: hold `leftBot` (the height
// callout ends there and is correct), run at 24.8°, and stop at the slab corner.
// It sits ~10px outside the fitted edge because `leftBot` is the wall base rather
// than a point on the slab boundary — which is the right direction, since the
// callout is meant to stand outside the room.
//
//   leftTop -> apex     the wall's TOP edge, receding away to the right   (WIDTH)
//   leftTop -> leftBot  the wall's OUTER VERTICAL edge                    (HEIGHT)
//   leftBot -> floor    the floor's FRONT edge, advancing to the right    (LENGTH)
export const ROOM_RENDER_EDGES = {
  leftTop: { x: 0.178, y: 0.252 },
  apex: { x: 0.531, y: 0.048 },
  leftBot: { x: 0.178, y: 0.703 },
  // 24.78° from leftBot, ending at the slab corner. Was { 0.523, 0.937 } = 20.88°.
  floor: { x: 0.479, y: 0.950 },
} as const

/**
 * Where the make-up / vent air's moisture lands.
 *
 * 'dehumidifier' — the air is ducted to the unit and dried BEFORE it reaches the
 *   room. Its moisture is a load on the UNIT, carried separately from the room
 *   load and excluded from the supply-air sizing. ASHRAE Ch. 5 is explicit that
 *   folding it into the room load grossly oversizes the system. This is what the
 *   engine did for every survey before the choice existed, so it is the default
 *   AND what the wizard marks preferred.
 *
 * 'room' — the air is delivered into the space untreated. Its moisture is then
 *   genuinely part of the room load: it shows up as a line in the breakdown, is
 *   inside the safety factor with everything else, and RAISES the dry air the
 *   unit has to supply.
 *
 * ⚠️ These are not two ways of reporting one number — they are different systems,
 * and they produce different equipment. Do not "simplify" one into the other.
 */
export type VentLoadTarget = 'dehumidifier' | 'room'

export const VENT_LOAD_TARGETS: { value: VentLoadTarget; label: string }[] = [
  { value: 'dehumidifier', label: 'Dehumidifier load (preferred)' },
  { value: 'room', label: 'Room load' },
]

export function normalizeVentLoadTarget(v: unknown): VentLoadTarget {
  return VENT_LOAD_TARGETS.some(t => t.value === v) ? (v as VentLoadTarget) : 'dehumidifier'
}

export type RoomSizeMode = 'dimensions' | 'volume'

export const ROOM_SIZE_MODES: { value: RoomSizeMode; label: string }[] = [
  { value: 'dimensions', label: 'Dimensions' },
  { value: 'volume', label: 'Volume' },
]

/** Used when volume mode is chosen but no ceiling height is given. */
export const DEFAULT_CEILING_FT = 12

export function normalizeRoomSizeMode(mode: unknown): RoomSizeMode {
  return ROOM_SIZE_MODES.some(m => m.value === mode) ? (mode as RoomSizeMode) : 'dimensions'
}

/** True when L and W were inferred from a volume rather than entered. */
export function roomDimsAreDerived(data: RfqData): boolean {
  return normalizeRoomSizeMode(data.roomSizeMode) === 'volume'
}

/**
 * The room's effective L/W/H, whichever way it was entered.
 *
 * ONE definition, deliberately: the load engine, the wizard's live readout, the
 * PDF diagram and the admin detail page all read through here, so they cannot
 * disagree about how big the room is.
 */
export function roomDims(data: RfqData): { L: number; W: number; H: number } {
  if (normalizeRoomSizeMode(data.roomSizeMode) === 'volume') {
    const volume = num(data.roomVolumeCuFt)
    const H = num(data.roomH) || DEFAULT_CEILING_FT
    if (volume <= 0 || H <= 0) return { L: 0, W: 0, H: 0 }
    const side = Math.sqrt(volume / H)
    return { L: side, W: side, H }
  }
  return { L: num(data.roomL), W: num(data.roomW), H: num(data.roomH) }
}

/** Any moisture unit → relative humidity %, at a given dry bulb. */
export function moistureToRh(mode: MoistureMode, value: number, tempF: number, elevationFt = 0): number {
  if (!Number.isFinite(value)) return 0
  switch (mode) {
    case 'rh': return Math.min(Math.max(value, 0), 100)
    case 'dp': return rhFromDewPoint(tempF, value)
    case 'gr': return rhFromGrains(tempF, value, elevationFt)
    case 'wb': return rhFromWetBulb(tempF, value, elevationFt)
  }
}

/** Relative humidity % → any moisture unit, for showing the same air a new way. */
export function rhToMoisture(mode: MoistureMode, rhPct: number, tempF: number, elevationFt = 0): number {
  switch (mode) {
    case 'rh': return rhPct
    case 'dp': return dewPointF(tempF, rhPct, elevationFt)
    case 'gr': return grains(tempF, rhPct, elevationFt)
    case 'wb': return wetBulbF(tempF, rhPct, elevationFt)
  }
}

/** Any moisture unit → grains, for the process track whose canonical unit is gr/lb. */
export function moistureToGrains(mode: MoistureMode, value: number, tempF: number, elevationFt = 0): number {
  if (mode === 'gr') return Number.isFinite(value) ? Math.max(value, 0) : 0
  return grains(tempF, moistureToRh(mode, value, tempF, elevationFt), elevationFt)
}

/** Rounding that suits each unit — grains can be sub-1 in a dry room, rh cannot. */
export function roundForMode(mode: MoistureMode, n: number): number {
  if (!Number.isFinite(n)) return 0
  if (mode === 'gr') return n < 10 ? Math.round(n * 100) / 100 : Math.round(n * 10) / 10
  return Math.round(n * 10) / 10
}

// ─── Application presets ──────────────────────────────────────────────────────
// The heart of "typical values at each stage": picking an application seeds the
// target condition, the surrounding space, occupancy and door activity with
// numbers a person in that industry would recognize. Every seeded value stays
// editable — the preset is a starting point, never an answer.
//
// ⚠️ PROVENANCE — these figures carry no external source. They were authored in
// one pass (2026-08-14, 59aeff9) from general industry knowledge, not transcribed
// from a standard, a datasheet, or an internal IAT table. That makes them the
// exception in this file: rfq-psych.ts is ASHRAE Fundamentals checked against
// published points, the load equations below follow IAT's moisture-load workbook,
// PEOPLE_LOADS is IAT's own table, and elevation comes from USGS. The presets do
// not have that backing.
//
// Two were found wrong exactly this way and corrected — the dry-room note
// (−20°F dp, should have been −30.2) and dry-room-process (0.4 gr/lb, should have
// been 0.55). Both read as plausible until checked against the psychrometrics.
//
// Reviewed by: —          ← fill in when an engineer signs off

export type RoomPreset = {
  key: string
  label: string
  blurb: string
  /** Why humidity is controlled here — shown as the "what we're protecting" line. */
  driver: string
  tempF: number
  rhPct: number
  /** Typical surrounding-space condition (the room's neighbours, not the weather). */
  surroundTempF: number
  surroundRhPct: number
  occupants: number
  activity: ActivityLevel
  doorOpensPerHour: number
  /** Free-text nudge shown under the target-condition step. */
  note?: string
}

export type ProcessPreset = {
  key: string
  label: string
  blurb: string
  driver: string
  /** Target LEAVING air off the dehumidifier — the process spec. */
  leavingTempF: number
  leavingGrains: number
  cfm: number
  note?: string
}

export type ActivityLevel =
  | 'Seated'
  | 'Standing'
  | 'Light Work'
  | 'Moderate Work'
  | 'Heavy Work'
  | 'Athletics'

/** gr/hr of water vapor released per person, by activity (IAT people-load table). */
export const PEOPLE_LOADS: Record<ActivityLevel, number> = {
  Seated: 1050,
  Standing: 1875,
  'Light Work': 2875,
  'Moderate Work': 4750,
  'Heavy Work': 5750,
  Athletics: 7280,
}

export const ROOM_PRESETS: RoomPreset[] = [
  {
    key: 'warehouse',
    label: 'Warehouse / corrosion protection',
    blurb: 'Finished goods, machined parts, tooling or spares held in a large open building.',
    driver: 'Stopping rust and re-work on polished surfaces',
    tempF: 75, rhPct: 40, surroundTempF: 85, surroundRhPct: 55,
    occupants: 2, activity: 'Moderate Work', doorOpensPerHour: 8,
    note: 'Below 40%rh, corrosion effectively stops on most steels, which is why 40% is the classic warehouse spec.',
  },
  {
    key: 'cold-storage',
    label: 'Cold storage / refrigerated room',
    blurb: 'Chilled coolers, docks and processing rooms above freezing.',
    driver: 'Killing fog, frost on coils and slippery floors',
    tempF: 38, rhPct: 60, surroundTempF: 80, surroundRhPct: 60,
    occupants: 2, activity: 'Moderate Work', doorOpensPerHour: 20,
    note: 'Cold rooms are dominated by door traffic. Every opening dumps warm wet air onto cold surfaces.',
  },
  {
    key: 'freezer',
    label: 'Freezer / blast freezer',
    blurb: 'Sub-freezing storage, spiral freezers and freezer docks.',
    driver: 'Frost on evaporators, ceilings and door tracks',
    tempF: 0, rhPct: 70, surroundTempF: 45, surroundRhPct: 70,
    occupants: 1, activity: 'Moderate Work', doorOpensPerHour: 12,
    note: 'Below freezing a desiccant unit is usually the only practical way to dry the air, because cooling coils just make ice.',
  },
  {
    key: 'pharma',
    label: 'Pharmaceutical / tableting',
    blurb: 'Tableting, encapsulation, granulation and packaging suites.',
    driver: 'Tablet hardness, powder flow and product stability',
    tempF: 72, rhPct: 25, surroundTempF: 75, surroundRhPct: 50,
    occupants: 6, activity: 'Light Work', doorOpensPerHour: 12,
    note: 'Tight tolerance work. A ±3%rh band is common, and that band drives the control strategy as much as the load.',
  },
  {
    key: 'dry-room',
    label: 'Battery / lithium dry room',
    blurb: 'Cell assembly, electrode handling and anhydrous processes.',
    driver: 'Lithium reacting with water vapor',
    tempF: 68, rhPct: 1, surroundTempF: 75, surroundRhPct: 50,
    occupants: 4, activity: 'Light Work', doorOpensPerHour: 6,
    // 1%rh at 68°F is a −30.2°F dew point (this said −20°F until it was checked
    // against the psychrometrics; −20°F dp is 1.8%rh).
    note: 'Usually specified as a dew point rather than %rh, so switch the unit on the humidity field. 1%rh at 68°F is about a −30°F dew point, and many cell lines ask for −40°F or drier.',
  },
  {
    key: 'food',
    label: 'Food processing / packaging',
    blurb: 'Cut rooms, packaging halls, powder rooms and washdown areas.',
    driver: 'Condensation over open product, mold and sanitation holds',
    tempF: 50, rhPct: 55, surroundTempF: 80, surroundRhPct: 60,
    occupants: 12, activity: 'Moderate Work', doorOpensPerHour: 20,
    note: 'Washdown adds a large periodic load. Tell us the wet floor area and we size for the recovery, not the average.',
  },
  {
    key: 'candy',
    label: 'Candy / confectionery',
    blurb: 'Panning, cooling tunnels, wrapping and hard-candy storage.',
    driver: 'Sticking, graining, and wrappers that will not seal',
    tempF: 70, rhPct: 40, surroundTempF: 80, surroundRhPct: 55,
    occupants: 6, activity: 'Light Work', doorOpensPerHour: 10,
  },
  {
    key: 'ice-rink',
    label: 'Ice rink / curling',
    blurb: 'Rinks, practice sheets and ice-based entertainment venues.',
    driver: 'Fog over the ice, ceiling drip and soft ice',
    tempF: 50, rhPct: 40, surroundTempF: 85, surroundRhPct: 60,
    occupants: 40, activity: 'Seated', doorOpensPerHour: 15,
    note: 'Spectator load swings enormously between practice and game day, so give us both if you can.',
  },
  {
    key: 'water-treatment',
    label: 'Water / wastewater treatment',
    blurb: 'Clearwells, filter galleries, pump rooms and pipe galleries.',
    driver: 'Condensation on pipe, corrosion of controls and gear',
    tempF: 70, rhPct: 50, surroundTempF: 85, surroundRhPct: 65,
    occupants: 2, activity: 'Light Work', doorOpensPerHour: 4,
    note: 'Open basins are usually the whole load. The water surface area matters more than the room size.',
  },
  {
    key: 'archive',
    label: 'Museum / archive / records',
    blurb: 'Collections storage, vaults, libraries and document rooms.',
    driver: 'Mold, foxing and dimensional movement in organics',
    tempF: 68, rhPct: 45, surroundTempF: 75, surroundRhPct: 55,
    occupants: 1, activity: 'Light Work', doorOpensPerHour: 2,
    note: 'A passive space. The loads are small, so envelope leakage and stability of control dominate the design.',
  },
  {
    key: 'military',
    label: 'Military / equipment preservation',
    blurb: 'Vehicle and equipment layup, spares, ordnance and depot storage.',
    driver: 'Corrosion during long-term layup',
    tempF: 70, rhPct: 40, surroundTempF: 90, surroundRhPct: 55,
    occupants: 1, activity: 'Light Work', doorOpensPerHour: 2,
    note: 'Watch radiant night cooling: a metal roof can drip even when the room reads well under 50%rh.',
  },
  {
    key: 'cannabis',
    label: 'Cannabis dry / cure',
    blurb: 'Dry rooms, cure rooms and trim areas.',
    driver: 'Mold, terpene loss and an even dry-down curve',
    tempF: 62, rhPct: 55, surroundTempF: 78, surroundRhPct: 55,
    occupants: 3, activity: 'Light Work', doorOpensPerHour: 6,
    note: 'The plant material itself is the load, and it decays over the cycle. Tell us the wet weight loaded per batch.',
  },
  {
    key: 'seed',
    label: 'Seed / grain storage',
    blurb: 'Seed conditioning, bagged storage and germination protection.',
    driver: 'Germination rate and insect activity',
    tempF: 60, rhPct: 45, surroundTempF: 85, surroundRhPct: 60,
    occupants: 2, activity: 'Moderate Work', doorOpensPerHour: 6,
  },
  {
    key: 'natatorium',
    label: 'Indoor pool / natatorium',
    blurb: 'Competition and therapy pools, water parks and spas.',
    driver: 'Structural condensation and swimmer comfort',
    tempF: 82, rhPct: 55, surroundTempF: 90, surroundRhPct: 60,
    occupants: 25, activity: 'Athletics', doorOpensPerHour: 10,
    note: 'The pool surface is the dominant load, so we need the water surface area and water temperature.',
  },
  {
    key: 'electronics',
    label: 'Electronics / clean assembly',
    blurb: 'PCB assembly, optics, semiconductor support and metrology.',
    driver: 'ESD, moisture-sensitive devices and process repeatability',
    tempF: 70, rhPct: 35, surroundTempF: 75, surroundRhPct: 50,
    occupants: 8, activity: 'Light Work', doorOpensPerHour: 10,
  },
  {
    key: 'molding',
    label: 'Plastics / molding plant',
    blurb: 'Injection and blow molding floors, resin handling, tool storage.',
    driver: 'Condensation on chilled tools and wet resin',
    tempF: 75, rhPct: 45, surroundTempF: 88, surroundRhPct: 60,
    occupants: 8, activity: 'Moderate Work', doorOpensPerHour: 12,
  },
  {
    key: 'restoration',
    label: 'Restoration / structural drying',
    blurb: 'Water-damaged buildings, tank and vessel drying, new-build dry-out.',
    driver: 'Drying the structure fast enough to stop mold',
    tempF: 80, rhPct: 35, surroundTempF: 85, surroundRhPct: 60,
    occupants: 2, activity: 'Moderate Work', doorOpensPerHour: 6,
    note: 'Temporary duty. Tell us the target completion date and we will quote rental as well as purchase.',
  },
  {
    key: 'other-room',
    label: 'Something else',
    blurb: "Describe it in your own words and we'll work from that.",
    driver: 'Your call. Tell us what the humidity is hurting',
    tempF: 70, rhPct: 45, surroundTempF: 85, surroundRhPct: 55,
    occupants: 2, activity: 'Light Work', doorOpensPerHour: 6,
  },
]

export const PROCESS_PRESETS: ProcessPreset[] = [
  {
    key: 'dry-room-process',
    label: 'Battery / lithium dry room supply',
    blurb: 'Supply air to a dry room, glovebox train or electrode line.',
    driver: 'Anhydrous process chemistry',
    // 0.55 gr/lb at 70°F is exactly a −40°F dew point — the canonical cell-line
    // spec. Was 0.4 gr/lb (which is −45°F) until it was checked.
    leavingTempF: 70, leavingGrains: 0.55, cfm: 4000,
    note: '0.55 gr/lb is a −40°F dew point, the usual cell-line spec. If yours is written as a dew point, switch the unit on the field above and type it straight in.',
  },
  {
    key: 'pharma-process',
    label: 'Pharmaceutical coating / tableting supply',
    blurb: 'Conditioned supply to coating pans, fluid beds and tableting suites.',
    driver: 'Coating film quality and powder flow',
    leavingTempF: 75, leavingGrains: 8, cfm: 3000,
  },
  {
    key: 'resin',
    label: 'Plastic resin / hopper drying',
    blurb: 'Drying hygroscopic resin before it reaches the screw.',
    driver: 'Splay, voids and lost tensile strength in the part',
    leavingTempF: 150, leavingGrains: 1, cfm: 800,
    note: 'Resin drying runs hot and very dry. The leaving dew point matters far more than the temperature.',
  },
  {
    key: 'candy-process',
    label: 'Candy coating / panning air',
    blurb: 'Drying air onto pans, belts and cooling tunnels.',
    driver: 'Shell set time and finish gloss',
    leavingTempF: 70, leavingGrains: 10, cfm: 2500,
  },
  {
    key: 'investment-casting',
    label: 'Investment casting shell room',
    blurb: 'Dip, stucco and dry cycles for ceramic shells.',
    driver: 'Repeatable shell dry times and shell cracking',
    leavingTempF: 70, leavingGrains: 15, cfm: 6000,
  },
  {
    key: 'powder',
    label: 'Powder handling / packaging air',
    blurb: 'Blending, milling, sifting and bagging of hygroscopic powders.',
    driver: 'Caking, bridging and bag-house blinding',
    leavingTempF: 70, leavingGrains: 12, cfm: 2000,
  },
  {
    key: 'food-drying',
    label: 'Food / ingredient drying',
    blurb: 'Belt dryers, cooling tunnels and ambient-temperature drying.',
    driver: 'Water activity and shelf life',
    leavingTempF: 90, leavingGrains: 10, cfm: 5000,
  },
  {
    key: 'seed-process',
    label: 'Seed / grain conditioning air',
    blurb: 'Drying and conditioning air into bins, bags or belts.',
    driver: 'Moisture content at bagging and germination rate',
    leavingTempF: 90, leavingGrains: 20, cfm: 8000,
  },
  {
    key: 'lyo',
    label: 'Freeze-dry / lyophilizer support',
    blurb: 'Purge, backfill and loading-area supply air.',
    driver: 'Ice on cold surfaces during load and unload',
    leavingTempF: 60, leavingGrains: 2, cfm: 1200,
  },
  {
    key: 'coatings',
    label: 'Coatings / paint / composites cure',
    blurb: 'Spray booths, cure ovens and composite layup supply.',
    driver: 'Blush, cure schedule and adhesion',
    leavingTempF: 75, leavingGrains: 25, cfm: 6000,
  },
  {
    key: 'other-process',
    label: 'Something else',
    blurb: "Describe the process and we'll work from that.",
    driver: 'Your call. Tell us what the moisture is hurting',
    leavingTempF: 70, leavingGrains: 20, cfm: 2000,
  },
]

// ─── Construction & envelope reference ────────────────────────────────────────
// Permeance in gr/hr/sq.ft/inHg of vapor-pressure difference. Values are the
// standard building-material set from ASHRAE Fundamentals, matched to the
// material list in IAT's moisture-load workbook.

/**
 * `retired` hides an option from the dropdowns while KEEPING it in the table.
 *
 * These arrays are two things at once: the choices a customer sees, and the
 * permeance data the load calculation reads. permOf() falls back to the LAST
 * entry when a stored label no longer matches, so the retired "Not sure" rows
 * must stay put and stay last — delete them and that fallback silently becomes
 * the most vapor-open material in each list (fabric/tent at 116 perm), which
 * would inflate the permeation load of any older record instead of failing
 * loudly.
 */
export type MaterialOption = { label: string; perm: number; permSealed: number; retired?: boolean }

/**
 * Material labels that were renamed after surveys had already stored the old text.
 *
 * permOf() matches on the label itself, so a rename without an entry here drops
 * every historical record onto the fallback row and quietly changes its quote.
 */
export const LEGACY_MATERIAL_LABELS: Record<string, string> = {
  'Concrete over vapour barrier': 'Concrete over vapor barrier',
}

export const WALL_MATERIALS: MaterialOption[] = [
  { label: 'Insulated metal panel', perm: 0.16, permSealed: 0.16 },
  { label: 'Sheet metal / steel siding', perm: 0.16, permSealed: 0.16 },
  { label: 'Concrete block, 8"', perm: 2.4, permSealed: 0.38 },
  { label: 'Poured concrete, 8"', perm: 0.4, permSealed: 0.21 },
  { label: 'Brick masonry, 8.5"', perm: 0.38, permSealed: 0.21 },
  { label: 'Gypsum board, painted', perm: 50, permSealed: 0.45 },
  { label: 'Plywood sheathing, 1/2"', perm: 0.94, permSealed: 0.3 },
  { label: 'Wood frame + insulation', perm: 5.3, permSealed: 0.45 },
  { label: 'Tilt-up concrete panel', perm: 0.4, permSealed: 0.21 },
  { label: 'Fabric / tent structure', perm: 116, permSealed: 1.2 },
  { label: 'Not sure', perm: 1.0, permSealed: 0.35, retired: true },
]

export const CEILING_MATERIALS: MaterialOption[] = [
  { label: 'Insulated metal panel', perm: 0.16, permSealed: 0.16 },
  { label: 'Metal deck / built-up roof', perm: 0.16, permSealed: 0.16 },
  { label: 'Concrete slab above', perm: 0.4, permSealed: 0.21 },
  { label: 'Gypsum board, painted', perm: 50, permSealed: 0.45 },
  { label: 'Suspended tile (open plenum)', perm: 116, permSealed: 1.6 },
  { label: 'Open to structure', perm: 116, permSealed: 1.6 },
  { label: 'Not sure', perm: 1.0, permSealed: 0.35, retired: true },
]

export const FLOOR_MATERIALS: MaterialOption[] = [
  { label: 'Concrete slab on grade', perm: 0.4, permSealed: 0.21 },
  { label: 'Concrete slab, sealed / coated', perm: 0.21, permSealed: 0.16 },
  { label: 'Concrete over vapor barrier', perm: 0.16, permSealed: 0.06 },
  { label: 'Elevated concrete deck', perm: 0.4, permSealed: 0.21 },
  { label: 'Wood / raised floor', perm: 5.3, permSealed: 0.45 },
  { label: 'Not sure', perm: 0.4, permSealed: 0.21, retired: true },
]

/**
 * Whole-envelope air leakage, cu.ft/hr per sq.ft of envelope. Chapter 5's
 * "Method A" shorthand — a single tightness band instead of totalling every
 * crack, which is the only realistic thing to ask a customer for.
 */
// 🔴 CORRECTED 2026-08-26 TO MATCH IAT'S OWN TABLE. The owner produced the figures
// this survey is supposed to agree with and asked whether they were the ones in
// use. They were not:
//
//              was      now
//   Tight      0.25  →  0.10
//   Average    0.60  →  0.30
//   Loose      1.50  →  0.60
//
// ⚠️ The old **Average** (0.60) was exactly the new **Loose**, so a customer
// answering "average" was being priced at the leakage rate IAT calls loose.
// Corrected, shell leakage falls to 0.40–0.50 of what it was — on a 50 × 50 × 12
// warehouse, Average goes 10,400 → 5,200 gr/hr.
//
// STORED SURVEYS DO NOT RE-PRICE. `summary` is snapshotted at submit and
// /admin/rfq reads it rather than recomputing, and the customer's PDF is kept as
// a file (migration 095). Only new surveys use these.
//
// ⚠️ These are a PHYSICS TABLE, not display copy — see the option-list rule in the
// project memory. Change one only against a source, and say which.
//
// 'Not sure' was removed (owner, 2026-08-20). Its rate was 0.6, and estimateLoad
// reads `TIGHTNESS_RATES[data.tightness] ?? TIGHTNESS_RATES.Average`, so a stored
// row holding 'Not sure' misses the lookup and takes the fallback. Before today
// that landed on the same 0.6 it always used; now it lands on 0.30 — which only
// matters if something recomputes such a row, and nothing does.
export type Tightness = 'Tight' | 'Average' | 'Loose'

/**
 * Envelope air leakage, cu.ft/hr per sq.ft of GROSS EXTERIOR WALL AREA.
 *
 * 🔴 REVISED 2026-08-27 on engineering advice, and BOTH HALVES CHANGED:
 *
 *              rate was   rate now      basis was          basis now
 *   Tight        0.10       0.05        walls + ceiling    WALLS ONLY
 *   Average      0.30       0.10        walls + ceiling    WALLS ONLY
 *   Loose        0.60       0.20        walls + ceiling    WALLS ONLY
 *
 * ⚠️ THE BASIS CHANGE IS THE BIGGER ONE. Roof, floor, doors, loading docks,
 * windows, penetrations and intentional ventilation are all evaluated separately —
 * doors already are, and the roof and floor are carried by permeation — so folding
 * the ceiling into this term was double-counting it. On a 50 x 40 x 14 room the two
 * changes together take Average from 1,356 to 252 cu.ft/hr.
 *
 * STORED SURVEYS DO NOT RE-PRICE. `summary` is snapshotted at submit and
 * /admin/rfq reads it rather than recomputing, and the customer's PDF is kept as a
 * file (migration 095). Only new surveys use these.
 *
 * ⚠️ These are a PHYSICS TABLE, not display copy — see the option-list rule in the
 * project memory. Change one only against a source, and say which.
 */
export const TIGHTNESS_RATES: Record<Tightness, number> = {
  Tight: 0.05,
  Average: 0.10,
  Loose: 0.20,
}
export const TIGHTNESS_HELP: Record<Tightness, string> = {
  Tight: 'Purpose-built envelope: sealed penetrations, gasketed doors, taped vapor barrier.',
  Average: 'Newer building, normal construction. No deliberate sealing program.',
  Loose: 'Older or industrial shell: visible daylight at joints, unsealed conduit, worn door seals.',
}

/** Shown behind the ⓘ beside the tightness control, not printed on the page. */
export const TIGHTNESS_DISCLAIMER =
  'These values are conservative preliminary design assumptions for air leakage through above-grade '
  + 'exterior wall construction, for use when measured building-envelope leakage data are not available. '
  + 'Apply the rates to gross exterior wall area only, unless a different envelope basis is specifically '
  + 'established. Roof leakage, floors, doors, loading docks, windows, penetrations, intentional '
  + 'ventilation and other openings should be evaluated separately where applicable. Actual infiltration '
  + 'can vary significantly with wind speed, building height, stack effect, mechanical pressurisation, '
  + 'construction quality and operating conditions. For critical low-dew-point applications, measured or '
  + 'engineered envelope leakage data should be used whenever available.'

/**
 * The vapor retarder, by IRC/ASHRAE class rather than a yes/no.
 *
 * 🔴 REPLACED 'Yes' | 'No' ON 2026-08-27 on engineering advice. The old pair chose
 * between a material's `perm` and `permSealed` columns; `permSealed` could not have
 * come from a published table, because a retarder's permeance is a property of the
 * RETARDER, not of the material it is fitted to. Backing the old column out implied
 * a single ~0.45-perm retarder for most rows — a Class II — behind a Yes/No whose
 * own hint offered Class I to III, a 100x range.
 *
 * Now the class carries an explicit permeance and the assembly is combined in
 * SERIES, which is how two resistances in the same vapor path actually add:
 *
 *     1 / P_assembly = 1 / P_material + 1 / P_retarder
 *
 * ⚠️ BLANK IS A REAL STATE and means no retarder credited — the bare material
 * permeance is used. There is no 'None' button; see the open question raised with
 * the owner on 2026-08-27.
 */
export type VaporBarrier = 'Class I' | 'Class II' | 'Class III'

/** Permeance of the retarder itself, grains/hr/sq.ft/inHg. */
export const VAPOR_BARRIER_PERMS: Record<VaporBarrier, number> = {
  'Class I': 0.06,
  'Class II': 0.60,
  'Class III': 3.00,
}

export const VAPOR_BARRIER_HELP: Record<VaporBarrier, string> = {
  'Class I': 'Polyethylene sheet.',
  'Class II': 'Kraft-faced fiberglass batt.',
  'Class III': 'Latex-painted gypsum board.',
}

/** Pin the union — see the same reasoning on `roomSizeMode` in app/api/rfq. */
export function normalizeVaporBarrier(v: unknown): VaporBarrier | '' {
  return v === 'Class I' || v === 'Class II' || v === 'Class III' ? v : ''
}

/** Shown behind the ⓘ beside the vapor retarder control, not printed on the page. */
export const VAPOR_BARRIER_DISCLAIMER =
  'Vapor permeance values are representative design assumptions for preliminary moisture-load '
  + 'calculations, for use when manufacturer-specific or tested assembly data are unavailable. Actual '
  + 'permeance varies with material thickness, coatings, installation quality, humidity, temperature, '
  + 'seams, penetrations and test method. Vapor-retarder classification alone does not define an exact '
  + 'permeance value. For critical low-dew-point applications, use tested permeance data for the actual '
  + 'wall, ceiling and floor assemblies whenever available.'

// Airflow velocity through an open door, fpm. Chapter 5's guidance: assume the
// local wind speed for a door to the weather, 50 fpm for a door to another
// conditioned space.
export const DOOR_VELOCITY_OUTDOOR = 350
export const DOOR_VELOCITY_INTERIOR = 50

export type Exposure = 'Outdoor' | 'Surrounding space'

export type DoorSpec = {
  id: string
  label: string
  widthFt: number
  heightFt: number
  opensPerHour: number
  secondsOpen: number
  exposure: Exposure
  /**
   * An aperture that is never closed — the product runs through it, so there is
   * no open/close cycle to count. estimateLoad charges it the full 60 minutes an
   * hour and IGNORES opensPerHour/secondsOpen.
   *
   * ⚠️ A FLAG ON THE DOOR, NOT A CHECK ON THE LABEL. `label` is a free-text input the
   * customer can rename — keying the physics off the string would mean typing
   * "Conveyor 1" silently cut that opening's load by ~10x. Set from DOOR_TYPES
   * when the opening is added, and carried through coerce() in app/api/rfq.
   *
   * Optional so surveys taken before 2026-08-26 read back as undefined and keep
   * the counted model they were quoted on.
   */
  continuouslyOpen?: boolean
  /**
   * How many identical openings this row stands for. A building with twelve of
   * the same personnel door is ONE row with quantity 12, not twelve rows.
   *
   * ⚠️ estimateLoad multiplies BOTH the load and the open-minutes by this, so it
   * is a physics field, not a label. It must be carried through coerce() in
   * app/api/rfq — that map rebuilds each door and silently drops anything it does
   * not name, which would price the browser one way and the stored record another.
   *
   * Optional, and read as 1 when absent, so every survey taken before 2026-08-26
   * reads back exactly as it was quoted.
   */
  quantity?: number
}

export const DOOR_TYPES: {
  label: string; widthFt: number; heightFt: number; secondsOpen: number
  continuouslyOpen?: boolean
}[] = [
  { label: 'Personnel door', widthFt: 3, heightFt: 7, secondsOpen: 8 },
  { label: 'Double personnel door', widthFt: 6, heightFt: 7, secondsOpen: 10 },
  { label: 'Roll-up / sectional door', widthFt: 10, heightFt: 10, secondsOpen: 45 },
  { label: 'Loading dock door', widthFt: 8, heightFt: 9, secondsOpen: 60 },
  { label: 'High-speed roll door', widthFt: 8, heightFt: 9, secondsOpen: 12 },
  { label: 'Air-lock vestibule', widthFt: 8, heightFt: 8, secondsOpen: 10 },
  // The only opening here that never closes. secondsOpen is kept for shape but is
  // not read for this type — see DoorSpec.continuouslyOpen.
  { label: 'Conveyor pass-through', widthFt: 4, heightFt: 2, secondsOpen: 60, continuouslyOpen: true },
]

// ─── Equipment & utility option lists (mirrors the paper quote request) ────────

export const VOLTAGES = ['208V / 3ph / 60Hz', '230V / 3ph / 60Hz', '460V / 3ph / 60Hz', '575V / 3ph / 60Hz', '120V / 1ph / 60Hz', '400V / 3ph / 50Hz']
// 'Painted galvanized' and 'Let IAT recommend' removed (owner, 2026-08-20). Cabinet
// construction is the customer's decision, not one to hand back to us on a form.
export const CONSTRUCTIONS = ['Galvanized (standard)', 'Aluminum', 'Stainless steel']
// Electric leads because it is the default. 'Let IAT recommend' was removed at the
// owner's request — regeneration heat is a decision the customer makes, not one to
// defer to us on the form.
export const REGEN_SOURCES = ['Electric', 'Natural gas', 'Steam', 'Hot water', 'Propane']
export const AIR_SOURCES = ['100% return air', '100% outdoor air', 'Mixed (describe below)']
// 'Not sure' removed and 'Not required' is the default (owner, 2026-08-19): most
// units have no cooling, and an unanswered cooling question is a quoting ambiguity
// where 'not required' is an actual answer. Same reasoning as the final filter.
export const COOLING_TYPES = ['Not required', 'Chilled water', 'DX (condensing unit by IAT)', 'DX (condensing unit by others)']
// 'Not sure' removed (owner, 2026-08-19), matching cooling and the final filter.
// Safe to DELETE rather than retire, unlike the material lists: heatingType is a
// spec field that only ever gets displayed — the admin detail view and the PDF —
// and never feeds estimateLoad(), so no unmatched label can fall through to a
// neighbouring row and change a number. Stored records still holding 'Not sure'
// keep rendering it, which is correct: it is what that customer actually answered.
export const HEATING_TYPES = ['Not required', 'Electric', 'Natural gas', 'Hot water', 'Steam']
export const RUNTIMES = ['Seasonal', 'Year-round, normal hours', 'Year-round, 24/7/365']
// 'Not sure' removed (owner, 2026-08-20). Default is MERV 8, an actual answer.
export const MERV_OPTIONS = ['MERV 8 (standard)', 'MERV 11', 'MERV 13', 'MERV 14', 'HEPA final']
// Final filter is its own list: most units do not have one, so 'Not required' leads
// and is the default, and 'Not sure' is gone — an unanswered final filter is a
// quoting ambiguity, whereas 'not required' is an answer.
export const FINAL_FILTER_OPTIONS = ['Not required', 'MERV 8 (standard)', 'MERV 11', 'MERV 13', 'MERV 14', 'HEPA final']
// Cut to two (owner, 2026-08-20). Rooftop and mezzanine are each already indoor or
// outdoor as far as the unit is concerned, and weatherproofing follows from Outdoor
// rather than needing to be spelled out in the label. The free-text "size
// restrictions" field on the same step is where anything unusual gets said.
// Display-only: installLocation is rendered on the admin view and the PDF and is
// never compared against or looked up, so changing these labels is safe.
export const INSTALL_LOCATIONS = ['Indoor', 'Outdoor']

// ─── Form data ────────────────────────────────────────────────────────────────

/**
 * How the room's target condition got its numbers — a REQUIRED choice on step 3
 * (owner, 2026-08-26).
 *
 * The survey no longer pre-fills the target from the application preset, because
 * a number nobody looked at was still pricing the job. Now the customer either
 * types their own figures or knowingly accepts ours, and the record says which.
 * Blank is the third state and it is the whole point: it means nobody has chosen
 * yet, and `validateStep('target')` refuses to advance on it.
 */
export type TargetSource = 'entered' | 'typical'

/**
 * What is on the other side of the room wall.
 *
 *   'outdoor' — Option A, "Outside air". The room is a standalone building, so the
 *               surrounding condition IS the outdoor design point. The surround
 *               fields are MIRRORED from the ASHRAE lookup rather than typed.
 *   'manual'  — Option B, "Box in a box". The room sits inside another building,
 *               so the surrounding condition is its own thing and is typed in.
 *
 * Blank until answered, on purpose. It moves the two biggest lines on most
 * surveys - permeation drives off the surrounding vapor pressure and infiltration
 * off the surrounding grains - so it is the same category of question as tightness
 * and the vapor barrier, and this survey has been bitten three times by answering
 * that category on the customer behalf.
 */
export type SurroundSource = 'outdoor' | 'manual'

/** Pin the union — see the same reasoning on `roomSizeMode` in app/api/rfq. */
export function normalizeSurroundSource(v: unknown): SurroundSource | '' {
  return v === 'outdoor' || v === 'manual' ? v : ''
}

/** Pin the union — see the same reasoning on `roomSizeMode` in app/api/rfq. */
export function normalizeTargetSource(v: unknown): TargetSource | '' {
  return v === 'entered' || v === 'typical' ? v : ''
}

export type RfqData = {
  track: Track
  application: string
  applicationOther: string

  // Contact & project
  company: string
  contactName: string
  email: string
  phone: string
  projectName: string
  location: string
  elevationFt: string
  endUser: string
  engineeringFirm: string
  engineerContact: string
  dateRequired: string
  dateClose: string
  purpose: string

  // Room target. `targetRhPct` stays canonical; the two Moisture fields record
  // what the customer actually typed and in which unit. Same pattern for the
  // three conditions below. See setCondition().
  targetTempF: string
  targetRhPct: string
  targetMoistureMode: MoistureMode
  targetMoistureValue: string
  /** See TargetSource. Blank until the customer chooses on step 3. */
  targetSource: TargetSource | ''
  surroundSource: SurroundSource | ''

  // Process target — canonical unit here is grains, not rh.
  leavingTempF: string
  leavingGrains: string
  leavingMoistureMode: MoistureMode
  leavingMoistureValue: string
  processCfm: string

  // Entering air
  airSource: string
  mixOutdoorPct: string
  outdoorTempF: string
  outdoorRhPct: string
  outdoorMoistureMode: MoistureMode
  outdoorMoistureValue: string
  /**
   * Where the outdoor design condition came from, e.g.
   * "ASHRAE · FULTON COUNTY AP, GA, USA · 8 mi".
   *
   * Empty means nobody looked it up and the figures are whatever the customer
   * typed, or the defaults below. That distinction is the whole reason the field
   * exists: a looked-up design condition and a template default look identical on
   * the page, and only one of them describes the customer's actual weather.
   *
   * CUSTOMER-FACING — it appears in the wizard and on their PDF, so it deliberately
   * carries no edition year. See outdoorVintage.
   */
  /**
   * Unit the customer types temperatures in. ONE setting for the whole survey —
   * somebody who thinks in Celsius thinks in it for every field, and a per-field
   * unit would let one survey mix the two. Storage stays °F regardless.
   */
  tempUnit: TempUnit
  outdoorSource: string
  /**
   * The ASHRAE edition behind those figures, e.g. "ASHRAE 2025, 2004-2023
   * observations". STAFF ONLY — shown on the admin detail view and nowhere else.
   *
   * Split out from outdoorSource on 2026-08-20 at the owner's request: the year
   * told a customer nothing they could act on and read as ambiguous (data year? a
   * forecast?), while the observation window read as though the figures were two
   * decades old. It is kept on the record because the numbers genuinely move
   * between editions — Houston is 143.9 gr/lb under 2021 and 147.9 under 2025 — so
   * when a quote and a later check disagree, this is the only thing that explains
   * why. Empty on records created before the split.
   */
  outdoorVintage: string
  surroundTempF: string
  surroundRhPct: string
  surroundMoistureMode: MoistureMode
  surroundMoistureValue: string

  // Geometry
  // Two ways in — see ROOM_SIZE_MODES and roomDims(). `roomL/W/H` stay the single
  // source of truth for the engine either way; volume mode derives them.
  roomSizeMode: RoomSizeMode
  roomVolumeCuFt: string
  roomL: string
  roomW: string
  roomH: string

  // Envelope
  wallMaterial: string
  ceilingMaterial: string
  floorMaterial: string
  /** Blank means no retarder credited — see VaporBarrier. */
  vaporBarrier: VaporBarrier | ''
  /**
   * A leakage rate the customer typed, cu.ft/hr per sq.ft of exterior wall.
   * Overrides the Tight/Average/Loose band whenever it is above zero.
   */
  tightnessCustom: string
  tightness: Tightness

  // Openings
  doors: DoorSpec[]

  // Internal loads
  occupants: string
  /**
   * Blank until chosen. It multiplies the headcount in estimateLoad, so a
   * default here is a number nobody picked pricing the job — required on step 7
   * whenever `occupants` is above zero, and irrelevant (so not required) at zero.
   */
  activity: ActivityLevel | ''
  productLoadLbHr: string
  productDescription: string
  gasCfh: string
  wetAreaSqFt: string
  wetWaterTempF: string

  // Ventilation / make-up air
  ventCfm: string
  exhaustCfm: string
  /**
   * The condition of the make-up air itself. Blank falls back to the outdoor
   * design point — which is what estimateLoad used before this existed, so an
   * untouched survey computes exactly as it did.
   *
   * Worth asking separately because make-up air is not always raw outdoor air:
   * it can come off a pre-treated deck, out of a conditioned corridor, or from a
   * neighbouring space at a condition nothing else on this form describes.
   */
  ventTempF: string
  ventRhPct: string
  ventMoistureMode: MoistureMode
  ventMoistureValue: string
  /** See VentLoadTarget — different systems, not two views of one number. */
  ventLoadTarget: VentLoadTarget

  // Equipment & utilities
  installLocation: string
  sizeRestrictions: string
  construction: string
  voltage: string
  chilledWaterEwt: string
  hotWaterEwt: string
  steamPsi: string
  regenSource: string
  regenAirSource: string
  regenIndoorConditions: string
  environmentClean: string
  contaminants: string
  prefilterMerv: string
  finalMerv: string
  coolingType: string
  heatingType: string
  runtime: string
  sensibleLoadBtuh: string
  notes: string
}

export function emptyRfq(): RfqData {
  return {
    track: 'room',
    application: '', applicationOther: '',
    company: '', contactName: '', email: '', phone: '',
    projectName: '', location: '', elevationFt: '', endUser: '',
    engineeringFirm: '', engineerContact: '', dateRequired: '', dateClose: '', purpose: '',
    // Zero, not blank, and not a preset value (owner, 2026-08-26). The customer
    // sees 0 and has to replace it — see TargetSource for why. num() returns an
    // explicit 0 rather than its fallback, so nothing quietly re-inflates these.
    targetTempF: '0', targetRhPct: '0', targetMoistureMode: 'rh', targetMoistureValue: '0',
    targetSource: '',
    surroundSource: '',
    leavingTempF: '', leavingGrains: '', leavingMoistureMode: 'gr', leavingMoistureValue: '',
    processCfm: '',
    airSource: '100% return air', mixOutdoorPct: '',
    // Was '95'/'55' — a national placeholder, NOT a design condition, and roughly
    // 100 gr/lb, which is wrong almost everywhere. Now zero (owner, 2026-08-26) so
    // nothing is assumed on the customer's behalf: step 1's location lookup fills
    // the site's real ASHRAE design point (lib/ashrae.ts), and if that never runs
    // the zero stands and validateStep('shell') will not let the survey past it.
    outdoorTempF: '0', outdoorRhPct: '0', outdoorMoistureMode: 'rh', outdoorMoistureValue: '0',
    tempUnit: 'F', outdoorSource: '', outdoorVintage: '',
    surroundTempF: '0', surroundRhPct: '0', surroundMoistureMode: 'rh', surroundMoistureValue: '0',
    // 'dimensions' is the default so the ~5 surveys taken before volume mode
    // existed still resolve through roomDims() exactly as they always did.
    roomSizeMode: 'dimensions', roomVolumeCuFt: '',
    roomL: '', roomW: '', roomH: '',
    wallMaterial: 'Insulated metal panel',
    ceilingMaterial: 'Insulated metal panel',
    floorMaterial: 'Concrete slab on grade',
    // Blank, not 'No' — the class buttons replaced the yes/no on 2026-08-27
    // and blank means no retarder credited.
    vaporBarrier: '',
    tightnessCustom: '',
    tightness: 'Average',
    doors: [],
    occupants: '0', activity: '',
    productLoadLbHr: '', productDescription: '', gasCfh: '', wetAreaSqFt: '', wetWaterTempF: '70',
    ventCfm: '', exhaustCfm: '',
    // Blank condition = fall back to the outdoor design point. 'dehumidifier' is
    // the default because it is what every survey before 2026-08-26 assumed.
    ventTempF: '', ventRhPct: '', ventMoistureMode: 'rh', ventMoistureValue: '',
    ventLoadTarget: 'dehumidifier',
    installLocation: 'Indoor', sizeRestrictions: '', construction: 'Galvanized (standard)',
    voltage: '460V / 3ph / 60Hz',
    chilledWaterEwt: '', hotWaterEwt: '', steamPsi: '',
    regenSource: 'Electric', regenAirSource: 'Outdoor', regenIndoorConditions: '',
    environmentClean: 'Clean', contaminants: '',
    prefilterMerv: 'MERV 8 (standard)', finalMerv: 'Not required',
    coolingType: 'Not required', heatingType: 'Not required',
    runtime: 'Year-round, normal hours',
    sensibleLoadBtuh: '', notes: '',
  }
}

// ─── Conditions ───────────────────────────────────────────────────────────────

export type ConditionKey = 'target' | 'surround' | 'outdoor' | 'leaving' | 'vent'

/** Which canonical field each condition keeps in sync, and its default unit. */
const CONDITION_CANON: Record<ConditionKey, { canon: 'rh' | 'gr'; defaultMode: MoistureMode }> = {
  target:   { canon: 'rh', defaultMode: 'rh' },
  surround: { canon: 'rh', defaultMode: 'rh' },
  outdoor:  { canon: 'rh', defaultMode: 'rh' },
  leaving:  { canon: 'gr', defaultMode: 'gr' },
  // Make-up / vent air. Blank on purpose — estimateLoad falls back to the outdoor
  // design point, which is what it used before this condition existed.
  vent:     { canon: 'rh', defaultMode: 'rh' },
}

/**
 * The ONE place a condition changes. Editing the dry bulb, the moisture number
 * or the unit all route through here, and the canonical field is recomputed from
 * whichever three are current.
 *
 * The dry bulb matters even when it wasn't the thing edited: a dew point of 50°F
 * is 49%rh at 75°F and 70%rh at 60°F. Leave the canonical value alone when the
 * temperature moves and the survey quietly reports air the customer never
 * described.
 *
 * Switching UNITS converts rather than clears — the air stays the same, only the
 * way of saying it changes — which is also what stops a half-typed number from
 * being reinterpreted as a different quantity.
 */
export function setCondition(
  data: RfqData,
  key: ConditionKey,
  patch: { tempF?: string; value?: string; mode?: MoistureMode },
): RfqData {
  const { canon, defaultMode } = CONDITION_CANON[key]
  const elev = num(data.elevationFt)
  const prevMode = normalizeMode(data[`${key}MoistureMode` as keyof RfqData], defaultMode)
  const tempF = patch.tempF !== undefined ? patch.tempF : (data[`${key}TempF` as keyof RfqData] as string)
  const t = num(tempF, key === 'leaving' ? 70 : 70)

  let mode = prevMode
  let value = patch.value !== undefined ? patch.value : (data[`${key}MoistureValue` as keyof RfqData] as string) ?? ''

  // A unit change re-expresses the SAME air in the new unit.
  if (patch.mode && patch.mode !== prevMode) {
    mode = patch.mode
    const current = num(value)
    if (value.trim() !== '' && Number.isFinite(current)) {
      const asRh = moistureToRh(prevMode, current, t, elev)
      value = String(roundForMode(mode, rhToMoisture(mode, asRh, t, elev)))
    }
  }

  const out: RfqData = {
    ...data,
    [`${key}TempF`]: tempF,
    [`${key}MoistureMode`]: mode,
    [`${key}MoistureValue`]: value,
  }

  // Blank stays blank — do not manufacture a 0% reading from an empty field.
  if (value.trim() === '') {
    return { ...out, [canon === 'rh' ? `${key}RhPct` : 'leavingGrains']: '' }
  }
  const n = num(value)
  return canon === 'rh'
    ? { ...out, [`${key}RhPct`]: String(roundForMode('rh', moistureToRh(mode, n, t, elev))) }
    : { ...out, leavingGrains: String(roundForMode('gr', moistureToGrains(mode, n, t, elev))) }
}

/** The as-entered reading for a condition, e.g. `50 °F dp`. */
export function conditionEntered(data: RfqData, key: ConditionKey): string {
  const { defaultMode } = CONDITION_CANON[key]
  const mode = normalizeMode(data[`${key}MoistureMode` as keyof RfqData], defaultMode)
  const value = (data[`${key}MoistureValue` as keyof RfqData] as string) ?? ''
  if (!value.trim()) {
    // Pre-selector rows carry only the canonical field.
    const canon = key === 'leaving' ? data.leavingGrains : (data[`${key}RhPct` as keyof RfqData] as string)
    return canon ? `${canon} ${MOISTURE_SUFFIX[defaultMode]}` : '—'
  }
  return `${value} ${MOISTURE_SUFFIX[mode]}`
}

/**
 * Record the chosen application and CLEAR every figure it used to seed.
 *
 * The name is now slightly wrong and kept anyway — it is called from the wizard
 * and from tests, and renaming it buys nothing. It no longer applies the preset's
 * numbers; see the comment inside.
 */
export function applyRoomPreset(data: RfqData, preset: RoomPreset): RfqData {
  return {
    ...data,
    track: 'room',
    application: preset.key,
    // ⚠️ THIS NO LONGER SEEDS ANY NUMBER (owner, 2026-08-26).
    //
    // It used to write the preset's target, surrounding condition, occupancy,
    // activity and a pre-built personnel door — the columns highlighted on the
    // preset review sheet, i.e. exactly the AUTHORED ones. Those values are
    // AI-authored and have never been signed off by an engineer (see the
    // "Reviewed by: —" note above PEOPLE_LOADS), yet every one of them reached
    // estimateLoad and priced the survey whether or not the customer ever looked
    // at the field.
    //
    // Zero is deliberate rather than blank: the customer SEES a 0 they have to
    // replace, and num() returns an explicit 0 instead of falling through to a
    // fallback. The preset values are NOT deleted — they still back the "Use
    // typical" chip on step 3, which is now an opt-in the record captures via
    // TargetSource.
    //
    // Do not re-add seeding here. That is the hidden-default bug this survey has
    // now hit three times (outdoor placeholder, hidden tightness, and this).
    targetTempF: '0',
    targetRhPct: '0',
    targetMoistureMode: 'rh',
    targetMoistureValue: '0',
    targetSource: '',
    surroundSource: '',
    surroundTempF: '0',
    surroundRhPct: '0',
    surroundMoistureMode: 'rh',
    surroundMoistureValue: '0',
    occupants: '0',
    activity: '',
    doors: [],
  }
}

export function applyProcessPreset(data: RfqData, preset: ProcessPreset): RfqData {
  return {
    ...data,
    track: 'process',
    application: preset.key,
    leavingTempF: String(preset.leavingTempF),
    leavingGrains: String(preset.leavingGrains),
    leavingMoistureMode: 'gr',
    leavingMoistureValue: String(preset.leavingGrains),
    processCfm: String(preset.cfm),
  }
}

export function presetFor(data: RfqData): RoomPreset | ProcessPreset | undefined {
  return data.track === 'room'
    ? ROOM_PRESETS.find(p => p.key === data.application)
    : PROCESS_PRESETS.find(p => p.key === data.application)
}

export function applicationLabel(data: RfqData): string {
  const preset = presetFor(data)
  if (!preset) return data.applicationOther || 'Not specified'
  if (preset.key.startsWith('other')) return data.applicationOther || preset.label
  return preset.label
}

// ─── Moisture load estimate ───────────────────────────────────────────────────

export type LoadLine = { key: string; label: string; grainsPerHour: number; detail: string }

export type LoadEstimate = {
  lines: LoadLine[]
  /** Internal room load, gr/hr, after the safety factor. */
  internalGrPerHr: number
  /**
   * Make-up air load carried SEPARATELY from the room, gr/hr.
   * Zero when ventLoadTarget is 'room' — there it is a line in `lines` instead.
   */
  ventilationGrPerHr: number
  /**
   * The make-up air's moisture load whichever way it is counted, gr/hr, after the
   * safety factor. Use this to SHOW the figure; use ventilationGrPerHr for totals.
   */
  ventGrPerHr: number
  /** Where that load was applied. See VentLoadTarget. */
  ventTarget: VentLoadTarget
  /** Grains of the make-up air itself — outdoor design point unless overridden. */
  ventGrains: number
  totalGrPerHr: number
  totalLbPerHr: number
  totalPintsPerDay: number
  /** Dry air the unit must deliver to hold the room, cfm. */
  dryAirCfm: number
  /** Grain level the supply air has to reach, gr/lb. */
  supplyGrains: number
  roomGrains: number
  outdoorGrains: number
  surroundGrains: number
  roomDewPointF: number
  volumeCuFt: number
  airChangesPerHour: number
  /** Largest single contributor — the sentence that makes the estimate useful. */
  dominant: LoadLine | null
  safetyFactor: number
  complete: boolean
}

const SAFETY_FACTOR = 0.1
/**
 * Grain depression the supply air is assumed to achieve below the room set point.
 * Chapter 5's worked example holds 30 gr/lb with 25 gr/lb supply air; 5 gr/lb is
 * the same conservative assumption, floored so very dry rooms stay solvable.
 */
function supplyDepression(roomGrains: number): number {
  return Math.max(Math.min(5, roomGrains * 0.6), 0.35)
}

const num = (v: string | number | undefined, fallback = 0): number => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : fallback
}

export function estimateLoad(data: RfqData): LoadEstimate {
  const elev = num(data.elevationFt, 0)
  // Never read roomL/W/H directly here — volume mode derives them. See roomDims().
  const { L, W, H } = roomDims(data)
  const volume = L * W * H

  const roomT = num(data.targetTempF, 70)
  const roomRh = num(data.targetRhPct, 45)
  const roomGr = grains(roomT, roomRh, elev)
  const roomVp = vaporPressureInHg(roomT, roomRh)

  const outT = num(data.outdoorTempF, 95)
  const outRh = num(data.outdoorRhPct, 55)
  const outGr = grains(outT, outRh, elev)
  const outVp = vaporPressureInHg(outT, outRh)

  const surT = num(data.surroundTempF, outT)
  const surRh = num(data.surroundRhPct, outRh)
  const surGr = grains(surT, surRh, elev)
  const surVp = vaporPressureInHg(surT, surRh)

  const density = airDensity(roomT, roomRh, elev)
  const lines: LoadLine[] = []

  // — Permeation through the envelope (Eq. 5.1: Wp = P × A × ΔVP) —
  const wallArea = 2 * (L + W) * H
  const ceilArea = L * W
  const floorArea = L * W
  // The retarder permeance, or undefined when none was chosen. See VaporBarrier:
  // blank is a real state and means no retarder credited.
  const retarderPerm = VAPOR_BARRIER_PERMS[data.vaporBarrier as VaporBarrier]
  const permOf = (list: MaterialOption[], label: string) => {
    // ⚠️ Renaming a material label silently re-prices every survey that stored the
    // old one: the lookup is an exact string match and misses fall through to the
    // LAST entry, which is the neutral retired row. "Concrete over vapour barrier"
    // was respelled on 2026-08-20 and is 0.16 perm; the fallback is 0.4. Any future
    // rename needs an entry here, not just a new label.
    const want = LEGACY_MATERIAL_LABELS[label] ?? label
    const m = list.find(x => x.label === want) ?? list[list.length - 1]
    if (!retarderPerm) return m.perm
    // Two resistances in the same vapor path add reciprocally. The result is always
    // LOWER than either alone, which is why a Class III retarder still helps a
    // gypsum wall (50 and 3.0 give 2.83) and barely touches an insulated metal
    // panel that is already tighter than the retarder (0.16 and 3.0 give 0.152).
    //
    // ⚠️ m.permSealed IS NO LONGER READ. It is kept in the tables as the record of
    // what those surveys were quoted under before 2026-08-27; nothing computes
    // from it now.
    return 1 / (1 / m.perm + 1 / retarderPerm)
  }
  const wallPerm = permOf(WALL_MATERIALS, data.wallMaterial)
  const ceilPerm = permOf(CEILING_MATERIALS, data.ceilingMaterial)
  const floorPerm = permOf(FLOOR_MATERIALS, data.floorMaterial)
  // Ground under a slab sits near saturation at the local ground-water
  // temperature; 55°F saturated is the usual stand-in when nothing is measured.
  const groundVp = vaporPressureInHg(55, 100)
  const permeation =
    Math.max(wallArea * wallPerm * (surVp - roomVp), 0) +
    Math.max(ceilArea * ceilPerm * (surVp - roomVp), 0) +
    Math.max(floorArea * floorPerm * (groundVp - roomVp), 0)
  if (volume > 0) {
    lines.push({
      key: 'permeation',
      label: 'Permeation through walls, roof and floor',
      grainsPerHour: permeation,
      detail: `${fmt(wallArea + ceilArea + floorArea)} sq.ft of envelope${data.vaporBarrier ? `, ${data.vaporBarrier} vapor retarder` : ', no vapor retarder'}`,
    })
  }

  // — Envelope air leakage (Ch. 5 Method A: whole-building infiltration) —
  // 🔴 GROSS EXTERIOR WALL AREA, not walls + ceiling (engineering advice,
  // 2026-08-27). The roof and floor are carried by permeation and the doors have
  // their own term, so including the ceiling here was counting it twice. See
  // TIGHTNESS_RATES — the rates changed at the same time and the two go together.
  const leakArea = wallArea
  // A rate the customer typed beats the band. num() returns 0 for blank or junk,
  // and a zero or negative rate is not an answer, so the band stands.
  const typedRate = num(data.tightnessCustom, 0)
  const leakRate = typedRate > 0
    ? typedRate
    : TIGHTNESS_RATES[data.tightness] ?? TIGHTNESS_RATES.Average
  const infiltration = Math.max(leakArea * leakRate * density * (surGr - roomGr), 0)
  if (volume > 0) {
    lines.push({
      key: 'infiltration',
      // Renamed from 'Air leakage through the shell' (owner, 2026-08-26). Stored
      // summaries keep whatever text they were quoted under - they are snapshotted
      // at submit and never recomputed - so shortLabel() still maps the old string.
      label: 'Infiltration',
      grainsPerHour: infiltration,
      detail: `${typedRate > 0 ? 'entered rate' : data.tightness.toLowerCase() + ' construction'}, ${leakRate} cu.ft/hr per sq.ft of exterior wall (${fmt(leakArea)} sq.ft)`,
    })
  }

  // — Door openings (Eq. 5.7: Wi = A × d × 60 × Va × ΔM, prorated by open time) —
  let doorLoad = 0
  let doorMinutes = 0
  for (const d of data.doors) {
    // Absent, zero and fractional all mean one opening. A row cannot stand for
    // less than the door it describes.
    const qty = Math.max(1, Math.round(d.quantity ?? 1))
    const area = d.widthFt * d.heightFt
    // ⚠️ A continuously-open aperture is the full hour, not a count of cycles.
    // Asked for on 2026-08-26: the wizard stops asking opens-per-hour and
    // seconds-open for a conveyor pass-through, because the product runs through
    // it and there is nothing to count. Hiding those two inputs while still
    // pricing off whatever happened to be stored in them is the exact bug this
    // survey has hit twice (tightness, vapor barrier) — so the model changes with
    // the UI rather than leaving a stale multiplier behind it.
    const minutesPerHour = d.continuouslyOpen
      ? 60
      : Math.min((d.opensPerHour * d.secondsOpen) / 60, 60)
    doorMinutes += minutesPerHour * qty
    const outside = d.exposure === 'Outdoor'
    const velocity = outside ? DOOR_VELOCITY_OUTDOOR : DOOR_VELOCITY_INTERIOR
    const delta = (outside ? outGr : surGr) - roomGr
    doorLoad += Math.max(area * velocity * minutesPerHour * density * delta, 0) * qty
  }
  if (data.doors.length) {
    // The COUNT is openings, not rows — one row of twelve doors reads as twelve.
    const openings = data.doors.reduce((n, d) => n + Math.max(1, Math.round(d.quantity ?? 1)), 0)
    lines.push({
      key: 'doors',
      label: 'Doors and openings',
      grainsPerHour: doorLoad,
      detail: `${openings} opening${openings === 1 ? '' : 's'}, open ${fmt(doorMinutes)} min per hour in total`,
    })
  }

  // — People (Eq. 5.4) —
  const people = num(data.occupants)
  // No activity chosen contributes NOTHING, rather than quietly falling back to
  // 'Light Work' as it did before 2026-08-26. Step 7 requires the choice once the
  // headcount is above zero, so a stored survey always has one; this is what the
  // live readout shows in the moments before it is picked, and showing a load
  // computed from an activity the customer never selected is the whole habit this
  // round of changes is removing.
  const perPerson = data.activity ? PEOPLE_LOADS[data.activity] : 0
  const peopleLoad = people * perPerson
  if (people > 0 && perPerson > 0) {
    lines.push({
      key: 'people',
      label: 'People in the space',
      grainsPerHour: peopleLoad,
      detail: `${people} × ${fmt(perPerson)} gr/hr (${data.activity.toLowerCase()})`,
    })
  }

  // — Product / process moisture, entered directly as lb of water per hour —
  const productLoad = num(data.productLoadLbHr) * GRAINS_PER_LB
  if (productLoad > 0) {
    lines.push({
      key: 'product',
      label: 'Product, packaging and process',
      grainsPerHour: productLoad,
      detail: data.productDescription || `${data.productLoadLbHr} lb of water per hour`,
    })
  }

  // — Open gas flame (Eq. 5.5: Wg = G × 650) —
  const gasLoad = num(data.gasCfh) * 650
  if (gasLoad > 0) {
    lines.push({
      key: 'gas',
      label: 'Unvented combustion',
      grainsPerHour: gasLoad,
      detail: `${data.gasCfh} cu.ft/hr of gas × 650 gr/cu.ft`,
    })
  }

  // — Wet surfaces (Eq. 5.6, simplified to the still-air transfer rate) —
  // H ≈ 95 Btu/hr/sq.ft/inHg for low-velocity air over a free water surface, and
  // 1050 Btu/lb latent heat near ambient; the 7000 converts lb of water to grains.
  const wetArea = num(data.wetAreaSqFt)
  const waterT = num(data.wetWaterTempF, 70)
  const wetLoad = wetArea > 0
    ? Math.max((95 * wetArea * (vaporPressureInHg(waterT, 100) - roomVp) * GRAINS_PER_LB) / 1050, 0)
    : 0
  if (wetLoad > 0) {
    lines.push({
      key: 'wet',
      label: 'Wet surfaces and open water',
      grainsPerHour: wetLoad,
      detail: `${fmt(wetArea)} sq.ft of water at ${fmt(waterT)}°F`,
    })
  }

  // — Fresh air / make-up (Eq. 5.13) —
  //
  // The AIR'S OWN CONDITION, not necessarily the outdoor design point: make-up
  // air can come off a pre-treated deck or out of a conditioned corridor. Blank
  // falls back to outdoor, which is what this used before the field existed, so
  // an untouched survey is unchanged.
  const ventEntered = String(data.ventRhPct ?? '').trim() !== ''
  const ventT = ventEntered ? num(data.ventTempF, outT) : outT
  const ventRh = ventEntered ? num(data.ventRhPct, outRh) : outRh
  const ventGr = ventEntered ? grains(ventT, ventRh, elev) : outGr

  const ventCfm = Math.max(num(data.ventCfm), num(data.exhaustCfm))
  const ventTarget = normalizeVentLoadTarget(data.ventLoadTarget)
  const ventRaw = ventCfm > 0 ? Math.max(ventCfm * density * 60 * (ventGr - roomGr), 0) : 0

  // ⚠️ WHERE THIS LANDS IS THE WHOLE POINT OF ventLoadTarget, and the two branches
  // size different equipment.
  //
  //   'dehumidifier' — ducted to the unit and dried upstream, so it is carried
  //     SEPARATELY and stays out of dryAirCfm. Ch. 5 is explicit that folding it
  //     into the room load grossly oversizes the system. Default, and what every
  //     survey before 2026-08-26 assumed.
  //
  //   'room' — delivered into the space untreated, so it is a room load like any
  //     other: pushed as a LINE here, which puts it in the breakdown bars, inside
  //     the safety factor with everything else, and inside dryAirCfm — the unit
  //     has to supply more dry air to hold the room against it.
  //
  // Pushed BEFORE rawInternal is summed, so the safety factor is applied once, to
  // everything, rather than separately to this term.
  if (ventTarget === 'room' && ventRaw > 0) {
    lines.push({
      key: 'ventilation',
      label: 'Outdoor make-up air into the room',
      grainsPerHour: ventRaw,
      detail: `${fmt(ventCfm)} cfm at ${fmtGrains(ventGr)} gr/lb, delivered into the space`,
    })
  }

  const rawInternal = lines.reduce((s, l) => s + l.grainsPerHour, 0)
  const internal = rawInternal * (1 + SAFETY_FACTOR)

  // Only the dehumidifier branch is carried outside the room load.
  const ventilation = ventTarget === 'dehumidifier' ? ventRaw * (1 + SAFETY_FACTOR) : 0

  const total = internal + ventilation
  const supplyGr = Math.max(roomGr - supplyDepression(roomGr), 0.1)
  const dryAirCfm = internal > 0 && roomGr - supplyGr > 0
    ? internal / (density * 60 * (roomGr - supplyGr))
    : 0

  const sorted = [...lines].sort((a, b) => b.grainsPerHour - a.grainsPerHour)

  return {
    lines,
    internalGrPerHr: internal,
    ventilationGrPerHr: ventilation,
    ventGrPerHr: ventRaw * (1 + SAFETY_FACTOR),
    ventTarget,
    ventGrains: ventGr,
    totalGrPerHr: total,
    totalLbPerHr: total / GRAINS_PER_LB,
    // 1 lb of water ≈ 0.9586 US pints — the unit people actually picture.
    totalPintsPerDay: (total / GRAINS_PER_LB) * 24 * 0.9586,
    dryAirCfm,
    supplyGrains: supplyGr,
    roomGrains: roomGr,
    outdoorGrains: outGr,
    surroundGrains: surGr,
    roomDewPointF: dewPointF(roomT, roomRh, elev),
    volumeCuFt: volume,
    airChangesPerHour: volume > 0 ? (dryAirCfm * 60) / volume : 0,
    dominant: sorted[0] ?? null,
    safetyFactor: SAFETY_FACTOR,
    complete: volume > 0 && roomGr > 0,
  }
}

/** Process track: the useful headline is grain depression and pounds removed. */
export type ProcessEstimate = {
  cfm: number
  enteringGrains: number
  leavingGrains: number
  depression: number
  lbPerHr: number
  leavingDewPointF: number
  leavingRhPct: number
  complete: boolean
}

export function estimateProcess(data: RfqData): ProcessEstimate {
  const elev = num(data.elevationFt, 0)
  const cfm = num(data.processCfm)
  const leavingGr = num(data.leavingGrains)
  const leavingT = num(data.leavingTempF, 70)

  const outGr = grains(num(data.outdoorTempF, 95), num(data.outdoorRhPct, 55), elev)
  const returnGr = grains(num(data.surroundTempF, 75), num(data.surroundRhPct, 50), elev)
  const mix = clamp01(num(data.mixOutdoorPct, 0) / 100)
  const enteringGr =
    data.airSource === '100% outdoor air' ? outGr
      : data.airSource === '100% return air' ? returnGr
      : returnGr + (outGr - returnGr) * mix

  const density = airDensity(leavingT, 50, elev)
  const depression = Math.max(enteringGr - leavingGr, 0)
  return {
    cfm,
    enteringGrains: enteringGr,
    leavingGrains: leavingGr,
    depression,
    lbPerHr: (cfm * density * 60 * depression) / GRAINS_PER_LB,
    leavingDewPointF: leavingGr > 0 ? dewPointF(leavingT, rhFromGrains(leavingT, leavingGr, elev), elev) : -100,
    leavingRhPct: rhFromGrains(leavingT, leavingGr, elev),
    complete: cfm > 0 && leavingGr > 0,
  }
}

// ─── Formatting ───────────────────────────────────────────────────────────────

export function fmt(n: number, digits = 0): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

/** Grain values span 0.4 → 150, so pick the precision from the magnitude. */
export function fmtGrains(n: number): string {
  if (!Number.isFinite(n)) return '—'
  if (n < 1) return n.toFixed(2)
  if (n < 10) return n.toFixed(1)
  return fmt(n)
}

export function fmtDewPoint(n: number): string {
  return n <= -99 ? '—' : `${Math.round(n)}°F`
}

function clamp01(n: number): number {
  return Math.min(Math.max(Number.isFinite(n) ? n : 0, 0), 1)
}

export { grains, dewPointF, rhFromGrains, vaporPressureFromGrains, airDensity }
