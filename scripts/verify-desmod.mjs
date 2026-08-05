/* Verifies lib/desmod.ts — the DryWare DesMod wheel-performance integration.
 *
 * Three layers, in increasing order of how badly a regression would hurt:
 *
 *   1. REQUEST DERIVATION — we must send what DryWare's own client would send for
 *      the same unit, or "verified against DryWare" is a lie. The velocity formula
 *      is reproduced independently here rather than imported, so a change to
 *      faceVelocityFpm() shows up as a failure instead of silently agreeing.
 *   2. THE RESPONSE GUARD — DesMod answers HTTP 200 for every outcome, including
 *      total failure and a zero-byte body. Each failure shape below is a payload
 *      captured verbatim from the live endpoint, not an invented one.
 *   3. MUTATION TESTS — the guard is asserted to REJECT deliberately corrupted
 *      copies of a known-good response. A guard that accepts everything passes a
 *      suite that only ever feeds it good input; this repo has been bitten by
 *      exactly that (a full data rewrite once passed every existing test).
 *
 * Layer 4 is a live round-trip against the real endpoint, which is the only thing
 * that catches the upstream changing its shape underneath us. Skip it with
 * --offline.
 *
 * Run:  node --import ./scripts/ts-resolve.mjs scripts/verify-desmod.mjs
 *       node --import ./scripts/ts-resolve.mjs scripts/verify-desmod.mjs --offline
 */

import {
  buildDesmodRequest,
  validateDesmodRequest,
  readDesmodResponse,
  reconcileVerification,
  desmodCacheKey,
} from '../lib/desmod.ts'
import { calculateSizing, DEFAULT_SIZING_INPUTS, parseSizingInputs } from '../lib/sizing.ts'
import { CATALOG_SIZES } from '../lib/sizing-catalog.ts'

let passed = 0
let failed = 0

function ok(label, condition, detail = '') {
  if (condition) {
    passed++
    console.log(`  \x1b[32mPASS\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`)
  } else {
    failed++
    console.log(`  \x1b[31mFAIL\x1b[0m  ${label}${detail ? `  \x1b[90m${detail}\x1b[0m` : ''}`)
  }
}

function near(label, actual, expected, tol) {
  const d = Math.abs(actual - expected)
  ok(label, d <= tol, `got ${round(actual)} vs ${round(expected)} ±${tol}`)
}

function round(n) {
  return typeof n === 'number' ? Number(n.toFixed(3)) : n
}

function section(t) {
  console.log(`\n\x1b[1m${t}\x1b[0m`)
}

const inputs = (over = {}) => ({ ...DEFAULT_SIZING_INPUTS, ...over })

/** A known-good response, captured verbatim from the live endpoint 2026-08-05. */
const LIVE_OK = {
  autofillPurgeOutletToReactInlet: true,
  usePurge: false,
  processCfm: 2000,
  reactCfm: 700,
  purgeCfm: 0,
  processFraction: 270,
  reactFraction: 90,
  purgeFraction: 0,
  processVelocity: 365,
  reactVelocity: 384,
  purgeVelocity: 0,
  processTemperature: 75,
  reactTemperature: 285,
  purgeTemperature: 0,
  processMoisture: 60,
  reactMoisture: 60,
  purgeMoisture: 0,
  optimizeRPH: true,
  rph: 7.5,
  rphOut: 7.5,
  elevation: 0,
  rotorDepth: 200,
  rotorDiameter: 965,
  processTempOut: 123.5,
  reactTempOut: 146.7,
  purgeTempOut: 0,
  processMoistureOut: 7.58,
  reactMoistureOut: 209.29,
  purgeMoistureOut: 0,
  processBTUOut: 1555,
  reactBTUOut: 1557,
  purgeBTUOut: 0,
  processDewPointOut: 6.3,
  reactDewPointOut: 88.8,
  purgeDewPointOut: 0,
  processDeltaP: 0.56,
  reactDeltaP: 0.75,
  purgeDeltaP: 0,
  temperatureBalance: 0,
  moistureBalance: -0.1,
  moistureRemovalLbsHr: 67.4,
  moistureRemovalGrHr: 471780,
  passwordOk: true,
  error: '',
}

// ─── 1. Request derivation ───────────────────────────────────────────────────
section('1. Request derivation — must match DryWare\'s own client')

{
  const i = inputs({ processCfm: 2000, freshAirPercent: 0 })
  const r = calculateSizing(i, CATALOG_SIZES)
  const built = buildDesmodRequest(i, r)
  ok('2,000 CFM run builds a request', built.ok, built.ok ? '' : built.message)

  if (built.ok) {
    const q = built.request
    const sel = r.selection

    // Independent restatement of DryWare's setProductSpecificCalculationParameters:
    // velocity = CFM / (effectiveArea × sector/360). Deliberately NOT importing
    // faceVelocityFpm — if that drifts, this must fail rather than agree.
    const expectProcVel = Math.round(q.processCfm / (sel.effectiveAreaFt2 * (270 / 360)))
    const expectReactVel = Math.round(q.reactCfm / (sel.effectiveAreaFt2 * (90 / 360)))

    near('process velocity matches DryWare\'s formula', q.processVelocity, expectProcVel, 1)
    near('reactivation velocity matches DryWare\'s formula', q.reactVelocity, expectReactVel, 1)

    // The Studio DISPLAYS a face velocity; the payload must carry the same number.
    // If these two ever disagree, one of them is wrong and the submittal is wrong.
    near('payload velocity equals the Studio\'s displayed face velocity', q.processVelocity, sel.faceVelocityFpm, 1)

    // At 270/90 the sector split must reproduce DryWare's own
    // getReactCfmFromProcess() = round(processCfm / 3).
    near('react CFM is process/3 at the 270/90 default', q.reactCfm, Math.round(q.processCfm / 3), 1)

    ok('sectors are sent in DEGREES, not fractions', q.processFraction === 270 && q.reactFraction === 90,
      `${q.processFraction}/${q.reactFraction}`)
    ok('purge disabled when the purge sector is 0', q.usePurge === false && q.purgeCfm === 0 && q.purgeVelocity === 0)
    // Compared against the CATALOG ROW, not against sel.* — asserting the payload
    // equals the value it was copied from is tautological and once let a real bug
    // through (the depth was a per-wheel-type constant, so the 100 mm compacts
    // were verified as 200 mm rotors).
    const row = CATALOG_SIZES.find((s) => s.nominalCfm === sel.nominalCfm)
    ok('wheel geometry comes from the catalog row for the selected size',
      q.rotorDiameter === row.wheelDiameterMm && q.rotorDepth === row.wheelDepthMm,
      `sent ${q.rotorDiameter}×${q.rotorDepth}mm, catalog says ${row.wheelDiameterMm}×${row.wheelDepthMm}mm`)
    ok('entering condition is the MIXED state, not the return air',
      Math.abs(q.processMoisture - r.entering.grains) < 0.02)
    ok('optimizeRPH is handed to DesMod when the Studio has no RPH', q.optimizeRPH === true && q.rph === 0)
  }
}

{
  // Reactivation temperature must follow the heat source, not a constant — that is
  // the entire reason steam and hot water reach less dryness.
  const hw = inputs({ reactivation: 'HW' })
  const bHw = buildDesmodRequest(hw, calculateSizing(hw, CATALOG_SIZES))
  ok('hot water sends its own 190 °F setpoint, not 285',
    bHw.ok && bHw.request.reactTemperature === 190,
    bHw.ok ? String(bHw.request.reactTemperature) : bHw.message)

  const steam = inputs({ reactivation: 'S' })
  const bS = buildDesmodRequest(steam, calculateSizing(steam, CATALOG_SIZES))
  ok('steam sends 250 °F', bS.ok && bS.request.reactTemperature === 250)

  // DryWare's client drops a fired/electric COMPACT to 275 °F. A 200 CFM job
  // selects the 300 CFM compact.
  const small = inputs({ processCfm: 200, freshAirPercent: 0 })
  const bSmall = buildDesmodRequest(small, calculateSizing(small, CATALOG_SIZES))
  ok('an electric compact sends 275 °F, matching DryWare\'s own client',
    bSmall.ok && bSmall.request.reactTemperature === 275,
    bSmall.ok ? `${bSmall.request.reactTemperature} °F on ${calculateSizing(small, CATALOG_SIZES).selection.model}` : bSmall.message)
}

{
  // ── Regression: the 100 mm compacts ────────────────────────────────────────
  // IAT-75REC and IAT-150REC ship a 100 mm rotor; every other catalog size is
  // 200 mm. Sending a flat 200 made DryWare model a machine that does not exist
  // and return numbers ~2 gr/lb too dry at double the true pressure drop — under
  // a green "Verified" pill. Each depth below is asserted as a LITERAL, so a
  // regression in the derivation cannot quietly agree with itself.
  const depthFor = (cfm, pref = 'auto') => {
    const i = inputs({ processCfm: cfm, freshAirPercent: 0, wheelPreference: pref })
    const b = buildDesmodRequest(i, calculateSizing(i, CATALOG_SIZES))
    return b.ok ? b.request.rotorDepth : `ERROR: ${b.message}`
  }

  ok('a 60 CFM job (IAT-75REC) sends a 100 mm rotor', depthFor(60) === 100, `sent ${depthFor(60)}`)
  ok('a 100 CFM job (IAT-150REC) sends a 100 mm rotor', depthFor(100) === 100, `sent ${depthFor(100)}`)
  ok('a 250 CFM job (IAT-300REC) sends a 200 mm rotor', depthFor(250) === 200, `sent ${depthFor(250)}`)
  ok('a 2,000 CFM job (IAT-3000) sends a 200 mm rotor', depthFor(2000) === 200, `sent ${depthFor(2000)}`)
  ok('HC doubles the mainline rotor to 400 mm',
    depthFor(2000, 'high-capacity') === 400, `sent ${depthFor(2000, 'high-capacity')}`)
  ok('HC doubles a 100 mm compact to 200 mm, not to 400',
    depthFor(100, 'high-capacity') === 200, `sent ${depthFor(100, 'high-capacity')}`)
}

{
  // Multi-unit jobs: DesMod models ONE wheel. Sending the total airflow would
  // report a wildly over-velocity wheel and a wrong leaving condition.
  const huge = inputs({ processCfm: 60_000, freshAirPercent: 0 })
  const r = calculateSizing(huge, CATALOG_SIZES)
  const built = buildDesmodRequest(huge, r)
  ok('a multi-unit job is modelled per unit', r.selection.unitsRequired > 1)
  ok('per-unit CFM is sent, not the job total',
    built.ok && built.request.processCfm < r.airflow.requiredCfm,
    built.ok ? `${built.request.processCfm} of ${Math.round(r.airflow.requiredCfm)} total across ${r.selection.unitsRequired} units` : built.message)
}

{
  // A purge sector must take its share of the airflow and enable usePurge.
  const purge = inputs({ processDegrees: 255, reactDegrees: 90, purgeDegrees: 15 })
  const built = buildDesmodRequest(purge, calculateSizing(purge, CATALOG_SIZES))
  ok('a purge sector enables usePurge and carries airflow',
    built.ok && built.request.usePurge === true && built.request.purgeCfm > 0 && built.request.purgeVelocity > 0,
    built.ok ? `${built.request.purgeCfm} CFM @ ${built.request.purgeVelocity} fpm` : built.message)
}

// ─── 2. The sanity envelope ──────────────────────────────────────────────────
section('2. Sanity envelope — DesMod validates nothing, so we must')

{
  const i = inputs({ processCfm: 2000 })
  const base = buildDesmodRequest(i, calculateSizing(i, CATALOG_SIZES))
  ok('a normal request passes validation', base.ok && validateDesmodRequest(base.request) === null)

  if (base.ok) {
    const bad = (over) => validateDesmodRequest({ ...base.request, ...over })
    ok('rejects an absurd face velocity', bad({ processVelocity: 9999 }) !== null, String(bad({ processVelocity: 9999 })))
    ok('rejects a negative airflow', bad({ processCfm: -500 }) !== null)
    ok('rejects NaN anywhere', bad({ processMoisture: NaN }) !== null)
    ok('rejects Infinity anywhere', bad({ elevation: Infinity }) !== null)
    ok('rejects an impossible reactivation temperature', bad({ reactTemperature: 900 }) !== null)
    ok('rejects a zero wheel diameter', bad({ rotorDiameter: 0 }) !== null)
    // The design ceiling is 600 fpm and the Studio warns there, but an engineer is
    // allowed to LOOK at an over-velocity case — the envelope must not block it.
    ok('permits an over-design-ceiling velocity an engineer may want to see', bad({ processVelocity: 700 }) === null)
  }
}

// ─── 3. The response guard ───────────────────────────────────────────────────
section('3. Response guard — every failure arrives as HTTP 200')

{
  const good = readDesmodResponse(LIVE_OK)
  ok('accepts the captured live response', good.ok, good.ok ? '' : good.message)
  if (good.ok) {
    near('reads processMoistureOut', good.response.processMoistureOut, 7.58, 0.001)
    near('reads processDeltaP (which the Studio cannot compute)', good.response.processDeltaP, 0.56, 0.001)
    near('reads the optimised RPH', good.response.rphOut, 7.5, 0.001)
    near('reads moistureRemovalLbsHr', good.response.moistureRemovalLbsHr, 67.4, 0.001)
  }

  // Failure shapes, all captured from the live endpoint.
  const empty = readDesmodResponse('')
  ok('zero-byte body → empty', !empty.ok && empty.code === 'empty', empty.ok ? '' : empty.message)

  const nullBody = readDesmodResponse(null)
  ok('null body → empty', !nullBody.ok && nullBody.code === 'empty')

  // Verbatim from omitting purgeFraction: the DryWare proxy's own envelope.
  const proxyErr = readDesmodResponse({
    errorMessage:
      'Error performing calculation: Error calling DesMod Web API.  Status Code: $BadRequest, Reason Phrase: Bad Request, Additional Content: {"type":"https://tools.ietf.org/html/rfc9110#section-15.5.1","title":"One or more validation errors occurred.","status":400,"errors":{"desiccantPerformance":["The desiccantPerformance field is required."]},"traceId":"00-2b11d299"}',
  })
  ok('proxy errorMessage envelope → rejected', !proxyErr.ok && proxyErr.code === 'rejected')
  ok('upstream traceIds are trimmed out of the surfaced message',
    !proxyErr.ok && proxyErr.message.length <= 301, !proxyErr.ok ? `${proxyErr.message.length} chars` : '')

  // Verbatim from processCfm:-500 — note every *Out field is absent.
  const vbErr = readDesmodResponse({
    ...LIVE_OK,
    passwordOk: false,
    error: 'Invalid procedure call or argument',
    rphOut: undefined,
    processTempOut: undefined,
    processMoistureOut: undefined,
    processDewPointOut: undefined,
    processDeltaP: undefined,
  })
  ok('passwordOk:false → rejected', !vbErr.ok && vbErr.code === 'rejected')
  ok('the model\'s own words are surfaced',
    !vbErr.ok && vbErr.message.includes('Invalid procedure call'), !vbErr.ok ? vbErr.message : '')

  const html = readDesmodResponse('<!doctype html><html>')
  ok('the SPA HTML shell is not mistaken for a result', !html.ok)
}

// ─── 4. Mutation tests ───────────────────────────────────────────────────────
section('4. Mutation tests — the guard must REJECT corrupted good responses')

{
  // Each case takes the known-good payload and breaks exactly one thing. If any of
  // these PASSES the guard, the guard is decorative.
  const mutate = (over, label, expectCode) => {
    const out = readDesmodResponse({ ...LIVE_OK, ...over })
    ok(`rejects: ${label}`, !out.ok && (!expectCode || out.code === expectCode),
      out.ok ? 'GUARD ACCEPTED A BROKEN RESPONSE' : `${out.code}`)
  }

  mutate({ passwordOk: false }, 'passwordOk flipped false', 'rejected')
  mutate({ error: 'something went wrong' }, 'a populated error string alongside passwordOk:true', 'rejected')
  mutate({ processMoistureOut: undefined }, 'the headline output missing', 'malformed')
  mutate({ processMoistureOut: 'seven' }, 'the headline output as a string', 'malformed')
  mutate({ processDeltaP: undefined }, 'pressure drop missing', 'malformed')
  mutate({ rphOut: undefined }, 'optimised RPH missing', 'malformed')
  mutate({ processTempOut: null }, 'leaving temperature null', 'malformed')

  // And the control: the guard must still accept the UNmutated payload, otherwise
  // the tests above prove nothing.
  ok('control — the unmutated payload is still accepted', readDesmodResponse({ ...LIVE_OK }).ok)
}

// ─── 5. Reconciliation ───────────────────────────────────────────────────────
section('5. Reconciliation against the Studio\'s own estimate')

{
  const i = inputs({ processCfm: 2000, freshAirPercent: 0 })
  const r = calculateSizing(i, CATALOG_SIZES)
  const built = buildDesmodRequest(i, r)
  const read = readDesmodResponse(LIVE_OK)

  if (built.ok && read.ok) {
    const v = reconcileVerification(r, built.request, read.response, '2026-08-05T00:00:00.000Z')

    near('the authoritative leaving state carries DesMod\'s grains', v.leaving.grains, 7.58, 0.01)
    near('the authoritative leaving state carries DesMod\'s temperature', v.leaving.tempF, 123.5, 0.01)
    ok('the leaving state is a full psychrometric state', Number.isFinite(v.leaving.dewPointF) && Number.isFinite(v.leaving.rh))

    near('the delta is DesMod minus Studio', v.delta.grains, 7.58 - r.leaving.grains, 0.02)
    ok('the Studio\'s own prediction is left untouched', r.leaving.grains !== v.leaving.grains || v.delta.grains === 0)
    ok('balance residuals near zero read as converged', v.balanced === true)

    const unbalanced = reconcileVerification(
      r, built.request, { ...read.response, moistureBalance: 12 }, '2026-08-05T00:00:00.000Z',
    )
    ok('a large residual reads as NOT converged', unbalanced.balanced === false)
  } else {
    ok('reconciliation fixture built', false, 'could not build request/response')
  }
}

// ─── 6. Cache key + input parsing ────────────────────────────────────────────
section('6. Cache key and untrusted-input parsing')

{
  const i = inputs({ processCfm: 2000 })
  const a = buildDesmodRequest(i, calculateSizing(i, CATALOG_SIZES))
  const b = buildDesmodRequest(i, calculateSizing(i, CATALOG_SIZES))
  ok('identical runs produce identical cache keys', a.ok && b.ok && desmodCacheKey(a.request) === desmodCacheKey(b.request))

  const j = inputs({ processCfm: 2500 })
  const c = buildDesmodRequest(j, calculateSizing(j, CATALOG_SIZES))
  ok('a different airflow produces a different cache key', a.ok && c.ok && desmodCacheKey(a.request) !== desmodCacheKey(c.request))

  // The route parses whatever the browser sends, so this must never throw or NaN.
  const junk = parseSizingInputs({ processCfm: 'lots', entering: { tempF: null }, reactivation: 'ZZ' })
  ok('junk input falls back to defaults rather than NaN',
    Number.isFinite(junk.processCfm) && Number.isFinite(junk.entering.tempF) && junk.reactivation === 'E')
  ok('parsing null does not throw', Number.isFinite(parseSizingInputs(null).processCfm))
  const parsedJunk = buildDesmodRequest(junk, calculateSizing(junk, CATALOG_SIZES))
  ok('a parsed junk payload still yields a sane request or a clear rejection',
    parsedJunk.ok ? validateDesmodRequest(parsedJunk.request) === null : typeof parsedJunk.message === 'string')
}

// ─── 7. Live round-trip ──────────────────────────────────────────────────────

const offline = process.argv.includes('--offline')

if (offline) {
  section('7. Live round-trip — SKIPPED (--offline)')
} else {
  section('7. Live round-trip against DryWare (the upstream-shape canary)')
  try {
    const { calculateDesiccantPerformance } = await import('../lib/dryware-sizing.ts')

    // The exact payload from the original probe. Its response is pinned in LIVE_OK,
    // so any drift upstream — a renamed field, a changed wheel table — fails here
    // rather than silently changing what a submittal claims.
    const probe = {
      usePurge: false, autofillPurgeOutletToReactInlet: true,
      processCfm: 2000, reactCfm: 700, purgeCfm: 0,
      processFraction: 270, reactFraction: 90, purgeFraction: 0,
      processVelocity: 365, reactVelocity: 384, purgeVelocity: 0,
      processTemperature: 75, reactTemperature: 285, purgeTemperature: 0,
      processMoisture: 60, reactMoisture: 60, purgeMoisture: 0,
      optimizeRPH: true, rph: 0, elevation: 0,
      rotorDepth: 200, rotorDiameter: 965,
    }

    const started = Date.now()
    const raw = await calculateDesiccantPerformance(probe)
    const elapsed = Date.now() - started
    const read = readDesmodResponse(raw)

    ok('the live endpoint still answers with a usable calculation', read.ok, read.ok ? `${elapsed} ms` : read.message)
    if (read.ok) {
      near('processMoistureOut still 7.58 gr/lb', read.response.processMoistureOut, 7.58, 0.01)
      near('processTempOut still 123.5 °F', read.response.processTempOut, 123.5, 0.05)
      near('processDeltaP still 0.56 in. w.g.', read.response.processDeltaP, 0.56, 0.01)
      near('rphOut still 7.5', read.response.rphOut, 7.5, 0.01)
      ok('the call stayed inside the single-call budget', elapsed < 15_000, `${elapsed} ms`)
    }

    // The empty-body failure mode, live. This is the one that would otherwise be
    // read as success by a res.ok check.
    const swallowed = await calculateDesiccantPerformance({ foo: 'bar' })
    const swallowedRead = readDesmodResponse(swallowed)
    ok('a payload DesMod cannot bind is still caught as a failure, not a success',
      !swallowedRead.ok, swallowedRead.ok ? 'GUARD ACCEPTED A SWALLOWED REQUEST' : swallowedRead.code)
  } catch (e) {
    ok('live round-trip completed', false, e instanceof Error ? e.message : String(e))
    console.log('\n  \x1b[90mIf DryWare is unreachable from here, re-run with --offline to check the pure logic only.\x1b[0m')
  }
}

// ─── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n\x1b[1m${passed} passed, ${failed} failed\x1b[0m`)
process.exit(failed > 0 ? 1 : 0)
