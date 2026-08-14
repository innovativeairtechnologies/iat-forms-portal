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
  rhFromGrains,
  vaporPressureFromGrains,
  vaporPressureInHg,
} from './rfq-psych'

export const LOAD_DISCLAIMER =
  'This is a preliminary estimate generated from the information entered above. Final verification is required by the owner or a qualified mechanical engineer. IAT does not guarantee the estimate due to potential differences between the information provided and actual facility conditions, and does not guarantee compliance with state or local codes or standards.'

export type Track = 'room' | 'process'

// ─── Application presets ──────────────────────────────────────────────────────
// The heart of "typical values at each stage": picking an application seeds the
// target condition, the surrounding space, occupancy and door activity with
// numbers a person in that industry would recognise. Every seeded value stays
// editable — the preset is a starting point, never an answer.

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

/** gr/hr of water vapour released per person, by activity (IAT people-load table). */
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
    note: 'Below 40%rh, corrosion effectively stops on most steels — which is why 40% is the classic warehouse spec.',
  },
  {
    key: 'cold-storage',
    label: 'Cold storage / refrigerated room',
    blurb: 'Chilled coolers, docks and processing rooms above freezing.',
    driver: 'Killing fog, frost on coils and slippery floors',
    tempF: 38, rhPct: 60, surroundTempF: 80, surroundRhPct: 60,
    occupants: 2, activity: 'Moderate Work', doorOpensPerHour: 20,
    note: 'Cold rooms are dominated by door traffic — every opening dumps warm wet air onto cold surfaces.',
  },
  {
    key: 'freezer',
    label: 'Freezer / blast freezer',
    blurb: 'Sub-freezing storage, spiral freezers and freezer docks.',
    driver: 'Frost on evaporators, ceilings and door tracks',
    tempF: 0, rhPct: 70, surroundTempF: 45, surroundRhPct: 70,
    occupants: 1, activity: 'Moderate Work', doorOpensPerHour: 12,
    note: 'Below freezing a desiccant unit is usually the only practical way to dry the air — cooling coils just make ice.',
  },
  {
    key: 'pharma',
    label: 'Pharmaceutical / tableting',
    blurb: 'Tableting, encapsulation, granulation and packaging suites.',
    driver: 'Tablet hardness, powder flow and product stability',
    tempF: 72, rhPct: 25, surroundTempF: 75, surroundRhPct: 50,
    occupants: 6, activity: 'Light Work', doorOpensPerHour: 12,
    note: 'Tight tolerance work — a ±3%rh band is common, and that band drives the control strategy as much as the load.',
  },
  {
    key: 'dry-room',
    label: 'Battery / lithium dry room',
    blurb: 'Cell assembly, electrode handling and anhydrous processes.',
    driver: 'Lithium reacting with water vapour',
    tempF: 68, rhPct: 1, surroundTempF: 75, surroundRhPct: 50,
    occupants: 4, activity: 'Light Work', doorOpensPerHour: 6,
    note: 'Specified by dew point, not %rh. 1%rh at 68°F is roughly a −20°F dew point; many cell lines ask for −40°F or drier.',
  },
  {
    key: 'food',
    label: 'Food processing / packaging',
    blurb: 'Cut rooms, packaging halls, powder rooms and washdown areas.',
    driver: 'Condensation over open product, mould and sanitation holds',
    tempF: 50, rhPct: 55, surroundTempF: 80, surroundRhPct: 60,
    occupants: 12, activity: 'Moderate Work', doorOpensPerHour: 20,
    note: 'Washdown adds a large periodic load — tell us the wet floor area and we size for the recovery, not the average.',
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
    note: 'Spectator load swings enormously between practice and game day — give us both if you can.',
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
    driver: 'Mould, foxing and dimensional movement in organics',
    tempF: 68, rhPct: 45, surroundTempF: 75, surroundRhPct: 55,
    occupants: 1, activity: 'Light Work', doorOpensPerHour: 2,
    note: 'A passive space — the loads are small, so envelope leakage and stability of control dominate the design.',
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
    driver: 'Mould, terpene loss and an even dry-down curve',
    tempF: 62, rhPct: 55, surroundTempF: 78, surroundRhPct: 55,
    occupants: 3, activity: 'Light Work', doorOpensPerHour: 6,
    note: 'The plant material itself is the load, and it decays over the cycle — tell us the wet weight loaded per batch.',
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
    note: 'The pool surface is the dominant load — we need the water surface area and water temperature.',
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
    blurb: 'Injection and blow moulding floors, resin handling, tool storage.',
    driver: 'Condensation on chilled tools and wet resin',
    tempF: 75, rhPct: 45, surroundTempF: 88, surroundRhPct: 60,
    occupants: 8, activity: 'Moderate Work', doorOpensPerHour: 12,
  },
  {
    key: 'restoration',
    label: 'Restoration / structural drying',
    blurb: 'Water-damaged buildings, tank and vessel drying, new-build dry-out.',
    driver: 'Drying the structure fast enough to stop mould',
    tempF: 80, rhPct: 35, surroundTempF: 85, surroundRhPct: 60,
    occupants: 2, activity: 'Moderate Work', doorOpensPerHour: 6,
    note: 'Temporary duty — tell us the target completion date and we will quote rental as well as purchase.',
  },
  {
    key: 'other-room',
    label: 'Something else',
    blurb: "Describe it in your own words and we'll work from that.",
    driver: 'Your call — tell us what the humidity is hurting',
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
    leavingTempF: 70, leavingGrains: 0.4, cfm: 4000,
    note: 'Around 0.4 gr/lb is a −40°F dew point. Tell us the dew point if that is how your spec is written.',
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
    note: 'Resin drying runs hot and very dry — the leaving dew point matters far more than the temperature.',
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
    driver: 'Your call — tell us what the moisture is hurting',
    leavingTempF: 70, leavingGrains: 20, cfm: 2000,
  },
]

// ─── Construction & envelope reference ────────────────────────────────────────
// Permeance in gr/hr/sq.ft/inHg of vapour-pressure difference. Values are the
// standard building-material set from ASHRAE Fundamentals, matched to the
// material list in IAT's moisture-load workbook.

export type MaterialOption = { label: string; perm: number; permSealed: number }

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
  { label: 'Not sure', perm: 1.0, permSealed: 0.35 },
]

export const CEILING_MATERIALS: MaterialOption[] = [
  { label: 'Insulated metal panel', perm: 0.16, permSealed: 0.16 },
  { label: 'Metal deck / built-up roof', perm: 0.16, permSealed: 0.16 },
  { label: 'Concrete slab above', perm: 0.4, permSealed: 0.21 },
  { label: 'Gypsum board, painted', perm: 50, permSealed: 0.45 },
  { label: 'Suspended tile (open plenum)', perm: 116, permSealed: 1.6 },
  { label: 'Open to structure', perm: 116, permSealed: 1.6 },
  { label: 'Not sure', perm: 1.0, permSealed: 0.35 },
]

export const FLOOR_MATERIALS: MaterialOption[] = [
  { label: 'Concrete slab on grade', perm: 0.4, permSealed: 0.21 },
  { label: 'Concrete slab, sealed / coated', perm: 0.21, permSealed: 0.16 },
  { label: 'Concrete over vapour barrier', perm: 0.16, permSealed: 0.06 },
  { label: 'Elevated concrete deck', perm: 0.4, permSealed: 0.21 },
  { label: 'Wood / raised floor', perm: 5.3, permSealed: 0.45 },
  { label: 'Not sure', perm: 0.4, permSealed: 0.21 },
]

/**
 * Whole-envelope air leakage, cu.ft/hr per sq.ft of envelope. Chapter 5's
 * "Method A" shorthand — a single tightness band instead of totalling every
 * crack, which is the only realistic thing to ask a customer for.
 */
export type Tightness = 'Tight' | 'Average' | 'Loose' | 'Not sure'
export const TIGHTNESS_RATES: Record<Tightness, number> = {
  Tight: 0.25,
  Average: 0.6,
  Loose: 1.5,
  'Not sure': 0.6,
}
export const TIGHTNESS_HELP: Record<Tightness, string> = {
  Tight: 'Purpose-built envelope — sealed penetrations, gasketed doors, taped vapour barrier.',
  Average: 'Newer building, normal construction. No deliberate sealing programme.',
  Loose: 'Older or industrial shell — visible daylight at joints, unsealed conduit, worn door seals.',
  'Not sure': "We'll assume average construction and confirm during the survey.",
}

export type VaporBarrier = 'Yes' | 'No' | 'Not sure'

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
}

export const DOOR_TYPES: { label: string; widthFt: number; heightFt: number; secondsOpen: number }[] = [
  { label: 'Personnel door', widthFt: 3, heightFt: 7, secondsOpen: 8 },
  { label: 'Double personnel door', widthFt: 6, heightFt: 7, secondsOpen: 10 },
  { label: 'Roll-up / sectional door', widthFt: 10, heightFt: 10, secondsOpen: 45 },
  { label: 'Loading dock door', widthFt: 8, heightFt: 9, secondsOpen: 60 },
  { label: 'High-speed roll door', widthFt: 8, heightFt: 9, secondsOpen: 12 },
  { label: 'Air-lock vestibule', widthFt: 8, heightFt: 8, secondsOpen: 10 },
  { label: 'Conveyor pass-through', widthFt: 4, heightFt: 2, secondsOpen: 60 },
]

// ─── Equipment & utility option lists (mirrors the paper quote request) ────────

export const VOLTAGES = ['208V / 3ph / 60Hz', '230V / 3ph / 60Hz', '460V / 3ph / 60Hz', '575V / 3ph / 60Hz', '120V / 1ph / 60Hz', '400V / 3ph / 50Hz']
export const CONSTRUCTIONS = ['Galvanized (standard)', 'Painted galvanized', 'Aluminum', 'Stainless steel', 'Let IAT recommend']
export const REGEN_SOURCES = ['Natural gas', 'Electric', 'Steam', 'Hot water', 'Propane', 'Let IAT recommend']
export const AIR_SOURCES = ['100% return air', '100% outdoor air', 'Mixed — describe below']
export const COOLING_TYPES = ['Not required', 'Chilled water', 'DX — condensing unit by IAT', 'DX — condensing unit by others', 'Not sure']
export const HEATING_TYPES = ['Not required', 'Electric', 'Natural gas', 'Hot water', 'Steam', 'Not sure']
export const PACKAGE_PREFS = ['Skid-mounted package', 'Split system', 'Let IAT recommend']
export const RUNTIMES = ['Seasonal', 'Year-round, normal hours', 'Year-round, 24/7/365']
export const MERV_OPTIONS = ['MERV 8 (standard)', 'MERV 11', 'MERV 13', 'MERV 14', 'HEPA final', 'Not sure']
export const INSTALL_LOCATIONS = ['Indoor', 'Outdoor (weatherproof)', 'Rooftop', 'Mezzanine / platform', 'Not sure']

// ─── Form data ────────────────────────────────────────────────────────────────

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

  // Room target
  targetTempF: string
  targetRhPct: string

  // Process target
  leavingTempF: string
  leavingGrains: string
  processCfm: string

  // Entering air
  airSource: string
  mixOutdoorPct: string
  outdoorTempF: string
  outdoorRhPct: string
  surroundTempF: string
  surroundRhPct: string

  // Geometry
  roomL: string
  roomW: string
  roomH: string

  // Envelope
  wallMaterial: string
  ceilingMaterial: string
  floorMaterial: string
  vaporBarrier: VaporBarrier
  tightness: Tightness

  // Openings
  doors: DoorSpec[]

  // Internal loads
  occupants: string
  activity: ActivityLevel
  productLoadLbHr: string
  productDescription: string
  gasCfh: string
  wetAreaSqFt: string
  wetWaterTempF: string

  // Ventilation
  ventCfm: string
  exhaustCfm: string

  // Equipment & utilities
  installLocation: string
  sizeRestrictions: string
  construction: string
  voltage: string
  gasAvailable: boolean
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
  packagePref: string
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
    targetTempF: '', targetRhPct: '',
    leavingTempF: '', leavingGrains: '', processCfm: '',
    airSource: '100% return air', mixOutdoorPct: '',
    outdoorTempF: '95', outdoorRhPct: '55',
    surroundTempF: '', surroundRhPct: '',
    roomL: '', roomW: '', roomH: '',
    wallMaterial: 'Insulated metal panel',
    ceilingMaterial: 'Insulated metal panel',
    floorMaterial: 'Concrete slab on grade',
    vaporBarrier: 'Not sure',
    tightness: 'Average',
    doors: [],
    occupants: '', activity: 'Light Work',
    productLoadLbHr: '', productDescription: '', gasCfh: '', wetAreaSqFt: '', wetWaterTempF: '70',
    ventCfm: '', exhaustCfm: '',
    installLocation: 'Indoor', sizeRestrictions: '', construction: 'Galvanized (standard)',
    voltage: '460V / 3ph / 60Hz', gasAvailable: false,
    chilledWaterEwt: '', hotWaterEwt: '', steamPsi: '',
    regenSource: 'Let IAT recommend', regenAirSource: 'Outdoor', regenIndoorConditions: '',
    environmentClean: 'Clean', contaminants: '',
    prefilterMerv: 'MERV 8 (standard)', finalMerv: 'Not sure',
    coolingType: 'Not sure', heatingType: 'Not required',
    packagePref: 'Let IAT recommend', runtime: 'Year-round, normal hours',
    sensibleLoadBtuh: '', notes: '',
  }
}

/** Seed the form from a chosen application, preserving anything already typed. */
export function applyRoomPreset(data: RfqData, preset: RoomPreset): RfqData {
  return {
    ...data,
    track: 'room',
    application: preset.key,
    targetTempF: String(preset.tempF),
    targetRhPct: String(preset.rhPct),
    surroundTempF: String(preset.surroundTempF),
    surroundRhPct: String(preset.surroundRhPct),
    occupants: String(preset.occupants),
    activity: preset.activity,
    doors: preset.doorOpensPerHour
      ? [{
          id: 'd1',
          label: 'Personnel door',
          widthFt: 3, heightFt: 7,
          opensPerHour: preset.doorOpensPerHour,
          secondsOpen: 8,
          exposure: 'Surrounding space',
        }]
      : [],
  }
}

export function applyProcessPreset(data: RfqData, preset: ProcessPreset): RfqData {
  return {
    ...data,
    track: 'process',
    application: preset.key,
    leavingTempF: String(preset.leavingTempF),
    leavingGrains: String(preset.leavingGrains),
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
  /** Ventilation / make-up air load, gr/hr — carried separately, per Ch. 5. */
  ventilationGrPerHr: number
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
  const L = num(data.roomL), W = num(data.roomW), H = num(data.roomH)
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
  const sealed = data.vaporBarrier === 'Yes'
  const permOf = (list: MaterialOption[], label: string) => {
    const m = list.find(x => x.label === label) ?? list[list.length - 1]
    return sealed ? m.permSealed : m.perm
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
      detail: `${fmt(wallArea + ceilArea + floorArea)} sq.ft of envelope${sealed ? ', vapour barrier credited' : ', no vapour barrier'}`,
    })
  }

  // — Envelope air leakage (Ch. 5 Method A: whole-building infiltration) —
  const envelopeArea = wallArea + ceilArea
  const leakRate = TIGHTNESS_RATES[data.tightness] ?? TIGHTNESS_RATES.Average
  const infiltration = Math.max(envelopeArea * leakRate * density * (surGr - roomGr), 0)
  if (volume > 0) {
    lines.push({
      key: 'infiltration',
      label: 'Air leakage through the shell',
      grainsPerHour: infiltration,
      detail: `${data.tightness.toLowerCase()} construction, ${leakRate} cu.ft/hr per sq.ft`,
    })
  }

  // — Door openings (Eq. 5.7: Wi = A × d × 60 × Va × ΔM, prorated by open time) —
  let doorLoad = 0
  let doorMinutes = 0
  for (const d of data.doors) {
    const area = d.widthFt * d.heightFt
    const minutesPerHour = Math.min((d.opensPerHour * d.secondsOpen) / 60, 60)
    doorMinutes += minutesPerHour
    const outside = d.exposure === 'Outdoor'
    const velocity = outside ? DOOR_VELOCITY_OUTDOOR : DOOR_VELOCITY_INTERIOR
    const delta = (outside ? outGr : surGr) - roomGr
    doorLoad += Math.max(area * velocity * minutesPerHour * density * delta, 0)
  }
  if (data.doors.length) {
    lines.push({
      key: 'doors',
      label: 'Doors and openings',
      grainsPerHour: doorLoad,
      detail: `${data.doors.length} opening${data.doors.length === 1 ? '' : 's'}, open ${fmt(doorMinutes)} min per hour in total`,
    })
  }

  // — People (Eq. 5.4) —
  const people = num(data.occupants)
  const perPerson = PEOPLE_LOADS[data.activity] ?? PEOPLE_LOADS['Light Work']
  const peopleLoad = people * perPerson
  if (people > 0) {
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

  const rawInternal = lines.reduce((s, l) => s + l.grainsPerHour, 0)
  const internal = rawInternal * (1 + SAFETY_FACTOR)

  // — Fresh air / make-up (Eq. 5.13). Kept OUT of the internal total on purpose:
  //   Chapter 5 is explicit that folding ventilation moisture into the room load
  //   grossly oversizes the system, because the unit dries that air upstream. —
  const ventCfm = Math.max(num(data.ventCfm), num(data.exhaustCfm))
  const ventilation = ventCfm > 0
    ? Math.max(ventCfm * density * 60 * (outGr - roomGr), 0) * (1 + SAFETY_FACTOR)
    : 0

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
