// Start-Up Readiness Verification (SRV) — content model.
//
// This is the single source of truth for the SRV checklist: the interactive
// 3D experience at /customer/srv renders from it, the submit API validates
// against it, and the admin detail page renders answers with it. The content
// mirrors the SRV document provided by management (2026-07): all critical
// items are Pass/Fail (N/A allowed only where the source form says
// "if applicable/supplied/required"). Photos are strongly recommended per
// section but OPTIONAL — some client sites don't permit on-campus photography,
// so a missing photo never blocks section completion or submission.

export type SrvItemAnswer = 'pass' | 'fail' | 'na'

export type SrvItem = {
  key: string
  label: string
  /** Items marked "(if applicable)" in the source form may be answered N/A. */
  naAllowed?: boolean
}

export type SrvReading = {
  key: string
  label: string
  unit: string
  /** Soft range hints — out-of-range flags the reading, it never blocks submit. */
  min?: number
  max?: number
}

export type SrvPhoto = {
  key: string
  label: string
}

export type SrvGroup = {
  title?: string
  items: SrvItem[]
}

export type SrvSection = {
  key: string
  /** 1-based section number from the SRV document. */
  number: number
  title: string
  /** Short name used on the 3D hotspot chip. */
  shortTitle: string
  /** Where on the unit this lives — shown as the panel subtitle. */
  locationHint: string
  groups: SrvGroup[]
  readings?: SrvReading[]
  photos: SrvPhoto[]
  /**
   * Sections gated by unit configuration (gas / hydronic coils /
   * refrigeration). Toggled off in the intro step → whole section records
   * as not-applicable.
   */
  conditional?: { key: SrvConfigKey; question: string }
}

export type SrvConfigKey = 'has_gas' | 'has_coils' | 'has_refrigeration'

// The DEFAULT SRV content, in code. Since 2026-07-08 the content is also
// editable live from /admin/srv — lib/srv-config.ts `getSrvSections()` reads the
// DB override (migration 046) and falls back to THIS array when none is saved.
// The helpers below take an explicit `sections` arg (defaulting here) so the
// server threads the DB content through; section KEYS + numbers + conditionals
// stay fixed (the 3D hotspot map keys off them), only their content is editable.
export const SRV_SECTIONS: SrvSection[] = [
  {
    key: 'equipment_condition',
    number: 1,
    title: 'Equipment Condition',
    shortTitle: 'Unit',
    locationHint: 'Walk around the unit and open the access doors',
    groups: [
      {
        title: 'Unit Inspection',
        items: [
          { key: 'shipping_damage_inspected', label: 'Unit has been inspected for shipping damage' },
          { key: 'damage_reported', label: 'All dents, punctures, or damage have been reported to IAT', naAllowed: true },
          { key: 'cabinet_airtight', label: 'Cabinet is fully assembled and airtight' },
          { key: 'panels_secured', label: 'Access panels installed and secured' },
          { key: 'doors_latch', label: 'All doors latch properly' },
          { key: 'interior_clean', label: 'Unit interior is clean and free of debris' },
          { key: 'no_materials_inside', label: 'No tools, packaging, or construction materials remain inside unit' },
          { key: 'wheel_rotates', label: 'Desiccant wheel rotates freely by hand' },
          { key: 'belts_tensioned', label: 'All belts are properly tensioned' },
          { key: 'fans_rotate', label: 'Fans rotate freely' },
          { key: 'drains_unobstructed', label: 'Condensate drains are unobstructed' },
        ],
      },
    ],
    photos: [
      { key: 'entire_unit', label: 'Entire unit' },
      { key: 'nameplate', label: 'Nameplate' },
      { key: 'interior_access', label: 'Interior access section' },
      { key: 'control_panel', label: 'Control panel' },
    ],
  },
  {
    key: 'ductwork',
    number: 2,
    title: 'Ductwork',
    shortTitle: 'Ductwork',
    locationHint: 'Process + reactivation duct connections',
    groups: [
      {
        title: 'Process Air Ducting',
        items: [
          { key: 'process_inlet_duct', label: 'Process inlet duct installed' },
          { key: 'process_outlet_duct', label: 'Process outlet duct installed' },
          { key: 'flex_connections', label: 'Flexible connections installed (if supplied)', naAllowed: true },
          { key: 'duct_supported', label: 'Ductwork adequately supported' },
          { key: 'duct_sealed', label: 'Ductwork sealed airtight' },
          { key: 'no_temp_openings', label: 'No temporary openings remain' },
        ],
      },
      {
        title: 'Reactivation Ducting',
        items: [
          { key: 'react_inlet_duct', label: 'React inlet duct installed' },
          { key: 'react_outlet_duct', label: 'React outlet duct installed' },
          { key: 'exhaust_termination', label: 'Exhaust termination complete' },
          { key: 'exhaust_code', label: 'Exhaust complies with local code' },
          { key: 'exhaust_clear', label: 'Exhaust is not blocked' },
        ],
      },
      {
        title: 'Airflow Verification',
        items: [
          { key: 'shipping_covers_removed', label: 'All shipping covers removed' },
          { key: 'dampers_installed', label: 'Dampers installed correctly', naAllowed: true },
          { key: 'dampers_operational', label: 'Dampers open and operational', naAllowed: true },
          { key: 'fire_smoke_dampers', label: 'Fire/smoke dampers installed and functional', naAllowed: true },
          { key: 'air_path_clear', label: 'Air path free of obstructions' },
        ],
      },
    ],
    photos: [
      { key: 'process_inlet', label: 'Process inlet' },
      { key: 'process_outlet', label: 'Process outlet' },
      { key: 'react_inlet', label: 'React inlet' },
      { key: 'react_outlet', label: 'React outlet' },
      { key: 'exhaust_termination', label: 'Exhaust termination' },
    ],
  },
  {
    key: 'electrical',
    number: 3,
    title: 'Electrical Power',
    shortTitle: 'Power',
    locationHint: 'Main disconnect + control box, top right',
    groups: [
      {
        title: 'Incoming Power',
        items: [
          { key: 'permanent_power', label: 'Permanent power available' },
          { key: 'electrical_permit', label: 'Electrical permit complete (if applicable)', naAllowed: true },
          { key: 'wired_per_drawings', label: 'Unit wired per IAT drawings' },
          { key: 'proper_breaker', label: 'Proper breaker installed' },
          { key: 'ground_installed', label: 'Ground connection installed' },
          { key: 'disconnect_labeled', label: 'Disconnect installed and labeled' },
        ],
      },
      {
        title: 'Electrical Checks',
        items: [
          { key: 'voltage_matches_nameplate', label: 'Voltage matches unit nameplate' },
          { key: 'phase_imbalance', label: 'Phase imbalance less than 2%' },
          { key: 'control_transformer', label: 'Control transformer energized' },
          { key: 'control_power', label: 'Control power available' },
          { key: 'terminals_tight', label: 'All terminal connections checked and tightened' },
          { key: 'vfds_powered', label: 'VFDs powered' },
          { key: 'no_electrical_faults', label: 'No active electrical faults present' },
        ],
      },
    ],
    readings: [
      { key: 'l1_l2', label: 'L1–L2', unit: 'V' },
      { key: 'l2_l3', label: 'L2–L3', unit: 'V' },
      { key: 'l1_l3', label: 'L1–L3', unit: 'V' },
      { key: 'l1_g', label: 'L1–G', unit: 'V' },
      { key: 'l2_g', label: 'L2–G', unit: 'V' },
      { key: 'l3_g', label: 'L3–G', unit: 'V' },
    ],
    photos: [
      { key: 'main_disconnect', label: 'Main disconnect' },
      { key: 'incoming_power', label: 'Incoming power connections' },
      { key: 'control_panel_interior', label: 'Control panel interior' },
      { key: 'voltage_readings', label: 'Voltage meter readings' },
    ],
  },
  {
    key: 'fans_motors',
    number: 4,
    title: 'Fan & Motor Verification',
    shortTitle: 'Fans',
    locationHint: 'Process fan, react fan, and wheel drive',
    groups: [
      {
        title: 'Process Fan',
        items: [
          { key: 'process_fan_rotates', label: 'Fan rotates freely' },
          { key: 'process_motor_mounted', label: 'Motor securely mounted' },
          { key: 'process_vfd_powered', label: 'VFD powered', naAllowed: true },
          { key: 'process_overloads', label: 'Motor overload settings verified' },
        ],
      },
      {
        title: 'React Fan',
        items: [
          { key: 'react_fan_rotates', label: 'Fan rotates freely' },
          { key: 'react_motor_mounted', label: 'Motor securely mounted' },
          { key: 'react_vfd_powered', label: 'VFD powered', naAllowed: true },
          { key: 'react_overloads', label: 'Motor overload settings verified' },
        ],
      },
      {
        title: 'Wheel Drive',
        items: [
          { key: 'drive_motor_installed', label: 'Drive motor installed' },
          { key: 'drive_tension', label: 'Chain/belt tension verified' },
          { key: 'wheel_rotates_drive', label: 'Wheel rotates freely' },
        ],
      },
    ],
    photos: [
      { key: 'process_fan', label: 'Process fan' },
      { key: 'react_fan', label: 'React fan' },
      { key: 'wheel_drive', label: 'Wheel drive assembly' },
    ],
  },
  {
    key: 'gas',
    number: 5,
    title: 'Gas Systems',
    shortTitle: 'Gas',
    locationHint: 'Gas train at the reactivation heater',
    conditional: { key: 'has_gas', question: 'Is this unit gas-fired (natural gas or propane reactivation)?' },
    groups: [
      {
        title: 'Piping',
        items: [
          { key: 'gas_piping_complete', label: 'Gas piping complete' },
          { key: 'sediment_trap', label: 'Sediment trap installed' },
          { key: 'shutoff_valve', label: 'Shutoff valve installed' },
          { key: 'leak_test', label: 'Leak test completed' },
          { key: 'regulator_installed', label: 'Regulator installed correctly' },
          { key: 'venting_complete', label: 'Venting complete' },
        ],
      },
      {
        title: 'Gas Supply',
        items: [
          { key: 'gas_type_matches', label: 'Gas type matches nameplate' },
          { key: 'inlet_pressure_verified', label: 'Inlet pressure verified' },
          { key: 'pressure_within_limit', label: 'Pressure does not exceed 14" WC' },
          { key: 'gas_available', label: 'Gas available at unit' },
        ],
      },
    ],
    readings: [
      { key: 'static_pressure', label: 'Static pressure', unit: '"WC', max: 14 },
      { key: 'dynamic_pressure', label: 'Dynamic pressure', unit: '"WC', max: 14 },
    ],
    photos: [
      { key: 'gas_train', label: 'Gas train' },
      { key: 'regulator', label: 'Regulator' },
      { key: 'sediment_trap', label: 'Sediment trap' },
      { key: 'pressure_gauge', label: 'Pressure gauge reading' },
    ],
  },
  {
    key: 'coils',
    number: 6,
    title: 'Hot Water / Steam / Chilled Water Coils',
    shortTitle: 'Coils',
    locationHint: 'Coil connections — supply & return, rear of unit',
    conditional: { key: 'has_coils', question: 'Does this unit have hot water, steam, or chilled water coils?' },
    groups: [
      {
        title: 'Piping',
        items: [
          { key: 'coil_piping_complete', label: 'Piping complete' },
          { key: 'pipe_sizing', label: 'Correct pipe sizing used' },
          { key: 'isolation_valves', label: 'Isolation valves installed' },
          { key: 'strainers', label: 'Strainers installed' },
          { key: 'control_valves', label: 'Control valves installed' },
          { key: 'unions', label: 'Unions installed for serviceability' },
          { key: 'freeze_protection', label: 'Freeze protection installed', naAllowed: true },
        ],
      },
      {
        title: 'Water System',
        items: [
          { key: 'system_filled', label: 'System filled' },
          { key: 'system_flushed', label: 'System flushed' },
          { key: 'system_purged', label: 'System purged of air' },
          { key: 'pumps_operational', label: 'Pumps operational' },
          { key: 'design_flow', label: 'Design flow available' },
        ],
      },
    ],
    photos: [
      { key: 'coil_connections', label: 'Coil connections' },
      { key: 'control_valve_assembly', label: 'Control valve assembly' },
      { key: 'strainer_installation', label: 'Strainer installation' },
    ],
  },
  {
    key: 'refrigeration',
    number: 7,
    title: 'Refrigeration Systems',
    shortTitle: 'Refrigeration',
    locationHint: 'Pre-cooling coil + remote condensing unit',
    conditional: { key: 'has_refrigeration', question: 'Does this unit have a refrigeration system (pre/post-cooling with a condensing unit)?' },
    groups: [
      {
        title: 'Condensing Unit',
        items: [
          { key: 'condenser_installed', label: 'Condenser installed' },
          { key: 'refrigerant_piping', label: 'Refrigerant piping complete' },
          { key: 'pipe_insulation', label: 'Proper pipe insulation installed' },
          { key: 'oil_traps', label: 'Oil traps installed as required', naAllowed: true },
          { key: 'pressure_tested', label: 'System pressure tested' },
          { key: 'evacuated', label: 'System evacuated' },
          { key: 'charged', label: 'System charged' },
        ],
      },
      {
        title: 'Electrical',
        items: [
          { key: 'condenser_power', label: 'Condenser power connected' },
          { key: 'condenser_controls', label: 'Condenser controls connected' },
          { key: 'crankcase_heaters', label: 'Crankcase heaters energized for 24 hours minimum' },
        ],
      },
    ],
    photos: [
      { key: 'condenser', label: 'Condenser' },
      { key: 'refrigerant_piping', label: 'Refrigerant piping' },
      { key: 'service_valves', label: 'Service valves' },
      { key: 'electrical_connections', label: 'Electrical connections' },
    ],
  },
  {
    key: 'controls',
    number: 8,
    title: 'Controls & Instrumentation',
    shortTitle: 'Controls',
    locationHint: 'HMI, sensors, and BAS connections',
    groups: [
      {
        title: 'Sensors',
        items: [
          { key: 'temp_sensors', label: 'Temperature sensors installed' },
          { key: 'humidity_sensors', label: 'Humidity sensors installed' },
          { key: 'pressure_sensors', label: 'Pressure sensors installed', naAllowed: true },
          { key: 'sensors_wired', label: 'Sensors wired correctly' },
        ],
      },
      {
        title: 'External Controls',
        items: [
          { key: 'remote_enable', label: 'Remote enable connected', naAllowed: true },
          { key: 'fire_alarm_interlock', label: 'Fire alarm interlock connected', naAllowed: true },
          { key: 'bas_wiring', label: 'BAS/BMS wiring complete', naAllowed: true },
          { key: 'bacnet', label: 'BACnet/IP or MSTP complete', naAllowed: true },
          { key: 'network_addressing', label: 'Network addressing completed', naAllowed: true },
        ],
      },
      {
        title: 'Operator Interface',
        items: [
          { key: 'hmi_powered', label: 'HMI powered' },
          { key: 'no_controller_faults', label: 'No controller faults present' },
          { key: 'control_wiring_verified', label: 'Control wiring verified' },
        ],
      },
    ],
    photos: [
      { key: 'hmi_screen', label: 'HMI screen' },
      { key: 'sensors', label: 'Sensors' },
      { key: 'bas_connection', label: 'BAS connection point' },
    ],
  },
  {
    key: 'condensate',
    number: 9,
    title: 'Condensate Drainage',
    shortTitle: 'Drainage',
    locationHint: 'Drain connection at the base of the unit',
    groups: [
      {
        items: [
          { key: 'drain_piping', label: 'Drain piping complete' },
          { key: 'trap_installed', label: 'Proper trap installed' },
          { key: 'drain_pitched', label: 'Drain pitched correctly' },
          { key: 'drain_tested', label: 'Drain tested with water' },
          { key: 'no_leaks', label: 'No leaks present' },
        ],
      },
    ],
    photos: [
      { key: 'drain_connection', label: 'Drain connection' },
      { key: 'trap', label: 'Trap' },
      { key: 'drain_routing', label: 'Drain routing' },
    ],
  },
  {
    key: 'site_readiness',
    number: 10,
    title: 'Site Readiness',
    shortTitle: 'Site',
    locationHint: 'The space around the unit + who will be on site',
    groups: [
      {
        title: 'Site Conditions',
        items: [
          { key: 'area_accessible', label: 'Unit area accessible' },
          { key: 'safe_access', label: 'Safe access provided' },
          { key: 'lighting', label: 'Lighting available' },
          { key: 'internet', label: 'Internet access available (if required)', naAllowed: true },
          { key: 'lift_equipment', label: 'Lift equipment available (if required)', naAllowed: true },
        ],
      },
      {
        title: 'Contractors On Site For Start-Up',
        items: [
          { key: 'mechanical_contractor', label: 'Mechanical contractor present for start-up' },
          { key: 'electrical_contractor', label: 'Electrical contractor present for start-up' },
          { key: 'controls_contractor', label: 'Controls contractor present for start-up' },
          { key: 'bas_contractor', label: 'BAS contractor present (if applicable)', naAllowed: true },
          { key: 'gas_contractor', label: 'Gas contractor available (if applicable)', naAllowed: true },
        ],
      },
    ],
    photos: [],
  },
]

// ── Answer payload shapes (client state + submitted JSON) ─────────────────────

export type SrvSectionAnswers = {
  /** item key → pass/fail/na */
  items: Record<string, SrvItemAnswer>
  /** reading key → recorded value */
  readings?: Record<string, string>
  /** photo key → storage path in the srv-photos bucket */
  photos: Record<string, string>
  notes?: string
}

export type SrvProjectInfo = {
  project_name: string
  customer: string
  model_number: string
  serial_number: string
  installation_address: string
  date_inspected: string
  inspected_by: string
  phone: string
  email: string
}

export type SrvConfig = Record<SrvConfigKey, boolean>

export type SrvCertification = {
  name: string
  company: string
  signature: string // data URL (PNG) from the signature pad
  date: string
}

export type SrvPayload = {
  project: SrvProjectInfo
  config: SrvConfig
  sections: Record<string, SrvSectionAnswers>
  certification: SrvCertification
  equipment_id?: string | null
}

// ── Progress + validation helpers (shared by client and API) ─────────────────

export function sectionApplies(section: SrvSection, config: SrvConfig): boolean {
  return !section.conditional || !!config[section.conditional.key]
}

/** Sections that apply under the given unit configuration. */
export function applicableSections(config: SrvConfig, sections: SrvSection[] = SRV_SECTIONS): SrvSection[] {
  return sections.filter((s) => sectionApplies(s, config))
}

export type SectionProgress = {
  answered: number
  total: number
  photosDone: number
  photosTotal: number
  readingsDone: number
  readingsTotal: number
  complete: boolean
  failures: number
}

export function sectionProgress(section: SrvSection, answers: SrvSectionAnswers | undefined): SectionProgress {
  const allItems = section.groups.flatMap((g) => g.items)
  const readings = section.readings || []
  const a = answers || { items: {}, photos: {} }
  const answered = allItems.filter((i) => a.items[i.key]).length
  const failures = allItems.filter((i) => a.items[i.key] === 'fail').length
  const photosDone = section.photos.filter((p) => a.photos[p.key]).length
  const readingsDone = readings.filter((r) => (a.readings?.[r.key] ?? '').trim() !== '').length
  return {
    answered,
    total: allItems.length,
    photosDone,
    photosTotal: section.photos.length,
    readingsDone,
    readingsTotal: readings.length,
    failures,
    // Photos are recommended, not required — they intentionally do NOT gate
    // completion (photosDone is still reported for the "Recommended photos X/Y"
    // sub-counter). A section is complete once every item is answered and every
    // reading is recorded.
    complete:
      answered === allItems.length &&
      readingsDone === readings.length,
  }
}

/** Full-payload validation used by the submit API. Returns human-readable problems. */
export function validateSrvPayload(payload: SrvPayload, sections: SrvSection[] = SRV_SECTIONS): string[] {
  const problems: string[] = []
  const p = payload.project || ({} as SrvProjectInfo)
  const required: Array<[keyof SrvProjectInfo, string]> = [
    ['project_name', 'Project name'],
    ['customer', 'Customer'],
    ['model_number', 'Unit model number'],
    ['serial_number', 'Unit serial number'],
    ['installation_address', 'Installation address'],
    ['date_inspected', 'Date inspected'],
    ['inspected_by', 'Inspected by'],
    ['phone', 'Phone number'],
    ['email', 'Email address'],
  ]
  for (const [key, label] of required) {
    if (!(p[key] || '').trim()) problems.push(`${label} is required`)
  }

  for (const section of applicableSections(payload.config, sections)) {
    const prog = sectionProgress(section, payload.sections?.[section.key])
    if (!prog.complete) {
      problems.push(`Section ${section.number} (${section.title}) is incomplete`)
    }
    // N/A only allowed where the checklist item permits it.
    const a = payload.sections?.[section.key]
    if (a) {
      for (const group of section.groups) {
        for (const item of group.items) {
          if (a.items[item.key] === 'na' && !item.naAllowed) {
            problems.push(`"${item.label}" (Section ${section.number}) cannot be N/A`)
          }
        }
      }
    }
  }

  const cert = payload.certification
  if (!cert?.name?.trim()) problems.push('Certification name is required')
  if (!cert?.company?.trim()) problems.push('Certification company is required')
  if (!cert?.signature || !cert.signature.startsWith('data:image/')) problems.push('Signature is required')
  return problems
}

/** Overall completion across applicable sections (for the progress ring). */
export function overallProgress(config: SrvConfig, answers: Record<string, SrvSectionAnswers>, sectionDefs: SrvSection[] = SRV_SECTIONS) {
  const applicable = applicableSections(config, sectionDefs)
  const done = applicable.filter((s) => sectionProgress(s, answers[s.key]).complete).length
  return { done, total: applicable.length }
}

// ── Form-builder integration ──────────────────────────────────────────────────
//
// SRV submissions land in the shared `submissions` queue, and the admin detail
// page renders a submission by iterating its form's `form_fields` (ordered by
// sort_order, grouped by section_header rows). So the SRV keeps a form row +
// field definitions that exactly mirror this content model. The submit API
// syncs them from here on every submit — this file stays the single source of
// truth, and nobody ever hand-edits the SRV in the form builder.
//
// The form stays is_active=false forever: the interactive /customer/srv page
// is the only way in, and /api/submit rejects drafts, so the classic stepped
// form can never be filled out by accident.

export const SRV_FORM_SLUG = 'start-up-readiness-verification'
export const SRV_FORM_TITLE = 'Start-Up Readiness Verification (SRV)'
export const SRV_FORM_DESCRIPTION =
  'Interactive pre-start-up verification completed by customers at /customer/srv. ' +
  'Start-up services are not scheduled until a completed SRV is received, ' +
  'a minimum of 7 calendar days before the requested start-up date. ' +
  'Photos are strongly recommended but optional (some sites restrict on-campus photography). ' +
  'This form is managed in code (lib/srv.ts) — edits made here in the form builder will be overwritten.'
export const SRV_FORM_CATEGORY = 'QC & Production'

export const SRV_CONFIG_QUESTIONS: Array<{ key: SrvConfigKey; label: string }> = [
  { key: 'has_gas', label: 'Gas-fired reactivation?' },
  { key: 'has_coils', label: 'Hot water / steam / chilled water coils?' },
  { key: 'has_refrigeration', label: 'Refrigeration / condensing unit?' },
]

const PROJECT_FIELDS: Array<{ key: keyof SrvProjectInfo; label: string; type: 'text' | 'date' | 'email' }> = [
  { key: 'project_name', label: 'Project Name', type: 'text' },
  { key: 'customer', label: 'Customer / Company', type: 'text' },
  { key: 'model_number', label: 'Unit Model Number', type: 'text' },
  { key: 'serial_number', label: 'Unit Serial Number', type: 'text' },
  { key: 'installation_address', label: 'Installation Address', type: 'text' },
  { key: 'date_inspected', label: 'Date Inspected', type: 'date' },
  { key: 'inspected_by', label: 'Inspected By', type: 'text' },
  { key: 'phone', label: 'Phone Number', type: 'text' },
  { key: 'email', label: 'Email Address', type: 'email' },
]

// Data keys are field labels, and submission data is one flat object — so every
// label must be unique across the whole form. Group titles disambiguate the
// repeats (e.g. "Fan rotates freely" exists for both fans).
export function itemFieldLabel(group: SrvGroup, item: SrvItem): string {
  return group.title ? `${group.title}: ${item.label}` : item.label
}
export function readingFieldLabel(reading: SrvReading): string {
  return `${reading.label} (${reading.unit})`
}
export function photoFieldLabel(photo: SrvPhoto): string {
  return `Photo — ${photo.label}`
}
export function sectionHeaderLabel(section: SrvSection): string {
  return `Section ${section.number} — ${section.title}`
}
export function sectionAppliesLabel(section: SrvSection): string {
  return `Section ${section.number} applies to this unit?`
}
export function sectionNotesLabel(section: SrvSection): string {
  return `Section ${section.number} notes`
}

export type SrvFieldDef = {
  label: string
  field_type: 'text' | 'email' | 'number' | 'date' | 'radio' | 'file' | 'signature' | 'textarea' | 'section_header'
  options: string[] | null
  is_required: boolean
  placeholder: string | null
}

/** The full ordered field list the SRV form must have in the form builder. */
export function srvFormFieldDefs(sections: SrvSection[] = SRV_SECTIONS): SrvFieldDef[] {
  const sh = (label: string): SrvFieldDef =>
    ({ label, field_type: 'section_header', options: null, is_required: false, placeholder: null })
  const defs: SrvFieldDef[] = []

  // Summary first: it becomes the always-open primary card on the admin detail
  // page, so triage reads result + failures without expanding anything.
  defs.push(sh('SRV Summary'))
  defs.push({ label: 'Overall result', field_type: 'text', options: null, is_required: true, placeholder: null })
  defs.push({ label: 'Revision', field_type: 'text', options: null, is_required: false, placeholder: null })
  defs.push({ label: 'Flagged items', field_type: 'textarea', options: null, is_required: false, placeholder: null })
  defs.push({ label: 'Sections not applicable', field_type: 'text', options: null, is_required: false, placeholder: null })

  defs.push(sh('Project Information'))
  for (const f of PROJECT_FIELDS) {
    defs.push({ label: f.label, field_type: f.type, options: null, is_required: true, placeholder: null })
  }
  for (const q of SRV_CONFIG_QUESTIONS) {
    defs.push({ label: q.label, field_type: 'radio', options: ['Yes', 'No'], is_required: true, placeholder: null })
  }

  for (const section of sections) {
    defs.push(sh(sectionHeaderLabel(section)))
    if (section.conditional) {
      defs.push({ label: sectionAppliesLabel(section), field_type: 'radio', options: ['Yes', 'No'], is_required: true, placeholder: null })
    }
    for (const group of section.groups) {
      for (const item of group.items) {
        defs.push({
          label: itemFieldLabel(group, item),
          field_type: 'radio',
          options: item.naAllowed ? ['Pass', 'Fail', 'N/A'] : ['Pass', 'Fail'],
          is_required: !section.conditional,
          placeholder: null,
        })
      }
    }
    for (const reading of section.readings || []) {
      defs.push({ label: readingFieldLabel(reading), field_type: 'text', options: null, is_required: !section.conditional, placeholder: null })
    }
    for (const photo of section.photos) {
      // Photos are recommended, not required (see sectionProgress) — keep the
      // mirrored form definition consistent so the admin/form-builder view
      // doesn't show them as required.
      defs.push({ label: photoFieldLabel(photo), field_type: 'file', options: null, is_required: false, placeholder: null })
    }
    defs.push({ label: sectionNotesLabel(section), field_type: 'textarea', options: null, is_required: false, placeholder: null })
  }

  defs.push(sh('Customer Certification'))
  defs.push({ label: 'Name', field_type: 'text', options: null, is_required: true, placeholder: null })
  defs.push({ label: 'Company', field_type: 'text', options: null, is_required: true, placeholder: null })
  defs.push({ label: 'Signature', field_type: 'signature', options: null, is_required: true, placeholder: null })
  defs.push({ label: 'Date', field_type: 'date', options: null, is_required: true, placeholder: null })

  return defs
}

const ANSWER_DISPLAY: Record<SrvItemAnswer, string> = { pass: 'Pass', fail: 'Fail', na: 'N/A' }

/** Flatten a validated payload into submissions.data (field label → value). */
export function flattenSrvPayload(payload: SrvPayload, sectionDefs: SrvSection[] = SRV_SECTIONS, opts?: { revision?: number }): Record<string, unknown> {
  const data: Record<string, unknown> = {}
  data['Revision'] = String(opts?.revision ?? 1)

  // Summary
  const flagged: string[] = []
  for (const section of applicableSections(payload.config, sectionDefs)) {
    const a = payload.sections[section.key]
    if (!a) continue
    for (const group of section.groups) {
      for (const item of group.items) {
        if (a.items[item.key] === 'fail') {
          flagged.push(`Section ${section.number} — ${itemFieldLabel(group, item)}`)
        }
      }
    }
  }
  const skipped = sectionDefs.filter((s) => !sectionApplies(s, payload.config))
  data['Overall result'] = flagged.length === 0
    ? 'READY — all applicable items passed'
    : `${flagged.length} item${flagged.length === 1 ? '' : 's'} FAILED — review before scheduling`
  data['Flagged items'] = flagged.join('\n')
  data['Sections not applicable'] = skipped.map((s) => `${s.number}. ${s.title}`).join(', ')

  // Project + configuration
  for (const f of PROJECT_FIELDS) data[f.label] = payload.project[f.key] || ''
  for (const q of SRV_CONFIG_QUESTIONS) data[q.label] = payload.config[q.key] ? 'Yes' : 'No'

  // Sections
  for (const section of sectionDefs) {
    const applies = sectionApplies(section, payload.config)
    if (section.conditional) data[sectionAppliesLabel(section)] = applies ? 'Yes' : 'No'
    if (!applies) continue
    const a = payload.sections[section.key]
    if (!a) continue
    for (const group of section.groups) {
      for (const item of group.items) {
        const v = a.items[item.key]
        if (v) data[itemFieldLabel(group, item)] = ANSWER_DISPLAY[v]
      }
    }
    for (const reading of section.readings || []) {
      const v = (a.readings?.[reading.key] ?? '').trim()
      if (v) data[readingFieldLabel(reading)] = v
    }
    for (const photo of section.photos) {
      const v = a.photos[photo.key]
      if (v) data[photoFieldLabel(photo)] = v
    }
    if (a.notes?.trim()) data[sectionNotesLabel(section)] = a.notes.trim()
  }

  // Certification
  data['Name'] = payload.certification.name
  data['Company'] = payload.certification.company
  data['Signature'] = payload.certification.signature
  data['Date'] = payload.certification.date

  return data
}

const DISPLAY_ANSWER: Record<string, SrvItemAnswer> = { Pass: 'pass', Fail: 'fail', 'N/A': 'na' }

/**
 * Reverse of flattenSrvPayload — rebuild editable client state from a
 * submission's data so a returned SRV can be revised. The signature is
 * intentionally NOT restored: a revision must be re-certified.
 */
export function unflattenSrvData(data: Record<string, unknown>, sectionDefs: SrvSection[] = SRV_SECTIONS): {
  project: SrvProjectInfo
  config: SrvConfig
  sections: Record<string, SrvSectionAnswers>
} {
  const s = (v: unknown) => (typeof v === 'string' ? v : '')

  const project: SrvProjectInfo = {
    project_name: s(data['Project Name']),
    customer: s(data['Customer / Company']),
    model_number: s(data['Unit Model Number']),
    serial_number: s(data['Unit Serial Number']),
    installation_address: s(data['Installation Address']),
    date_inspected: s(data['Date Inspected']),
    inspected_by: s(data['Inspected By']),
    phone: s(data['Phone Number']),
    email: s(data['Email Address']),
  }

  const config = { has_gas: false, has_coils: false, has_refrigeration: false } as SrvConfig
  for (const q of SRV_CONFIG_QUESTIONS) config[q.key] = data[q.label] === 'Yes'

  const sections: Record<string, SrvSectionAnswers> = {}
  for (const section of sectionDefs) {
    if (!sectionApplies(section, config)) continue
    const a: SrvSectionAnswers = { items: {}, photos: {} }
    for (const group of section.groups) {
      for (const item of group.items) {
        const v = DISPLAY_ANSWER[s(data[itemFieldLabel(group, item)])]
        if (v) a.items[item.key] = v
      }
    }
    for (const reading of section.readings || []) {
      const v = s(data[readingFieldLabel(reading)])
      if (v) (a.readings ||= {})[reading.key] = v
    }
    for (const photo of section.photos) {
      const v = s(data[photoFieldLabel(photo)])
      if (v) a.photos[photo.key] = v
    }
    const notes = s(data[sectionNotesLabel(section)])
    if (notes) a.notes = notes
    sections[section.key] = a
  }

  return { project, config, sections }
}
