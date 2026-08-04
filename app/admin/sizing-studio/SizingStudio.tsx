'use client'

import { useMemo, useState, useCallback, type ReactNode } from 'react'
import { AlertTriangle, Check, Copy, Info, RotateCcw, TriangleAlert } from 'lucide-react'
import PageChrome from '../PageChrome'
import PsychroChart from './PsychroChart'
import {
  calculateSizing,
  DEFAULT_SIZING_INPUTS,
  type HumidityInput,
  type HumidityMode,
  type SizingInputs,
  type SizingResult,
} from '@/lib/sizing'
import { REACTIVATION_TYPES, WHEEL_SPECS, describeModel } from '@/lib/sizing-catalog'
import type { AirState } from '@/lib/psychro'

/* Sizing Studio — enter a job's design conditions, get a recommended IAT unit.
 *
 * Everything here is pure client-side math (lib/sizing.ts), so the whole thing
 * recalculates live as the rep types. No server round trip, no save, no writes —
 * this view cannot mutate anything, which is why it ships gated to admins only.
 *
 * The local Field/NumField/Segmented primitives below follow DESIGN.md §6 and should
 * graduate into components/ui/ when the shared kit lands (DESIGN.md Phase 1).
 */

export default function SizingStudio() {
  const [inputs, setInputs] = useState<SizingInputs>(DEFAULT_SIZING_INPUTS)
  const [copied, setCopied] = useState(false)

  const result = useMemo(() => calculateSizing(sanitize(inputs)), [inputs])

  const set = useCallback(<K extends keyof SizingInputs>(key: K, value: SizingInputs[K]) => {
    setInputs((prev) => ({ ...prev, [key]: value }))
  }, [])

  const copySummary = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(summaryText(inputs, result))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked by permissions policy; failing quietly is fine
      // because the same numbers are all on screen.
    }
  }, [inputs, result])

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
          className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {copied ? <Check size={15} strokeWidth={1.75} /> : <Copy size={15} strokeWidth={1.75} />}
          {copied ? 'Copied' : 'Copy summary'}
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
          </header>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
            <ConditionsForm inputs={inputs} set={set} />
            <div className="min-w-0 space-y-6">
              <SelectionCard result={result} blocked={errors.length > 0} />
              <ChartCard result={result} />
              <StatesCard result={result} />
              <WarningsCard result={result} />
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

function SelectionCard({ result, blocked }: { result: SizingResult; blocked: boolean }) {
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
            <Pill tone="amber">Preliminary</Pill>
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

function WarningsCard({ result }: { result: SizingResult }) {
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
          <p className="text-[12px] text-ink-muted">
            <span className="font-medium text-ink-secondary">Preliminary selection.</span>{' '}
            Psychrometrics are exact (ASHRAE), but desiccant-wheel performance uses planning
            coefficients — {WHEEL_SPECS.standard.removalFraction * 100}% moisture removal for a
            standard wheel, {WHEEL_SPECS['high-capacity'].removalFraction * 100}% for
            high-capacity, derated by reactivation temperature. Engineering confirms rotor
            performance before this goes on a submittal.
          </p>
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

type Tone = 'amber' | 'sky' | 'violet'

function Pill({ tone, children }: { tone: Tone; children: ReactNode }) {
  const cx: Record<Tone, string> = {
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
    sky: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',
    violet: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',
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

/** Plain-text summary for the clipboard — pasteable into an email or a deal note. */
function summaryText(inputs: SizingInputs, r: SizingResult): string {
  const line = (label: string, value: string) => `${label.padEnd(24)}${value}`
  return [
    'IAT SIZING STUDIO — PRELIMINARY SELECTION',
    '',
    line('Recommended unit', `${r.selection.unitsRequired > 1 ? `${r.selection.unitsRequired} × ` : ''}${r.selection.model}`),
    line('Nominal airflow', `${r.selection.nominalCfm.toLocaleString()} CFM`),
    line('Required airflow', `${fmt(r.airflow.requiredCfm, 0)} CFM`),
    line('Wheel', WHEEL_SPECS[r.selection.wheel].label),
    line('Reactivation', `${r.reactivation.label} at ${r.reactivation.tempF} °F`),
    '',
    'CONDITIONS',
    line('Entering wheel', stateLine(r.entering)),
    line('Leaving unit', stateLine(r.leaving)),
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
    ...(r.warnings.length
      ? ['', 'CHECKS', ...r.warnings.map((w) => `  [${w.severity.toUpperCase()}] ${w.message}`)]
      : []),
    '',
    'Preliminary — engineering confirms rotor performance before submittal.',
  ].join('\n')
}

function stateLine(s: AirState): string {
  return `${fmt(s.tempF, 1)} °F / ${fmt(s.rh, 0)} % RH / ${fmt(s.grains, 1)} gr/lb / ${fmt(s.dewPointF, 1)} °F DP`
}
