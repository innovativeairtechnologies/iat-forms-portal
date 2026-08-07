/* Datasets for the HVAC/R practice exercises.
 *
 * Data, not code: one component per exercise *kind* reads the set named by the
 * lesson marker's `data-set`, so a new drill is a new entry here rather than a
 * new component and a new registry line. Same shape as `lib/cpco/trees` —
 * content that came off a source document belongs in a record.
 *
 * Every set below is ported 1:1 from the source course; the answer keys are the
 * source's. These are ungraded practice — nothing here writes to
 * `learn_progress` — so the keys live client-side on purpose. The graded
 * knowledge checks are `learn_quizzes`, whose keys are never sent to the
 * browser (docs/learn.md).
 */

import { SVG, SVG_WASH } from './palette'

/* ── Label the diagram ────────────────────────────────────────────────────── */

export type LabelSpot = { id: string; x: number; y: number }
export type LabelChip = { id: string; text: string }
export type LabelSet = {
  title: string
  description: string
  /** viewBox of the accompanying schematic. */
  viewBox: string
  svg: string
  /** Percentages within the diagram box. */
  spots: LabelSpot[]
  chips: LabelChip[]
  maxWidth?: number
}

const arrowDef = `<defs><marker id="hvacr-arrow" markerWidth="10" markerHeight="10" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z" fill="${SVG.wire}"/></marker></defs>`

export const LABEL_SETS: Record<string, LabelSet> = {
  cycle: {
    title: 'Label the refrigeration cycle',
    description: 'Pick a component name, then click the matching box on the loop.',
    viewBox: '0 0 640 320',
    svg:
      arrowDef +
      `<rect x="40" y="30" width="160" height="70" rx="10" fill="${SVG_WASH.compressor}" stroke="${SVG.compressor}" stroke-width="2"/>` +
      `<rect x="440" y="30" width="160" height="70" rx="10" fill="${SVG_WASH.condenser}" stroke="${SVG.condenser}" stroke-width="2"/>` +
      `<rect x="440" y="220" width="160" height="70" rx="10" fill="${SVG_WASH.metering}" stroke="${SVG.metering}" stroke-width="2"/>` +
      `<rect x="40" y="220" width="160" height="70" rx="10" fill="${SVG_WASH.evaporator}" stroke="${SVG.evaporator}" stroke-width="2"/>` +
      `<line x1="200" y1="65" x2="440" y2="65" stroke="${SVG.wire}" stroke-width="2.5" marker-end="url(#hvacr-arrow)"/>` +
      `<line x1="520" y1="100" x2="520" y2="220" stroke="${SVG.wire}" stroke-width="2.5" marker-end="url(#hvacr-arrow)"/>` +
      `<line x1="440" y1="255" x2="200" y2="255" stroke="${SVG.wire}" stroke-width="2.5" marker-end="url(#hvacr-arrow)"/>` +
      `<line x1="120" y1="220" x2="120" y2="100" stroke="${SVG.wire}" stroke-width="2.5" marker-end="url(#hvacr-arrow)"/>`,
    spots: [
      { id: 'compressor', x: 18.75, y: 20.3 },
      { id: 'condenser', x: 81.25, y: 20.3 },
      { id: 'metering', x: 81.25, y: 79.7 },
      { id: 'evaporator', x: 18.75, y: 79.7 },
    ],
    chips: [
      { id: 'compressor', text: 'Compressor' },
      { id: 'condenser', text: 'Condenser' },
      { id: 'metering', text: 'Metering device' },
      { id: 'evaporator', text: 'Evaporator' },
    ],
  },

  compressor: {
    title: 'Label the reciprocating compressor',
    description: 'Pick a part name, then click the matching spot on the cutaway.',
    viewBox: '0 0 400 300',
    maxWidth: 380,
    svg:
      `<rect x="130" y="20" width="140" height="180" rx="8" fill="${SVG_WASH.cold}" stroke="${SVG.wireLive}" stroke-width="2"/>` +
      `<rect x="140" y="60" width="120" height="45" rx="4" fill="rgba(208,59,59,.5)" stroke="${SVG.compressor}" stroke-width="2"/>` +
      `<rect x="140" y="14" width="50" height="10" fill="${SVG.metering}"/>` +
      `<rect x="210" y="14" width="50" height="10" fill="${SVG.condenser}"/>` +
      `<line x1="200" y1="105" x2="200" y2="200" stroke="${SVG.wire}" stroke-width="6"/>` +
      `<circle cx="200" cy="230" r="34" fill="none" stroke="${SVG.metering}" stroke-width="8"/>`,
    spots: [
      { id: 'piston', x: 50, y: 28 },
      { id: 'suction', x: 41, y: 6 },
      { id: 'discharge', x: 59, y: 6 },
      { id: 'crankshaft', x: 50, y: 77 },
      { id: 'cylinder', x: 16, y: 40 },
    ],
    chips: [
      { id: 'piston', text: 'Piston' },
      { id: 'suction', text: 'Suction valve' },
      { id: 'discharge', text: 'Discharge valve' },
      { id: 'crankshaft', text: 'Crankshaft' },
      { id: 'cylinder', text: 'Cylinder wall' },
    ],
  },

  condenser: {
    title: 'Label the air-cooled condenser',
    description: 'Pick a part name, then click the matching spot on the diagram.',
    viewBox: '0 0 420 260',
    maxWidth: 420,
    svg:
      `<rect x="60" y="40" width="40" height="180" fill="rgba(236,131,90,.25)" stroke="${SVG.condenser}" stroke-width="2"/>` +
      `<circle cx="260" cy="130" r="70" fill="none" stroke="${SVG.wireLive}" stroke-width="3"/>` +
      `<line x1="260" y1="60" x2="260" y2="200" stroke="${SVG.wireLive}" stroke-width="3"/>` +
      `<line x1="190" y1="130" x2="330" y2="130" stroke="${SVG.wireLive}" stroke-width="3"/>` +
      `<rect x="65" y="20" width="30" height="10" fill="${SVG.compressor}"/>` +
      `<rect x="65" y="230" width="30" height="10" fill="${SVG.metering}"/>`,
    spots: [
      { id: 'coil', x: 19, y: 50 },
      { id: 'fan', x: 62, y: 50 },
      { id: 'vaporin', x: 19, y: 10 },
      { id: 'liquidout', x: 19, y: 92 },
    ],
    chips: [
      { id: 'coil', text: 'Finned coil' },
      { id: 'fan', text: 'Condenser fan' },
      { id: 'vaporin', text: 'Hot vapour in' },
      { id: 'liquidout', text: 'Liquid out' },
    ],
  },

  components: {
    title: 'Label the extended system',
    description: 'Pick a component name, then click its spot on the loop.',
    viewBox: '0 0 500 400',
    maxWidth: 520,
    svg: `<path d="M 60 120 C 60 60, 440 60, 440 120 C 440 260, 440 300, 300 330 C 200 350, 100 340, 60 260 C 40 200, 40 160, 60 120 Z" fill="none" stroke="${SVG.neutral}" stroke-width="3" stroke-dasharray="6 4"/>`,
    spots: [
      { id: 'oilsep', x: 32, y: 14 },
      { id: 'receiver', x: 78, y: 22 },
      { id: 'drier', x: 88, y: 45 },
      { id: 'sightglass', x: 80, y: 68 },
      { id: 'accumulator', x: 12, y: 60 },
    ],
    chips: [
      { id: 'oilsep', text: 'Oil separator' },
      { id: 'receiver', text: 'Receiver' },
      { id: 'drier', text: 'Filter-drier' },
      { id: 'sightglass', text: 'Sight glass' },
      { id: 'accumulator', text: 'Accumulator' },
    ],
  },

  circuit: {
    title: 'Label the control circuit',
    description: 'Pick a part name, then click its spot on the circuit.',
    viewBox: '0 0 480 220',
    maxWidth: 480,
    svg:
      `<rect x="20" y="20" width="30" height="60" fill="none" stroke="${SVG.wire}" stroke-width="3"/>` +
      `<rect x="150" y="15" width="40" height="30" fill="${SVG_WASH.live}" stroke="${SVG.wireLive}" stroke-width="2"/>` +
      `<circle cx="310" cy="30" r="20" fill="none" stroke="${SVG.metering}" stroke-width="3"/>` +
      `<line x1="50" y1="70" x2="330" y2="70" stroke="${SVG.wire}" stroke-width="3"/>` +
      `<line x1="330" y1="30" x2="330" y2="70" stroke="${SVG.wire}" stroke-width="3"/>` +
      `<rect x="150" y="120" width="40" height="16" fill="${SVG.condenser}"/>` +
      `<line x1="60" y1="128" x2="150" y2="128" stroke="${SVG.wire}" stroke-width="3"/>` +
      `<line x1="190" y1="128" x2="280" y2="128" stroke="${SVG.wire}" stroke-width="3"/>` +
      `<circle cx="320" cy="128" r="26" fill="rgba(208,59,59,.15)" stroke="${SVG.compressor}" stroke-width="3"/>` +
      `<line x1="60" y1="60" x2="60" y2="128" stroke="${SVG.wire}" stroke-width="3"/>`,
    spots: [
      { id: 'transformer', x: 7, y: 23 },
      { id: 'thermostat', x: 35, y: 14 },
      { id: 'coil', x: 65, y: 14 },
      { id: 'contacts', x: 35, y: 62 },
      { id: 'motor', x: 67, y: 58 },
    ],
    chips: [
      { id: 'transformer', text: 'Transformer' },
      { id: 'thermostat', text: 'Thermostat switch' },
      { id: 'coil', text: 'Contactor coil' },
      { id: 'contacts', text: 'Contactor contacts' },
      { id: 'motor', text: 'Compressor motor' },
    ],
  },

  'safety-devices': {
    title: 'Label the safety devices',
    description: 'Pick a device name, then click where it sits on the system.',
    viewBox: '0 0 640 320',
    svg:
      `<rect x="40" y="30" width="160" height="70" rx="10" fill="rgba(208,59,59,.08)" stroke="${SVG.compressor}" stroke-width="2"/>` +
      `<rect x="440" y="30" width="160" height="70" rx="10" fill="rgba(236,131,90,.08)" stroke="${SVG.condenser}" stroke-width="2"/>` +
      `<rect x="440" y="220" width="160" height="70" rx="10" fill="rgba(74,58,167,.08)" stroke="${SVG.metering}" stroke-width="2"/>` +
      `<rect x="40" y="220" width="160" height="70" rx="10" fill="rgba(27,175,122,.08)" stroke="${SVG.evaporator}" stroke-width="2"/>`,
    spots: [
      { id: 'hpc', x: 31, y: 9 },
      { id: 'lpc', x: 69, y: 9 },
      { id: 'defrost', x: 69, y: 91 },
      { id: 'freeze', x: 31, y: 91 },
    ],
    chips: [
      { id: 'hpc', text: 'High-pressure switch' },
      { id: 'lpc', text: 'Low-pressure switch' },
      { id: 'defrost', text: 'Defrost timer/thermostat' },
      { id: 'freeze', text: 'Freeze stat' },
    ],
  },
}

/* ── Put the steps in order ───────────────────────────────────────────────── */

export type SequenceSet = {
  title: string
  description: string
  items: { id: string; text: string }[]
  /** Item ids in the correct order. */
  answer: string[]
}

export const SEQUENCE_SETS: Record<string, SequenceSet> = {
  loto: {
    title: 'Put the LOTO steps in order',
    description:
      'Lockout/tagout has a strict sequence. Drag the steps, or use the arrows, into the correct order.',
    items: [
      { id: 'notify', text: 'Notify affected personnel that equipment will be shut down' },
      { id: 'shutdown', text: 'Shut down the equipment using the normal stopping procedure' },
      { id: 'isolate', text: 'Isolate all energy sources (electrical, mechanical, pressure)' },
      { id: 'apply', text: 'Apply your lock and tag to each isolated energy source' },
      { id: 'verify', text: 'Verify zero energy state — test before you touch' },
      { id: 'work', text: 'Perform the service work' },
      { id: 'restore', text: 'Remove your lock and tag, notify personnel, restore power' },
    ],
    answer: ['notify', 'shutdown', 'isolate', 'apply', 'verify', 'work', 'restore'],
  },
  cycle: {
    title: 'Put the cycle in order',
    description:
      'Drag the steps, or use the arrows, into the correct sequence. Start wherever you like as long as the cycle order is right.',
    items: [
      { id: 'comp', text: 'Compression — vapour is compressed to high pressure and temperature' },
      { id: 'cond', text: 'Condensation — vapour rejects heat and becomes high-pressure liquid' },
      { id: 'meter', text: 'Metering/expansion — pressure and temperature drop sharply' },
      { id: 'evap', text: 'Evaporation — liquid absorbs heat and becomes low-pressure vapour' },
    ],
    answer: ['comp', 'cond', 'meter', 'evap'],
  },
  install: {
    title: 'Put the installation steps in order',
    description: 'Drag the steps, or use the arrows, into the correct installation order.',
    items: [
      { id: 'braze', text: 'Braze joints while purging with dry nitrogen' },
      { id: 'presstest', text: 'Pressure test the system with dry nitrogen' },
      { id: 'evac', text: 'Evacuate to a deep vacuum (target ~500 microns)' },
      { id: 'charge', text: 'Weigh in the refrigerant charge' },
      { id: 'verify', text: 'Verify superheat and subcooling against target values' },
    ],
    answer: ['braze', 'presstest', 'evac', 'charge', 'verify'],
  },
}

/* ── Read the scenario, pick the answer ───────────────────────────────────── */

export type ClassifyScenario = {
  prompt: string
  options: string[]
  correct: number
  explain: string
}
export type ClassifySet = {
  title: string
  description: string
  scenarios: ClassifyScenario[]
}

export const CLASSIFY_SETS: Record<string, ClassifySet> = {
  'sensible-latent': {
    title: 'Sensible or latent?',
    description: 'Classify whether each scenario describes sensible heat or latent heat.',
    scenarios: [
      {
        prompt: 'Ice at 32°F absorbs heat and turns into water, still at 32°F.',
        options: ['Sensible heat', 'Latent heat'],
        correct: 1,
        explain: 'Temperature stayed the same during a phase change (melting) — that is latent heat.',
      },
      {
        prompt: 'Air blowing across a coil drops from 75°F to 55°F with no condensation.',
        options: ['Sensible heat', 'Latent heat'],
        correct: 0,
        explain: 'A temperature change with no phase change is sensible heat.',
      },
      {
        prompt: 'Refrigerant in the evaporator boils from liquid to vapour at a constant 40°F.',
        options: ['Sensible heat', 'Latent heat'],
        correct: 1,
        explain: 'Boiling is a phase change — the refrigerant absorbs heat without a temperature rise.',
      },
      {
        prompt:
          'Suction vapour leaving the evaporator warms from 40°F to 50°F (superheat) with no further phase change.',
        options: ['Sensible heat', 'Latent heat'],
        correct: 0,
        explain: 'Once fully vapour, added heat just raises temperature — sensible heat (superheat).',
      },
      {
        prompt: 'A pot of water at 212°F absorbs heat and turns to steam, still at 212°F.',
        options: ['Sensible heat', 'Latent heat'],
        correct: 1,
        explain: 'Boiling water into steam is a phase change at constant temperature — latent heat.',
      },
    ],
  },

  ashrae: {
    title: 'Classify the ASHRAE safety group',
    description: 'Given the description, pick the matching ASHRAE 34 safety classification.',
    scenarios: [
      {
        prompt:
          'Nontoxic, and will not propagate a flame under any test condition (e.g. R-410A, R-134a).',
        options: ['A1', 'A2L', 'A3', 'B2L'],
        correct: 0,
        explain: 'A1 = lower toxicity, nonflammable.',
      },
      {
        prompt:
          'Nontoxic, lower flammability, burns slowly with low heat of combustion (e.g. R-32, R-454B).',
        options: ['A1', 'A2L', 'A3', 'B2L'],
        correct: 1,
        explain: 'A2L = lower toxicity, mildly ("lower") flammable — the modern A2L refrigerant class.',
      },
      {
        prompt: 'Nontoxic, but highly flammable (e.g. R-290 propane).',
        options: ['A1', 'A2L', 'A3', 'B2L'],
        correct: 2,
        explain: 'A3 = lower toxicity, higher flammability.',
      },
      {
        prompt: 'Higher toxicity, mildly flammable (e.g. ammonia, R-717).',
        options: ['A1', 'A2L', 'A3', 'B2L'],
        correct: 3,
        explain: "B2L = higher toxicity, lower flammability — ammonia's classification.",
      },
    ],
  },

  capacitor: {
    title: 'Good capacitor or bad?',
    description: 'A dual run capacitor is rated 40/5 µF ±6%. Given the measured value, classify it.',
    scenarios: [
      {
        prompt: 'Nameplate: 40 µF. Measured: 39.2 µF.',
        options: ['Within tolerance — good', 'Out of tolerance — replace'],
        correct: 0,
        explain: '39.2 µF is within ±6% of 40 µF (37.6–42.4 µF range).',
      },
      {
        prompt: 'Nameplate: 40 µF. Measured: 14 µF.',
        options: ['Within tolerance — good', 'Out of tolerance — replace'],
        correct: 1,
        explain:
          '14 µF is far below the 37.6–42.4 µF tolerance band — the capacitor has degraded and should be replaced.',
      },
      {
        prompt: 'Nameplate: 5 µF (fan section). Measured: 0.4 µF.',
        options: ['Within tolerance — good', 'Out of tolerance — replace'],
        correct: 1,
        explain: '0.4 µF is essentially open — this section has failed.',
      },
      {
        prompt: 'Nameplate: 45 µF. Measured: 46.1 µF.',
        options: ['Within tolerance — good', 'Out of tolerance — replace'],
        correct: 0,
        explain: '46.1 µF is within ±6% of 45 µF (42.3–47.7 µF range).',
      },
    ],
  },

  dehumidify: {
    title: 'Does this space need dehumidification?',
    description:
      'Given the conditions and the application, decide whether active dehumidification is needed.',
    scenarios: [
      {
        prompt: 'A basement storage room reads 68°F and 75% RH, with a musty smell developing.',
        options: ['Yes, dehumidify', "No, it's fine"],
        correct: 0,
        explain:
          '75% RH is well above the ~60–70% threshold where mould risk rises — this space needs dehumidification.',
      },
      {
        prompt: 'An office space reads 72°F and 45% RH.',
        options: ['Yes, dehumidify', "No, it's fine"],
        correct: 1,
        explain: '45% RH is within the normal comfort band (roughly 30–50%) — no dehumidification needed.',
      },
      {
        prompt: 'A pharmaceutical storage room requires under 40% RH, and currently reads 55% RH.',
        options: ['Yes, dehumidify', "No, it's fine"],
        correct: 0,
        explain:
          "55% RH exceeds this application's strict 40% requirement — dehumidification is needed regardless of comfort norms.",
      },
      {
        prompt: 'A pool room reads 82°F and 62% RH, with condensation forming on the windows.',
        options: ['Yes, dehumidify', "No, it's fine"],
        correct: 0,
        explain:
          'Visible condensation confirms the dew point is being reached at the window surface — this space needs dehumidification.',
      },
    ],
  },

  'system-type': {
    title: 'Match the scenario to the system type',
    description: 'Read the scenario and pick the most likely system type.',
    scenarios: [
      {
        prompt:
          'A grocery store has one large mechanical room where several compressors serve dozens of open cases throughout the sales floor.',
        options: ['Domestic refrigerator', 'Supermarket rack system', 'Chiller plant'],
        correct: 1,
        explain:
          'Centralised compressors serving many display cases is the definition of a supermarket rack system.',
      },
      {
        prompt:
          'A hospital has a large piece of equipment that cools water, which is then piped to air handlers on every floor.',
        options: ['Heat pump', 'Chiller', 'Domestic refrigerator'],
        correct: 1,
        explain: 'Cooling water for distribution to air handlers is exactly what a chiller does.',
      },
      {
        prompt: "A home's outdoor unit has a reversing valve and provides both heating and cooling.",
        options: ['Heat pump', 'Chiller', 'Industrial ammonia plant'],
        correct: 0,
        explain: 'A reversing valve for both heating and cooling is the signature of a heat pump.',
      },
      {
        prompt: 'A large cold-storage food warehouse uses a toxic but highly efficient natural refrigerant.',
        options: [
          'Domestic refrigerator',
          'Industrial/process refrigeration',
          'Comfort cooling split system',
        ],
        correct: 1,
        explain:
          'Ammonia (R-717) in large cold storage is a classic industrial/process refrigeration application.',
      },
    ],
  },

  pm: {
    title: 'Spot the maintenance issue',
    description: 'Match the symptom to the PM task that would address it.',
    scenarios: [
      {
        prompt: 'A walk-in cooler door seal is cracked and lets warm air seep in around the frame.',
        options: ['Clean the condenser coil', 'Inspect/replace door gaskets', 'Test the defrost cycle'],
        correct: 1,
        explain: 'A cracked seal is a door gasket issue, letting warm humid air infiltrate the box.',
      },
      {
        prompt:
          "A rooftop unit's head pressure has crept up steadily over the summer with visible debris on the coil face.",
        options: ['Clean the condenser coil', 'Replace the air filter', 'Torque electrical connections'],
        correct: 0,
        explain:
          'Debris-fouled condenser coils are the classic cause of rising head pressure — cleaning restores airflow.',
      },
      {
        prompt:
          'A technician notices a discoloured, slightly loose wire connection at a contactor during a routine visit.',
        options: [
          'Verify refrigerant charge',
          'Torque and inspect electrical connections',
          'Clean the condensate drain',
        ],
        correct: 1,
        explain:
          'Loose or discoloured (heat-damaged) connections need to be tightened and inspected before they fail or start a fire.',
      },
      {
        prompt: 'Water is pooling under an indoor evaporator coil instead of draining away.',
        options: [
          'Clean the condensate drain and pan',
          'Inspect belts and bearings',
          'Clean the condenser coil',
        ],
        correct: 0,
        explain: 'Standing water under the coil points to a clogged condensate drain or pan.',
      },
    ],
  },

  recovery: {
    title: 'Recovery, recycling, or reclaiming?',
    description: 'A common EPA 608 exam trap — match the action to the correct term.',
    scenarios: [
      {
        prompt:
          'A technician removes refrigerant from a system into a recovery cylinder without testing or cleaning it.',
        options: ['Recovery', 'Recycling', 'Reclaiming'],
        correct: 0,
        explain: 'Recovery is simply removing refrigerant from a system, with no implied cleaning.',
      },
      {
        prompt:
          "A shop cleans refrigerant on-site with basic filtering so it can go back into the same customer's equipment.",
        options: ['Recovery', 'Recycling', 'Reclaiming'],
        correct: 1,
        explain: 'Recycling is on-site cleaning for reuse, typically by or for the same owner.',
      },
      {
        prompt:
          'Refrigerant is sent off-site and processed to AHRI 700 purity standards so it can be resold to anyone.',
        options: ['Recovery', 'Recycling', 'Reclaiming'],
        correct: 2,
        explain:
          'Reclaiming is the off-site process that restores refrigerant to new-product purity for resale.',
      },
      {
        prompt: 'A technician pulls refrigerant out of a decommissioned walk-in cooler before scrapping it.',
        options: ['Recovery', 'Recycling', 'Reclaiming'],
        correct: 0,
        explain: 'Simply pulling refrigerant out of equipment, regardless of what happens next, is recovery.',
      },
    ],
  },
}

/* ── Work the number out first, then classify ─────────────────────────────── */

export type CalcScenario = {
  /** Rows of given data. */
  givens: { label: string; value: string }[]
  /** The worked step-1 answer, shown before the learner classifies. */
  workedLabel: string
  worked: string
  correct: string
  /** Extra sentence appended to feedback, built from the scenario. */
  detail: string
}
export type CalcSet = {
  title: string
  description: string
  step2: string
  options: { value: string; label: string }[]
  scenarios: CalcScenario[]
}

function superheatScenario(satT: number, sucT: number, correct: string): CalcScenario {
  const sh = sucT - satT
  return {
    givens: [
      { label: 'Evaporator saturation temperature', value: `${satT}°F` },
      { label: 'Suction line temperature (same point)', value: `${sucT}°F` },
    ],
    workedLabel: 'Superheat',
    worked: `${sh}°F (${sucT} − ${satT})`,
    correct,
    detail: `${sh}°F of superheat.`,
  }
}

function heatLoadScenario(sens: number, lat: number, cap: number, correct: string): CalcScenario {
  const total = sens + lat
  return {
    givens: [
      { label: 'Sensible load', value: `${sens.toLocaleString()} Btu/hr` },
      { label: 'Latent load', value: `${lat.toLocaleString()} Btu/hr` },
      { label: 'Equipment rated capacity', value: `${cap.toLocaleString()} Btu/hr` },
    ],
    workedLabel: 'Total load',
    worked: `${total.toLocaleString()} Btu/hr (${sens.toLocaleString()} + ${lat.toLocaleString()})`,
    correct,
    detail: `Capacity is ${Math.round((cap / total) * 100)}% of the ${total.toLocaleString()} Btu/hr load.`,
  }
}

export const CALC_SETS: Record<string, CalcSet> = {
  superheat: {
    title: 'Calculate and classify',
    description: 'Work out the superheat, then classify how the metering device is feeding the evaporator.',
    step2: "Classify the valve's feeding behaviour",
    options: [
      { value: 'overfeeding', label: 'Overfeeding (too much refrigerant)' },
      { value: 'normal', label: 'Feeding normally' },
      { value: 'underfeeding', label: 'Underfeeding (starving the coil)' },
    ],
    scenarios: [
      superheatScenario(38, 47, 'normal'),
      superheatScenario(35, 39, 'overfeeding'),
      superheatScenario(40, 62, 'underfeeding'),
      superheatScenario(32, 35, 'overfeeding'),
      superheatScenario(42, 66, 'underfeeding'),
    ],
  },
  'heat-load': {
    title: 'Calculate the heat load, then classify',
    description:
      'Add the sensible and latent loads, then classify the equipment sizing against that total.',
    step2: 'Classify the sizing',
    options: [
      { value: 'undersized', label: 'Undersized for the load' },
      { value: 'correct', label: 'Correctly sized' },
      { value: 'oversized', label: 'Oversized for the load' },
    ],
    scenarios: [
      heatLoadScenario(8000, 2000, 10500, 'correct'),
      heatLoadScenario(9000, 3000, 9000, 'undersized'),
      heatLoadScenario(6000, 1500, 12000, 'oversized'),
      heatLoadScenario(11000, 4000, 15200, 'correct'),
      heatLoadScenario(7000, 5000, 9000, 'undersized'),
    ],
  },
}

/* ── Reference data used by the hero widgets ──────────────────────────────── */

export const HAZARDS = [
  {
    id: 'elec',
    label: 'Electrical shock / arc flash',
    ppe: ['Insulated, voltage-rated gloves', 'Arc-rated clothing for live work', 'Voltage-rated hand tools'],
    why: 'Contact with energised components can cause shock, burns, or a fatal arc flash.',
  },
  {
    id: 'refrig',
    label: 'Refrigerant splash / frostbite',
    ppe: ['Safety goggles or full face shield', 'Insulated, cold-resistant gloves'],
    why: 'Liquid refrigerant boils instantly on skin or in eyes, causing frostbite-like burns.',
  },
  {
    id: 'braze',
    label: 'Brazing flame / fire',
    ppe: ['Flame-resistant clothing', 'Welding gloves', 'Tinted safety glasses'],
    why: 'Brazing torches exceed 1,000°F and emit UV/IR light that can burn skin and eyes.',
  },
  {
    id: 'noise',
    label: 'Loud equipment noise',
    ppe: ['Earplugs or earmuffs'],
    why: "Compressors, condenser fans, and rooftop units often exceed 85 dBA, OSHA's action level.",
  },
  {
    id: 'falls',
    label: 'Falls from height',
    ppe: ['Fall-protection harness on rooftops', 'Hard hat', 'Steel-toe boots'],
    why: 'Rooftop units and ladder work carry serious fall hazards.',
  },
  {
    id: 'confined',
    label: 'Confined space / asphyxiation',
    ppe: ['Combustible/oxygen gas detector', 'Ventilation before entry', 'Harness and retrieval line'],
    why: 'A refrigerant leak can displace oxygen in an enclosed mechanical room in minutes.',
  },
] as const

export const COMPONENT_MAP_NODES = [
  {
    id: 'compressor',
    label: 'Compressor',
    x: 12,
    y: 30,
    info: 'Compresses low-pressure vapour into high-pressure, high-temperature vapour — the starting point of the high side.',
  },
  {
    id: 'oilsep',
    label: 'Oil separator',
    x: 32,
    y: 14,
    info: 'Sits right after the compressor and removes entrained oil from the hot discharge gas before it reaches the condenser.',
  },
  {
    id: 'condenser',
    label: 'Condenser',
    x: 55,
    y: 14,
    info: 'Rejects heat to outdoor air or water, condensing high-pressure vapour into high-pressure liquid.',
  },
  {
    id: 'receiver',
    label: 'Receiver',
    x: 78,
    y: 22,
    info: 'Stores a reserve of liquid refrigerant after the condenser so the system has liquid available as load changes.',
  },
  {
    id: 'drier',
    label: 'Filter-drier',
    x: 88,
    y: 45,
    info: 'Removes moisture, acid, and debris from the liquid line to protect the metering device and compressor.',
  },
  {
    id: 'sightglass',
    label: 'Sight glass',
    x: 80,
    y: 68,
    info: 'Lets you see whether refrigerant is a clear solid liquid (normal), has bubbles (undercharge or restriction), or shows moisture on the colour-changing element.',
  },
  {
    id: 'txv',
    label: 'Metering device',
    x: 60,
    y: 82,
    info: 'Creates the pressure drop into the evaporator and regulates refrigerant flow to match the heat load.',
  },
  {
    id: 'evaporator',
    label: 'Evaporator',
    x: 32,
    y: 82,
    info: 'Absorbs heat from the space as liquid refrigerant boils into low-pressure vapour.',
  },
  {
    id: 'accumulator',
    label: 'Accumulator',
    x: 12,
    y: 60,
    info: 'Traps any liquid or oil slugs on the suction line before they can reach and damage the compressor.',
  },
] as const

export const CONTROL_SEQUENCE_STEPS = [
  {
    label: 'Thermostat',
    info: 'Thermostat calls for cooling, energising the liquid line solenoid and control circuit.',
  },
  {
    label: 'Low-pressure switch',
    info: 'The LPC checks that suction pressure is high enough to safely start, and closes to allow the compressor circuit.',
  },
  {
    label: 'Contactor',
    info: 'The contactor coil energises, pulling in the contacts that feed the compressor and condenser fan.',
  },
  {
    label: 'Compressor & fan',
    info: 'Compressor and condenser fan start running, beginning the refrigeration cycle.',
  },
  {
    label: 'High-pressure switch',
    info: 'The HPC continuously monitors discharge pressure and can shut the compressor down any time it is exceeded.',
  },
  {
    label: 'Satisfied / shutdown',
    info: 'The thermostat is satisfied, the solenoid closes, the compressor pumps down, then the LPC opens and stops it.',
  },
] as const

export const SYSTEM_TYPES = [
  {
    label: 'Domestic',
    temp: '0 to 40°F',
    refrigerants: 'R-600a, R-134a',
    note: 'Sealed, factory-charged, capillary tube metering, no service ports.',
  },
  {
    label: 'Commercial',
    temp: '−30 to 45°F',
    refrigerants: 'R-448A, R-449A, R-404A (legacy)',
    note: 'Reach-ins, walk-ins, and supermarket racks serving many cases from central compressors.',
  },
  {
    label: 'Comfort / AC',
    temp: '~55–75°F supply air',
    refrigerants: 'R-410A, R-32, R-454B',
    note: 'The same vapour-compression cycle, tuned for occupant comfort and humidity control.',
  },
  {
    label: 'Heat pump',
    temp: 'Reverse-cycle',
    refrigerants: 'R-410A, R-32, R-454B',
    note: 'A reversing valve lets the same equipment heat or cool the building.',
  },
  {
    label: 'Chiller',
    temp: '42–58°F water',
    refrigerants: 'R-134a, R-513A, ammonia',
    note: 'Cools water or glycol, which is piped to air handlers throughout a building.',
  },
  {
    label: 'Industrial',
    temp: '−40 to 35°F',
    refrigerants: 'R-717 (ammonia), R-744 (CO₂)',
    note: 'Cold storage, food processing, and transport refrigeration at large scale.',
  },
] as const

export const PM_TASKS = [
  'Clean condenser coil and fins',
  'Replace or clean the air filter',
  'Inspect belts, bearings, and pulleys',
  'Torque and inspect electrical connections',
  'Verify refrigerant charge (superheat/subcooling)',
  'Clean condensate drain and pan',
  'Inspect door gaskets and seals (coolers/freezers)',
  'Test defrost cycle and safety controls',
] as const

/** The four corners of the classic charge/airflow diagnostic quadrant. */
export const DIAGNOSTIC_QUADRANTS = [
  {
    id: 'lowSH-highSC',
    title: 'Low SH / high SC',
    body: 'Overcharge, or restricted condenser airflow',
  },
  {
    id: 'highSH-highSC',
    title: 'High SH / high SC',
    body: 'Liquid-line restriction, e.g. a clogged drier',
  },
  {
    id: 'lowSH-lowSC',
    title: 'Low SH / low SC',
    body: 'TXV overfeeding or non-condensables — inspect further',
  },
  {
    id: 'highSH-lowSC',
    title: 'High SH / low SC',
    body: 'Undercharge, or restricted evaporator airflow',
  },
] as const
