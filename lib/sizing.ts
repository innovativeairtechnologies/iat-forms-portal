/* Sizing Studio — the desiccant dehumidifier selection engine.
 *
 * Takes a job's design conditions and returns a recommended IAT unit, the predicted
 * leaving-air condition, the moisture-removal duty, and the reactivation energy —
 * everything a rep needs to move from "the customer described a room" to a
 * preliminary submittal.
 *
 * Layering:
 *   lib/psychro.ts         — moist-air physics (ASHRAE, verified against the book)
 *   lib/sizing-catalog.ts  — IAT's product line and model-number grammar
 *   lib/sizing.ts          — this file: the selection logic joining the two
 *
 * ⚠️ PRELIMINARY BY DESIGN. The psychrometrics are exact; the *wheel performance*
 * coefficients in sizing-catalog.ts are planning approximations, because IAT's real
 * rotor curves live in the DryWare calculator and engineering's selection charts, not
 * in this repo. Every result carries `preliminary: true` and the UI stamps it. When
 * engineering supplies real curves, swap `predictLeavingState` and nothing else moves.
 */

import {
  type AirState,
  airStateFromRH,
  airStateFromDewPoint,
  airStateFromGrains,
  airStateFromW,
  enthalpy,
  massFlowFromCFM,
  mixStreams,
  moistureRemoval,
  pressureAtAltitude,
  GRAINS_PER_LB,
} from './psychro'
import {
  type ReactivationCode,
  type ModelSpec,
  type WheelType,
  WHEEL_SPECS,
  CATALOG_SIZES,
  MAX_CATALOG_CFM,
  MAX_DESIGN_FACE_VELOCITY_FPM,
  buildModelNumber,
  faceVelocityFpm,
  isCompactSize,
  selectNominalSize,
  reactivationLabel,
} from './sizing-catalog'

// ─── Design constants ────────────────────────────────────────────────────────

/**
 * Reactivation airflow as a fraction of process airflow. Desiccant units commonly
 * run 3:1 process:reactivation; that's the planning default until a job says otherwise.
 */
export const REACTIVATION_AIRFLOW_RATIO = 1 / 3

/**
 * Reactivation temperature and its effect on achievable dryness, per heat source.
 *
 * The temperature is real and consequential: hot-water reactivation tops out far below
 * electric or gas, so it genuinely cannot reach the deep dew points a molecular-sieve
 * job needs. `removalFactor` derates the wheel's nominal removal accordingly.
 *
 * ⚠️ Planning coefficients — see the file header.
 */
export const REACTIVATION_PERFORMANCE: Record<
  ReactivationCode,
  { tempF: number; removalFactor: number }
> = {
  // 285 °F is DryWare's own default reactivation temperature in the wheel calculator,
  // and the figure the training material teaches ("typically set at 285 degrees"). This
  // previously said 270.
  E: { tempF: 285, removalFactor: 1.0 },
  G: { tempF: 285, removalFactor: 1.0 },
  // ⚠️ Steam and hot water are NOT confirmed against DryWare — these remain planning
  // figures. Hot water genuinely tops out far below a fired/electric heater, which is
  // why it derates hardest.
  S: { tempF: 250, removalFactor: 0.95 },
  HW: { tempF: 190, removalFactor: 0.7 },
}

/** Natural gas higher heating value, BTU per standard ft³. */
const NATURAL_GAS_BTU_PER_CF = 1030
/** Latent heat of low-pressure steam, BTU per lb — planning figure. */
const STEAM_BTU_PER_LB = 1000
/** BTU per hour per kW. */
const BTU_PER_KWH = 3412.14
/** Specific heat of air, BTU / lb·°F. */
const CP_AIR = 0.24

// ─── Inputs ──────────────────────────────────────────────────────────────────

/** How a humidity condition was entered. The Studio accepts all three. */
export type HumidityMode = 'rh' | 'dewpoint' | 'grains'

export type HumidityInput = {
  tempF: number
  mode: HumidityMode
  /** Relative humidity, percent (0–100). Used when mode is 'rh'. */
  rh?: number
  /** Dew point, °F. Used when mode is 'dewpoint'. */
  dewPointF?: number
  /** Grains per lb dry air. Used when mode is 'grains'. */
  grains?: number
}

export type SizingInputs = {
  /** Job identity — carried onto the submittal. */
  projectName?: string

  /** Airflow basis: state it directly, or derive it from room volume × air changes. */
  airflowMode: 'direct' | 'room'
  processCfm?: number
  roomVolumeFt3?: number
  airChangesPerHour?: number

  /** The space / return-air condition entering the unit. */
  entering: HumidityInput
  /** The condition the space must hold. */
  target: HumidityInput

  /** Outside-air fraction, percent (0–100), and the outdoor design condition. */
  freshAirPercent: number
  outsideAir: HumidityInput

  /** Site elevation, ft above sea level. */
  altitudeFt: number

  /** Internal moisture generation — people, product drying, open tanks, infiltration. */
  internalLoadLbPerHour?: number

  /** Equipment preferences. */
  reactivation: ReactivationCode
  /** 'auto' upgrades to a high-capacity wheel only when the target demands it. */
  wheelPreference: 'auto' | WheelType
  idp: boolean
}

export const DEFAULT_SIZING_INPUTS: SizingInputs = {
  airflowMode: 'direct',
  processCfm: 2000,
  entering: { tempF: 75, mode: 'rh', rh: 60 },
  target: { tempF: 70, mode: 'rh', rh: 35 },
  freshAirPercent: 10,
  outsideAir: { tempF: 95, mode: 'rh', rh: 60 },
  altitudeFt: 0,
  internalLoadLbPerHour: 0,
  reactivation: 'E',
  wheelPreference: 'auto',
  idp: false,
}

// ─── Outputs ─────────────────────────────────────────────────────────────────

export type SizingWarning = {
  severity: 'error' | 'warning' | 'info'
  message: string
}

export type SizingResult = {
  /** Always true until engineering's rotor curves land — see the file header. */
  preliminary: true
  pressure: number

  /** Resolved air states, in process order. */
  returnAir: AirState
  outsideAir: AirState
  /** Return + outside air mixed — what actually enters the wheel. */
  entering: AirState
  /** Predicted unit discharge. */
  leaving: AirState
  /** The condition the space must hold. */
  target: AirState

  airflow: {
    /** Circulation airflow the user asked for (direct, or room volume × ACH). */
    circulationCfm: number
    /** Airflow needed to carry away the total moisture load. */
    loadCfm: number
    /** The governing requirement — the greater of the two. */
    requiredCfm: number
    freshAirCfm: number
  }

  load: {
    /** Moisture the airstream itself must shed, lb/hr. */
    airstreamLbPerHour: number
    /** Moisture pulled in with outside air, lb/hr. */
    freshAirLbPerHour: number
    /** User-supplied internal generation, lb/hr. */
    internalLbPerHour: number
    /** Everything the unit must remove, lb/hr. */
    totalLbPerHour: number
    /** Grain depression required, entering → target. */
    requiredGrainDepression: number
    /** Grain depression the selected unit is predicted to deliver. */
    deliveredGrainDepression: number
  }

  selection: {
    model: string
    spec: ModelSpec
    nominalCfm: number
    /** More than one when the requirement exceeds the largest single unit. */
    unitsRequired: number
    wheel: WheelType
    /** Real wheel geometry for the selected unit, from DryWare's product catalog. */
    wheelDiameterMm: number
    wheelDepthMm: number
    effectiveAreaFt2: number
    /** Process-sector face velocity at the airflow ONE unit sees, ft/min. */
    faceVelocityFpm: number
    /** Plain-English reasons this unit was chosen — shown in the UI and by Jerry. */
    rationale: string[]
  }

  reactivation: {
    code: ReactivationCode
    label: string
    airflowCfm: number
    tempF: number
    heatBtuh: number
    electricKw: number
    gasCfh: number
    steamLbPerHour: number
    /** Reactivation heat per lb of water removed — the industry sanity check. */
    btuPerLbWater: number
  }

  warnings: SizingWarning[]
}

// ─── Resolving a humidity input into a full air state ────────────────────────

export function resolveAirState(input: HumidityInput, p: number): AirState {
  switch (input.mode) {
    case 'dewpoint':
      return airStateFromDewPoint(input.tempF, input.dewPointF ?? input.tempF, p)
    case 'grains':
      return airStateFromGrains(input.tempF, Math.max(input.grains ?? 0, 0), p)
    case 'rh':
    default:
      return airStateFromRH(input.tempF, clamp(input.rh ?? 50, 0, 100), p)
  }
}

// ─── Wheel performance ───────────────────────────────────────────────────────

/**
 * Predict the air leaving the desiccant wheel.
 *
 * Moisture: a fixed fraction of the entering grains is removed, floored at the wheel's
 * practical minimum, and derated by the reactivation heat source's temperature.
 *
 * Temperature: desiccant dehumidification is modelled as ADIABATIC — the latent heat
 * given up by the air reappears as sensible heat, so the process runs up a line of
 * constant enthalpy. That's the textbook first-order approximation and it's what makes
 * the chart's process line read correctly. Real units run slightly warmer still,
 * because some reactivation heat carries over on the wheel.
 *
 * ⚠️ Replace this function (only) when engineering's rotor curves are available.
 */
export function predictLeavingState(
  entering: AirState,
  wheel: WheelType,
  reactivation: ReactivationCode,
  p: number,
): AirState {
  const spec = WHEEL_SPECS[wheel]
  const derate = REACTIVATION_PERFORMANCE[reactivation].removalFactor
  const removal = spec.removalFraction * derate

  const leavingGrains = Math.max(entering.grains * (1 - removal), spec.floorGrains)
  // Never "dry" past the floor into a wetter state than we started.
  const grains = Math.min(leavingGrains, entering.grains)
  const W = grains / GRAINS_PER_LB

  // Adiabatic: hold enthalpy, solve for the new dry-bulb.
  const h = entering.enthalpy
  const tempF = (h - 1061 * W) / (CP_AIR + 0.444 * W)
  return airStateFromW(tempF, W, p)
}

/** The driest grains a given wheel + heat source can reach from this entering air. */
function achievableGrains(
  entering: AirState,
  wheel: WheelType,
  reactivation: ReactivationCode,
): number {
  const spec = WHEEL_SPECS[wheel]
  const removal = spec.removalFraction * REACTIVATION_PERFORMANCE[reactivation].removalFactor
  return Math.max(entering.grains * (1 - removal), spec.floorGrains)
}

// ─── The engine ──────────────────────────────────────────────────────────────

export function calculateSizing(inputs: SizingInputs): SizingResult {
  const warnings: SizingWarning[] = []
  const p = pressureAtAltitude(Math.max(inputs.altitudeFt, 0))

  // 1. Resolve the three given conditions.
  const returnAir = resolveAirState(inputs.entering, p)
  const outsideAir = resolveAirState(inputs.outsideAir, p)
  const target = resolveAirState(inputs.target, p)

  // 2. Circulation airflow — stated directly, or from room volume × air changes.
  const circulationCfm =
    inputs.airflowMode === 'room'
      ? ((inputs.roomVolumeFt3 ?? 0) * (inputs.airChangesPerHour ?? 0)) / 60
      : Math.max(inputs.processCfm ?? 0, 0)

  if (circulationCfm <= 0) {
    warnings.push({
      severity: 'error',
      message:
        inputs.airflowMode === 'room'
          ? 'Enter a room volume and air-change rate to derive the process airflow.'
          : 'Enter a process airflow greater than zero.',
    })
  }

  // 3. Mix in outside air to get the true entering condition. This is the single most
  //    common reason a "room condition" sizing comes out undersized.
  const freshPct = clamp(inputs.freshAirPercent, 0, 100)
  const freshAirCfm = (circulationCfm * freshPct) / 100
  const returnCfm = circulationCfm - freshAirCfm
  const entering =
    freshAirCfm > 0 && returnCfm >= 0
      ? mixStreams(returnAir, returnCfm, outsideAir, freshAirCfm, p)
      : returnAir

  // 4. Pick the wheel. 'auto' upgrades to high-capacity only if standard can't reach
  //    the target — an HC wheel is a real cost adder, not a free safety margin.
  let wheel: WheelType
  if (inputs.wheelPreference === 'auto') {
    wheel =
      achievableGrains(entering, 'standard', inputs.reactivation) <= target.grains
        ? 'standard'
        : 'high-capacity'
  } else {
    wheel = inputs.wheelPreference
  }

  const leaving = predictLeavingState(entering, wheel, inputs.reactivation, p)

  // 5. Can we actually hit the target?
  if (leaving.grains > target.grains + 0.01) {
    warnings.push({
      severity: 'error',
      message: `Target of ${fmt(target.grains, 1)} gr/lb is below what this configuration reaches (${fmt(leaving.grains, 1)} gr/lb). Try ${reactivationLabel('G')} or ${reactivationLabel('E')} reactivation, a high-capacity wheel, or relax the target.`,
    })
  }
  if (target.grains >= entering.grains) {
    warnings.push({
      severity: 'error',
      message:
        'The target is already wetter than the entering air — no dehumidification is required. Check the entering and target conditions.',
    })
  }

  // 6. Moisture load. Three contributors, all in lb/hr.
  const airstreamDuty = moistureRemoval(circulationCfm, entering, leaving)

  const freshAirLbPerHour =
    freshAirCfm > 0
      ? Math.max(
          (massFlowFromCFM(freshAirCfm, outsideAir) * (outsideAir.W - target.W)),
          0,
        )
      : 0
  const internalLbPerHour = Math.max(inputs.internalLoadLbPerHour ?? 0, 0)
  const totalLbPerHour = freshAirLbPerHour + internalLbPerHour

  // 7. Airflow needed to carry that load away, given the drying this unit achieves.
  const deltaW = Math.max(entering.W - leaving.W, 0)
  const removalPerCfm = deltaW > 0 ? (60 / entering.specificVolume) * deltaW : 0
  const loadCfm = removalPerCfm > 0 ? totalLbPerHour / removalPerCfm : 0

  // The unit must satisfy BOTH the circulation requirement and the load requirement.
  const requiredCfm = Math.max(circulationCfm, loadCfm)
  if (loadCfm > circulationCfm && circulationCfm > 0) {
    warnings.push({
      severity: 'warning',
      message: `The moisture load governs: ${fmt(loadCfm, 0)} CFM is needed to carry it away, more than the ${fmt(circulationCfm, 0)} CFM circulation requirement.`,
    })
  }

  // 8. Select the unit.
  const size = selectNominalSize(requiredCfm)
  let nominalCfm: number
  let unitsRequired = 1
  if (size) {
    nominalCfm = size.nominalCfm
  } else {
    nominalCfm = MAX_CATALOG_CFM
    unitsRequired = Math.max(Math.ceil(requiredCfm / MAX_CATALOG_CFM), 1)
    warnings.push({
      severity: 'warning',
      message: `${fmt(requiredCfm, 0)} CFM exceeds the largest single unit (${MAX_CATALOG_CFM.toLocaleString()} CFM). Shown as ${unitsRequired} × ${MAX_CATALOG_CFM.toLocaleString()} CFM — confirm the arrangement with engineering.`,
    })
  }

  const sizeEntry = CATALOG_SIZES.find((s) => s.nominalCfm === nominalCfm)

  // Face velocity through the process sector — the constraint that really governs the
  // wheel diameter. Checked against the airflow ONE unit actually sees.
  const cfmPerUnit = requiredCfm / unitsRequired
  const faceVelocity = sizeEntry ? faceVelocityFpm(cfmPerUnit, sizeEntry) : 0
  if (sizeEntry && faceVelocity > MAX_DESIGN_FACE_VELOCITY_FPM) {
    warnings.push({
      severity: 'warning',
      message: `Process face velocity is ${fmt(faceVelocity, 0)} fpm on the ${sizeEntry.model} (${fmt(sizeEntry.effectiveAreaFt2, 3)} ft² wheel). IAT rates this line at 530–580 fpm and the design ceiling is ${MAX_DESIGN_FACE_VELOCITY_FPM} fpm — too fast leaves the air too little residence time in the desiccant and raises pressure drop. Step up a size.`,
    })
  }

  const compact = isCompactSize(nominalCfm) && nominalCfm <= 600 && !inputs.idp
  const spec: ModelSpec = {
    nominalCfm,
    system: 'R',
    reactivation: inputs.reactivation,
    wheel,
    compact,
    idp: inputs.idp,
    actualCfm: Math.round(requiredCfm / unitsRequired),
  }

  // 9. Reactivation duty. Heat the reactivation airstream from the outdoor condition
  //    up to the wheel's regeneration temperature.
  const reactPerf = REACTIVATION_PERFORMANCE[inputs.reactivation]
  const reactAirflowCfm = (nominalCfm * unitsRequired) * REACTIVATION_AIRFLOW_RATIO
  const reactMassFlow = massFlowFromCFM(reactAirflowCfm, outsideAir)
  const reactDeltaT = Math.max(reactPerf.tempF - outsideAir.tempF, 0)
  const heatBtuh = reactMassFlow * CP_AIR * reactDeltaT

  const removedLbPerHour = Math.max(airstreamDuty.lbPerHour, 0)
  const btuPerLbWater = removedLbPerHour > 0 ? heatBtuh / removedLbPerHour : 0

  // Desiccant reactivation typically lands around 1,500–2,500 BTU per lb of water.
  // Well outside that usually means the airflow or the conditions need a second look.
  if (removedLbPerHour > 0 && (btuPerLbWater < 1000 || btuPerLbWater > 4000)) {
    warnings.push({
      severity: 'info',
      message: `Reactivation works out to ${fmt(btuPerLbWater, 0)} BTU per lb of water removed; desiccant systems typically run 1,500–2,500. Worth a sanity check on airflow and design conditions.`,
    })
  }

  // 10. Advisory notes on the inputs themselves.
  if (inputs.altitudeFt >= 2000) {
    warnings.push({
      severity: 'info',
      message: `Sized at ${inputs.altitudeFt.toLocaleString()} ft (${fmt(p, 2)} psia). Thinner air carries less moisture per CFM — this is accounted for.`,
    })
  }
  if (freshPct >= 50) {
    warnings.push({
      severity: 'warning',
      message: `${fmt(freshPct, 0)}% outside air is a heavy ventilation load. Confirm it's required — it drives most of the unit size.`,
    })
  }
  if (inputs.reactivation === 'HW') {
    warnings.push({
      severity: 'warning',
      message: `Hot-water reactivation runs at ${reactPerf.tempF} °F, well below electric or gas, so achievable dryness is limited. Verify the target dew point is reachable.`,
    })
  }
  if (returnAir.dewPointF > returnAir.tempF + 0.1) {
    warnings.push({
      severity: 'error',
      message: 'Entering dew point is above the entering dry-bulb — check the entering condition.',
    })
  }

  const rationale = buildRationale({
    requiredCfm,
    nominalCfm,
    unitsRequired,
    wheel,
    reactivation: inputs.reactivation,
    entering,
    target,
    leaving,
    freshPct,
    loadGoverns: loadCfm > circulationCfm,
  })

  return {
    preliminary: true,
    pressure: p,
    returnAir,
    outsideAir,
    entering,
    leaving,
    target,
    airflow: { circulationCfm, loadCfm, requiredCfm, freshAirCfm },
    load: {
      airstreamLbPerHour: airstreamDuty.lbPerHour,
      freshAirLbPerHour,
      internalLbPerHour,
      totalLbPerHour,
      requiredGrainDepression: entering.grains - target.grains,
      deliveredGrainDepression: entering.grains - leaving.grains,
    },
    selection: {
      model: buildModelNumber(spec),
      spec,
      nominalCfm,
      unitsRequired,
      wheel,
      wheelDiameterMm: sizeEntry?.wheelDiameterMm ?? 0,
      // An HC build swaps the standard 200 mm rotor for a 400 mm one.
      wheelDepthMm: WHEEL_SPECS[wheel].depthMm,
      effectiveAreaFt2: sizeEntry?.effectiveAreaFt2 ?? 0,
      faceVelocityFpm: faceVelocity,
      rationale,
    },
    reactivation: {
      code: inputs.reactivation,
      label: reactivationLabel(inputs.reactivation),
      airflowCfm: reactAirflowCfm,
      tempF: reactPerf.tempF,
      heatBtuh,
      electricKw: heatBtuh / BTU_PER_KWH,
      gasCfh: heatBtuh / NATURAL_GAS_BTU_PER_CF,
      steamLbPerHour: heatBtuh / STEAM_BTU_PER_LB,
      btuPerLbWater,
    },
    warnings,
  }
}

/** Plain-English "why this unit" — surfaced in the UI and reusable as Jerry's script. */
function buildRationale(a: {
  requiredCfm: number
  nominalCfm: number
  unitsRequired: number
  wheel: WheelType
  reactivation: ReactivationCode
  entering: AirState
  target: AirState
  leaving: AirState
  freshPct: number
  loadGoverns: boolean
}): string[] {
  const out: string[] = []

  out.push(
    a.unitsRequired > 1
      ? `${a.requiredCfm.toFixed(0)} CFM required → ${a.unitsRequired} × ${a.nominalCfm.toLocaleString()} CFM units.`
      : `${a.requiredCfm.toFixed(0)} CFM required → the ${a.nominalCfm.toLocaleString()} CFM catalog size is the smallest that covers it.`,
  )

  if (a.freshPct > 0) {
    out.push(
      `${fmt(a.freshPct, 0)}% outside air raises the entering condition to ${fmt(a.entering.tempF, 1)} °F / ${fmt(a.entering.grains, 1)} gr/lb.`,
    )
  }

  out.push(
    a.loadGoverns
      ? 'The moisture load governs the airflow, not the circulation rate.'
      : 'The circulation rate governs the airflow.',
  )

  out.push(
    a.wheel === 'high-capacity'
      ? `A high-capacity wheel is needed: a standard wheel cannot reach ${fmt(a.target.grains, 1)} gr/lb from this entering air.`
      : `A standard wheel reaches ${fmt(a.leaving.grains, 1)} gr/lb, meeting the ${fmt(a.target.grains, 1)} gr/lb target.`,
  )

  out.push(
    `${reactivationLabel(a.reactivation)} reactivation at ${REACTIVATION_PERFORMANCE[a.reactivation].tempF} °F.`,
  )

  return out
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi)
}

function fmt(n: number, digits: number): string {
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}
