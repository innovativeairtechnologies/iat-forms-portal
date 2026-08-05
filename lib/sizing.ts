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
import { sectorDwellSeconds } from './hvac-calcs'
import {
  type ReactivationCode,
  type ModelSpec,
  type WheelType,
  WHEEL_SPECS,
  CATALOG_SIZES,
  MAX_DESIGN_FACE_VELOCITY_FPM,
  maxCatalogCfm,
  type CatalogSize,
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
 * Fraction of the available reactivation temperature rise recovered by routing the
 * purge outlet into the reactivation inlet.
 *
 * ⚠️ PLANNING ESTIMATE — the real figure depends on wheel thermal mass and rotation
 * speed, which is what DryWare's calculator models. It only ever reduces the
 * reactivation duty, and the un-credited figure is reported alongside it.
 */
export const PURGE_HEAT_RECOVERY = 0.35

/** Rotation used for dwell reporting when the job doesn't state one. */
export const DEFAULT_RPH = 20

/** Normalised wheel sector split, in degrees, plus the derived area fractions. */
export type WheelSectors = {
  processDeg: number
  reactDeg: number
  purgeDeg: number
  processFraction: number
  reactFraction: number
  purgeFraction: number
  /** True when the entered degrees did not total 360 and were scaled to fit. */
  normalised: boolean
}

/**
 * Resolve the wheel split. The three sectors must cover the face exactly, so if the
 * entered degrees don't total 360 they are scaled proportionally rather than silently
 * producing airflow ratios that don't correspond to a real machine.
 */
export function resolveWheelSectors(
  processDeg: number,
  reactDeg: number,
  purgeDeg: number,
): WheelSectors {
  const p = Math.max(processDeg, 0)
  const r = Math.max(reactDeg, 0)
  const g = Math.max(purgeDeg, 0)
  const total = p + r + g
  if (total <= 0) {
    return { processDeg: 270, reactDeg: 90, purgeDeg: 0, processFraction: 0.75, reactFraction: 0.25, purgeFraction: 0, normalised: true }
  }
  const k = 360 / total
  const normalised = Math.abs(total - 360) > 0.01
  return {
    processDeg: p * k,
    reactDeg: r * k,
    purgeDeg: g * k,
    processFraction: (p * k) / 360,
    reactFraction: (r * k) / 360,
    purgeFraction: (g * k) / 360,
    normalised,
  }
}

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

  /**
   * How the wheel face is divided, in DEGREES — the way DryWare expresses it, and the
   * way the machine is actually built. Airflow through each sector is proportional to
   * its angle at a common face velocity, so this replaces the old fixed ⅓
   * process:reactivation airflow ratio (270/90 is the same 3:1, stated properly).
   */
  processDegrees: number
  reactDegrees: number
  /** Purge sector, degrees. 0 disables purge. */
  purgeDegrees: number
  /**
   * Route the purge outlet into the reactivation inlet. Purge air leaves the
   * just-reactivated wheel hot, so feeding it to reactivation recovers that heat
   * instead of dumping it — DryWare's "Autofill Purge Outlet to React Inlet".
   */
  purgeToReact: boolean

  /** Wheel rotation, rotations per hour. 0 = let the Studio suggest one. */
  rph: number
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
  // DryWare's own defaults.
  processDegrees: 270,
  reactDegrees: 90,
  purgeDegrees: 0,
  purgeToReact: true,
  rph: 0,
}

/**
 * Coerce untrusted JSON into a usable SizingInputs.
 *
 * The Studio itself never needs this — its state is already typed. It exists for
 * the server side, where a client POSTs a run to be verified against DryWare and
 * every field has to be re-derived rather than trusted. Anything missing, wrongly
 * typed or non-finite falls back to the corresponding DEFAULT_SIZING_INPUTS value,
 * so this never throws and never yields NaN.
 */
export function parseSizingInputs(raw: unknown): SizingInputs {
  const d = DEFAULT_SIZING_INPUTS
  const o = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>

  const num = (v: unknown, fallback: number): number =>
    typeof v === 'number' && Number.isFinite(v) ? v : fallback
  const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback)
  const oneOf = <T extends string>(v: unknown, allowed: readonly T[], fallback: T): T =>
    typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : fallback

  const cond = (v: unknown, fallback: HumidityInput): HumidityInput => {
    const c = (v && typeof v === 'object' ? v : {}) as Record<string, unknown>
    return {
      tempF: num(c.tempF, fallback.tempF),
      mode: oneOf<HumidityMode>(c.mode, ['rh', 'dewpoint', 'grains'], fallback.mode),
      rh: num(c.rh, fallback.rh ?? 0),
      dewPointF: num(c.dewPointF, fallback.dewPointF ?? 0),
      grains: num(c.grains, fallback.grains ?? 0),
    }
  }

  return {
    projectName: typeof o.projectName === 'string' ? o.projectName.slice(0, 200) : undefined,
    airflowMode: oneOf(o.airflowMode, ['direct', 'room'] as const, d.airflowMode),
    processCfm: num(o.processCfm, d.processCfm ?? 0),
    roomVolumeFt3: num(o.roomVolumeFt3, d.roomVolumeFt3 ?? 0),
    airChangesPerHour: num(o.airChangesPerHour, d.airChangesPerHour ?? 0),
    entering: cond(o.entering, d.entering),
    target: cond(o.target, d.target),
    freshAirPercent: num(o.freshAirPercent, d.freshAirPercent),
    outsideAir: cond(o.outsideAir, d.outsideAir),
    altitudeFt: num(o.altitudeFt, d.altitudeFt),
    internalLoadLbPerHour: num(o.internalLoadLbPerHour, d.internalLoadLbPerHour ?? 0),
    reactivation: oneOf<ReactivationCode>(o.reactivation, ['E', 'S', 'G', 'HW'], d.reactivation),
    wheelPreference: oneOf(o.wheelPreference, ['auto', 'standard', 'high-capacity'] as const, d.wheelPreference),
    idp: bool(o.idp, d.idp),
    processDegrees: num(o.processDegrees, d.processDegrees),
    reactDegrees: num(o.reactDegrees, d.reactDegrees),
    purgeDegrees: num(o.purgeDegrees, d.purgeDegrees),
    purgeToReact: bool(o.purgeToReact, d.purgeToReact),
    rph: num(o.rph, d.rph),
  }
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

  /** How the wheel face is divided, and what that implies for rotation. */
  wheel: {
    processDeg: number
    reactDeg: number
    purgeDeg: number
    /** Airflow through the purge sector, CFM. Zero when purge is off. */
    purgeAirflowCfm: number
    /** Rotation used for the dwell figures, RPH (the suggested value when not set). */
    rph: number
    rphSuggested: boolean
    /** Seconds a point on the wheel spends in each sector at that rotation. */
    processDwellSec: number
    reactDwellSec: number
    purgeDwellSec: number
  }

  reactivation: {
    code: ReactivationCode
    label: string
    airflowCfm: number
    tempF: number
    /** Reactivation inlet temperature — raised above ambient when purge feeds it. */
    inletTempF: number
    heatBtuh: number
    /** What the duty would be without the purge heat-recovery credit. */
    heatBtuhWithoutPurge: number
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

export function calculateSizing(
  inputs: SizingInputs,
  catalog: CatalogSize[] = CATALOG_SIZES,
): SizingResult {
  const warnings: SizingWarning[] = []
  const maxCfm = maxCatalogCfm(catalog)

  // Wheel sector split, resolved up front — it governs reactivation airflow, purge
  // airflow and the process face velocity.
  const wheel3 = resolveWheelSectors(inputs.processDegrees, inputs.reactDegrees, inputs.purgeDegrees)
  if (wheel3.normalised) {
    warnings.push({
      severity: 'info',
      message: `Wheel sectors totalled ${fmt(inputs.processDegrees + inputs.reactDegrees + inputs.purgeDegrees, 0)}°, not 360° — scaled proportionally to ${fmt(wheel3.processDeg, 0)}° / ${fmt(wheel3.reactDeg, 0)}°${wheel3.purgeDeg > 0 ? ` / ${fmt(wheel3.purgeDeg, 0)}° purge` : ''}.`,
    })
  }
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
  const size = selectNominalSize(requiredCfm, catalog)
  let nominalCfm: number
  let unitsRequired = 1
  if (size) {
    nominalCfm = size.nominalCfm
  } else {
    nominalCfm = maxCfm
    unitsRequired = Math.max(Math.ceil(requiredCfm / maxCfm), 1)
    warnings.push({
      severity: 'warning',
      message: `${fmt(requiredCfm, 0)} CFM exceeds the largest single unit (${maxCfm.toLocaleString()} CFM). Shown as ${unitsRequired} × ${maxCfm.toLocaleString()} CFM — confirm the arrangement with engineering.`,
    })
  }

  const sizeEntry = catalog.find((s) => s.nominalCfm === nominalCfm)

  // Face velocity through the process sector — the constraint that really governs the
  // wheel diameter. Checked against the airflow ONE unit actually sees, and against
  // the ACTUAL process sector, which shrinks when a purge sector is carved out.
  const cfmPerUnit = requiredCfm / unitsRequired
  const faceVelocity = sizeEntry ? faceVelocityFpm(cfmPerUnit, sizeEntry, wheel3.processFraction) : 0
  if (sizeEntry && faceVelocity > MAX_DESIGN_FACE_VELOCITY_FPM) {
    warnings.push({
      severity: 'warning',
      message: `Process face velocity is ${fmt(faceVelocity, 0)} fpm on the ${sizeEntry.model} (${fmt(sizeEntry.effectiveAreaFt2, 3)} ft² wheel). IAT rates this line at 530–580 fpm and the design ceiling is ${MAX_DESIGN_FACE_VELOCITY_FPM} fpm — too fast leaves the air too little residence time in the desiccant and raises pressure drop. Step up a size.`,
    })
  }

  // The rotor actually fitted to the selected size.
  //
  // ⚠️ This is the catalog row's own depth, NOT a per-wheel-type constant. The
  // mainline units are all 200 mm, but the 75 and 150 CFM compacts ship a 100 mm
  // rotor — reading WHEEL_SPECS[wheel].depthMm here modelled a machine IAT does
  // not build, and once that value started feeding DryWare's performance engine it
  // produced confidently wrong numbers (a 100 CFM job verified ~2 gr/lb drier than
  // reachable, at double the true pressure drop, under a "Verified" stamp).
  //
  // An HC build swaps in a rotor of twice the depth — 200→400 on the mainline
  // (which is what WHEEL_SPECS describes), 100→200 on the compacts. Both depths
  // exist in DryWare's rotor catalog.
  const baseRotorDepthMm = sizeEntry?.wheelDepthMm ?? WHEEL_SPECS.standard.depthMm
  const HC_DEPTH_MULTIPLE =
    WHEEL_SPECS['high-capacity'].depthMm / WHEEL_SPECS.standard.depthMm
  const rotorDepthMm =
    wheel === 'high-capacity' ? baseRotorDepthMm * HC_DEPTH_MULTIPLE : baseRotorDepthMm

  const compact = isCompactSize(nominalCfm, catalog) && nominalCfm <= 600 && !inputs.idp
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
  //
  //    Reactivation airflow now follows the ANGULAR split rather than a fixed ⅓: at a
  //    common face velocity the flow through each sector is proportional to its angle,
  //    so 270°/90° reproduces the old 3:1 exactly while a purge sector correctly takes
  //    its share.
  const reactPerf = REACTIVATION_PERFORMANCE[inputs.reactivation]
  const totalProcessCfm = nominalCfm * unitsRequired
  const reactAirflowCfm = totalProcessCfm * (wheel3.reactDeg / Math.max(wheel3.processDeg, 1))
  const purgeAirflowCfm = totalProcessCfm * (wheel3.purgeDeg / Math.max(wheel3.processDeg, 1))

  // Purge air enters from the dried process stream and leaves hot, having cooled the
  // just-reactivated wheel. Routing it to the reactivation inlet recovers that heat.
  //
  // ⚠️ PLANNING ESTIMATE. The true purge outlet temperature depends on wheel thermal
  // mass and rotation speed — DryWare computes it; we approximate the recovered
  // preheat as a fraction of the available temperature rise. It only ever REDUCES the
  // reactivation duty, and is reported separately so it can be discounted.
  const purgeActive = wheel3.purgeDeg > 0
  const reactInletTempF =
    purgeActive && inputs.purgeToReact
      ? outsideAir.tempF + PURGE_HEAT_RECOVERY * Math.max(reactPerf.tempF - outsideAir.tempF, 0)
      : outsideAir.tempF

  const reactMassFlow = massFlowFromCFM(reactAirflowCfm, outsideAir)
  const reactDeltaT = Math.max(reactPerf.tempF - reactInletTempF, 0)
  const heatBtuh = reactMassFlow * CP_AIR * reactDeltaT
  // What it would have cost without the purge credit, so the saving is visible.
  const heatBtuhNoPurge = reactMassFlow * CP_AIR * Math.max(reactPerf.tempF - outsideAir.tempF, 0)

  // Rotation. DryWare optimises RPH against its wheel curves; we don't have those, so
  // an unset value falls back to a mid-range default rather than pretending to optimise.
  // It only drives the reported dwell times, never the moisture maths.
  const effectiveRph = inputs.rph > 0 ? inputs.rph : DEFAULT_RPH
  if (!(inputs.rph > 0)) {
    warnings.push({
      severity: 'info',
      message: `Rotation shown at ${DEFAULT_RPH} RPH (a typical mid-range value) — DryWare optimises RPH against its wheel performance curves, which this Studio does not have. Dwell times below are indicative.`,
    })
  }

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
      wheelDepthMm: rotorDepthMm,
      effectiveAreaFt2: sizeEntry?.effectiveAreaFt2 ?? 0,
      faceVelocityFpm: faceVelocity,
      rationale,
    },
    wheel: {
      processDeg: wheel3.processDeg,
      reactDeg: wheel3.reactDeg,
      purgeDeg: wheel3.purgeDeg,
      purgeAirflowCfm: purgeAirflowCfm,
      rph: effectiveRph,
      rphSuggested: !(inputs.rph > 0),
      processDwellSec: sectorDwellSeconds(effectiveRph, wheel3.processDeg),
      reactDwellSec: sectorDwellSeconds(effectiveRph, wheel3.reactDeg),
      purgeDwellSec: sectorDwellSeconds(effectiveRph, wheel3.purgeDeg),
    },
    reactivation: {
      code: inputs.reactivation,
      label: reactivationLabel(inputs.reactivation),
      airflowCfm: reactAirflowCfm,
      tempF: reactPerf.tempF,
      inletTempF: reactInletTempF,
      heatBtuh,
      heatBtuhWithoutPurge: heatBtuhNoPurge,
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
