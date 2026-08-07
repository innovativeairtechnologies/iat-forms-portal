// ─────────────────────────────────────────────────────────────────────────────
// lib/soo.ts — the Sequence of Operation engine.
//
// Pure and dependency-free, so the client editor, the server routes and
// scripts/verify-soo.mjs all import it directly. The master clause content lives
// in lib/soo-master.ts; the DB override + version pinning in lib/soo-library.ts.
//
// ── The one design decision everything else follows ─────────────────────────
// ASSEMBLY IS DETERMINISTIC. There is no model in this path.
//
// An SOO is a controls contract: it goes to the controls contractor and the BAS
// integrator, and commissioning checks the unit against it. Two failure modes
// drove the shape of this file.
//
// 1. SILENT OMISSION. If a clause can disappear without anyone being told, the
//    document is untrustworthy — a missing freeze-protection clause reads
//    exactly like a unit that never needed one. So `assemble()` returns the
//    EXCLUDED and BLOCKED sets alongside the included one, and every caller is
//    expected to show them. Nothing is dropped quietly.
//
//    This is also why `evaluateRequires` is THREE-valued. A null fact is not
//    false. If extraction never read `reactivation`, the steam clause must land
//    on `blocked` ("needs reactivation"), NOT vanish because `null !== 'steam'`.
//    Two-valued logic would defeat the entire guarantee at the first null.
//
// 2. TWO KINDS OF NUMBER. The 120°F react permissive, the 40°F freeze stage and
//    the 300°F react ceiling are PLC CONSTANTS — they live in CONTROL_CONSTANTS
//    and are identical on every project. 3,000 CFM and 240°F react heat-to are
//    DESIGN CONDITIONS read off the submittal. A third kind, PROJECT SETPOINTS
//    (space dewpoint, time delays), is owned by neither and is usually "TBD at
//    commissioning".
//
//    `SlotBinding` is a discriminated union precisely so a clause CANNOT bind a
//    control constant to a submittal fact. Getting those three confused is the
//    most plausible way this tool ships a wrong sequence.
//
// Related: lib/srv.ts (the conditional-section precedent), lib/proposals.ts
// (the draft/edited + approvalBlockers precedent).
// ─────────────────────────────────────────────────────────────────────────────

// ─── Unit facts ──────────────────────────────────────────────────────────────

export type Reactivation = 'steam' | 'gas' | 'electric' | 'hot_water'
export type CoolMedium = 'chilled_water' | 'dx' | 'none'
export type HeatMedium = 'hot_water' | 'steam' | 'electric' | 'none'
export type DamperKind = 'none' | 'two_position' | 'motorized_modulating' | 'manually_set'
export type FanDrive = 'vfd' | 'across_line'
export type ControlsPackage = 'icontrol_premium' | 'icontrol_standard' | 'other'
export type BasProtocol = 'bacnet_mstp' | 'bacnet_ip' | 'modbus' | 'none'
export type SensorLocation = 'space' | 'post_desiccant'

export type CoilDuty = {
  service: 'pre_cool' | 'post_cool' | 'post_heat' | 'react_heat'
  btuh_summer: number | null
  btuh_winter: number | null
  gpm_summer: number | null
  gpm_winter: number | null
  ewt_f: number | null
  lwt_f: number | null
}

export type WeatherDesign = {
  station: string
  elevation_ft: number | null
  design_db_f: number | null
  design_wb_f: number | null
  heating_db_f: number | null
}

/**
 * Everything the clause predicates and slots can read.
 *
 * `null` means UNKNOWN, never "no". A component that is genuinely absent is
 * `has_x: false` / `x_medium: 'none'`. That distinction is load-bearing: null
 * blocks a clause and surfaces it for a human, false cleanly excludes it.
 *
 * Provenance is deliberately NOT embedded here — predicates evaluate against a
 * clean typed object, and `UnitFactsRecord` carries the sidecar.
 */
export type UnitFacts = {
  // ── Identity ── Schedule page header (clean, colon-delimited) or the cover.
  // Never the per-component page headers: those scramble reading order.
  customer: string | null
  project_name: string | null
  model_number: string | null
  unit_tag: string | null
  serial_number: string | null
  voltage: string | null
  controls_package: ControlsPackage | null
  bas_protocol: BasProtocol | null

  // ── Component presence ── Schedule authoritative; component pages confirm.
  has_desiccant_wheel: boolean | null
  has_process_filter: boolean | null
  has_react_filter: boolean | null
  has_final_filter: boolean | null
  has_process_fan: boolean | null
  has_react_fan: boolean | null
  has_afms: boolean | null
  has_rotor_rotation_alarm: boolean | null
  has_idp: boolean | null
  has_process_plenum_pressure_xmtr: boolean | null
  has_react_plenum_pressure_xmtr: boolean | null
  dirty_filter_alarms: boolean | null

  // ── Component options — the enums that gate clauses ──
  reactivation: Reactivation | null
  pre_cool_medium: CoolMedium | null
  post_cool_medium: CoolMedium | null
  post_heat_medium: HeatMedium | null
  humidity_sensor_location: SensorLocation | null
  space_sensor_ships_loose: boolean | null
  oa_damper: DamperKind | null
  ra_damper: DamperKind | null
  react_outlet_damper: DamperKind | null
  process_fan_drive: FanDrive | null
  react_fan_drive: FanDrive | null
  wheel_drive: FanDrive | null

  // ── Design conditions — printed, never gating ──
  process_cfm: number | null
  react_cfm: number | null
  outside_air_cfm: number | null
  return_air_cfm: number | null
  process_esp_inwc: number | null
  react_esp_inwc: number | null
  react_heat_to_f_summer: number | null
  react_heat_to_f_winter: number | null
  moisture_removal_lb_hr: number | null
  steam_pressure_psi: number | null
  coils: CoilDuty[] | null
  weather: WeatherDesign | null
}

export type FactKey = keyof UnitFacts

/** A blank fact set. Every key present and null — "unknown", not "absent". */
export function blankFacts(): UnitFacts {
  const out = {} as Record<string, unknown>
  for (const key of Object.keys(FACT_SPECS)) out[key] = null
  return out as UnitFacts
}

// ─── Fact registry ───────────────────────────────────────────────────────────

export type FactKind = 'string' | 'boolean' | 'number' | 'enum' | 'object'

export type FactSpec = {
  label: string
  kind: FactKind
  /** Allowed values for `kind: 'enum'` — also drives the review UI's dropdown. */
  options?: readonly string[]
  /** Design conditions are printed but never appear in a `requires`. */
  group: 'identity' | 'presence' | 'options' | 'design'
  unit?: string
}

/**
 * Every fact key, declared once. This is what makes an unknown key in a
 * predicate a VALIDATION ERROR at save time rather than a silent false at
 * runtime — see `validateLibrary`.
 */
export const FACT_SPECS: Record<FactKey, FactSpec> = {
  customer: { label: 'Customer', kind: 'string', group: 'identity' },
  project_name: { label: 'Project', kind: 'string', group: 'identity' },
  model_number: { label: 'Model number', kind: 'string', group: 'identity' },
  unit_tag: { label: 'Unit tag', kind: 'string', group: 'identity' },
  serial_number: { label: 'Serial number', kind: 'string', group: 'identity' },
  voltage: { label: 'Voltage', kind: 'string', group: 'identity' },
  controls_package: {
    label: 'Controls package',
    kind: 'enum',
    options: ['icontrol_premium', 'icontrol_standard', 'other'],
    group: 'identity',
  },
  bas_protocol: {
    label: 'BAS protocol',
    kind: 'enum',
    options: ['bacnet_mstp', 'bacnet_ip', 'modbus', 'none'],
    group: 'identity',
  },

  has_desiccant_wheel: { label: 'Desiccant wheel', kind: 'boolean', group: 'presence' },
  has_process_filter: { label: 'Process filter', kind: 'boolean', group: 'presence' },
  has_react_filter: { label: 'React filter', kind: 'boolean', group: 'presence' },
  has_final_filter: { label: 'Final filter', kind: 'boolean', group: 'presence' },
  has_process_fan: { label: 'Process fan', kind: 'boolean', group: 'presence' },
  has_react_fan: { label: 'React fan', kind: 'boolean', group: 'presence' },
  has_afms: { label: 'Air flow monitoring station (Ebtron)', kind: 'boolean', group: 'presence' },
  has_rotor_rotation_alarm: { label: 'Rotor rotation alarm package', kind: 'boolean', group: 'presence' },
  has_idp: { label: 'IDP', kind: 'boolean', group: 'presence' },
  has_process_plenum_pressure_xmtr: { label: 'Process plenum pressure transmitter', kind: 'boolean', group: 'presence' },
  has_react_plenum_pressure_xmtr: { label: 'React plenum pressure transmitter', kind: 'boolean', group: 'presence' },
  dirty_filter_alarms: { label: 'Dirty filter alarms', kind: 'boolean', group: 'presence' },

  reactivation: {
    label: 'Reactivation type',
    kind: 'enum',
    options: ['steam', 'gas', 'electric', 'hot_water'],
    group: 'options',
  },
  pre_cool_medium: {
    label: 'Pre-cooling medium',
    kind: 'enum',
    options: ['chilled_water', 'dx', 'none'],
    group: 'options',
  },
  post_cool_medium: {
    label: 'Post-cooling medium',
    kind: 'enum',
    options: ['chilled_water', 'dx', 'none'],
    group: 'options',
  },
  post_heat_medium: {
    label: 'Post-heating medium',
    kind: 'enum',
    options: ['hot_water', 'steam', 'electric', 'none'],
    group: 'options',
  },
  humidity_sensor_location: {
    label: 'Humidity control based on',
    kind: 'enum',
    options: ['space', 'post_desiccant'],
    group: 'options',
  },
  space_sensor_ships_loose: { label: 'Space sensor ships loose', kind: 'boolean', group: 'options' },
  oa_damper: {
    label: 'Outside-air damper',
    kind: 'enum',
    options: ['none', 'two_position', 'motorized_modulating', 'manually_set'],
    group: 'options',
  },
  ra_damper: {
    label: 'Return-air damper',
    kind: 'enum',
    options: ['none', 'two_position', 'motorized_modulating', 'manually_set'],
    group: 'options',
  },
  react_outlet_damper: {
    label: 'React outlet damper',
    kind: 'enum',
    options: ['none', 'two_position', 'motorized_modulating', 'manually_set'],
    group: 'options',
  },
  process_fan_drive: { label: 'Process fan drive', kind: 'enum', options: ['vfd', 'across_line'], group: 'options' },
  react_fan_drive: { label: 'React fan drive', kind: 'enum', options: ['vfd', 'across_line'], group: 'options' },
  wheel_drive: { label: 'Wheel gear motor drive', kind: 'enum', options: ['vfd', 'across_line'], group: 'options' },

  process_cfm: { label: 'Process airflow', kind: 'number', group: 'design', unit: 'CFM' },
  react_cfm: { label: 'React airflow', kind: 'number', group: 'design', unit: 'CFM' },
  outside_air_cfm: { label: 'Outside air', kind: 'number', group: 'design', unit: 'CFM' },
  return_air_cfm: { label: 'Return air', kind: 'number', group: 'design', unit: 'CFM' },
  process_esp_inwc: { label: 'Process external static', kind: 'number', group: 'design', unit: '" w.c.' },
  react_esp_inwc: { label: 'React external static', kind: 'number', group: 'design', unit: '" w.c.' },
  react_heat_to_f_summer: { label: 'React heat-to (summer)', kind: 'number', group: 'design', unit: '°F' },
  react_heat_to_f_winter: { label: 'React heat-to (winter)', kind: 'number', group: 'design', unit: '°F' },
  moisture_removal_lb_hr: { label: 'System moisture removal', kind: 'number', group: 'design', unit: 'lbs/hr' },
  steam_pressure_psi: { label: 'Steam pressure', kind: 'number', group: 'design', unit: 'PSI' },
  coils: { label: 'Coil duties', kind: 'object', group: 'design' },
  weather: { label: 'Weather design data', kind: 'object', group: 'design' },
}

export const FACT_KEYS = Object.keys(FACT_SPECS) as FactKey[]

/**
 * Coerce one incoming value against its FACT_SPEC. Never throws, never invents.
 *
 * A value of the wrong shape becomes `null` — which means UNKNOWN, so the
 * clauses depending on it BLOCK and surface for a human, rather than a junk
 * value silently gating one. Shared by the PATCH route (human edits) and the
 * extractor (model findings) so both are held to the same standard.
 */
export function coerceFactValue(key: FactKey, raw: unknown): unknown {
  if (raw === null || raw === undefined || raw === '') return null
  const spec = FACT_SPECS[key]
  if (spec.kind === 'boolean') {
    if (typeof raw === 'boolean') return raw
    const s = String(raw).trim().toLowerCase()
    if (['true', 'yes', 'y', '1'].includes(s)) return true
    if (['false', 'no', 'n', '0'].includes(s)) return false
    return null
  }
  if (spec.kind === 'number') {
    const n = typeof raw === 'number' ? raw : Number(String(raw).replace(/,/g, ''))
    return Number.isFinite(n) ? n : null
  }
  if (spec.kind === 'enum') {
    const s = String(raw).trim()
    return spec.options?.includes(s) ? s : null
  }
  if (spec.kind === 'object') return typeof raw === 'object' ? raw : null
  return String(raw)
}

/** Human-readable value for the review table and the "why" panel. */
export function factValueLabel(key: FactKey, value: unknown): string {
  if (value === null || value === undefined) return '—'
  const spec = FACT_SPECS[key]
  if (spec.kind === 'boolean') return value ? 'Yes' : 'No'
  if (spec.kind === 'enum') return enumLabel(String(value))
  if (spec.kind === 'object') return Array.isArray(value) ? `${value.length} entries` : 'set'
  if (spec.kind === 'number' && spec.unit) return `${formatNumber(Number(value))} ${spec.unit}`
  return String(value)
}

/** `motorized_modulating` → `Motorized (modulating)`. Presentation only. */
export function enumLabel(raw: string): string {
  const special: Record<string, string> = {
    icontrol_premium: 'iControl Premium',
    icontrol_standard: 'iControl Standard',
    bacnet_mstp: 'BACnet MS/TP',
    bacnet_ip: 'BACnet IP',
    modbus: 'Modbus',
    chilled_water: 'Chilled water',
    hot_water: 'Hot water',
    dx: 'DX',
    vfd: 'VFD',
    across_line: 'Across-the-line',
    motorized_modulating: 'Motorized (modulating)',
    two_position: 'Two-position',
    manually_set: 'Manually set',
    post_desiccant: 'Leaving air (post-desiccant)',
    space: 'Space condition',
    none: 'None',
  }
  if (special[raw]) return special[raw]
  return raw.charAt(0).toUpperCase() + raw.slice(1).replace(/_/g, ' ')
}

// ─── Control constants ───────────────────────────────────────────────────────

export type ConstKey =
  | 'react_permissive_f'
  | 'react_max_setpoint_f'
  | 'freeze_stage1_f'
  | 'freeze_stage2_f'
  | 'freeze_stage1_fan_percent'
  | 'valve_full_open_percent'

/**
 * PLC values that are the same on every project.
 *
 * `rationale` is not documentation for its own sake — it is the field that stops
 * someone "fixing" a number whose reason nobody remembers. Changing a value here
 * changes every SOO regenerated afterwards, which is why lib/soo-library.ts
 * pins a library version onto approved documents.
 */
export type ControlConstant = {
  key: ConstKey
  label: string
  value: number
  unit: string
  rationale: string
}

export const CONTROL_CONSTANTS: Record<ConstKey, ControlConstant> = {
  react_permissive_f: {
    key: 'react_permissive_f',
    label: 'Reactivation permissive temperature',
    value: 120,
    unit: '°F',
    rationale:
      'The react fan and wheel must keep running until the react plenum falls below this, so residual heater energy is carried off the desiccant instead of soaking a stationary rotor. Safety and coil longevity — not a tuning parameter.',
  },
  react_max_setpoint_f: {
    key: 'react_max_setpoint_f',
    label: 'Maximum reactivation setpoint',
    value: 300,
    unit: '°F',
    rationale: 'Upper limit on the manual reactivation inlet temperature setpoint. Ceiling for the desiccant media.',
  },
  freeze_stage1_f: {
    key: 'freeze_stage1_f',
    label: 'Freeze prevention (Stage 1) temperature',
    value: 40,
    unit: '°F',
    rationale:
      'Soft stage. Leaving-air temperature at which the valve drives open and the process fan halves, before the mechanical freezestat has to act.',
  },
  freeze_stage2_f: {
    key: 'freeze_stage2_f',
    label: 'Freeze protection (Stage 2) temperature',
    value: 35,
    unit: '°F',
    rationale:
      'Hard stage for the hydronic post-heating coil. Chilled-water coils trip on their hardwired mechanical freezestat instead, which has no software setpoint.',
  },
  freeze_stage1_fan_percent: {
    key: 'freeze_stage1_fan_percent',
    label: 'Freeze prevention process fan speed',
    value: 50,
    unit: '%',
    rationale: 'Reduced airflow across the coil during Stage 1 freeze prevention.',
  },
  valve_full_open_percent: {
    key: 'valve_full_open_percent',
    label: 'Valve full-open position',
    value: 100,
    unit: '%',
    rationale: 'Full flow. Named rather than inlined so freeze-protection clauses read consistently.',
  },
}

export const CONST_KEYS = Object.keys(CONTROL_CONSTANTS) as ConstKey[]

// ─── Project setpoints ───────────────────────────────────────────────────────

export type ProjectKey =
  | 'space_dewpoint_setpoint_f'
  | 'dewpoint_differential_f'
  | 'dehum_off_delay_min'
  | 'pre_cool_lat_setpoint_f'
  | 'post_cool_lat_setpoint_f'
  | 'post_heat_lat_setpoint_f'
  | 'oa_ventilation_setpoint_cfm'
  | 'valve_alarm_delay_min'

export type ProjectSetpointSpec = {
  key: ProjectKey
  label: string
  unit: string
  /** Shown verbatim in the document when the value is unset. */
  placeholder: string
  hint: string
}

/**
 * Owned by NEITHER the submittal nor the master library. These come off the
 * mechanical spec or are dialled in at commissioning.
 *
 * This is the category that quietly does damage: a plausible default (55°F
 * dewpoint) would be accepted without a second look and shipped. So an unset
 * required setpoint renders its placeholder VISIBLY in the document AND blocks
 * approval. Visible-and-blocking beats invisible-and-defaulted.
 */
export const PROJECT_SETPOINTS: Record<ProjectKey, ProjectSetpointSpec> = {
  space_dewpoint_setpoint_f: {
    key: 'space_dewpoint_setpoint_f',
    label: 'Dewpoint setpoint',
    unit: '°F',
    placeholder: '[dewpoint setpoint — TBD at commissioning]',
    hint: 'The controlling dewpoint setpoint, adjustable from the HMI or over BAS.',
  },
  dewpoint_differential_f: {
    key: 'dewpoint_differential_f',
    label: 'Dewpoint differential',
    unit: '°F',
    placeholder: '[differential — TBD at commissioning]',
    hint: 'How far below setpoint the dewpoint must fall before dehumidification disables.',
  },
  dehum_off_delay_min: {
    key: 'dehum_off_delay_min',
    label: 'Dehumidification off-delay',
    unit: 'min',
    placeholder: '[off-delay — TBD at commissioning]',
    hint: 'How long the dewpoint must stay satisfied before the react section shuts down.',
  },
  pre_cool_lat_setpoint_f: {
    key: 'pre_cool_lat_setpoint_f',
    label: 'Pre-cooling leaving air setpoint',
    unit: '°F',
    placeholder: '[pre-cooling setpoint — TBD at commissioning]',
    hint: 'Leaving air temperature the pre-cooling valve modulates to maintain.',
  },
  post_cool_lat_setpoint_f: {
    key: 'post_cool_lat_setpoint_f',
    label: 'Post-cooling leaving air setpoint',
    unit: '°F',
    placeholder: '[post-cooling setpoint — TBD at commissioning]',
    hint: 'Leaving air temperature the post-cooling valve modulates to maintain.',
  },
  post_heat_lat_setpoint_f: {
    key: 'post_heat_lat_setpoint_f',
    label: 'Post-heating leaving air setpoint',
    unit: '°F',
    placeholder: '[post-heating setpoint — TBD at commissioning]',
    hint: 'Leaving air temperature the post-heating valve modulates to maintain.',
  },
  oa_ventilation_setpoint_cfm: {
    key: 'oa_ventilation_setpoint_cfm',
    label: 'Outside-air ventilation setpoint',
    unit: 'CFM',
    placeholder: '[ventilation setpoint — TBD at commissioning]',
    hint: 'Outside-air flow the AFMS modulates the OA damper to maintain.',
  },
  valve_alarm_delay_min: {
    key: 'valve_alarm_delay_min',
    label: 'Valve-at-100% alarm delay',
    unit: 'min',
    placeholder: '[alarm delay — TBD at commissioning]',
    hint: 'How long a valve may sit at 100% without meeting setpoint before alarming.',
  },
}

export const PROJECT_KEYS = Object.keys(PROJECT_SETPOINTS) as ProjectKey[]

export type ProjectSetpoints = Partial<Record<ProjectKey, number | null>>

// ─── Formatters ──────────────────────────────────────────────────────────────

export type FormatKey =
  | 'text'
  | 'label'
  | 'int'
  | 'cfm'
  | 'degF'
  | 'grains'
  | 'lbhr'
  | 'inwc'
  | 'psi'
  | 'gpm'
  | 'percent'
  | 'minutes'

function formatNumber(n: number): string {
  return Number.isInteger(n) ? n.toLocaleString('en-US') : n.toLocaleString('en-US', { maximumFractionDigits: 2 })
}

/**
 * A closed set, so the same value can never render two ways in one document
 * (`3000` in one clause and `3,000 CFM` in another, leaving a reader to wonder
 * whether they are the same number).
 */
export const FORMATTERS: Record<FormatKey, (v: unknown) => string> = {
  text: (v) => String(v),
  /** Enum → prose: `bacnet_mstp` → `BACnet MS/TP`. */
  label: (v) => enumLabel(String(v)),
  int: (v) => formatNumber(Math.round(Number(v))),
  cfm: (v) => `${formatNumber(Number(v))} CFM`,
  degF: (v) => `${formatNumber(Number(v))}°F`,
  grains: (v) => `${formatNumber(Number(v))} gr/lb`,
  lbhr: (v) => `${formatNumber(Number(v))} lbs/hr`,
  inwc: (v) => `${formatNumber(Number(v))}" w.c.`,
  psi: (v) => `${formatNumber(Number(v))} PSI`,
  gpm: (v) => `${formatNumber(Number(v))} GPM`,
  percent: (v) => `${formatNumber(Number(v))}%`,
  minutes: (v) => `${formatNumber(Number(v))} minutes`,
}

export const FORMAT_KEYS = Object.keys(FORMATTERS) as FormatKey[]

// ─── Clause model ────────────────────────────────────────────────────────────

export type Condition =
  | { fact: FactKey; is: string | number | boolean }
  | { fact: FactKey; oneOf: readonly (string | number)[] }

/**
 * AND across the array. An empty/absent `requires` means "always included".
 *
 * Deliberately NOT a nested all/any/not DSL. Every real predicate in this domain
 * is "component present AND option selected", and `oneOf` covers the only OR
 * that occurs in practice. When a genuine cross-fact OR is needed, author TWO
 * clauses with the same order and different `requires` — visible duplication,
 * and the "why is this here" panel stays a flat list a human can read.
 */
export type Requires = readonly Condition[]

export type SlotBinding =
  | { from: 'fact'; path: FactKey; format: FormatKey }
  | { from: 'constant'; key: ConstKey }
  | { from: 'project'; key: ProjectKey; required: boolean }
  | { from: 'literal'; text: string }

/** Device metadata — the seed of the Point List / Instrument Index (Phase 4). */
export type ClauseDevice = {
  tag_prefix: string
  signal: 'AI' | 'AO' | 'DI' | 'DO' | 'none'
  service: string
}

export type Clause = {
  /** Stable and globally unique. Referenced by edits and overrides — never renumber. */
  key: string
  order: number
  heading?: string
  /** Body text with `{{slot}}` placeholders. */
  body: string
  requires?: Requires
  slots?: Record<string, SlotBinding>
  device?: ClauseDevice
  /** Depth ≤ 3 (validated). A dead parent's children are never evaluated. */
  children?: Clause[]
}

export type SooSection = {
  key: string
  number: number
  title: string
  clauses: Clause[]
}

/**
 * "If the unit's `fact` has this value, THIS clause must survive assembly."
 *
 * Without this, a library holding only steam reactivation clauses hands a gas
 * unit a document with no reactivation sequence at all — every clause cleanly
 * and correctly excluded, and the document silently missing its most important
 * section. Exclusion is only safe when it means "not applicable"; here it means
 * "not written yet", and nothing else can tell those apart.
 *
 * ── Why this names a clause key rather than counting survivors ──────────────
 * The first version of this asked "did ANY clause testing this fact survive?",
 * and that was too weak to catch the case it existed for. A DX unit kept the
 * one-line "Pre-Cooling Leaving Air Temperature (Type J thermocouple)" sensor
 * entry — which tests `pre_cool_medium` — so the whole missing pre-cooling
 * SEQUENCE read as covered. A sensor is not a sequence. The rule now names the
 * clause that constitutes having one.
 *
 * `covered` lists every value that REQUIRES content, mapped to the key that
 * provides it. A key that does not exist yet is the point: it makes the gap
 * loud. A value absent from the map legitimately needs no clauses — `none`
 * means the unit has no such component, which is correct silence, not a hole.
 */
export type CoverageRule = {
  fact: FactKey
  covered: Record<string, string>
  /** Shown to the reviewer when the named clause did not survive. */
  requirement: string
}

export type UncoveredFact = { fact: FactKey; value: string; why: string }

export type SooLibrary = {
  /** Bumped whenever content changes. Pinned onto approved documents. */
  version: number
  sections: SooSection[]
  coverage?: CoverageRule[]
}

export const MAX_CLAUSE_DEPTH = 3

// ─── Predicate evaluation ────────────────────────────────────────────────────

/**
 * Three-valued on purpose. See the file header.
 *
 * - `satisfied`     every condition definitively true
 * - `unsatisfied`   at least one condition definitively false → clean exclusion
 * - `indeterminate` no condition false, but one reads a null fact → BLOCKED,
 *                   surfaced to a human. Never silently dropped.
 */
export type Verdict = 'satisfied' | 'unsatisfied' | 'indeterminate'

export type ConditionResult = {
  condition: Condition
  verdict: Verdict
  actual: unknown
}

export function evaluateCondition(condition: Condition, facts: UnitFacts): ConditionResult {
  const actual = (facts as Record<string, unknown>)[condition.fact]
  if (actual === null || actual === undefined) {
    return { condition, verdict: 'indeterminate', actual }
  }
  const ok = 'oneOf' in condition
    ? condition.oneOf.some((v) => v === actual)
    : condition.is === actual
  return { condition, verdict: ok ? 'satisfied' : 'unsatisfied', actual }
}

export function evaluateRequires(
  requires: Requires | undefined,
  facts: UnitFacts
): { verdict: Verdict; results: ConditionResult[] } {
  const results = (requires ?? []).map((c) => evaluateCondition(c, facts))
  // Order matters: a definitive false wins over an unknown. If the unit is
  // steam, the gas clause is genuinely not applicable even when some other fact
  // in its predicate is still null — that is an exclusion, not a gap to chase.
  if (results.some((r) => r.verdict === 'unsatisfied')) return { verdict: 'unsatisfied', results }
  if (results.some((r) => r.verdict === 'indeterminate')) return { verdict: 'indeterminate', results }
  return { verdict: 'satisfied', results }
}

/** "Reactivation type is Steam" — used by both the excluded list and the inspector. */
export function describeCondition(condition: Condition): string {
  const label = FACT_SPECS[condition.fact]?.label ?? condition.fact
  if ('oneOf' in condition) {
    return `${label} is one of ${condition.oneOf.map((v) => valueLabel(v)).join(', ')}`
  }
  return `${label} is ${valueLabel(condition.is)}`
}

function valueLabel(v: string | number | boolean): string {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'number') return String(v)
  return enumLabel(v)
}

// ─── Assembly ────────────────────────────────────────────────────────────────

export type UsedFact = { slot: string; fact: FactKey; label: string; value: string }
export type UsedConstant = { slot: string; key: ConstKey; label: string; value: string; rationale: string }
export type UsedProject = { slot: string; key: ProjectKey; label: string; value: string; unset: boolean }

export type RenderedClause = {
  key: string
  depth: number
  heading?: string
  text: string
  /** Why this clause is here — the inspector renders these verbatim. */
  because: string[]
  usedFacts: UsedFact[]
  usedConstants: UsedConstant[]
  usedProject: UsedProject[]
  device?: ClauseDevice
  children: RenderedClause[]
}

export type RenderedSection = {
  key: string
  number: number
  title: string
  clauses: RenderedClause[]
}

export type ExcludedClause = {
  key: string
  section: string
  heading?: string
  /** Human-readable name for the receipt. See clauseSummary. */
  summary: string
  /** "Reactivation type is Gas — unit is Steam". */
  why: string
}

export type BlockedClause = {
  key: string
  section: string
  heading?: string
  summary: string
  reason: 'unknown-fact' | 'missing-fact-slot'
  /** The fact keys a human has to resolve to unblock this clause. */
  needs: FactKey[]
  why: string
}

/**
 * What a clause is called in the excluded/blocked receipts.
 *
 * These lists print on the delivered document, so they cannot show internal
 * keys — a contractor reading "run_oa_damper_modulating" learns nothing and it
 * reads as a leak. Falls back to the clause's own first sentence, which is
 * already written in the document's voice, so no separate label content has to
 * be authored and kept in sync.
 */
export function clauseSummary(clause: Clause): string {
  const heading = clause.heading?.trim().replace(/:\s*$/, '')
  if (heading) return heading
  // Strip unresolved placeholders — a receipt reading "adjusted over
  // {{protocol}}" leaks template syntax into a customer-facing document. The
  // missing value is named in `needs` instead.
  const body = clause.body.replace(SLOT_RE, '…').trim()
  const firstStop = body.indexOf('. ')
  const first = firstStop > 0 ? body.slice(0, firstStop + 1) : body
  return first.length > 96 ? `${first.slice(0, 93).trimEnd()}…` : first
}

export type AssemblyResult = {
  libraryVersion: number
  sections: RenderedSection[]
  excluded: ExcludedClause[]
  blocked: BlockedClause[]
  /** Required project setpoints referenced by an included clause but unset. */
  unsetSetpoints: ProjectKey[]
  /** Configurations the master library has no clauses for. See CoverageRule. */
  uncovered: UncoveredFact[]
}

type SlotResolution =
  | { ok: true; text: string; usedFacts: UsedFact[]; usedConstants: UsedConstant[]; usedProject: UsedProject[] }
  | { ok: false; missing: FactKey[] }

const SLOT_RE = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g

function resolveBody(clause: Clause, facts: UnitFacts, setpoints: ProjectSetpoints): SlotResolution {
  const usedFacts: UsedFact[] = []
  const usedConstants: UsedConstant[] = []
  const usedProject: UsedProject[] = []
  const missing: FactKey[] = []

  const text = clause.body.replace(SLOT_RE, (whole, name: string) => {
    const binding = clause.slots?.[name]
    // An unbound placeholder is a library bug, not a data problem. Leave it
    // visible rather than swallowing it — validateLibrary also rejects it.
    if (!binding) return whole

    if (binding.from === 'literal') return binding.text

    if (binding.from === 'constant') {
      const c = CONTROL_CONSTANTS[binding.key]
      const value = `${formatNumber(c.value)}${c.unit === '%' ? '%' : c.unit === '°F' ? '°F' : ` ${c.unit}`}`
      usedConstants.push({ slot: name, key: c.key, label: c.label, value, rationale: c.rationale })
      return value
    }

    if (binding.from === 'project') {
      const spec = PROJECT_SETPOINTS[binding.key]
      const raw = setpoints[binding.key]
      if (raw === null || raw === undefined) {
        usedProject.push({ slot: name, key: spec.key, label: spec.label, value: spec.placeholder, unset: true })
        return spec.placeholder
      }
      const value = `${formatNumber(Number(raw))}${spec.unit === '°F' ? '°F' : ` ${spec.unit}`}`
      usedProject.push({ slot: name, key: spec.key, label: spec.label, value, unset: false })
      return value
    }

    const raw = (facts as Record<string, unknown>)[binding.path]
    if (raw === null || raw === undefined) {
      // A fact slot that cannot be filled BLOCKS the clause. It must never
      // render as a blank or an em-dash — a sequence with a hole in it reads as
      // complete, which is exactly the failure this tool exists to prevent.
      missing.push(binding.path)
      return whole
    }
    const value = FORMATTERS[binding.format](raw)
    usedFacts.push({ slot: name, fact: binding.path, label: FACT_SPECS[binding.path].label, value })
    return value
  })

  if (missing.length > 0) return { ok: false, missing }
  return { ok: true, text, usedFacts, usedConstants, usedProject }
}

/**
 * Assemble a document. Pure: same library + facts + setpoints ⇒ same result.
 *
 * Returns the excluded and blocked sets alongside the included one. Callers are
 * expected to SHOW both — see the file header.
 */
export function assemble(
  library: SooLibrary,
  facts: UnitFacts,
  setpoints: ProjectSetpoints = {}
): AssemblyResult {
  const excluded: ExcludedClause[] = []
  const blocked: BlockedClause[] = []
  const unset = new Set<ProjectKey>()
  const satisfiedKeys = new Set<string>()

  function walk(clauses: Clause[], sectionTitle: string, depth: number): RenderedClause[] {
    const out: RenderedClause[] = []
    for (const clause of [...clauses].sort((a, b) => a.order - b.order)) {
      const { verdict, results } = evaluateRequires(clause.requires, facts)

      if (verdict === 'unsatisfied') {
        const failed = results.find((r) => r.verdict === 'unsatisfied')!
        excluded.push({
          key: clause.key,
          section: sectionTitle,
          heading: clause.heading,
          summary: clauseSummary(clause),
          why: `${describeCondition(failed.condition)} — unit is ${factValueLabel(failed.condition.fact, failed.actual)}`,
        })
        continue
      }

      if (verdict === 'indeterminate') {
        const needs = results.filter((r) => r.verdict === 'indeterminate').map((r) => r.condition.fact)
        blocked.push({
          key: clause.key,
          section: sectionTitle,
          heading: clause.heading,
          summary: clauseSummary(clause),
          reason: 'unknown-fact',
          needs,
          why: `Needs ${needs.map((f) => FACT_SPECS[f].label).join(', ')} before this clause can be included or ruled out.`,
        })
        continue
      }

      const resolved = resolveBody(clause, facts, setpoints)
      if (!resolved.ok) {
        blocked.push({
          key: clause.key,
          section: sectionTitle,
          heading: clause.heading,
          summary: clauseSummary(clause),
          reason: 'missing-fact-slot',
          needs: resolved.missing,
          why: `Text references ${resolved.missing.map((f) => FACT_SPECS[f].label).join(', ')}, which ${resolved.missing.length === 1 ? 'is' : 'are'} not known.`,
        })
        continue
      }

      for (const p of resolved.usedProject) if (p.unset) unset.add(p.key)
      satisfiedKeys.add(clause.key)

      out.push({
        key: clause.key,
        depth,
        heading: clause.heading,
        text: resolved.text,
        because: results.map((r) => describeCondition(r.condition)),
        usedFacts: resolved.usedFacts,
        usedConstants: resolved.usedConstants,
        usedProject: resolved.usedProject,
        device: clause.device,
        children: clause.children ? walk(clause.children, sectionTitle, depth + 1) : [],
      })
    }
    return out
  }

  const sections = [...library.sections]
    .sort((a, b) => a.number - b.number)
    .map((s) => ({ key: s.key, number: s.number, title: s.title, clauses: walk(s.clauses, s.title, 0) }))
    // A section whose every clause was excluded is itself not applicable.
    .filter((s) => s.clauses.length > 0)

  // Coverage. Only meaningful for a fact we actually know — a null value is
  // already on `blocked`, and reporting it twice would just add noise.
  const uncovered: UncoveredFact[] = []
  for (const rule of library.coverage ?? []) {
    const value = (facts as Record<string, unknown>)[rule.fact]
    if (value === null || value === undefined) continue
    const requiredKey = rule.covered[String(value)]
    // Not in the map ⇒ this value needs no clauses (e.g. `none`). Correct silence.
    if (!requiredKey) continue
    if (satisfiedKeys.has(requiredKey)) continue
    uncovered.push({ fact: rule.fact, value: factValueLabel(rule.fact, value), why: rule.requirement })
  }

  return { libraryVersion: library.version, sections, excluded, blocked, unsetSetpoints: [...unset], uncovered }
}

// ─── Traversal helpers ───────────────────────────────────────────────────────

export function eachClause(library: SooLibrary, fn: (clause: Clause, section: SooSection, depth: number) => void): void {
  for (const section of library.sections) {
    const walk = (clauses: Clause[], depth: number) => {
      for (const c of clauses) {
        fn(c, section, depth)
        if (c.children) walk(c.children, depth + 1)
      }
    }
    walk(section.clauses, 0)
  }
}

export function eachRendered(result: AssemblyResult, fn: (clause: RenderedClause) => void): void {
  const walk = (clauses: RenderedClause[]) => {
    for (const c of clauses) {
      fn(c)
      walk(c.children)
    }
  }
  for (const s of result.sections) walk(s.clauses)
}

/** Which fact keys any predicate reads. Drives the "switches on N clauses" column. */
export function gatingFactKeys(library: SooLibrary): FactKey[] {
  const keys = new Set<FactKey>()
  eachClause(library, (c) => {
    for (const cond of c.requires ?? []) keys.add(cond.fact)
  })
  return FACT_KEYS.filter((k) => keys.has(k))
}

/**
 * How many clauses a fact's current value turns on versus off.
 *
 * This is the number the review table puts next to each gating fact, and it is
 * the single thing standing between a careful review and a rubber-stamp: a
 * reviewer who can see that one dropdown moves eleven clauses reads that row.
 */
export function clauseImpact(library: SooLibrary, facts: UnitFacts, key: FactKey): { on: number; off: number } {
  let on = 0
  let off = 0
  eachClause(library, (c) => {
    if (!c.requires?.some((cond) => cond.fact === key)) return
    const { verdict } = evaluateRequires(c.requires, facts)
    if (verdict === 'satisfied') on += 1
    else if (verdict === 'unsatisfied') off += 1
  })
  return { on, off }
}

// ─── Library validation ──────────────────────────────────────────────────────

/**
 * Returns an error string, or null if OK. Run on every library save.
 *
 * The point of this function: a predicate naming a fact key that does not exist
 * would evaluate `undefined === 'steam'` → false → the clause silently vanishes
 * from every document forever. That is precisely the silent-omission failure the
 * whole design exists to prevent, so an unknown key must be caught HERE, at
 * authoring time, and never reach the assembler.
 */
export function validateLibrary(incoming: unknown): string | null {
  if (!incoming || typeof incoming !== 'object') return 'Library must be an object.'
  const lib = incoming as SooLibrary
  if (typeof lib.version !== 'number' || !Number.isInteger(lib.version) || lib.version < 1) {
    return 'Library needs an integer version of 1 or more.'
  }
  if (!Array.isArray(lib.sections) || lib.sections.length === 0) return 'Library needs at least one section.'

  const sectionKeys = new Set<string>()
  const sectionNumbers = new Set<number>()
  const clauseKeys = new Set<string>()

  for (const section of lib.sections) {
    if (!section || typeof section !== 'object') return 'Malformed section.'
    if (!section.key?.trim()) return 'Every section needs a key.'
    if (sectionKeys.has(section.key)) return `Section key "${section.key}" appears more than once.`
    sectionKeys.add(section.key)
    if (typeof section.number !== 'number') return `Section "${section.key}" needs a number.`
    if (sectionNumbers.has(section.number)) return `Two sections share number ${section.number}.`
    sectionNumbers.add(section.number)
    if (!section.title?.trim()) return `Section "${section.key}" needs a title.`
    if (!Array.isArray(section.clauses)) return `Section "${section.key}" is malformed.`

    const err = validateClauses(section.clauses, section.key, 1, clauseKeys)
    if (err) return err
  }

  for (const rule of lib.coverage ?? []) {
    if (!rule || typeof rule !== 'object') return 'Malformed coverage rule.'
    if (!(rule.fact in FACT_SPECS)) return `Coverage rule tests unknown fact "${rule.fact}".`
    const spec = FACT_SPECS[rule.fact]
    if (spec.group === 'design') {
      return `Coverage rule tests "${rule.fact}", which is a design condition.`
    }
    if (!rule.covered || typeof rule.covered !== 'object' || Object.keys(rule.covered).length === 0) {
      return `Coverage rule for "${rule.fact}" lists no values that require content.`
    }
    if (!rule.requirement?.trim()) return `Coverage rule for "${rule.fact}" needs a requirement message.`
    for (const value of Object.keys(rule.covered)) {
      if (spec.kind === 'enum' && !spec.options?.includes(value)) {
        return `Coverage rule for "${rule.fact}" names value "${value}", which is not one of: ${spec.options?.join(', ')}.`
      }
    }
    // A rule whose every clause key is unknown is a typo, not a declared gap —
    // it would report "uncovered" on every unit forever and teach people to
    // ignore the warning. At least one named clause must actually exist.
    if (!Object.values(rule.covered).some((k) => clauseKeys.has(k))) {
      return `Coverage rule for "${rule.fact}" names no clause that exists — check for a typo in: ${Object.values(rule.covered).join(', ')}.`
    }
  }
  return null
}

function validateClauses(clauses: Clause[], sectionKey: string, depth: number, seen: Set<string>): string | null {
  if (depth > MAX_CLAUSE_DEPTH) {
    return `Clauses in section "${sectionKey}" nest deeper than ${MAX_CLAUSE_DEPTH} levels.`
  }
  for (const clause of clauses) {
    if (!clause || typeof clause !== 'object') return `Malformed clause in section "${sectionKey}".`
    if (!clause.key?.trim()) return `Every clause needs a key (section "${sectionKey}").`
    if (seen.has(clause.key)) return `Clause key "${clause.key}" appears more than once — keys must be globally unique.`
    seen.add(clause.key)
    if (typeof clause.order !== 'number') return `Clause "${clause.key}" needs an order.`
    if (typeof clause.body !== 'string') return `Clause "${clause.key}" needs body text.`

    for (const cond of clause.requires ?? []) {
      if (!cond || typeof cond !== 'object') return `Clause "${clause.key}" has a malformed condition.`
      if (!(cond.fact in FACT_SPECS)) {
        return `Clause "${clause.key}" tests unknown fact "${cond.fact}". A typo here would silently drop the clause from every document.`
      }
      const spec = FACT_SPECS[cond.fact]
      if (spec.group === 'design') {
        return `Clause "${clause.key}" tests "${cond.fact}", which is a design condition. Design conditions are printed, never used to gate a clause.`
      }
      const values = 'oneOf' in cond ? cond.oneOf : [cond.is]
      if ('oneOf' in cond && (!Array.isArray(cond.oneOf) || cond.oneOf.length === 0)) {
        return `Clause "${clause.key}" has an empty oneOf.`
      }
      for (const v of values) {
        if (spec.kind === 'enum' && !spec.options?.includes(String(v))) {
          return `Clause "${clause.key}" tests ${cond.fact} against "${v}", which is not one of: ${spec.options?.join(', ')}.`
        }
        if (spec.kind === 'boolean' && typeof v !== 'boolean') {
          return `Clause "${clause.key}" tests boolean ${cond.fact} against a non-boolean.`
        }
      }
    }

    // Every placeholder must have a binding, and every binding a placeholder.
    const placeholders = new Set<string>()
    for (const m of clause.body.matchAll(SLOT_RE)) placeholders.add(m[1])
    for (const name of placeholders) {
      const binding = clause.slots?.[name]
      if (!binding) return `Clause "${clause.key}" uses {{${name}}} with no matching slot binding.`
      if (binding.from === 'fact') {
        if (!(binding.path in FACT_SPECS)) return `Clause "${clause.key}" slot "${name}" reads unknown fact "${binding.path}".`
        if (!(binding.format in FORMATTERS)) return `Clause "${clause.key}" slot "${name}" uses unknown format "${binding.format}".`
      } else if (binding.from === 'constant') {
        if (!(binding.key in CONTROL_CONSTANTS)) return `Clause "${clause.key}" slot "${name}" reads unknown constant "${binding.key}".`
      } else if (binding.from === 'project') {
        if (!(binding.key in PROJECT_SETPOINTS)) return `Clause "${clause.key}" slot "${name}" reads unknown project setpoint "${binding.key}".`
      } else if (binding.from !== 'literal') {
        return `Clause "${clause.key}" slot "${name}" has an unknown binding type.`
      }
    }
    for (const name of Object.keys(clause.slots ?? {})) {
      if (!placeholders.has(name)) return `Clause "${clause.key}" binds slot "${name}" but never uses {{${name}}}.`
    }

    if (clause.children) {
      const err = validateClauses(clause.children, sectionKey, depth + 1, seen)
      if (err) return err
    }
  }
  return null
}

// ─── Documents ───────────────────────────────────────────────────────────────

export type SooStatus = 'draft' | 'in_review' | 'approved'

/** A human edit to one assembled clause. */
export type ClauseOverride = {
  clause_key: string
  text: string
  /**
   * Required when the original clause used a control constant. A silent local
   * edit to a safety value is this document's worst failure mode, so the note is
   * enforced by approvalBlockers rather than left to convention.
   */
  note?: string
}

export type SooDocument = {
  id: string
  title: string
  customer_name: string
  project_name: string
  unit_tag: string | null
  status: SooStatus
  facts: UnitFacts | null
  /** Which facts came from where. Null until Phase 2 extraction lands. */
  provenance: Record<string, unknown> | null
  conflicts: Record<string, unknown>[] | null
  setpoints: ProjectSetpoints | null
  /** Immutable output of the last assemble(). */
  assembled: AssemblyResult | null
  /** The human working copy, keyed by clause key. */
  overrides: ClauseOverride[] | null
  library_version: number | null
  submittal_path: string | null
  assembled_at: string | null
  submitted_at: string | null
  approved_at: string | null
  approved_by: string | null
  review_notes: string | null
  created_at: string
  updated_at: string
}

// ─── What makes a document incomplete ────────────────────────────────────────

export type DocumentGap = {
  kind: 'uncovered' | 'blocked' | 'setpoint'
  /** Short name for the thing that is missing. */
  label: string
  /** Why it is missing, and what would fix it. */
  detail: string
}

/**
 * Every reason this document is not whole, in one list.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `uncovered`, `blocked` and `unsetSetpoints` are three arrays that all mean
 * "something is missing from this document", and they were rendered in three
 * separate places. The print view got the `uncovered` banner and not the
 * `blocked` one, so a Ferrara draft shipped without its Shutdown Sequence, its
 * BAS interface section, and the clauses that start the wheel and the react fan
 * — every one correctly withheld, and none of it visible on the PDF.
 *
 * That is the same silent-omission failure the whole design exists to prevent,
 * reintroduced by having three lists and three render sites. There is now ONE
 * function. Anything that tells a human whether a document is finished — the
 * editor, the print view, the approval gate — reads it, so a new gap kind
 * cannot be added to one surface and forgotten on another.
 */
export function documentGaps(result: AssemblyResult): DocumentGap[] {
  const out: DocumentGap[] = []

  for (const u of result.uncovered) {
    out.push({
      kind: 'uncovered',
      label: `${FACT_SPECS[u.fact].label}: ${u.value}`,
      detail: `${u.why}. Those clauses are absent, not inapplicable — the master sequence has nothing written for this configuration.`,
    })
  }

  // Grouped by the fact they need: twelve blocked clauses from four unknown
  // facts reads as four problems to fix, not twelve.
  const byNeed = new Map<FactKey, string[]>()
  for (const b of result.blocked) {
    for (const need of b.needs) {
      const list = byNeed.get(need) ?? []
      list.push(b.summary)
      byNeed.set(need, list)
    }
  }
  for (const [need, clauses] of byNeed) {
    out.push({
      kind: 'blocked',
      label: FACT_SPECS[need].label,
      detail: `Not known, so ${clauses.length} clause${clauses.length === 1 ? '' : 's'} ${clauses.length === 1 ? 'is' : 'are'} withheld: ${clauses.slice(0, 4).join('; ')}${clauses.length > 4 ? `; and ${clauses.length - 4} more` : ''}.`,
    })
  }

  for (const key of result.unsetSetpoints) {
    out.push({
      kind: 'setpoint',
      label: PROJECT_SETPOINTS[key].label,
      detail: 'Still marked TBD in the document text. Enter it or agree it at commissioning.',
    })
  }

  return out
}

/** Apply human overrides onto an assembly result. Pure. */
export function applyOverrides(result: AssemblyResult, overrides: ClauseOverride[] | null): AssemblyResult {
  if (!overrides?.length) return result
  const byKey = new Map(overrides.map((o) => [o.clause_key, o]))
  const walk = (clauses: RenderedClause[]): RenderedClause[] =>
    clauses.map((c) => {
      const o = byKey.get(c.key)
      return { ...c, text: o ? o.text : c.text, children: walk(c.children) }
    })
  return { ...result, sections: result.sections.map((s) => ({ ...s, clauses: walk(s.clauses) })) }
}

/** Clause keys whose override changed text that carried a control constant. */
export function constantOverrides(result: AssemblyResult, overrides: ClauseOverride[] | null): ClauseOverride[] {
  if (!overrides?.length) return []
  const withConstants = new Set<string>()
  eachRendered(result, (c) => {
    if (c.usedConstants.length > 0) withConstants.add(c.key)
  })
  return overrides.filter((o) => withConstants.has(o.clause_key))
}

/**
 * What stands between this document and approval. Re-run server-side on the
 * status route — the UI copy is advisory, this is the gate.
 */
export function approvalBlockers(doc: SooDocument): string[] {
  const out: string[] = []
  if (!doc.facts) out.push('The unit configuration has not been confirmed.')
  if (!doc.assembled) out.push('The document has not been assembled yet.')

  const result = doc.assembled
  if (result) {
    if (result.sections.length === 0) out.push('No clauses were included — check the unit configuration.')
    // Same source as the editor and the print view — see documentGaps.
    for (const gap of documentGaps(result)) out.push(`${gap.label} — ${gap.detail}`)
    const unnoted = constantOverrides(result, doc.overrides).filter((o) => !o.note?.trim())
    for (const o of unnoted) {
      out.push(`Clause "${o.clause_key}" overrides text containing a control constant and needs a note explaining why.`)
    }
  }

  const conflicts = doc.conflicts ?? []
  if (conflicts.length > 0) {
    out.push(`${conflicts.length} extraction conflict${conflicts.length === 1 ? '' : 's'} still unresolved.`)
  }
  return out
}
