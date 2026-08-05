'use client'

import { useMemo, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import {
  AlertTriangle,
  Check,
  Copy,
  Info,
  MapPin,
  RotateCcw,
  ShieldCheck,
  TriangleAlert,
} from 'lucide-react'
import PageChrome from '../PageChrome'
import PsychroChart from './PsychroChart'
import Calculators from './Calculators'
import {
  calculateSizing,
  DEFAULT_SIZING_INPUTS,
  type HumidityInput,
  type HumidityMode,
  type SizingInputs,
  type SizingResult,
} from '@/lib/sizing'
import {
  REACTIVATION_TYPES,
  WHEEL_SPECS,
  describeModel,
  type CatalogSize,
} from '@/lib/sizing-catalog'
import type { AirState } from '@/lib/psychro'
// Type-only: lib/desmod.ts is pure (no fetch, no server-only imports), but the
// network call it describes lives behind /api/admin/sizing/verify.
import type { SizingVerification } from '@/lib/desmod'

/* Sizing Studio — enter a job's design conditions, get a recommended IAT unit.
 *
 * Everything here is pure client-side math (lib/sizing.ts), so the whole thing
 * recalculates live as the rep types. No server round trip, no save, no writes —
 * this view cannot mutate anything, which is why it ships gated to admins only.
 *
 * The local Field/NumField/Segmented primitives below follow DESIGN.md §6 and should
 * graduate into components/ui/ when the shared kit lands (DESIGN.md Phase 1).
 */

export default function SizingStudio({
  catalog,
  catalogSource,
  catalogError,
}: {
  catalog: CatalogSize[]
  catalogSource: 'dryware' | 'fallback'
  catalogError?: string
}) {
  const [inputs, setInputs] = useState<SizingInputs>(DEFAULT_SIZING_INPUTS)
  const [copied, setCopied] = useState(false)

  // DryWare verification state. The local engine still drives everything on screen;
  // this is the authoritative second opinion, fetched only when asked for.
  const [verification, setVerification] = useState<SizingVerification | null>(null)
  const [verifying, setVerifying] = useState(false)
  const [verifyError, setVerifyError] = useState<string | null>(null)
  const verifySeq = useRef(0)

  const result = useMemo(() => calculateSizing(sanitize(inputs), catalog), [inputs, catalog])

  const set = useCallback(<K extends keyof SizingInputs>(key: K, value: SizingInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }, [])

  // A verification belongs to the exact run that produced it. Any input change
  // invalidates it, and bumping the sequence discards an in-flight response —
  // DryWare's numbers sitting next to conditions they were not calculated from
  // would be far worse than showing none.
  useEffect(() => {
    verifySeq.current += 1
    setVerification(null)
    setVerifyError(null)
  }, [inputs])

  const verify = useCallback(async () => {
    const seq = verifySeq.current
    setVerifying(true)
    setVerifyError(null)
    try {
      const res = await fetch('/api/admin/sizing/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs: sanitize(inputs) }),
      })
      const json = await res.json().catch(() => null)
      // Superseded by a newer edit — drop it on the floor.
      if (verifySeq.current !== seq) return
      if (!res.ok || !json?.verification) {
        setVerifyError(json?.error || 'DryWare could not verify this selection.')
        return
      }
      setVerification(json.verification as SizingVerification)
    } catch {
      if (verifySeq.current === seq) {
        setVerifyError('Could not reach the verification service.')
      }
    } finally {
      setVerifying(false)
    }
  }, [inputs])

  const copySummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summaryText(inputs, result, verification))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked by permissions policy; failing quietly is fine
      // because the same numbers are all on screen.
    }
  }, [inputs, result, verification])

  const errors = result.warnings.filter((w) => w.severity === 'error')

  return (
    <>
      <PageChrome record="Sizing Studio">
        <button
          type="button"
          onClick={() => setInputs(DEFAULT_SIZING_INPUTS)}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <RotateCcw size={15} strokeWidth={1.75} />
          Reset
        </button>
        <button
          type="button"
          onClick={copySummary}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {copied ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
          {copied ? 'Copied' : 'Copy summary'}
        </button>
        {/* The primary action of this view: the local engine is a planning estimate,
            so confirming it against DryWare's real wheel model is the thing worth
            doing. Copy summary demotes to secondary. */}
        <button
          type="button"
          onClick={verify}
          disabled={verifying || errors.length > 0}
          title={
            errors.length > 0
              ? 'Fix the errors below before verifying.'
              : 'Run this selection through DryWare’s wheel performance model'
          }
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <ShieldCheck size={15} strokeWidth={1.75} />
          {verifying ? 'Verifying…' : verification ? 'Re-verify' : 'Verify with DryWare'}
        </button>
      </PageChrome>

      <div className="flex-1 overflow-y-auto bg-canvas">
        <div className="mx-auto max-w-[1280px] px-6 py-6">
          <header className="mb-6 animate-fade-up">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              Engineering
            </p>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-ink">
              Sizing Studio
            </h1>
            <p className="mt-1 text-[13px] text-ink-secondary">
              Size a desiccant dehumidifier from the job&rsquo;s design conditions — moisture
              load, unit selection, leaving-air condition and reactivation duty.
            </p>
            <p className="mt-1.5 text-[12px] text-ink-muted">
              {catalogSource === 'dryware' ? (
                <>Catalog live from DryWare — {catalog.length} sizes.</>
              ) : (
                <span className="text-amber-600 dark:text-amber-400">
                  DryWare unreachable — sizing against the built-in catalog ({catalog.length}{' '}
                  sizes){catalogError ? `. ${catalogError}` : '.'}
                </span>
              )}
            </p>
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <ConditionsForm inputs={inputs} set={set} />
            <div className="min-w-0 space-y-6">
              <SelectionCard
                result={result}
                blocked={errors.length > 0}
                verification={verification}
              />
              <VerificationCard
                result={result}
                verification={verification}
                verifying={verifying}
                error={verifyError}
              />
              <ChartCard result={result} />
              <StatesCard result={result} />
              <WarningsCard result={result} verification={verification} />
              <Calculators />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

// ─── Left column: the inputs ─────────────────────────────────────────────────

function ConditionsForm({
  inputs,
  set,
}: {
  inputs: SizingInputs
  set: <K extends keyof SizingInputs>(key: K, value: SizingInputs[K]) => void
}) {
  return (
    <div className="space-y-6 lg:sticky lg:top-6 lg:self-start">
      <Card>
        <CardHead title="Airflow" />
        <div className="space-y-4 px-5 py-4">
          <Segmented
            label="Basis"
            value={inputs.airflowMode}
            onChange={(v) => set('airflowMode', v as SizingInputs['airflowMode'])}
            options={[
              { value: 'direct', label: 'Known CFM' },
              { value: 'room', label: 'Room volume' },
            ]}
          />
          {inputs.airflowMode === 'direct' ? (
            <NumField
              label="Process airflow"
              unit="CFM"
              value={inputs.processCfm}
              onChange={(v) => set('processCfm', v)}
              step={100}
            />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <NumField
                label="Room volume"
                unit="ft³"
                value={inputs.roomVolumeFt3}
                onChange={(v) => set('roomVolumeFt3', v)}
                step={1000}
              />
              <NumField
                label="Air changes"
                unit="/hr"
                value={inputs.airChangesPerHour}
                onChange={(v) => set('airChangesPerHour', v)}
                step={0.5}
              />
            </div>
          )}
        </div>
      </Card>

      <Card>
        <CardHead title="Conditions" />
        <div className="space-y-5 px-5 py-4">
          <ConditionField
            legend="Entering / space air"
            value={inputs.entering}
            onChange={(v) => set('entering', v)}
          />
          <ConditionField
            legend="Target condition"
            value={inputs.target}
            onChange={(v) => set('target', v)}
          />
        </div>
      </Card>

      <Card>
        <CardHead title="Outside air" />
        <div className="space-y-5 px-5 py-4">
          <NumField
            label="Outside air fraction"
            unit="%"
            value={inputs.freshAirPercent}
            onChange={(v) => set('freshAirPercent', v)}
            step={5}
            min={0}
            max={100}
          />
          <WeatherLookup
            onApply={(d, elevationFt) => {
              // ASHRAE gives the design condition as mean-coincident dry bulb plus a
              // humidity ratio in grains — exactly the Studio's grains input mode, so
              // no conversion and no precision lost.
              set('outsideAir', { tempF: d.tempF, mode: 'grains', grains: d.grains })
              set('altitudeFt', elevationFt)
            }}
          />
          <ConditionField
            legend="Outdoor design condition"
            value={inputs.outsideAir}
            onChange={(v) => set('outsideAir', v)}
          />
        </div>
      </Card>

      <Card>
        <CardHead title="Site & load" />
        <div className="grid grid-cols-2 gap-3 px-5 py-4">
          <NumField
            label="Altitude"
            unit="ft"
            value={inputs.altitudeFt}
            onChange={(v) => set('altitudeFt', v)}
            step={500}
            min={0}
          />
          <NumField
            label="Internal load"
            unit="lb/hr"
            value={inputs.internalLoadLbPerHour}
            onChange={(v) => set('internalLoadLbPerHour', v)}
            step={10}
            min={0}
            hint="People, product drying, open tanks"
          />
        </div>
      </Card>

      <Card>
        <CardHead title="Equipment" />
        <div className="space-y-4 px-5 py-4">
          <div>
            <FieldLabel>Reactivation</FieldLabel>
            <div className="grid grid-cols-2 gap-2">
              {REACTIVATION_TYPES.map((r) => {
                const active = inputs.reactivation === r.code
                return (
                  <button
                    key={r.code}
                    type="button"
                    onClick={() => set('reactivation', r.code)}
                    title={r.note}
                    aria-pressed={active}
                    className={`h-9 rounded-lg border px-2 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      active
                        ? 'border-brand bg-brand-soft text-brand-ink'
                        : 'border-hairline bg-surface text-ink-secondary hover:border-hairline-strong hover:text-ink'
                    }`}
                  >
                    {r.label}
                  </button>
                )
              })}
            </div>
            <p className="mt-1.5 text-[12px] text-ink-muted">
              {REACTIVATION_TYPES.find((r) => r.code === inputs.reactivation)?.note}
            </p>
          </div>

          <Segmented
            label="Desiccant wheel"
            value={inputs.wheelPreference}
            onChange={(v) => set('wheelPreference', v as SizingInputs['wheelPreference'])}
            options={[
              { value: 'auto', label: 'Auto' },
              { value: 'standard', label: 'Standard' },
              { value: 'high-capacity', label: 'HC' },
            ]}
          />

          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              checked={inputs.idp}
              onChange={(e) => set('idp', e.target.checked)}
              className="h-4 w-4 cursor-pointer rounded border-hairline-strong accent-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
            <span className="text-[13px] text-ink-secondary">
              Integrated package (IDP)
              <span className="block text-[12px] text-ink-muted">
                Pre/post-cooling, heating, filtration
              </span>
            </span>
          </label>
        </div>
      </Card>
    </div>
  )
}

type DesignPoint = { tempF: number; grains: number; dewPointF: number }

/**
 * Look up a city's ASHRAE design conditions and drop them straight into the outdoor
 * inputs. This is the single biggest time-saver in the form: reps otherwise copy
 * these out of the ASHRAE tables or DryWare's weather app by hand, and a transposed
 * grain value silently mis-sizes the whole job.
 *
 * Defaults to the **1% dehumidification** column, not a cooling column — a
 * dehumidifier is sized for the peak-MOISTURE hour, which is a different hour of the
 * year than peak temperature.
 */
function WeatherLookup({
  onApply,
}: {
  onApply: (design: DesignPoint, elevationFt: number) => void
}) {
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{
    stationName: string
    elevation: number
    design: Record<'p1' | 'p2' | 'p4', DesignPoint | null>
  } | null>(null)
  const [pct, setPct] = useState<'p1' | 'p2' | 'p4'>('p1')

  const lookup = useCallback(async () => {
    if (!city.trim() || !state.trim()) {
      setError('Enter a city and a two-letter state.')
      return
    }
    setBusy(true)
    setError(null)
    setResult(null)
    try {
      const qs = new URLSearchParams({ city: city.trim(), state: state.trim() })
      const res = await fetch(`/api/admin/sizing/weather?${qs}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Lookup failed')
      setResult({
        stationName: data.station.stationName ?? 'Unknown station',
        elevation: data.station.elevation ?? 0,
        design: data.design,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Lookup failed')
    } finally {
      setBusy(false)
    }
  }, [city, state])

  const chosen = result?.design[pct] ?? null

  return (
    <fieldset className="min-w-0 rounded-lg border border-hairline bg-surface-soft p-3">
      <legend className="px-1 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        ASHRAE design conditions
      </legend>
      <div className="flex gap-2">
        <input
          value={city}
          onChange={(e) => setCity(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && lookup()}
          placeholder="City"
          aria-label="City"
          className="h-9 min-w-0 flex-1 rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-ink transition-colors placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <input
          value={state}
          onChange={(e) => setState(e.target.value.toUpperCase().slice(0, 2))}
          onKeyDown={(e) => e.key === 'Enter' && lookup()}
          placeholder="ST"
          aria-label="State"
          className="h-9 w-14 rounded-lg border border-hairline bg-surface px-2.5 text-[13px] uppercase text-ink transition-colors placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <button
          type="button"
          onClick={lookup}
          disabled={busy}
          className="inline-flex h-9 flex-shrink-0 items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <MapPin size={15} strokeWidth={1.75} />
          {busy ? 'Looking…' : 'Find'}
        </button>
      </div>

      {error && <p className="mt-2 text-[12px] text-rose-600 dark:text-rose-400">{error}</p>}

      {result && (
        <div className="mt-3 space-y-2">
          <p className="text-[12px] text-ink-secondary">
            {result.stationName} · {result.elevation.toLocaleString()} ft
          </p>
          <Segmented
            value={pct}
            onChange={(v) => setPct(v as 'p1' | 'p2' | 'p4')}
            options={[
              { value: 'p1', label: '1%' },
              { value: 'p2', label: '2%' },
              { value: 'p4', label: '4%' },
            ]}
            small
          />
          {chosen ? (
            <>
              <p className="text-[12px] tabular-nums text-ink-secondary">
                {fmt(chosen.tempF, 1)} °F · {fmt(chosen.grains, 1)} gr/lb ·{' '}
                {fmt(chosen.dewPointF, 1)} °F DP
              </p>
              <button
                type="button"
                onClick={() => onApply(chosen, result.elevation)}
                className="h-8 w-full rounded-lg border border-brand bg-brand-soft text-[13px] font-medium text-brand-ink transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                Use these conditions + elevation
              </button>
            </>
          ) : (
            <p className="text-[12px] text-ink-muted">
              No dehumidification data at this percentile for this station.
            </p>
          )}
          <p className="text-[12px] text-ink-muted">
            Dehumidification design — the peak-moisture hour, not peak temperature.
          </p>
        </div>
      )}
    </fieldset>
  )
}

function ConditionField({
  legend,
  value,
  onChange,
}: {
  legend: string
  value: HumidityInput
  onChange: (v: HumidityInput) => void
}) {
  const modes: { value: HumidityMode; label: string }[] = [
    { value: 'rh', label: 'RH' },
    { value: 'dewpoint', label: 'Dew pt' },
    { value: 'grains', label: 'Grains' },
  ]
  const unit = value.mode === 'rh' ? '%' : value.mode === 'dewpoint' ? '°F' : 'gr/lb'
  const current =
    value.mode === 'rh' ? value.rh : value.mode === 'dewpoint' ? value.dewPointF : value.grains

  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {legend}
      </legend>
      <div className="grid grid-cols-2 gap-3">
        <NumField
          label="Dry bulb"
          unit="°F"
          value={value.tempF}
          onChange={(v) => onChange({ ...value, tempF: v })}
        />
        <NumField
          label="Humidity"
          unit={unit}
          value={current}
          onChange={(v) =>
            onChange({
              ...value,
              ...(value.mode === 'rh'
                ? { rh: v }
                : value.mode === 'dewpoint'
                  ? { dewPointF: v }
                  : { grains: v }),
            })
          }
        />
      </div>
      <div className="mt-2">
        <Segmented
          value={value.mode}
          onChange={(m) => onChange({ ...value, mode: m as HumidityMode })}
          options={modes}
          small
        />
      </div>
    </fieldset>
  )
}

// ─── Right column: the results ───────────────────────────────────────────────

function SelectionCard({
  result,
  blocked,
  verification,
}: {
  result: SizingResult
  blocked: boolean
  verification: SizingVerification | null
}) {
  const { selection, airflow, load, reactivation } = result

  return (
    <Card className="animate-fade-up">
      <div className="border-b border-hairline px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
              Recommended unit
            </p>
            <p
              className={`mt-1 text-[26px] font-semibold tracking-[-0.02em] tabular-nums ${
                blocked ? 'text-ink-faint' : 'text-ink'
              }`}
            >
              {selection.unitsRequired > 1 && (
                <span className="text-ink-secondary">{selection.unitsRequired} × </span>
              )}
              {selection.model}
            </p>
            <p className="mt-1 text-[12px] text-ink-muted">
              {describeModel(selection.spec).join(' · ')}
            </p>
            <p className="mt-1 text-[12px] tabular-nums text-ink-muted">
              {selection.wheelDiameterMm} × {selection.wheelDepthMm} mm rotor ·{' '}
              {fmt(selection.effectiveAreaFt2, 3)} ft² face ·{' '}
              {fmt(selection.faceVelocityFpm, 0)} fpm
            </p>
          </div>
          <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
            {verification ? (
              <Pill tone="emerald">Verified</Pill>
            ) : (
              <Pill tone="amber">Preliminary</Pill>
            )}
            {selection.wheel === 'high-capacity' && <Pill tone="sky">HC wheel</Pill>}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 divide-hairline sm:grid-cols-4 sm:divide-x">
        <Stat
          label="Required airflow"
          value={fmt(airflow.requiredCfm, 0)}
          unit="CFM"
          sub={`${selection.nominalCfm.toLocaleString()} CFM nominal`}
        />
        <Stat
          label="Grain depression"
          value={fmt(load.deliveredGrainDepression, 1)}
          unit="gr/lb"
          sub={`${fmt(load.requiredGrainDepression, 1)} required`}
        />
        <Stat
          label="Moisture removed"
          value={fmt(load.airstreamLbPerHour, 1)}
          unit="lb/hr"
          sub={`${fmt(load.totalLbPerHour, 1)} lb/hr load`}
        />
        <Stat
          label={`${reactivation.label} reactivation`}
          value={
            reactivation.code === 'E'
              ? fmt(reactivation.electricKw, 1)
              : reactivation.code === 'G'
                ? fmt(reactivation.gasCfh, 0)
                : reactivation.code === 'S'
                  ? fmt(reactivation.steamLbPerHour, 0)
                  : fmt(reactivation.heatBtuh / 1000, 0)
          }
          unit={
            reactivation.code === 'E'
              ? 'kW'
              : reactivation.code === 'G'
                ? 'CFH'
                : reactivation.code === 'S'
                  ? 'lb/hr'
                  : 'MBH'
          }
          sub={`${fmt(reactivation.heatBtuh, 0)} BTU/hr at ${reactivation.tempF}°F`}
        />
      </div>

      <div className="border-t border-hairline bg-surface-soft px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Why this unit
        </p>
        <ul className="mt-2 space-y-1">
          {selection.rationale.map((r, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-ink-secondary">
              <span aria-hidden="true" className="text-ink-faint">
                —
              </span>
              <span>{r}</span>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

/**
 * DryWare's answer, next to ours.
 *
 * Deliberately does NOT overwrite the Studio's numbers elsewhere on the page. The
 * gap between the planning estimate and the real wheel model is itself the useful
 * information — it tells an engineer how much margin the local coefficients were
 * carrying on this particular job.
 */
function VerificationCard({
  result,
  verification,
  verifying,
  error,
}: {
  result: SizingResult
  verification: SizingVerification | null
  verifying: boolean
  error: string | null
}) {
  if (verifying) {
    return (
      <Card>
        <CardHead title="DryWare verification" caption="Running…" />
        <div className="px-5 py-4">
          <p className="text-[13px] text-ink-secondary">
            Waiting on DryWare&rsquo;s wheel model — this normally takes about two seconds.
          </p>
        </div>
      </Card>
    )
  }

  if (!verification && error) {
    return (
      <Card className="border-rose-200 dark:border-rose-500/30">
        <CardHead title="DryWare verification" caption="Could not verify" />
        <div className="px-5 py-4">
          <p className="text-[13px] text-ink-secondary">{error}</p>
          <p className="mt-2 text-[12px] text-ink-muted">
            The selection above still stands as a preliminary estimate — it just has
            not been confirmed against DryWare.
          </p>
        </div>
      </Card>
    )
  }

  if (!verification) {
    return (
      <Card>
        <CardHead
          title="DryWare verification"
          caption="Not yet verified"
        />
        <div className="px-5 py-4">
          <p className="text-[13px] text-ink-secondary">
            The selection above uses planning coefficients for wheel performance —
            80% moisture removal for a standard wheel, 90% for high-capacity.{' '}
            <span className="text-ink">Verify with DryWare</span> runs this exact
            selection through DryWare&rsquo;s real wheel model and returns the actual
            leaving condition, the optimised rotation speed, and the pressure drop.
          </p>
          <p className="mt-2 text-[12px] text-ink-muted">
            One call takes about two seconds. Nothing is saved.
          </p>
        </div>
      </Card>
    )
  }

  const { response, delta, leaving, meetsTarget, balanced } = verification
  // The local engine's own verdict, so a disagreement can be called out explicitly.
  const studioMetTarget = result.leaving.grains <= result.target.grains + 0.01
  const disagreesOnTarget = studioMetTarget !== meetsTarget

  return (
    <Card className="animate-fade-up">
      <CardHead
        title="DryWare verification"
        caption={`DryWare wheel model · ${fmt(response.rphOut, 1)} RPH${
          verification.request.optimizeRPH ? ' (optimised)' : ''
        }`}
      />

      <div className="grid grid-cols-2 divide-hairline sm:grid-cols-4 sm:divide-x">
        <Stat
          label="Leaving (verified)"
          value={fmt(leaving.grains, 2)}
          unit="gr/lb"
          sub={`${fmt(leaving.dewPointF, 1)} °F dew point`}
        />
        <Stat
          label="Leaving temp"
          value={fmt(leaving.tempF, 1)}
          unit="°F"
          sub={`${delta.tempF >= 0 ? '+' : ''}${fmt(delta.tempF, 1)} °F vs estimate`}
        />
        <Stat
          label="Pressure drop"
          value={fmt(response.processDeltaP, 2)}
          unit="in. w.g."
          sub={`${fmt(response.reactDeltaP, 2)} reactivation`}
        />
        {/* DesMod models ONE wheel, so its figure is per unit. The Selection card
            above reports the whole-job duty — showing the two under the same label
            without scaling would invite a direct comparison of different things. */}
        <Stat
          label="Moisture removed"
          value={fmt(response.moistureRemovalLbsHr * result.selection.unitsRequired, 1)}
          unit="lb/hr"
          sub={
            result.selection.unitsRequired > 1
              ? `${fmt(response.moistureRemovalLbsHr, 1)} lb/hr × ${result.selection.unitsRequired} units`
              : 'DryWare’s own figure'
          }
        />
      </div>

      {error && (
        <div className="border-t border-hairline bg-surface-soft px-5 py-3">
          <p className="text-[12px] text-ink-secondary">
            <span className="font-medium">The latest re-verify failed.</span> {error} The
            figures above are from the previous successful run against these same inputs.
          </p>
        </div>
      )}

      <div className="space-y-2.5 border-t border-hairline bg-surface-soft px-5 py-4">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Against the Studio&rsquo;s estimate
        </p>

        <p className="text-[13px] text-ink-secondary">
          The Studio predicted{' '}
          <span className="tabular-nums text-ink">{fmt(result.leaving.grains, 2)} gr/lb</span>{' '}
          leaving; DryWare says{' '}
          <span className="tabular-nums text-ink">{fmt(leaving.grains, 2)} gr/lb</span> —{' '}
          {Math.abs(delta.grains) < 0.05 ? (
            <>essentially the same answer.</>
          ) : delta.grains < 0 ? (
            <>
              <span className="text-ink">{fmt(Math.abs(delta.grains), 2)} gr/lb drier</span> than
              the planning coefficients assumed, so the estimate was conservative.
            </>
          ) : (
            <>
              <span className="text-ink">{fmt(delta.grains, 2)} gr/lb wetter</span> than the
              planning coefficients assumed, so the estimate was optimistic.
            </>
          )}
        </p>

        {disagreesOnTarget && (
          <p className="text-[13px] text-ink-secondary">
            {meetsTarget ? (
              <>
                <span className="text-ink">
                  The Studio flagged this target as out of reach; DryWare says it is met.
                </span>{' '}
                A smaller unit or a standard wheel may be enough — worth re-running before
                quoting.
              </>
            ) : (
              <>
                <span className="text-ink">
                  The Studio expected this target to be met; DryWare says it is not.
                </span>{' '}
                Do not quote this selection without engineering.
              </>
            )}
          </p>
        )}

        {verification.request.reactTemperature !== result.reactivation.tempF && (
          <p className="text-[13px] text-ink-secondary">
            Verified at{' '}
            <span className="tabular-nums text-ink">
              {fmt(verification.request.reactTemperature, 0)} °F
            </span>{' '}
            reactivation, not the {fmt(result.reactivation.tempF, 0)} °F shown above — DryWare
            runs this compact at its own setpoint, and matching it is what makes the result
            reproducible in their tool.
          </p>
        )}

        {!balanced && (
          <p className="text-[13px] text-ink-secondary">
            DryWare reported non-zero energy/mass residuals (
            <span className="tabular-nums">{fmt(response.temperatureBalance, 2)}</span> /{' '}
            <span className="tabular-nums">{fmt(response.moistureBalance, 2)}</span>) — the run
            did not fully converge. Treat these numbers with caution.
          </p>
        )}

        <p className="text-[12px] text-ink-muted">
          Wheel performance and pressure drop are now DryWare&rsquo;s. The airflow, moisture
          load and reactivation duty above are still the Studio&rsquo;s own psychrometrics.
          Engineering confirms before a submittal goes out.
        </p>
      </div>
    </Card>
  )
}

function ChartCard({ result }: { result: SizingResult }) {
  return (
    <Card>
      <CardHead
        title="Psychrometric chart"
        caption={`Sea-level curves shift with altitude — drawn at ${fmt(result.pressure, 2)} psia`}
      />
      <div className="px-5 py-4">
        <PsychroChart result={result} />
      </div>
    </Card>
  )
}

function StatesCard({ result }: { result: SizingResult }) {
  const rows: { label: string; state: AirState; note?: string }[] = [
    { label: 'Return air', state: result.returnAir },
    ...(result.airflow.freshAirCfm > 0
      ? [
          {
            label: 'Outside air',
            state: result.outsideAir,
            note: `${fmt(result.airflow.freshAirCfm, 0)} CFM`,
          },
        ]
      : []),
    { label: 'Entering wheel', state: result.entering },
    { label: 'Leaving unit', state: result.leaving },
    { label: 'Target', state: result.target },
  ]

  return (
    <Card>
      <CardHead title="Air states" caption="Every value derived from the entered conditions" />
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-hairline bg-surface-soft text-left">
              <Th className="text-left">State</Th>
              <Th>Dry bulb</Th>
              <Th>RH</Th>
              <Th>Dew point</Th>
              <Th>Grains</Th>
              <Th>Enthalpy</Th>
            </tr>
          </thead>
          <tbody className="divide-y divide-hairline-soft">
            {rows.map((r) => (
              <tr key={r.label} className="transition-colors hover:bg-surface-soft">
                <td className="px-4 py-3 align-middle">
                  <span className="font-medium text-ink">{r.label}</span>
                  {r.note && <span className="ml-2 text-[12px] text-ink-muted">{r.note}</span>}
                </td>
                <Td>{fmt(r.state.tempF, 1)} °F</Td>
                <Td>{fmt(r.state.rh, 1)} %</Td>
                <Td>{fmt(r.state.dewPointF, 1)} °F</Td>
                <Td>{fmt(r.state.grains, 1)}</Td>
                <Td>{fmt(r.state.enthalpy, 2)}</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}

function WarningsCard({
  result,
  verification,
}: {
  result: SizingResult
  verification: SizingVerification | null
}) {
  const order = { error: 0, warning: 1, info: 2 } as const
  const items = [...result.warnings].sort((a, b) => order[a.severity] - order[b.severity])

  return (
    <Card>
      <CardHead title="Checks & notes" />
      <div className="space-y-2.5 px-5 py-4">
        {items.length === 0 && (
          <p className="text-[13px] text-ink-muted">
            No issues flagged for these conditions.
          </p>
        )}
        {items.map((w, i) => {
          const Icon =
            w.severity === 'error' ? TriangleAlert : w.severity === 'warning' ? AlertTriangle : Info
          const tone =
            w.severity === 'error'
              ? 'text-rose-600 dark:text-rose-400'
              : w.severity === 'warning'
                ? 'text-amber-600 dark:text-amber-400'
                : 'text-sky-600 dark:text-sky-400'
          return (
            <div key={i} className="flex gap-2.5">
              <Icon size={15} strokeWidth={1.75} className={`mt-0.5 flex-shrink-0 ${tone}`} />
              <p className="text-[13px] text-ink-secondary">{w.message}</p>
            </div>
          )
        })}

        <div className="mt-4 border-t border-hairline pt-3">
          {verification ? (
            <p className="text-[12px] text-ink-muted">
              <span className="font-medium text-ink-secondary">Verified against DryWare.</span>{' '}
              Psychrometrics are exact (ASHRAE) and wheel performance now comes from
              DryWare&rsquo;s own model rather than planning coefficients. The warnings above
              were raised by the Studio&rsquo;s estimate — re-read them against the verified
              figures. Engineering still confirms before this goes on a submittal.
            </p>
          ) : (
            <p className="text-[12px] text-ink-muted">
              <span className="font-medium text-ink-secondary">Preliminary selection.</span>{' '}
              Psychrometrics are exact (ASHRAE), but desiccant-wheel performance uses planning
              coefficients — {WHEEL_SPECS.standard.removalFraction * 100}% moisture removal for a
              standard wheel, {WHEEL_SPECS['high-capacity'].removalFraction * 100}% for
              high-capacity, derated by reactivation temperature. Engineering confirms rotor
              performance before this goes on a submittal.
            </p>
          )}
        </div>
      </div>
    </Card>
  )
}

// ─── Local primitives (DESIGN.md §6) ─────────────────────────────────────────

function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-hairline bg-surface ${className}`}>{children}</div>
  )
}

function CardHead({ title, caption }: { title: string; caption?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-hairline px-5 py-3.5">
      <h2 className="text-[16px] font-semibold tracking-[-0.011em] text-ink">{title}</h2>
      {caption && <p className="text-[12px] text-ink-muted">{caption}</p>}
    </div>
  )
}

function Stat({
  label,
  value,
  unit,
  sub,
}: {
  label: string
  value: string
  unit: string
  sub?: string
}) {
  return (
    <div className="border-b border-hairline px-5 py-4 sm:border-b-0">
      <p className="truncate text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        {label}
      </p>
      <p className="mt-1.5 text-[20px] font-semibold tracking-[-0.02em] tabular-nums text-ink">
        {value}
        <span className="ml-1 text-[12px] font-normal text-ink-muted">{unit}</span>
      </p>
      {sub && <p className="mt-0.5 truncate text-[12px] tabular-nums text-ink-muted">{sub}</p>}
    </div>
  )
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[12px] font-medium text-ink-secondary">{children}</p>
}

function NumField({
  label,
  unit,
  value,
  onChange,
  step = 1,
  min,
  max,
  hint,
}: {
  label: string
  unit: string
  value: number | undefined
  onChange: (v: number) => void
  step?: number
  min?: number
  max?: number
  hint?: string
}) {
  const id = `f-${label.replace(/\W+/g, '-').toLowerCase()}`
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="mb-1.5 block text-[12px] font-medium text-ink-secondary">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="number"
          inputMode="decimal"
          step={step}
          min={min}
          max={max}
          // NaN renders as an empty field so the input can actually be cleared while
          // typing; sanitize() coerces it back to 0 before the engine sees it.
          value={value === undefined || Number.isNaN(value) ? '' : value}
          onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
          className="h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 pr-10 text-[13px] tabular-nums text-ink transition-colors placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        />
        <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[12px] text-ink-muted">
          {unit}
        </span>
      </div>
      {hint && <p className="mt-1 text-[12px] text-ink-muted">{hint}</p>}
    </div>
  )
}

function Segmented({
  label,
  value,
  onChange,
  options,
  small,
}: {
  label?: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
  small?: boolean
}) {
  return (
    <div>
      {label && <FieldLabel>{label}</FieldLabel>}
      <div
        role="group"
        aria-label={label}
        className="flex gap-1 rounded-lg border border-hairline bg-surface-soft p-1"
      >
        {options.map((o) => {
          const active = o.value === value
          return (
            <button
              key={o.value}
              type="button"
              onClick={() => onChange(o.value)}
              aria-pressed={active}
              className={`flex-1 rounded-md text-center font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                small ? 'h-7 text-[12px]' : 'h-8 text-[13px]'
              } ${
                active
                  ? 'border border-hairline bg-surface text-ink'
                  : 'text-ink-muted hover:text-ink-secondary'
              }`}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

type Tone = 'amber' | 'sky' | 'violet' | 'emerald' | 'rose'

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const cx: Record<Tone, string> = {
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400',
    rose: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-semibold ${cx[tone]}`}
    >
      {children}
    </span>
  )
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <th
      className={`px-4 py-2.5 text-right text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted ${className}`}
    >
      {children}
    </th>
  )
}

function Td({ children }: { children: ReactNode }) {
  return <td className="px-4 py-3 text-right tabular-nums text-ink-secondary">{children}</td>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Replace the NaNs an empty input produces with zeros before the engine runs. */
function sanitize(i: SizingInputs): SizingInputs {
  const n = (v: number | undefined) => (v === undefined || Number.isNaN(v) ? 0 : v)
  const cond = (c: HumidityInput): HumidityInput => ({
    ...c,
    tempF: n(c.tempF),
    rh: n(c.rh),
    dewPointF: n(c.dewPointF),
    grains: n(c.grains),
  })
  return {
    ...i,
    processCfm: n(i.processCfm),
    roomVolumeFt3: n(i.roomVolumeFt3),
    airChangesPerHour: n(i.airChangesPerHour),
    freshAirPercent: n(i.freshAirPercent),
    altitudeFt: n(i.altitudeFt),
    internalLoadLbPerHour: n(i.internalLoadLbPerHour),
    entering: cond(i.entering),
    target: cond(i.target),
    outsideAir: cond(i.outsideAir),
  }
}

function fmt(n: number, digits: number): string {
  if (!Number.isFinite(n)) return '—'
  return n.toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
}

/**
 * Plain-text summary for the clipboard — pasteable into an email or a deal note.
 *
 * The verification status is load-bearing here: this text leaves the building, so
 * a summary that says PRELIMINARY when the numbers were verified (or, far worse,
 * one that reads as verified when it wasn't) misrepresents the selection.
 */
function summaryText(
  inputs: SizingInputs,
  r: SizingResult,
  v: SizingVerification | null,
): string {
  const line = (label: string, value: string) => `${label.padEnd(24)}${value}`
  return [
    v
      ? 'IAT SIZING STUDIO — SELECTION VERIFIED AGAINST DRYWARE'
      : 'IAT SIZING STUDIO — PRELIMINARY SELECTION',
    '',
    line('Recommended unit', `${r.selection.unitsRequired > 1 ? `${r.selection.unitsRequired} × ` : ''}${r.selection.model}`),
    line('Nominal airflow', `${r.selection.nominalCfm.toLocaleString()} CFM`),
    line('Required airflow', `${fmt(r.airflow.requiredCfm, 0)} CFM`),
    line('Wheel', WHEEL_SPECS[r.selection.wheel].label),
    line('Reactivation', `${r.reactivation.label} at ${r.reactivation.tempF} °F`),
    '',
    'CONDITIONS',
    line('Entering wheel', stateLine(r.entering)),
    // When verified, DryWare's leaving condition is the one that matters — but the
    // estimate stays alongside it rather than being quietly dropped.
    ...(v
      ? [
          line('Leaving unit (DryWare)', stateLine(v.leaving)),
          line('  Studio estimate', stateLine(r.leaving)),
        ]
      : [line('Leaving unit', stateLine(r.leaving))]),
    line('Target', stateLine(r.target)),
    line('Outside air', `${fmt(inputs.freshAirPercent, 0)} % — ${stateLine(r.outsideAir)}`),
    line('Altitude', `${fmt(inputs.altitudeFt, 0)} ft (${fmt(r.pressure, 2)} psia)`),
    '',
    'DUTY',
    line('Grain depression', `${fmt(r.load.deliveredGrainDepression, 1)} gr/lb`),
    line('Moisture removed', `${fmt(r.load.airstreamLbPerHour, 1)} lb/hr`),
    line('Total moisture load', `${fmt(r.load.totalLbPerHour, 1)} lb/hr`),
    line('Reactivation heat', `${fmt(r.reactivation.heatBtuh, 0)} BTU/hr (${fmt(r.reactivation.electricKw, 1)} kW)`),
    '',
    'WHY THIS UNIT',
    ...r.selection.rationale.map((x) => `  - ${x}`),
    ...(v
      ? [
          '',
          'DRYWARE VERIFICATION',
          line('Rotor modelled', `${v.request.rotorDiameter} × ${v.request.rotorDepth} mm`),
          // The verification may run at a different reactivation setpoint than the
          // one quoted above (DryWare runs its compacts at 275 °F), so state the
          // temperature these numbers were actually computed at.
          line('Reactivation', `${fmt(v.request.reactTemperature, 0)} °F (as verified)`),
          line('Rotation', `${fmt(v.response.rphOut, 1)} RPH${v.request.optimizeRPH ? ' (optimised)' : ''}`),
          line('Pressure drop', `${fmt(v.response.processDeltaP, 2)} in. w.g. process / ${fmt(v.response.reactDeltaP, 2)} reactivation`),
          line(
            'Moisture removed',
            `${fmt(v.response.moistureRemovalLbsHr * r.selection.unitsRequired, 1)} lb/hr${
              r.selection.unitsRequired > 1
                ? ` (${fmt(v.response.moistureRemovalLbsHr, 1)} × ${r.selection.unitsRequired} units)`
                : ''
            }`,
          ),
          line('Meets target', v.meetsTarget ? 'Yes' : 'NO'),
          ...(v.balanced ? [] : [line('⚠ Convergence', 'DryWare reported non-zero residuals')]),
          line('Verified', v.verifiedAt),
        ]
      : []),
    ...(r.warnings.length
      ? ['', 'CHECKS', ...r.warnings.map((w) => `  [${w.severity.toUpperCase()}] ${w.message}`)]
      : []),
    '',
    v
      ? 'Wheel performance verified against DryWare. Engineering confirms before submittal.'
      : 'Preliminary — engineering confirms rotor performance before submittal.',
  ].join('\n')
}

function stateLine(s: AirState): string {
  return `${fmt(s.tempF, 1)} °F / ${fmt(s.rh, 0)} % RH / ${fmt(s.grains, 1)} gr/lb / ${fmt(s.dewPointF, 1)} °F DP`
}
