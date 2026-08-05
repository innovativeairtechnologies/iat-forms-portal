// ─────────────────────────────────────────────────────────────────────────────
// lib/desmod.ts — the DryWare "DesMod" desiccant performance engine, expressed as
// pure functions: build a request from a Sizing Studio run, guard the response,
// and reconcile it against the Studio's own prediction.
//
// NO I/O lives here. The fetch is `calculateDesiccantPerformance()` in
// lib/dryware-sizing.ts; this module is deliberately pure so the derivation and
// the guards can be exercised by scripts/verify-desmod.mjs without a network.
//
// ── Why this exists ──────────────────────────────────────────────────────────
// `predictLeavingState()` in lib/sizing.ts is a planning approximation: 80/90%
// nominal moisture removal on an adiabatic line. DryWare runs the real, table-
// driven wheel model ("DesMod") and will tell us the actual leaving condition,
// the optimised RPH, and the pressure drop — which the Studio cannot compute at
// all. We do NOT replace the local engine: it stays as the instant-feedback path
// that recalculates as the rep types. This is an explicit verification step that
// reconciles against it.
//
// ── Three properties of the upstream that shape everything below ─────────────
//  1. EVERY failure is HTTP 200 — including a zero-byte body. `res.ok` is
//     meaningless here. See readDesmodResponse() for the guard that matters.
//  2. The upstream is SINGLE-THREADED, ~1.9 s per call, strictly serialised
//     (8 parallel calls returned at 2.1 s … 12.8 s). Never fan out, never sweep
//     the catalog, never call this on a keystroke.
//  3. It does NOT validate its inputs — a 9,999 fpm face velocity comes back as
//     a confident extrapolated answer. The sanity envelope in this file is the
//     only thing standing between a typo and a plausible-looking wrong number.
//
// Field names are lifted verbatim from DryWare's own shipped Angular bundle, not
// guessed. Related: lib/sizing.ts (the local engine), lib/dryware-sizing.ts (the
// HTTP client + product catalog).
// ─────────────────────────────────────────────────────────────────────────────

import { airStateFromGrains, type AirState } from './psychro'
import { faceVelocityFpm } from './sizing-catalog'
import { REACTIVATION_PERFORMANCE, type SizingInputs, type SizingResult } from './sizing'

/**
 * The calculate payload, exactly as DesMod binds it.
 *
 * The three `*Fraction` values are the wheel sector split in DEGREES (270/90/0),
 * despite the name — that is DryWare's own convention. All six of the
 * fraction/velocity/purge doubles are REQUIRED and must be non-null: omitting one
 * fails binding upstream with a .NET validation error rather than defaulting.
 */
export type DesmodRequest = {
  usePurge: boolean
  autofillPurgeOutletToReactInlet: boolean
  processCfm: number
  reactCfm: number
  purgeCfm: number
  processFraction: number
  reactFraction: number
  purgeFraction: number
  processVelocity: number
  reactVelocity: number
  purgeVelocity: number
  processTemperature: number
  reactTemperature: number
  purgeTemperature: number
  processMoisture: number
  reactMoisture: number
  purgeMoisture: number
  optimizeRPH: boolean
  rph: number
  elevation: number
  rotorDepth: number
  rotorDiameter: number
}

/** The computed half of the DTO. Only the fields we actually consume are typed. */
export type DesmodResponse = {
  /** Rotation DesMod settled on, RPH. Authoritative — the Studio only guesses. */
  rphOut: number
  processTempOut: number
  processMoistureOut: number
  processDewPointOut: number
  processBTUOut: number
  /** Process-side pressure drop, in. w.g. The Studio cannot compute this. */
  processDeltaP: number
  reactTempOut: number
  reactMoistureOut: number
  reactDewPointOut: number
  reactBTUOut: number
  reactDeltaP: number
  purgeTempOut: number
  purgeMoistureOut: number
  purgeDeltaP: number
  /** Water removed, lb/hr — DesMod's own figure, not derived from the states. */
  moistureRemovalLbsHr: number
  /** Residuals DesMod reports as its own sanity check; both should sit near zero. */
  temperatureBalance: number
  moistureBalance: number
}

export type DesmodFailureCode =
  /** Our own sanity envelope rejected the inputs — never left the building. */
  | 'invalid_input'
  /** Network, DNS, TLS, or timeout. */
  | 'unreachable'
  /** 200 with a zero-byte body — DesMod silently swallowed the request. */
  | 'empty'
  /** DesMod ran and refused: `passwordOk:false`, or an `errorMessage` envelope. */
  | 'rejected'
  /** 200 with JSON we cannot trust — missing outputs, or the SPA HTML shell. */
  | 'malformed'

export type DesmodOutcome =
  | { ok: true; request: DesmodRequest; response: DesmodResponse }
  | { ok: false; code: DesmodFailureCode; message: string; request?: DesmodRequest }

// ─── Sanity envelope ─────────────────────────────────────────────────────────

/**
 * Bounds we refuse to send. DesMod validates nothing, so anything absurd comes
 * back as a confident number — these exist to make a typo fail loudly instead of
 * silently producing a wrong submittal.
 *
 * The face-velocity ceiling is deliberately well ABOVE the 600 fpm design ceiling
 * in lib/sizing-catalog.ts: the Studio already warns at 600, and an engineer is
 * allowed to look at an over-velocity case. 1,200 fpm is where the answer stops
 * being physics.
 */
const LIMITS = {
  cfm: { min: 1, max: 200_000 },
  velocity: { min: 20, max: 1_200 },
  processTempF: { min: -40, max: 200 },
  reactTempF: { min: 100, max: 400 },
  moistureGrains: { min: 0, max: 1_000 },
  elevationFt: { min: -1_500, max: 20_000 },
  rotorDiameterMm: { min: 100, max: 4_000 },
  rotorDepthMm: { min: 50, max: 600 },
  rph: { min: 0, max: 120 },
} as const

function checkRange(
  label: string,
  value: number,
  bounds: { min: number; max: number },
  unit: string,
): string | null {
  if (!Number.isFinite(value)) return `${label} is not a finite number.`
  if (value < bounds.min || value > bounds.max) {
    return `${label} is ${round(value, 1)} ${unit}, outside the range DryWare's model can be trusted over (${bounds.min}–${bounds.max} ${unit}).`
  }
  return null
}

/** DryWare rounds every derived velocity to a whole number before sending. */
function round(n: number, dp = 0): number {
  const f = 10 ** dp
  return Math.round(n * f) / f
}

// ─── Request derivation ──────────────────────────────────────────────────────

/**
 * Turn a Sizing Studio run into a DesMod request.
 *
 * The velocity derivation is DryWare's own, from `setProductSpecificCalculation-
 * Parameters` in the shipped bundle: velocity = CFM / (effectiveArea × sector/360).
 * That is byte-identical to the Studio's `faceVelocityFpm()`, which is why the
 * process velocity we send always equals the face velocity the Studio displays —
 * if those two ever diverge, one of them is wrong.
 *
 * Everything is expressed PER UNIT. When a job needs 3 × 30,000 CFM, DesMod is
 * modelling one wheel, not three.
 */
export function buildDesmodRequest(
  inputs: SizingInputs,
  result: SizingResult,
): { ok: true; request: DesmodRequest } | { ok: false; message: string } {
  const sel = result.selection
  const sectors = result.wheel

  // The airflow ONE unit actually sees. Note this is the *required* airflow, not
  // the catalog nominal — it is the number the wheel is really being asked to
  // pass, and the same basis the Studio's own face-velocity check uses.
  const processCfm = round(result.airflow.requiredCfm / Math.max(sel.unitsRequired, 1))

  // At a common face velocity, flow through each sector is proportional to its
  // angle. At the 270/90 default this reproduces DryWare's own
  // getReactCfmFromProcess() = processCfm / 3 exactly.
  const processDeg = Math.max(sectors.processDeg, 1)
  const reactCfm = round(processCfm * (sectors.reactDeg / processDeg))
  const usePurge = sectors.purgeDeg > 0
  const purgeCfm = usePurge ? round(processCfm * (sectors.purgeDeg / processDeg)) : 0

  const area = sel.effectiveAreaFt2
  if (!(area > 0)) {
    return { ok: false, message: 'The selected unit has no wheel area — nothing to calculate against.' }
  }

  const processVelocity = round(faceVelocityFpm(processCfm, { effectiveAreaFt2: area }, sectors.processDeg / 360))
  const reactVelocity = round(faceVelocityFpm(reactCfm, { effectiveAreaFt2: area }, sectors.reactDeg / 360))
  const purgeVelocity = usePurge
    ? round(faceVelocityFpm(purgeCfm, { effectiveAreaFt2: area }, sectors.purgeDeg / 360))
    : 0

  // Reactivation setpoint follows the heat source the user picked, not a constant —
  // that is the whole reason steam and hot water reach less dryness. DryWare's own
  // client drops a fired/electric compact to 275 °F, so we match it rather than
  // producing a number their engineers cannot reproduce in their own tool.
  const designReactTempF = REACTIVATION_PERFORMANCE[inputs.reactivation].tempF
  const reactTemperature =
    sel.spec.compact && designReactTempF === 285 ? 275 : designReactTempF

  // 0 RPH in the Studio means "you pick one". DesMod genuinely optimises against
  // its wheel curves, so we hand the decision over rather than sending the
  // Studio's DEFAULT_RPH placeholder.
  const optimizeRPH = !(inputs.rph > 0)

  const request: DesmodRequest = {
    usePurge,
    autofillPurgeOutletToReactInlet: inputs.purgeToReact,
    processCfm,
    reactCfm,
    purgeCfm,
    // Degrees, not fractions — DryWare's naming, kept verbatim so the payload
    // stays greppable against their bundle.
    processFraction: round(sectors.processDeg, 2),
    reactFraction: round(sectors.reactDeg, 2),
    purgeFraction: round(sectors.purgeDeg, 2),
    processVelocity,
    reactVelocity,
    purgeVelocity,
    processTemperature: round(result.entering.tempF, 2),
    reactTemperature,
    purgeTemperature: 0,
    processMoisture: round(result.entering.grains, 2),
    // Reactivation air is drawn from outside; heating it does not change its
    // humidity ratio, so the outdoor grains are what enters the react sector.
    reactMoisture: round(result.outsideAir.grains, 2),
    purgeMoisture: 0,
    optimizeRPH,
    rph: optimizeRPH ? 0 : round(inputs.rph, 2),
    elevation: round(Math.max(inputs.altitudeFt, 0)),
    rotorDepth: sel.wheelDepthMm,
    rotorDiameter: sel.wheelDiameterMm,
  }

  const problem = validateDesmodRequest(request)
  if (problem) return { ok: false, message: problem }
  return { ok: true, request }
}

/** The sanity envelope. Returns the first problem, or null when the payload is sane. */
export function validateDesmodRequest(r: DesmodRequest): string | null {
  const checks: (string | null)[] = [
    checkRange('Process airflow', r.processCfm, LIMITS.cfm, 'CFM'),
    checkRange('Reactivation airflow', r.reactCfm, LIMITS.cfm, 'CFM'),
    checkRange('Process face velocity', r.processVelocity, LIMITS.velocity, 'fpm'),
    checkRange('Reactivation face velocity', r.reactVelocity, LIMITS.velocity, 'fpm'),
    checkRange('Entering temperature', r.processTemperature, LIMITS.processTempF, '°F'),
    checkRange('Reactivation temperature', r.reactTemperature, LIMITS.reactTempF, '°F'),
    checkRange('Entering moisture', r.processMoisture, LIMITS.moistureGrains, 'gr/lb'),
    checkRange('Reactivation-air moisture', r.reactMoisture, LIMITS.moistureGrains, 'gr/lb'),
    checkRange('Elevation', r.elevation, LIMITS.elevationFt, 'ft'),
    checkRange('Wheel diameter', r.rotorDiameter, LIMITS.rotorDiameterMm, 'mm'),
    checkRange('Wheel depth', r.rotorDepth, LIMITS.rotorDepthMm, 'mm'),
    checkRange('Rotation', r.rph, LIMITS.rph, 'RPH'),
  ]
  if (r.usePurge) {
    checks.push(checkRange('Purge airflow', r.purgeCfm, LIMITS.cfm, 'CFM'))
    checks.push(checkRange('Purge face velocity', r.purgeVelocity, LIMITS.velocity, 'fpm'))
  }
  // A non-finite value anywhere fails binding upstream with a .NET validation
  // error rather than a useful message, so catch it here.
  for (const [k, v] of Object.entries(r)) {
    if (typeof v === 'number' && !Number.isFinite(v)) return `${k} is not a finite number.`
  }
  return checks.find((c) => c !== null) ?? null
}

// ─── Response guard ──────────────────────────────────────────────────────────

const REQUIRED_OUTPUTS = [
  'rphOut',
  'processTempOut',
  'processMoistureOut',
  'processDewPointOut',
  'processDeltaP',
] as const

/**
 * The load-bearing guard. DesMod answers 200 for everything, so this is the only
 * thing that distinguishes a calculation from a silent failure.
 *
 * Four distinct failures all arrive as HTTP 200:
 *   - a zero-length body (a body it could not bind at all)
 *   - `{ errorMessage: "..." }` — the DryWare proxy failed calling DesMod
 *   - the DTO echoed back with `passwordOk:false` and a populated `error`
 *     (`passwordOk` is an OUTPUT flag meaning "calculation valid", not an auth gate)
 *   - the DTO with every `*Out` field absent
 */
export function readDesmodResponse(
  raw: unknown,
): { ok: true; response: DesmodResponse } | { ok: false; code: DesmodFailureCode; message: string } {
  if (raw === null || raw === undefined || raw === '') {
    return {
      ok: false,
      code: 'empty',
      message: 'DryWare accepted the request and returned nothing — the payload was rejected before it reached the model.',
    }
  }
  if (typeof raw !== 'object') {
    return { ok: false, code: 'malformed', message: 'DryWare returned a non-object response.' }
  }

  const r = raw as Record<string, unknown>

  // The proxy's own failure envelope. It carries the upstream .NET validation
  // payload verbatim, which is long and internal — surface a trimmed version.
  if (typeof r.errorMessage === 'string' && r.errorMessage.trim() !== '') {
    return { ok: false, code: 'rejected', message: trimUpstream(r.errorMessage) }
  }

  const modelError = typeof r.error === 'string' ? r.error.trim() : ''
  if (r.passwordOk !== true || modelError !== '') {
    return {
      ok: false,
      code: 'rejected',
      message: modelError
        ? `DryWare could not run this calculation: ${trimUpstream(modelError)}`
        : 'DryWare could not run this calculation.',
    }
  }

  const missing = REQUIRED_OUTPUTS.filter((k) => typeof r[k] !== 'number')
  if (missing.length > 0) {
    return {
      ok: false,
      code: 'malformed',
      message: `DryWare reported success but returned no ${missing.join(', ')} — treating it as a failure rather than trusting a partial result.`,
    }
  }

  return { ok: true, response: pickResponse(r) }
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : 0
}

function pickResponse(r: Record<string, unknown>): DesmodResponse {
  return {
    rphOut: num(r.rphOut),
    processTempOut: num(r.processTempOut),
    processMoistureOut: num(r.processMoistureOut),
    processDewPointOut: num(r.processDewPointOut),
    processBTUOut: num(r.processBTUOut),
    processDeltaP: num(r.processDeltaP),
    reactTempOut: num(r.reactTempOut),
    reactMoistureOut: num(r.reactMoistureOut),
    reactDewPointOut: num(r.reactDewPointOut),
    reactBTUOut: num(r.reactBTUOut),
    reactDeltaP: num(r.reactDeltaP),
    purgeTempOut: num(r.purgeTempOut),
    purgeMoistureOut: num(r.purgeMoistureOut),
    purgeDeltaP: num(r.purgeDeltaP),
    moistureRemovalLbsHr: num(r.moistureRemovalLbsHr),
    temperatureBalance: num(r.temperatureBalance),
    moistureBalance: num(r.moistureBalance),
  }
}

/** Upstream errors carry .NET traceIds and RFC links. Keep the useful first line. */
function trimUpstream(msg: string): string {
  const flat = msg.replace(/\s+/g, ' ').trim()
  return flat.length > 300 ? `${flat.slice(0, 300)}…` : flat
}

// ─── Reconciliation ──────────────────────────────────────────────────────────

export type SizingVerification = {
  /** When this was run, ISO. Stamped by the caller — this module stays pure. */
  verifiedAt: string
  request: DesmodRequest
  response: DesmodResponse

  /** The authoritative leaving condition, as a full psychrometric state. */
  leaving: AirState
  /** How far the Studio's planning estimate was off. */
  delta: {
    /** DesMod grains − Studio grains. Negative = the Studio was pessimistic. */
    grains: number
    tempF: number
    /** Studio grains as a percentage of DesMod's, for a quick "how close" read. */
    grainsPercent: number
  }
  /** Does the selection still meet the target once real wheel data is applied? */
  meetsTarget: boolean
  /** DesMod's own residuals, surfaced so a bad run is visible rather than silent. */
  balanced: boolean
}

/**
 * Fold a DesMod result back onto a Studio run.
 *
 * The Studio's `leaving` state stays untouched — this returns the authoritative
 * one alongside it, plus the delta, so the UI can show both. Silently swapping
 * the number would hide exactly the information an engineer needs: how wrong the
 * planning coefficients were for this job.
 */
export function reconcileVerification(
  result: SizingResult,
  request: DesmodRequest,
  response: DesmodResponse,
  verifiedAt: string,
): SizingVerification {
  const leaving = airStateFromGrains(response.processTempOut, response.processMoistureOut, result.pressure)
  const studioGrains = result.leaving.grains
  const realGrains = response.processMoistureOut

  return {
    verifiedAt,
    request,
    response,
    leaving,
    delta: {
      grains: round(realGrains - studioGrains, 2),
      tempF: round(response.processTempOut - result.leaving.tempF, 1),
      grainsPercent: realGrains > 0 ? round((studioGrains / realGrains) * 100, 1) : 0,
    },
    // +0.01 gr/lb of slack, matching the tolerance the local engine uses when it
    // raises the unreachable-target error.
    meetsTarget: realGrains <= result.target.grains + 0.01,
    // DesMod reports its own energy/mass residuals; anything past a whole unit
    // means the run did not converge cleanly even though it claimed success.
    balanced: Math.abs(response.temperatureBalance) < 1 && Math.abs(response.moistureBalance) < 1,
  }
}

/**
 * A stable cache key for a request. DesMod is deterministic — identical inputs
 * returned byte-identical outputs across every probe — so caching is safe and is
 * the main defence against the single-threaded upstream.
 */
export function desmodCacheKey(r: DesmodRequest): string {
  const keys = Object.keys(r).sort() as (keyof DesmodRequest)[]
  return keys.map((k) => `${k}=${String(r[k])}`).join('&')
}
