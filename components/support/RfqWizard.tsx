'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowLeft, ArrowRight, Building2, Check, CheckCircle2, ChevronDown, Cog, Download,
  DoorOpen, Droplets, Factory, Gauge, Layers, Loader2, type LucideIcon, Mail, MapPin, PanelsTopLeft,
  Ruler, Send, Sparkles, Thermometer, Users, Wind,
} from 'lucide-react'

import Logo from '@/components/Logo'
import ThemeToggle from '@/components/ThemeToggle'
import { getRecaptchaToken } from '@/components/use-recaptcha'
import {
  AIR_SOURCES, CEILING_MATERIALS, CONSTRUCTIONS, COOLING_TYPES, DOOR_TYPES, FLOOR_MATERIALS,
  HEATING_TYPES, INSTALL_LOCATIONS, LOAD_DISCLAIMER, MERV_OPTIONS, FINAL_FILTER_OPTIONS, MOISTURE_MODES, MOISTURE_SUFFIX,
  PEOPLE_LOADS, PROCESS_PRESETS, REGEN_SOURCES, ROOM_PRESETS, ROOM_RENDER_EDGES, ROOM_SIZE_MODES, RUNTIMES, TEMP_UNITS,
  TIGHTNESS_HELP, VOLTAGES, WALL_MATERIALS, DEFAULT_CEILING_FT,
  applicationLabel, applyProcessPreset, applyRoomPreset, dewPointF, emptyRfq, estimateLoad,
  estimateProcess, fmt, fmtDewPoint, fmtGrains, fToC, grains, modeIsTemperature, normalizeMode,
  normalizeRoomSizeMode, presetFor, roomDims, setCondition, tempFromDisplay, tempToDisplay,
  type ActivityLevel, type ConditionKey, type DoorSpec, type Exposure, type MoistureMode,
  type ProcessPreset, type RfqData, type RoomPreset, type TempUnit, type Tightness, type Track,
  type VaporBarrier,
} from '@/lib/rfq'
import { renderAsset, renderAssetUrl } from '@/lib/render-assets'
import { renderKeyForPreset } from '@/lib/rfq-renders'

// ─── Steps ────────────────────────────────────────────────────────────────────

type StepKey =
  | 'application' | 'target' | 'space' | 'shell' | 'openings' | 'inside'
  | 'leaving' | 'airstream' | 'entering'
  | 'unit' | 'about' | 'review'

/**
 * TWO tones, deliberately (owner, 2026-08-20). Sky carries ordinary information;
 * amber marks the one thing on a step worth stopping at. Rose, violet and emerald
 * were deleted rather than left unused — a fourth colour is otherwise one commit
 * away, and the survey goes back to looking like a paint chart.
 *
 * Dropping emerald also puts this in line with the house rule that brand green
 * belongs to the single primary action on a view. Here that is Continue and the
 * site-conditions lookup, and nothing else.
 */
type Tone = 'sky' | 'amber'

// `short` is the 1-2 word label printed under each segment of the progress rail,
// so a step can be recognized and jumped to directly instead of clicking Back
// repeatedly. `title` remains the full heading shown on the step itself.
const STEPS: Record<StepKey, { short: string; title: string; kicker: string; icon: LucideIcon; tone: Tone }> = {
  application: { short: 'Application', title: 'What is the application', kicker: 'Pick the closest match and it fills in the rest', icon: Sparkles, tone: 'sky' },
  target:      { short: 'Target', title: 'Target conditions',   kicker: 'The condition you need held inside',           icon: Thermometer, tone: 'sky' },
  space:       { short: 'Space', title: 'The space',                kicker: 'Rough dimensions are fine',                    icon: Ruler, tone: 'sky' },
  shell:       { short: 'Construction', title: 'Space construction',      kicker: 'Tell us about your building materials',                  icon: Layers, tone: 'sky' },
  openings:    { short: 'Openings', title: 'Doors and openings',       kicker: 'Usually the single biggest load',              icon: DoorOpen, tone: 'sky' },
  inside:      { short: 'Inside', title: "What's happening inside",  kicker: 'People, product, water, ventilation',          icon: Users, tone: 'sky' },
  leaving:     { short: 'Leaving air', title: 'Leaving air you need',     kicker: 'The condition off the dehumidifier',           icon: Wind, tone: 'sky' },
  airstream:   { short: 'Airstream', title: 'The airstream',            kicker: 'How much air, and where it comes from',        icon: Gauge, tone: 'sky' },
  entering:    { short: 'Entering', title: 'Entering conditions',      kicker: 'What the unit has to work against',            icon: Thermometer, tone: 'sky' },
  unit:        { short: 'Unit', title: 'The unit',                 kicker: 'Utilities, construction, filtration',          icon: Cog, tone: 'sky' },
  about:       { short: 'About you', title: 'You and the project',      kicker: 'Who to send the quote to, and where it is going', icon: Mail, tone: 'sky' },
  review:      { short: 'Review', title: 'Review and send',          kicker: 'One last look before it reaches our desk',     icon: CheckCircle2, tone: 'sky' },
}

// `about` leads. It was the second-to-last step, which meant a customer answered
// nine engineering questions before telling us who they were — so an abandoned
// survey left us nothing to follow up on. Site location lives here too, because
// elevation is an input to every psychrometric number the rest of the wizard
// shows; asked last, those numbers were computed at sea level until the very end.
//
// `about` and `application` occupy indices 0 and 1 in BOTH flows on purpose:
// switching track mid-survey keeps the current index meaningful.
const ROOM_FLOW: StepKey[] = ['about', 'application', 'target', 'space', 'shell', 'openings', 'inside', 'unit', 'review']
const PROCESS_FLOW: StepKey[] = ['about', 'application', 'leaving', 'airstream', 'entering', 'unit', 'review']

// Tone recipes. DESIGN.md §2.4 keeps chroma to the Tone set and to meaning; on
// this one customer-facing surface each step owns a tone so the wizard reads as
// a journey rather than nine identical forms.
const TONE: Record<Tone, { chip: string; ring: string; dot: string; bar: string; text: string; softBg: string }> = {
  sky:   { chip: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',         ring: 'ring-sky-200 dark:ring-sky-500/30',     dot: 'bg-sky-500',   bar: 'bg-sky-500',   text: 'text-sky-700 dark:text-sky-400',     softBg: 'bg-sky-50/60 dark:bg-sky-500/5' },
  amber: { chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400', ring: 'ring-amber-200 dark:ring-amber-500/30', dot: 'bg-amber-500', bar: 'bg-amber-500', text: 'text-amber-700 dark:text-amber-400', softBg: 'bg-amber-50/60 dark:bg-amber-500/5' },
}

// ─── Field primitives ─────────────────────────────────────────────────────────

const inputCx =
  'w-full rounded-lg border border-hairline bg-surface px-3 py-2.5 text-[14px] text-ink placeholder:text-ink-faint transition-colors hover:border-hairline-strong focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand'

// Every control is explicitly wired to its <label> and hint via useId, so the
// label is a click target, screen readers announce the hint, and the fields are
// addressable by accessible name in tests.
/**
 * Field label. The hint deliberately does NOT live here — see Hint below.
 */
function Label({ id, children, required }: { id: string; children: React.ReactNode; required?: boolean }) {
  return (
    <label htmlFor={id} className="mb-1.5 block text-[12.5px] font-medium text-ink-secondary">
      {children}{required && <span className="ml-0.5 text-rose-400" aria-hidden="true">*</span>}
    </label>
  )
}

/**
 * Helper text, rendered BELOW the control.
 *
 * It used to sit between the label and the input, which quietly broke every 2-up
 * row where one field had a hint and its neighbour did not: the hint made one
 * label block taller and pushed that field's input down, so the two inputs no
 * longer lined up. The Email/Phone pair on step 1 was the visible case — Phone
 * carries a two-line hint, Email carries none.
 *
 * Below the control, a hint can be any length and the inputs stay level, because
 * the height it adds falls beneath the row's shared baseline instead of above it.
 * `aria-describedby` still resolves by id, so nothing changes for screen readers.
 */
function Hint({ id, children }: { id: string; children: React.ReactNode }) {
  return <p id={id} className="mt-1 text-[11.5px] leading-relaxed text-ink-muted">{children}</p>
}

function TextField({
  label, hint, value, onChange, placeholder, type = 'text', autoFocus, suffix, required,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void
  placeholder?: string; type?: string; autoFocus?: boolean; suffix?: string; required?: boolean
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div>
      <Label id={id} required={required}>{label}</Label>
      <div className="relative">
        <input
          id={id}
          type={type}
          value={value}
          autoFocus={autoFocus}
          onChange={e => onChange(e.target.value)}
          placeholder={placeholder}
          aria-describedby={hint ? hintId : undefined}
          aria-required={required || undefined}
          inputMode={type === 'number' ? 'decimal' : undefined}
          className={`${inputCx} ${suffix ? 'pr-12' : ''} ${type === 'number' ? 'tabular-nums' : ''}`}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-muted">
            {suffix}
          </span>
        )}
      </div>
      {hint && <Hint id={hintId}>{hint}</Hint>}
    </div>
  )
}

function TextArea({
  label, hint, value, onChange, placeholder, rows = 3,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div>
      <Label id={id}>{label}</Label>
      <textarea
        id={id}
        value={value}
        rows={rows}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-describedby={hint ? hintId : undefined}
        className={`${inputCx} resize-none leading-relaxed`}
      />
      {hint && <Hint id={hintId}>{hint}</Hint>}
    </div>
  )
}

function SelectField({
  label, hint, value, onChange, options,
}: {
  label: string; hint?: string; value: string; onChange: (v: string) => void; options: readonly string[]
}) {
  const id = useId()
  const hintId = `${id}-hint`
  return (
    <div>
      <Label id={id}>{label}</Label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          aria-describedby={hint ? hintId : undefined}
          className={`${inputCx} cursor-pointer appearance-none pr-9`}
        >
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
        <ChevronDown size={15} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint" />
      </div>
      {hint && <Hint id={hintId}>{hint}</Hint>}
    </div>
  )
}

/** Segmented control — the fastest possible answer for a short option set. */
function Segmented<T extends string>({
  label, hint, value, onChange, options, tone = 'sky',
}: {
  label?: string; hint?: string; value: T; onChange: (v: T) => void
  options: { value: T; label: string }[]; tone?: Tone
}) {
  const groupId = useId()
  const hintId = `${groupId}-hint`
  return (
    <div>
      {/* A radiogroup has no single labelable control, so it is labeled by its
          heading element rather than by a <label for>. */}
      {label && (
        <div className="mb-1.5">
          <span id={groupId} className="block text-[12.5px] font-medium text-ink-secondary">{label}</span>
          {hint && <p id={hintId} className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{hint}</p>}
        </div>
      )}
      <div
        className="flex flex-wrap gap-1.5"
        role="radiogroup"
        aria-labelledby={label ? groupId : undefined}
        aria-describedby={label && hint ? hintId : undefined}
      >
        {options.map(o => {
          const on = value === o.value
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onChange(o.value)}
              className={`rounded-lg border px-3.5 py-2 text-[13px] font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                on
                  ? `border-transparent ring-1 ${TONE[tone].ring} ${TONE[tone].chip}`
                  : 'border-hairline bg-surface text-ink-muted hover:border-hairline-strong hover:text-ink-secondary'
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

/** '°F dp' → '°C dp' when the survey is in Celsius. Leaves '% rh' and 'gr/lb' alone. */
const unitLabel = (label: string, unit: TempUnit): string =>
  unit === 'C' ? label.replace('°F', '°C') : label

/**
 * A number input that stores °F while the customer types °C.
 *
 * ⚠️ IT KEEPS A LOCAL TEXT BUFFER, and that is not optional. Converting on every
 * keystroke and feeding the result back as the input's value destroys typing: type
 * "20." in Celsius and it parses to 20, stores 68°F, redisplays "20" — the dot is
 * gone, and the next digit turns 20 into 205. The buffer holds exactly what was
 * typed and only re-derives when the stored value changes from OUTSIDE (a preset,
 * the site lookup, or a unit flip).
 *
 * ⚠️ A UNIT FLIP MUST NEVER WRITE. It re-renders this field in the other scale and
 * leaves storage alone. Tenths of °C and tenths of °F do not line up — 105°F shows
 * as 40.6°C, which would re-enter as 105.1°F — so a toggle that wrote back would
 * quietly edit a survey every time someone looked at it in the other unit.
 */
function TempInput({
  id, valueF, unit, onChangeF, autoFocus, className, ariaDescribedBy,
}: {
  id?: string
  valueF: string
  unit: TempUnit
  onChangeF: (nextF: string) => void
  autoFocus?: boolean
  className?: string
  ariaDescribedBy?: string
}) {
  const [raw, setRaw] = useState(() => tempToDisplay(valueF, unit))
  // What this field last pushed upward, so an echo of our own write is not mistaken
  // for an external one and does not clobber the buffer mid-word.
  const pushed = useRef(valueF)
  const lastUnit = useRef(unit)

  useEffect(() => {
    if (valueF !== pushed.current || unit !== lastUnit.current) {
      pushed.current = valueF
      lastUnit.current = unit
      setRaw(tempToDisplay(valueF, unit))
    }
  }, [valueF, unit])

  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      value={raw}
      autoFocus={autoFocus}
      aria-describedby={ariaDescribedBy}
      onChange={e => {
        const text = e.target.value
        setRaw(text)
        const f = tempFromDisplay(text, unit)
        pushed.current = f
        onChangeF(f)
      }}
      className={className}
    />
  )
}

/**
 * A dry-bulb + moisture pair, where the moisture unit is the customer's choice.
 * Room specs arrive as %rh, dry rooms as a dew point, process wheels as grains,
 * and a sling psychrometer gives a wet bulb — so all four are typeable and the
 * conversion happens here rather than in the customer's head.
 *
 * Both fields route through setCondition(), which is what keeps the canonical
 * value right when the DRY BULB moves — a 50°F dew point is 49%rh at 75°F and
 * 70%rh at 60°F, so the temperature is part of the moisture answer.
 */
function ConditionField({
  label, hint, tempLabel = 'Temperature', data, conditionKey, onChange, autoFocus, typical, tone = 'sky',
}: {
  label: string
  hint?: string
  tempLabel?: string
  data: RfqData
  conditionKey: ConditionKey
  onChange: (next: RfqData) => void
  autoFocus?: boolean
  typical?: { tempF: number; value: number; mode: MoistureMode }
  tone?: Tone
}) {
  const tempId = useId()
  const tempUnitId = useId()
  const valueId = useId()
  const modeId = useId()
  const unit = data.tempUnit ?? 'F'
  const hintId = `${valueId}-hint`

  const tempF = (data[`${conditionKey}TempF` as keyof RfqData] as string) ?? ''
  const mode = normalizeMode(data[`${conditionKey}MoistureMode` as keyof RfqData], conditionKey === 'leaving' ? 'gr' : 'rh')
  const value = (data[`${conditionKey}MoistureValue` as keyof RfqData] as string) ?? ''
  const modeMeta = MOISTURE_MODES.find(m => m.value === mode)!

  const typicalUsed = !!typical
    && tempF === String(typical.tempF)
    && mode === typical.mode
    && value === String(typical.value)

  return (
    <div>
      <div className="mb-1.5">
        <span className="block text-[12.5px] font-medium text-ink-secondary">{label}</span>
        {hint && <p id={hintId} className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">{hint}</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor={tempId} className="mb-1 block text-[11px] text-ink-muted">{tempLabel}</label>
          <div className="relative">
            <TempInput
              id={tempId}
              valueF={tempF}
              unit={unit}
              autoFocus={autoFocus}
              onChangeF={next => onChange(setCondition(data, conditionKey, { tempF: next }))}
              className={`${inputCx} pr-[68px] tabular-nums`}
            />
            {/* Sets the unit for the WHOLE survey and writes no temperature. */}
            <label htmlFor={tempUnitId} className="sr-only">Temperature unit</label>
            <select
              id={tempUnitId}
              value={unit}
              onChange={e => onChange({ ...data, tempUnit: e.target.value as TempUnit })}
              className="absolute right-1.5 top-1/2 h-7 -translate-y-1/2 cursor-pointer appearance-none rounded-md border border-hairline bg-surface-soft pl-2 pr-5 text-[12px] text-ink-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
            >
              {TEMP_UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint" />
          </div>
        </div>

        <div>
          <label htmlFor={valueId} className="mb-1 block text-[11px] text-ink-muted">Moisture</label>
          <div className="flex gap-1.5">
            {modeIsTemperature(mode) ? (
              // Dew point and wet bulb ARE temperatures. Leaving them in °F beside a
              // °C dry bulb is how someone types 15 meaning 15°C into a 15°F field.
              <TempInput
                id={valueId}
                valueF={value}
                unit={unit}
                ariaDescribedBy={hint ? hintId : undefined}
                onChangeF={next => onChange(setCondition(data, conditionKey, { value: next }))}
                className={`${inputCx} min-w-0 flex-1 tabular-nums`}
              />
            ) : (
              <input
                id={valueId}
                type="number"
                inputMode="decimal"
                value={value}
                aria-describedby={hint ? hintId : undefined}
                onChange={e => onChange(setCondition(data, conditionKey, { value: e.target.value }))}
                className={`${inputCx} min-w-0 flex-1 tabular-nums`}
              />
            )}
            <div className="relative flex-shrink-0">
              <label htmlFor={modeId} className="sr-only">Moisture unit for {label}</label>
              <select
                id={modeId}
                value={mode}
                onChange={e => onChange(setCondition(data, conditionKey, { mode: e.target.value as MoistureMode }))}
                className={`${inputCx} w-[104px] cursor-pointer appearance-none pl-2.5 pr-7 text-[12.5px]`}
              >
                {MOISTURE_MODES.map(m => (
                  <option key={m.value} value={m.value}>{unitLabel(m.short, unit)}</option>
                ))}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint" />
            </div>
          </div>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{modeMeta.hint}</p>

      {typical && (
        <Typical
          label={`${tempToDisplay(String(typical.tempF), unit)}${unitLabel('°F', unit)} / ${
            modeIsTemperature(typical.mode) ? tempToDisplay(String(typical.value), unit) : typical.value
          }${unitLabel(MOISTURE_SUFFIX[typical.mode], unit)}`}
          used={typicalUsed}
          onUse={() => onChange(setCondition(
            setCondition(data, conditionKey, { tempF: String(typical.tempF) }),
            conditionKey,
            { mode: typical.mode, value: String(typical.value) },
          ))}
        />
      )}
    </div>
  )
}

/** Every way of saying the same air — the payoff for the unit selector. */
function ConditionReadout({ tempF, rhPct, elevationFt, unit = 'F', tone = 'sky' }: {
  tempF: number; rhPct: number; elevationFt: number; unit?: TempUnit; tone?: Tone
}) {
  if (!tempF || !rhPct) return null
  // Both temperatures follow the survey's unit — a °C dry bulb above a °F dew point
  // here is the same confusion the input fields were fixed for. Grains and %rh are
  // unitless in this sense and never convert.
  // WHOLE DEGREES. dewPointF() is a bisection result like 49.0556..., and this
  // readout is where it is shown. It used to run through fmtDewPoint(), which
  // rounded; the unit-aware rewrite on 2026-08-20 swapped in tempToDisplay(),
  // which returns the raw value untouched in Fahrenheit, and the full float
  // reached the page. fmt() rounds and also renders a non-finite value as a dash.
  const asUnit = (f: number) =>
    !Number.isFinite(f) ? '—' : unit === 'C' ? `${fmt(fToC(f))}°C` : `${fmt(f)}°F`
  return (
    <div className={`grid grid-cols-2 gap-3 rounded-xl p-4 sm:grid-cols-4 ${TONE[tone].softBg}`}>
      <Stat label="Temperature" value={asUnit(tempF)} />
      <Stat label="Relative humidity" value={`${fmt(rhPct, rhPct < 10 ? 1 : 0)}%`} />
      <Stat label="Grains" value={fmtGrains(grains(tempF, rhPct, elevationFt))} unit="gr/lb" />
      <Stat label="Dew point" value={asUnit(dewPointF(tempF, rhPct, elevationFt))} />
    </div>
  )
}

/** One-tap acceptance of the value a person in this industry would expect. */
function Typical({ label, onUse, used }: { label: string; onUse: () => void; used: boolean }) {
  return (
    <button
      type="button"
      onClick={onUse}
      className={`mt-1.5 inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-[11.5px] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        used
          ? 'bg-brand-soft text-brand-ink'
          : 'bg-surface-strong text-ink-muted hover:text-ink-secondary'
      }`}
    >
      {used ? <Check size={11} strokeWidth={2.5} /> : <Sparkles size={11} />}
      {used ? `Using typical: ${label}` : `Use typical: ${label}`}
    </button>
  )
}

function Callout({ tone = 'sky', children }: { tone?: Tone; children: React.ReactNode }) {
  return (
    <div className={`rounded-lg px-3.5 py-2.5 text-[12px] leading-relaxed ${TONE[tone].softBg} ${TONE[tone].text}`}>
      {children}
    </div>
  )
}

function Grid({ cols = 2, children }: { cols?: 1 | 2 | 3; children: React.ReactNode }) {
  const cx = cols === 3 ? 'sm:grid-cols-3' : cols === 2 ? 'sm:grid-cols-2' : ''
  return <div className={`grid gap-4 ${cx}`}>{children}</div>
}

// ─── The wizard ───────────────────────────────────────────────────────────────

type Stage = 'fork' | 'form' | 'sending' | 'done'

export default function RfqWizard() {
  const [stage, setStage] = useState<Stage>('fork')
  const [data, setData] = useState<RfqData>(emptyRfq)
  const [index, setIndex] = useState(0)
  /**
   * Furthest step reached, so the rail can offer a jump FORWARD as well as back.
   *
   * Without it the rail could only reach `index`, which meant going back from
   * Review to fix one field stranded you: the only way forward again was clicking
   * Continue through every intervening step. The high-water mark is what makes
   * "jump back, edit, jump straight to Review" possible.
   *
   * It never decreases while a survey is open — a step you have already satisfied
   * stays reachable even if you are currently standing behind it.
   */
  const [maxIndex, setMaxIndex] = useState(0)
  const [direction, setDirection] = useState(1)
  const [error, setError] = useState<string | null>(null)
  const [reference, setReference] = useState('')
  const [downloading, setDownloading] = useState(false)
  const reduce = useReducedMotion()

  const flow = data.track === 'room' ? ROOM_FLOW : PROCESS_FLOW
  const step = flow[Math.min(index, flow.length - 1)]
  const set = useCallback(<K extends keyof RfqData>(key: K, value: RfqData[K]) => {
    setData(d => ({ ...d, [key]: value }))
  }, [])

  const load = useMemo(() => estimateLoad(data), [data])
  const proc = useMemo(() => estimateProcess(data), [data])

  const canAdvance = useMemo(() => validateStep(step, data), [step, data])

  const go = useCallback((delta: number) => {
    setDirection(delta)
    setIndex(i => {
      const next = Math.min(Math.max(i + delta, 0), flow.length - 1)
      setMaxIndex(m => Math.max(m, next))
      return next
    })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' })
  }, [flow.length])

  // Enter advances, except inside a textarea where it means a new line.
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter') return
    const el = e.target as HTMLElement
    if (el.tagName === 'TEXTAREA' || el.tagName === 'BUTTON') return
    e.preventDefault()
    if (canAdvance && index < flow.length - 1) go(1)
  }

  const pickTrack = (track: Track) => {
    setData(d => ({ ...emptyRfq(), ...d, track }))
    setStage('form')
    setIndex(0)
    setMaxIndex(0)
  }

  const buildPdf = useCallback(async (submitted: boolean, ref: string) => {
    const { generateRfqPdf } = await import('@/lib/rfq-pdf')
    return generateRfqPdf(data, { reference: ref, submittedAt: new Date(), submitted })
  }, [data])

  const downloadPdf = useCallback(async (submitted: boolean, ref: string) => {
    setDownloading(true)
    try {
      const blob = await buildPdf(submitted, ref)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `IAT-RFQ-${ref}-${slug(data.projectName || data.company || 'project')}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      setTimeout(() => URL.revokeObjectURL(url), 4000)
    } catch (e) {
      console.error('[rfq] pdf generation failed:', e)
      setError('We could not build the PDF in this browser. Your details are safe. Try again, or send the request and we will generate it on our side.')
    } finally {
      setDownloading(false)
    }
  }, [buildPdf, data.company, data.projectName])

  /** Build the PDF this browser would hand the customer and post it to the desk.
   *  Best-effort by design — see the call site. */
  const storePdfCopy = useCallback(async (ref: string) => {
    try {
      const blob = await buildPdf(true, ref)
      const buf = await blob.arrayBuffer()
      // Chunked so a few hundred KB cannot blow the argument limit on
      // String.fromCharCode — apply() takes the array as individual arguments.
      const bytes = new Uint8Array(buf)
      let binary = ''
      for (let i = 0; i < bytes.length; i += 8192) {
        binary += String.fromCharCode(...bytes.subarray(i, i + 8192))
      }
      await fetch('/api/rfq/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reference: ref, pdf: btoa(binary) }),
      })
    } catch (err) {
      // Never surfaced. The request is already safely in the queue.
      console.warn('[rfq] could not store a copy of the PDF:', err)
    }
  }, [buildPdf])

  const submit = async () => {
    setError(null)
    setStage('sending')
    try {
      const recaptcha_token = await getRecaptchaToken('submit_rfq')
      const res = await fetch('/api/rfq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          data,
          summary: data.track === 'room' ? summarizeRoom(load) : summarizeProcess(proc),
          ...(recaptcha_token ? { recaptcha_token } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Submission failed')
      setReference(json.reference)
      setStage('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })

      // Hand the desk a copy of the exact document this browser produces, so the
      // engineer who picks the request up sees what the customer is holding
      // rather than a regeneration that may drift from it (migration 095).
      //
      // ⚠️ Deliberately AFTER the success screen and deliberately not awaited.
      // The survey is already committed; a customer must never wait on — or be
      // shown an error from — a convenience for us. Every failure is swallowed
      // and simply leaves pdf_path NULL, which the admin page treats as normal.
      //
      // It also runs whether or not they click Download, because most people
      // never do, and "only the ones who downloaded it" is a strange rule for
      // which requests have a record.
      void storePdfCopy(json.reference)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setStage('form')
    }
  }

  // ── Fork ──
  if (stage === 'fork') return <Fork onPick={pickTrack} />

  // ── Done ──
  if (stage === 'done') {
    return (
      <Shell>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="mx-auto max-w-2xl px-5 py-16"
        >
          <div className="overflow-hidden rounded-2xl border border-hairline bg-surface">
            <div className="bg-emerald-50 px-8 py-8 dark:bg-emerald-500/10">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white">
                <CheckCircle2 size={26} strokeWidth={2} />
              </span>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.06em] text-emerald-700 dark:text-emerald-400">
                Request received
              </p>
              <h1 className="mt-1 text-[26px] font-semibold tracking-tight text-ink">
                Thanks. We have everything we need to start.
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
                Your request is with our application engineering team. Reference{' '}
                <strong className="font-semibold tabular-nums text-ink">{reference}</strong>. We&apos;ll come back
                to <strong className="font-semibold text-ink">{data.email}</strong>. If anything in your
                survey needs a second look, that&apos;s the conversation we&apos;ll start with.
              </p>
            </div>

            <div className="border-t border-hairline px-8 py-7">
              <p className="text-[13px] font-semibold text-ink">Take your survey with you</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-ink-muted">
                A full record of everything you entered, plus a one-page summary of your numbers you can
                hand to anyone who asks.
              </p>
              <button
                type="button"
                onClick={() => downloadPdf(true, reference)}
                disabled={downloading}
                className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-brand px-4 text-[13px] font-medium text-white transition-colors hover:bg-brand-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                {downloading ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {downloading ? 'Building your PDF…' : 'Download my RFQ (PDF)'}
              </button>
              {error && <p className="mt-3 text-[12px] text-rose-600 dark:text-rose-400">{error}</p>}
            </div>

            <div className="flex items-center justify-between gap-4 border-t border-hairline px-8 py-5">
              <Link href="/support" className="text-[13px] text-ink-muted transition-colors hover:text-ink-secondary">
                Back to support
              </Link>
              <button
                type="button"
                onClick={() => { setData(emptyRfq()); setIndex(0); setMaxIndex(0); setStage('fork'); setReference(''); setError(null) }}
                className="text-[13px] font-medium text-brand-ink transition-colors hover:text-brand"
              >
                Start another request
              </button>
            </div>
          </div>
        </motion.div>
      </Shell>
    )
  }

  // ── Form ──
  const meta = STEPS[step]
  const Icon = meta.icon
  const tone = TONE[meta.tone]
  const isLast = index === flow.length - 1

  return (
    <Shell>
      <div className="mx-auto max-w-6xl px-5 pb-24 pt-8">
        <Rail flow={flow} index={index} maxIndex={maxIndex} onJump={i => { setDirection(i > index ? 1 : -1); setIndex(i); setMaxIndex(m => Math.max(m, i)) }} />

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
          {/* Step column */}
          <div onKeyDown={onKeyDown}>
            <div className="mb-5 flex items-start gap-3.5">
              <span className={`mt-0.5 flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl ${tone.chip}`}>
                <Icon size={19} strokeWidth={1.9} />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
                  Step {index + 1} of {flow.length}
                </p>
                <h2 className="mt-0.5 text-[23px] font-semibold leading-tight tracking-tight text-ink">{meta.title}</h2>
                <p className="mt-1 text-[13.5px] text-ink-muted">{meta.kicker}</p>
              </div>
            </div>

            <AnimatePresence mode="wait" custom={direction} initial={false}>
              <motion.div
                key={step}
                custom={direction}
                initial={reduce ? false : { opacity: 0, x: direction > 0 ? 24 : -24 }}
                animate={{ opacity: 1, x: 0 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, x: direction > 0 ? -24 : 24 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="rounded-2xl border border-hairline bg-surface p-5 sm:p-7"
              >
                <StepBody
                  step={step}
                  data={data}
                  set={set}
                  setData={setData}
                  load={load}
                  proc={proc}
                  onDownloadPreview={() => downloadPdf(false, 'PREVIEW')}
                  downloading={downloading}
                />
              </motion.div>
            </AnimatePresence>

            {error && (
              <p className="mt-4 rounded-lg bg-rose-50 px-3.5 py-2.5 text-[12.5px] text-rose-700 dark:bg-rose-500/10 dark:text-rose-400">
                {error}
              </p>
            )}

            {/* Nav */}
            <div className="mt-5 flex items-center gap-3">
              {index > 0 && (
                <button
                  type="button"
                  onClick={() => go(-1)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <ArrowLeft size={15} /> Back
                </button>
              )}
              {isLast ? (
                <button
                  type="button"
                  onClick={submit}
                  disabled={!canAdvance || stage === 'sending'}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-lg bg-brand px-5 text-[13.5px] font-medium text-white transition-all hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  {stage === 'sending' ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                  {stage === 'sending' ? 'Sending…' : 'Send my request to IAT'}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => go(1)}
                  disabled={!canAdvance}
                  className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand px-5 text-[13.5px] font-medium text-white transition-all hover:bg-brand-hover disabled:cursor-not-allowed disabled:opacity-40 sm:flex-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  Continue <ArrowRight size={15} />
                </button>
              )}
              {!canAdvance && (
                <span className="text-[12px] text-ink-muted">{requirementHint(step, data)}</span>
              )}
            </div>
          </div>

          {/* Live readout, then the picture of the application they picked */}
          <div className="lg:sticky lg:top-[76px] lg:self-start">
            <Readout data={data} load={load} proc={proc} />
            <ApplicationRender data={data} />
          </div>
        </div>
      </div>
    </Shell>
  )
}

// ─── Shell + chrome ───────────────────────────────────────────────────────────

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-canvas text-ink">
      <header className="sticky top-0 z-30 h-14 border-b border-hairline bg-canvas">
        <div className="mx-auto flex h-full max-w-6xl items-center px-5">
          <Link href="/support" className="flex items-center gap-2.5 no-underline">
            <Logo size={26} className="flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-semibold tracking-tight text-ink">IAT</span>
              <span className="text-[13px] text-ink-faint">/</span>
              <span className="text-[13px] font-medium text-ink-muted">Request for Quote</span>
            </div>
          </Link>
          <ThemeToggle className="ml-auto" />
        </div>
      </header>
      {children}
    </div>
  )
}

/** The opening fork — the one decision that reshapes everything after it. */
function Fork({ onPick }: { onPick: (t: Track) => void }) {
  const reduce = useReducedMotion()
  const cards: { track: Track; icon: LucideIcon; title: string; lede: string; bullets: string[]; tone: Tone }[] = [
    {
      track: 'room',
      icon: PanelsTopLeft,
      title: 'A room or building',
      lede: 'You need a space held at a condition: a warehouse, cold store, dry room or production hall.',
      bullets: ['You know the temperature and humidity you want inside', 'People, product or equipment live in that space', 'We calculate the moisture load from the room itself'],
      tone: 'sky',
    },
    {
      track: 'process',
      icon: Factory,
      title: 'A process airstream',
      lede: 'You need dry air delivered to a machine, line or vessel at a specific condition.',
      bullets: ['Your spec is a leaving-air condition or dew point', 'The air feeds a process rather than a room', 'We size the wheel on grain depression and airflow'],
      tone: 'sky',
    },
  ]
  return (
    <Shell>
      <main className="mx-auto max-w-4xl px-5 py-14 sm:py-20">
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            Request for Quote · Moisture Survey
          </p>
          <h1 className="max-w-2xl text-[32px] font-semibold leading-[1.08] tracking-tight text-ink sm:text-[40px]">
            Let&apos;s find the right dehumidifier for your&nbsp;job.
          </h1>
          <p className="mt-4 max-w-xl text-[15px] leading-relaxed text-ink-secondary">
            A few guided questions, about three minutes. We fill in typical values as you go, show you
            the numbers as they build, and you leave with a PDF of the whole survey.
          </p>

          <p className="mt-10 text-[13px] font-medium text-ink-secondary">
            First, the one question that changes everything else:
          </p>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            {cards.map(c => {
              const Icon = c.icon
              const t = TONE[c.tone]
              return (
                <button
                  key={c.track}
                  type="button"
                  onClick={() => onPick(c.track)}
                  className="group flex flex-col rounded-2xl border border-hairline bg-surface p-6 text-left transition-all duration-150 hover:-translate-y-0.5 hover:border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                >
                  <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${t.chip}`}>
                    <Icon size={24} strokeWidth={1.75} />
                  </span>
                  <span className="mt-4 text-[18px] font-semibold tracking-tight text-ink">{c.title}</span>
                  <span className="mt-1.5 text-[13px] leading-relaxed text-ink-muted">{c.lede}</span>
                  <ul className="mt-4 flex-1 space-y-1.5">
                    {c.bullets.map(b => (
                      <li key={b} className="flex gap-2 text-[12.5px] leading-relaxed text-ink-secondary">
                        <span className={`mt-[6px] h-1.5 w-1.5 flex-shrink-0 rounded-full ${t.dot}`} />
                        {b}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-[13px] font-medium text-brand-ink">
                    Start here
                    <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              )
            })}
          </div>

          <p className="mt-6 text-[12.5px] leading-relaxed text-ink-muted">
            Not sure? Pick <strong className="font-medium text-ink-secondary">a room or building</strong>. It&apos;s
            the more common of the two, and you can switch on the next screen.
          </p>
        </motion.div>
      </main>
    </Shell>
  )
}

/**
 * Progress rail — a labeled, clickable map of the survey.
 *
 * Reachability is `maxIndex`, the furthest step visited, NOT the current index.
 * That is the whole point: from Review you can drop back to fix one answer and
 * then jump straight to Review again, instead of clicking Continue through every
 * step in between. Steps never visited stay disabled, because letting someone
 * skip ahead into a step whose inputs depend on earlier answers produces a form
 * that looks filled in but is not.
 *
 * The label is what makes it usable — a bare bar tells you nothing about which
 * step is which, so you would have to walk back one at a time to find the one you
 * wanted. Labels are hidden below `sm`, where twelve of them would not fit; the
 * bars stay tappable and keep their title tooltip.
 */
function Rail({ flow, index, maxIndex, onJump }: {
  flow: StepKey[]; index: number; maxIndex: number; onJump: (i: number) => void
}) {
  return (
    <div className="flex items-start gap-1.5" role="navigation" aria-label="Progress">
      {flow.map((k, i) => {
        const done = i < index
        const now = i === index
        const reachable = i <= maxIndex
        return (
          <button
            key={k}
            type="button"
            onClick={() => reachable && onJump(i)}
            disabled={!reachable}
            title={reachable ? `Go to: ${STEPS[k].title}` : STEPS[k].title}
            aria-current={now ? 'step' : undefined}
            className={`group flex flex-1 flex-col gap-1 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              reachable ? 'cursor-pointer' : 'cursor-default'
            }`}
          >
            <span
              className={`h-1.5 w-full rounded-full transition-all duration-200 ${
                now ? TONE[STEPS[k].tone].bar : done ? 'bg-brand' : 'bg-surface-strong'
              } ${reachable && !now ? 'group-hover:bg-brand-hover' : ''}`}
            />
            <span
              className={`hidden truncate text-[10.5px] leading-tight transition-colors sm:block ${
                now
                  ? 'font-semibold text-ink'
                  : reachable
                    ? 'text-ink-muted group-hover:text-ink-secondary'
                    : 'text-ink-faint'
              }`}
            >
              {STEPS[k].short}
            </span>
          </button>
        )
      })}
    </div>
  )
}

// ─── Live readout ─────────────────────────────────────────────────────────────

function Readout({
  data, load, proc,
}: {
  data: RfqData
  load: ReturnType<typeof estimateLoad>
  proc: ReturnType<typeof estimateProcess>
}) {
  const isRoom = data.track === 'room'
  const elev = numOf(data.elevationFt)
  const t = numOf(data.targetTempF)
  const rh = numOf(data.targetRhPct)

  return (
    <div className="rounded-2xl border border-hairline bg-surface p-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
        Typical Conditions
      </p>

      {/* Grains and dew point ONLY.
          The estimated moisture load, its per-source breakdown, the dry-air cfm and
          the process water-removal figures were all shown here and are now withheld
          from the customer view (owner's call, 2026-08-18): they read as a quotable
          selection when they are a rough planning estimate off partial inputs. They
          are still calculated — estimateLoad/estimateProcess are unchanged and both
          still reach our desk on submission — just not displayed to the person
          filling the form. Restoring them is deleting this comment and putting the
          blocks back; nothing was ripped out of the model. */}
      {isRoom ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Grains" value={t || rh ? fmtGrains(grains(t, rh, elev)) : '—'} unit="gr/lb" />
          <Stat label="Dew point" value={t || rh ? fmtDewPoint(dewPointF(t, rh, elev)) : '—'} />
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Stat label="Leaving grains" value={data.leavingGrains ? fmtGrains(proc.leavingGrains) : '—'} unit="gr/lb" />
          <Stat label="Dew point" value={data.leavingGrains ? fmtDewPoint(proc.leavingDewPointF) : '—'} />
        </div>
      )}

      <p className="mt-4 border-t border-hairline-soft pt-3 text-[10.5px] leading-relaxed text-ink-faint">
        Indicative figures for the conditions entered. For discussion, not for equipment selection.
      </p>
    </div>
  )
}

/**
 * True only where a magnify-on-hover is meaningful: a fine pointer that can
 * actually hover, on a viewport wide enough for the enlarged copy to land
 * somewhere useful. Touch reports `hover: none`, and a 2x panel on a phone would
 * cover the form it is meant to annotate.
 */
function useCanHover() {
  const [can, setCan] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 640px) and (hover: hover) and (pointer: fine)')
    const apply = () => setCan(mq.matches)
    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [])
  return can
}

/**
 * Hover to enlarge. That is the whole behavior.
 *
 * ⚠️ TWO interaction ideas have now been tried here and BOTH were rejected by the
 * owner. Do not reach for a third without asking.
 *
 *   1. Tilt following the pointer on hover. The picture moved under an
 *      uncommitted cursor, which reads as drift rather than control.
 *   2. Press-and-drag to turn it in 3D. Rejected as "missed the mark"; the owner
 *      is finding a reference for what they actually want.
 *
 * So this magnifies and does nothing else, on purpose, until there is a concrete
 * example to build against. `perspective` and `preserve-3d` are deliberately
 * gone with the rotation — leaving a 3D context behind for a purely 2D scale
 * invites the next person to "just add a small rotate" to it.
 *
 * `origin` matters more than it looks. In the right rail the element sits
 * against the right edge of the page, so it must grow LEFTWARD (origin
 * '100% 50%') or the enlarged copy runs off-screen. Centered content gets
 * 'center'.
 *
 * Reduced motion keeps the magnify — a zoom is a function, not an ornament — and
 * drops only the transition, so it snaps.
 */
/**
 * Hover-to-enlarge for an image whose ARTWORK CONTAINS TEXT.
 *
 * Separate from HoverMagnify below, which stays exactly as it is — the render and
 * the wall build-ups have a settled interaction and are not worth disturbing.
 *
 * 🔴 Why this exists. `transform: scale()` does not re-read the source file. The
 * browser rasterizes an <img> at its LAYOUT size, then stretches that bitmap. A
 * 760px asset laid out at 132px is ~264 device pixels at 2x DPR; magnifying it
 * 2.4x spreads those 264 across ~634, so the callout text goes soft and the
 * source resolution is never used. Measured side by side on 2026-08-25: at the
 * same on-screen size, laid-out-at-317px is visibly crisper than
 * laid-out-at-132px-then-scaled.
 *
 * So the image is laid out at its FULL magnified size and scaled DOWN at rest.
 * The raster is made at the size it is eventually shown at, and magnifying is
 * 1:1 rather than an upscale.
 *
 * ⚠️ `max-w-none` IS LOAD-BEARING. A global `img { max-width: 100% }` clamps the
 * full-size image to the container's resting width, and the scale-down then
 * applies to THAT — which renders the picture at 132 x 0.4167 = 54px. That is
 * exactly what shipped and had to be reverted on 2026-08-25. If the illustration
 * ever looks tiny, this is the first thing to check.
 *
 * ⚠️ `full` must be exactly `rest` x `scale`, or the image jumps on hover. The
 * container keeps the resting footprint so surrounding layout never moves.
 */
function CrispMagnifyImage({
  src, alt, width, height, rest, full, scale, label,
}: {
  src: string
  alt: string
  width: number
  height: number
  /** Resting footprint — what the layout reserves. */
  rest: string
  /** The image's own size: rest x scale. */
  full: string
  scale: number
  label: string
}) {
  const reduce = useReducedMotion()
  const canHover = useCanHover()
  const [on, setOn] = useState(false)
  const active = canHover && on

  return (
    <div
      onPointerEnter={() => setOn(true)}
      onPointerLeave={() => setOn(false)}
      onFocus={() => setOn(true)}
      onBlur={() => setOn(false)}
      tabIndex={canHover ? 0 : -1}
      aria-label={label}
      className={`relative flex-shrink-0 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${rest}`}
    >
      <Image
        src={src}
        alt={alt}
        width={width}
        height={height}
        unoptimized
        draggable={false}
        className={`absolute left-1/2 top-1/2 max-w-none select-none rounded-lg ${full}`}
        style={{
          transform: `translate(-50%, -50%) scale(${active ? 1 : 1 / scale})`,
          transformOrigin: 'center',
          transition: reduce ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          // Under the sticky header (z-30) on purpose, over the step card.
          zIndex: active ? 20 : undefined,
        }}
      />
    </div>
  )
}

function HoverMagnify({
  children, scale = 2, origin = '100% 50%', className = '', label,
}: {
  children: React.ReactNode
  scale?: number
  origin?: string
  className?: string
  label?: string
}) {
  const reduce = useReducedMotion()
  const canHover = useCanHover()
  const [on, setOn] = useState(false)
  const active = canHover && on

  return (
    <div className={className}>
      <div
        onPointerEnter={() => setOn(true)}
        onPointerLeave={() => setOn(false)}
        onFocus={() => setOn(true)}
        onBlur={() => setOn(false)}
        tabIndex={canHover ? 0 : -1}
        aria-label={label}
        style={{
          transform: active ? `scale(${scale})` : 'scale(1)',
          transformOrigin: origin,
          transition: reduce ? 'none' : 'transform 180ms cubic-bezier(0.22, 1, 0.36, 1)',
          position: 'relative',
          // Under the sticky header (z-30) on purpose, over the step card.
          zIndex: active ? 20 : undefined,
        }}
        className="rounded-2xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {children}
      </div>
    </div>
  )
}

// Geometry for the dimensioned render, in one coordinate system so the callout
// lines and the image cannot drift apart. The image is a fixed 16:9 (every asset
// in the `rooms` set is 1920x1080), so the padded box is computable and the SVG
// overlay and the <Image> can both be positioned from these numbers as
// percentages. Getting this wrong by a pixel is very visible: the lines stop
// touching the corners.
// ⚠️ padT and padB must clear the LABELS, not just the rules. The rule sits 11
// from the image and the label baseline a further 7 beyond it; at font-size 14
// the glyphs reach roughly 10 more. padT 26 put the top of "25 ft wide" at -3 —
// outside the viewBox, and it rendered visibly clipped, which is what got
// reported. 34/30 cleared it by only 1.5px at the bottom, which is not a margin,
// so both ends carry real slack now: measured 12px clear at the top and 9px at
// the bottom. Re-measure in SCREEN space if these change — getBBox() ignores an
// element's own transform, so it reports the rotated height label as clipped
// when it is not.
const DIM = { padL: 34, padR: 12, padT: 48, padB: 42, imgW: 320, imgH: 180 }
const DIM_W = DIM.padL + DIM.imgW + DIM.padR
const DIM_H = DIM.padT + DIM.imgH + DIM.padB
const pct = (n: number, total: number) => `${(n / total) * 100}%`

/**
 * Length, width and height called out ON THE ROOM'S OWN EDGES, drawn live from
 * the step-4 inputs.
 *
 * Until 2026-08-24 these were three rules floating outside the picture — width
 * along the top, height up the left, length across the bottom — because a
 * photograph was assumed to have no usable depth edge. Every image in the
 * `rooms` set is in fact the same isometric cutaway from the same camera, so it
 * does: the near-left wall's top edge, its outer vertical edge and the floor's
 * front edge land in the same place in all of them. Drawing on those reads as
 * part of the room rather than as a diagram wrapped around it.
 *
 * ⚠️ Geometry lives in ONE place — ROOM_RENDER_EDGES in lib/rfq.ts — because
 * lib/rfq-pdf.ts draws the same three callouts on the same render, and the
 * customer reads the screen and the PDF side by side. Change one, change both.
 *
 * Each edge appears only once its own field has a value, so the drawing builds
 * up as they type rather than flashing three "0 ft" labels.
 */
function DimensionOverlay({ L, W, H }: { L: number; W: number; H: number }) {
  // Edge fractions are of the IMAGE box; map them into overlay coordinates.
  const E = ROOM_RENDER_EDGES
  const P = (p: { x: number; y: number }) => ({
    x: DIM.padL + p.x * DIM.imgW,
    y: DIM.padT + p.y * DIM.imgH,
  })
  const leftTop = P(E.leftTop), apex = P(E.apex), leftBot = P(E.leftBot), floor = P(E.floor)

  /** One callout: a line running PARALLEL to a room edge but standing off it, a
   *  tick across each end, and a label lying along it.
   *
   *  `side` is the outward perpendicular. The line is pushed OUT by OFFSET so the
   *  three callouts outline the room from outside rather than sitting on its
   *  walls — drawing them on the walls reads as graffiti on the render. */
  const OFFSET = 4   // overlay units. Small on purpose: the room's top corner sits
                     // only ~5% below the image edge, so a bigger stand-off puts the
                     // width line hard against the top of the picture.
  const edge = (
    a: { x: number; y: number }, b: { x: number; y: number },
    label: string, side: 1 | -1, key: string,
  ) => {
    const dx = b.x - a.x, dy = b.y - a.y
    const len = Math.hypot(dx, dy) || 1
    const ux = dx / len, uy = dy / len            // along the edge
    const nx = -uy * side, ny = ux * side         // outward perpendicular
    const T = 4                                   // tick half-length
    const GAP = 11                                // label clearance beyond the line
    // Stand the whole callout off the room.
    const p = { x: a.x + nx * OFFSET, y: a.y + ny * OFFSET }
    const q = { x: b.x + nx * OFFSET, y: b.y + ny * OFFSET }
    const mid = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 }
    // Keep text upright: past vertical, flip it rather than let it read upside down.
    let deg = (Math.atan2(dy, dx) * 180) / Math.PI
    if (deg > 90) deg -= 180
    if (deg < -90) deg += 180
    const lx = mid.x + nx * GAP, ly = mid.y + ny * GAP
    return (
      <g key={key}>
        <line x1={p.x} y1={p.y} x2={q.x} y2={q.y} />
        <line x1={p.x - nx * T} y1={p.y - ny * T} x2={p.x + nx * T} y2={p.y + ny * T} />
        <line x1={q.x - nx * T} y1={q.y - ny * T} x2={q.x + nx * T} y2={q.y + ny * T} />
        <text
          x={lx} y={ly} fill="currentColor" stroke="none"
          fontSize="13" fontWeight="600" textAnchor="middle" dominantBaseline="middle"
          transform={`rotate(${deg.toFixed(2)} ${lx.toFixed(2)} ${ly.toFixed(2)})`}
        >{label}</text>
      </g>
    )
  }

  return (
    <svg
      viewBox={`0 0 ${DIM_W} ${DIM_H}`}
      className={`pointer-events-none absolute inset-0 h-full w-full ${TONE.sky.text}`}
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round">
        {/* ⚠️ The `side` on each is the OUTWARD normal and they are not all the
            same sign — for the downward vertical, -uy/ux points INTO the room, so
            height takes +1 while width takes -1. Getting it wrong puts the line
            on the wall face instead of outside it, which looks almost right and
            is easy to miss. Verified by compositing onto three real renders. */}
        {W > 0 && edge(leftTop, apex, `${fmt(W)} ft wide`, -1, 'w')}
        {H > 0 && edge(leftTop, leftBot, `${fmt(H)} ft high`, 1, 'h')}
        {L > 0 && edge(leftBot, floor, `${fmt(L)} ft long`, 1, 'l')}
      </g>
    </svg>
  )
}

/**
 * The room the customer is describing, under the readout in the right rail.
 *
 * Picked on step 2 and then held for the rest of the survey, so there is a
 * constant picture of the space while they answer questions about its walls,
 * doors and contents. It sits in the rail rather than the step column on purpose:
 * the rail is outside the AnimatePresence that swaps steps, so the image is not
 * unmounted and re-fetched on every Continue, and it does not re-animate.
 *
 * Renders nothing when the application is unpicked or unmapped. `natatorium` has
 * no pool artwork, so an indoor-pool survey shows no picture — deliberate, see
 * lib/rfq-renders.ts. Showing the wrong room would be worse than showing none.
 *
 * `sizes` is the rail width, not the intrinsic 1920 — without it next/image
 * requests a full-width source for a 290px slot.
 */
function ApplicationRender({ data }: { data: RfqData }) {
  const preset = presetFor(data)
  const asset = renderAsset('rooms', renderKeyForPreset(preset?.key) ?? '')
  if (!asset) return null

  const label = applicationLabel(data)
  const { L, W, H } = roomDims(data)
  // Process surveys have no room geometry to call out, so they never dimension.
  const dims = data.track === 'room' && (L > 0 || W > 0 || H > 0)

  // Both branches place the image absolutely inside a box whose aspect ratio is
  // known, so switching to the dimensioned layout does not reflow the rail.
  const box = dims
    ? { left: pct(DIM.padL, DIM_W), top: pct(DIM.padT, DIM_H), width: pct(DIM.imgW, DIM_W), height: pct(DIM.imgH, DIM_H) }
    : { left: '0%', top: '0%', width: '100%', height: '100%' }

  return (
    <HoverMagnify
      className="mt-4"
      origin="100% 50%"
      label={`Enlarge the ${label.toLowerCase()} illustration`}
    >
      <figure className="overflow-hidden rounded-2xl border border-hairline bg-surface">
        <div className="relative" style={{ aspectRatio: dims ? `${DIM_W} / ${DIM_H}` : '16 / 9' }}>
          <div className={`absolute overflow-hidden ${dims ? 'rounded-md' : ''}`} style={box}>
            {/* ⚠️ unoptimized on purpose. These assets were already resized and
                compressed ONCE, deliberately, by the upload script — 1920x1080
                webp at q82, about 60-125 KB. Running them through next/image
                re-encodes a second time at its default quality of 75 AND
                downscales to the layout width: measured, a 61 KB source came
                back as a 13 KB 640px JPEG. That is invisible at rest and very
                visible at 2x, which is the whole point of the magnifier. Serving
                the original costs a few tens of KB and is the sharpest this can
                be without new masters. */}
            <Image
              src={renderAssetUrl(asset)}
              alt={`Cutaway illustration of a typical ${label.toLowerCase()} space`}
              fill
              unoptimized
              draggable={false}
              className="select-none object-cover"
            />
          </div>
          {dims && <DimensionOverlay L={L} W={W} H={H} />}
        </div>
        <figcaption className="border-t border-hairline-soft px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            Your application
          </p>
          <p className="mt-1 text-[12.5px] leading-snug text-ink-secondary">{label}</p>
          <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
            A typical layout for this application, not a drawing of your site.
            {' '}Hover to enlarge.
          </p>
        </figcaption>
      </figure>
    </HoverMagnify>
  )
}

// LINE_BAR (the per-source color ramp for the load breakdown bars) was removed
// with the breakdown itself. Restore it alongside those bars if the moisture load
// ever comes back to the customer view.

function Stat({ label, value, unit, big }: { label: string; value: string; unit?: string; big?: boolean }) {
  return (
    <div>
      <p className="text-[11px] text-ink-muted">{label}</p>
      <p className={`${big ? 'text-[26px]' : 'text-[17px]'} font-semibold leading-tight tabular-nums tracking-tight text-ink`}>
        {value}
        {unit && <span className="ml-1 text-[11px] font-normal text-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}

// ─── Steps ────────────────────────────────────────────────────────────────────

type SetFn = <K extends keyof RfqData>(key: K, value: RfqData[K]) => void

function StepBody({
  step, data, set, setData, load, proc, onDownloadPreview, downloading,
}: {
  step: StepKey
  data: RfqData
  set: SetFn
  setData: React.Dispatch<React.SetStateAction<RfqData>>
  load: ReturnType<typeof estimateLoad>
  proc: ReturnType<typeof estimateProcess>
  onDownloadPreview: () => void
  downloading: boolean
}) {
  switch (step) {
    case 'application': return <StepApplication data={data} set={set} setData={setData} />
    case 'target':      return <StepTarget data={data} setData={setData} />
    case 'space':       return <StepSpace data={data} set={set} load={load} />
    case 'shell':       return <StepShell data={data} set={set} setData={setData} />
    case 'openings':    return <StepOpenings data={data} setData={setData} />
    case 'inside':      return <StepInside data={data} set={set} />
    case 'leaving':     return <StepLeaving data={data} set={set} setData={setData} proc={proc} />
    case 'airstream':   return <StepAirstream data={data} set={set} />
    case 'entering':    return <StepEntering data={data} set={set} setData={setData} />
    case 'unit':        return <StepUnit data={data} set={set} />
    case 'about':       return <StepAbout data={data} set={set} setData={setData} />
    case 'review':      return <StepReview data={data} load={load} proc={proc} onDownloadPreview={onDownloadPreview} downloading={downloading} />
  }
}

function StepApplication({
  data, set, setData,
}: { data: RfqData; set: SetFn; setData: React.Dispatch<React.SetStateAction<RfqData>> }) {
  const presets: (RoomPreset | ProcessPreset)[] = data.track === 'room' ? ROOM_PRESETS : PROCESS_PRESETS
  const chosen = presetFor(data)
  const other: Track = data.track === 'room' ? 'process' : 'room'
  return (
    <div className="space-y-5">
      {/* The fork promises you can change your mind; this is where that happens.
          Only on step one — past here the two tracks ask genuinely different
          questions, and a silent switch would strand half the answers. */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg bg-surface-soft px-3.5 py-2.5">
        <span className="text-[12.5px] text-ink-muted">
          You&apos;re surveying {data.track === 'room' ? 'a room or building' : 'a process airstream'}.
        </span>
        <button
          type="button"
          onClick={() => setData(d => ({ ...d, track: other, application: '', applicationOther: '' }))}
          className="text-[12.5px] font-medium text-brand-ink underline-offset-2 transition-colors hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          Switch to {other === 'room' ? 'a room' : 'a process'} instead
        </button>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        {presets.map(p => {
          const on = data.application === p.key
          return (
            <button
              key={p.key}
              type="button"
              onClick={() => setData(d => (
                data.track === 'room'
                  ? applyRoomPreset(d, p as RoomPreset)
                  : applyProcessPreset(d, p as ProcessPreset)
              ))}
              className={`rounded-xl border p-3.5 text-left transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                on
                  ? 'border-transparent bg-brand-soft ring-1 ring-emerald-200 dark:ring-emerald-500/30'
                  : 'border-hairline bg-surface hover:border-hairline-strong'
              }`}
            >
              <span className={`block text-[13.5px] font-semibold ${on ? 'text-brand-ink' : 'text-ink'}`}>{p.label}</span>
              <span className="mt-0.5 block text-[11.5px] leading-relaxed text-ink-muted">{p.blurb}</span>
            </button>
          )
        })}
      </div>

      {chosen && (
        <Callout tone="sky">
          <strong className="font-semibold">What we&apos;re protecting:</strong> {chosen.driver}. We&apos;ve
          pre-filled typical values for this application. Change anything that doesn&apos;t match your site.
        </Callout>
      )}

      {chosen?.key.startsWith('other') && (
        <TextField
          label="Tell us what it is"
          hint="A sentence is plenty: what the space or process does, and what the moisture is hurting."
          value={data.applicationOther}
          onChange={v => set('applicationOther', v)}
          placeholder="e.g. Ammunition primer assembly room"
          autoFocus
        />
      )}
    </div>
  )
}

function StepTarget({ data, setData }: { data: RfqData; setData: React.Dispatch<React.SetStateAction<RfqData>> }) {
  const preset = presetFor(data) as RoomPreset | undefined
  const elev = numOf(data.elevationFt)
  return (
    <div className="space-y-5">
      <ConditionField
        label="The condition you need held inside"
        tempLabel="Target temperature"
        data={data}
        conditionKey="target"
        onChange={setData}
        autoFocus
        typical={preset ? { tempF: preset.tempF, value: preset.rhPct, mode: 'rh' } : undefined}
      />

      <ConditionReadout
        tempF={numOf(data.targetTempF)}
        rhPct={numOf(data.targetRhPct)}
        elevationFt={elev}
        unit={data.tempUnit ?? 'F'}
      />

      {preset?.note && <Callout tone="sky">{preset.note}</Callout>}

      <Callout tone="amber">
        Answer in whichever unit your spec is written in. The four above are the same air, and we convert
        as you type. Grains and dew point are what actually size equipment:{' '}
        <strong className="font-semibold">30% rh</strong> is a very different amount of water at 50°F than
        at 90°F, while a dew point does not move when the temperature does.
      </Callout>
    </div>
  )
}

function StepSpace({ data, set, load }: { data: RfqData; set: SetFn; load: ReturnType<typeof estimateLoad> }) {
  const sizeMode = normalizeRoomSizeMode(data.roomSizeMode)
  const dims = roomDims(data)
  return (
    <div className="space-y-5">
      <Segmented
        label="How do you know the size?"
        hint="Plenty of people know a building by its volume and would have to go and measure to answer length × width × height. Either is fine."
        value={sizeMode}
        onChange={v => set('roomSizeMode', v)}
        options={ROOM_SIZE_MODES}
      />

      {sizeMode === 'volume' ? (
        <>
          <Grid cols={2}>
            <TextField label="Volume" value={data.roomVolumeCuFt} onChange={v => set('roomVolumeCuFt', v)} type="number" suffix="cu.ft" autoFocus />
            <TextField label="Ceiling height" value={data.roomH} onChange={v => set('roomH', v)} type="number" suffix="ft"
              placeholder={String(DEFAULT_CEILING_FT)} />
          </Grid>
          {/* Not a nicety — the load depends on envelope AREA, not just volume, and
              a single number cannot give us that. Saying so is the difference
              between an assumption and a silent guess. */}
          <Callout tone="amber">
            Volume alone does not size a system — moisture comes through the walls, ceiling and
            floor, so we need their <strong className="font-semibold">area</strong>. We assume a
            square floor at your ceiling height
            {numOf(data.roomVolumeCuFt) > 0 && (
              <> — about <strong className="font-semibold">{fmt(dims.L)} × {fmt(dims.W)} ft</strong> at{' '}
                <strong className="font-semibold">{fmt(dims.H)} ft</strong></>
            )}
            . If the space is long and narrow it has more wall than that, and the real figure will
            be higher. Enter dimensions instead if you know them.
          </Callout>
        </>
      ) : (
        <Grid cols={3}>
          <TextField label="Length" value={data.roomL} onChange={v => set('roomL', v)} type="number" suffix="ft" autoFocus />
          <TextField label="Width" value={data.roomW} onChange={v => set('roomW', v)} type="number" suffix="ft" />
          <TextField label="Height" value={data.roomH} onChange={v => set('roomH', v)} type="number" suffix="ft" />
        </Grid>
      )}

      {/* Same wash as every other readout on the survey. It was hardcoded violet
          rather than going through TONE, which is how it survived the palette being
          cut down. */}
      {load.volumeCuFt > 0 && (
        <div className={`grid grid-cols-2 gap-3 rounded-xl p-4 sm:grid-cols-3 ${TONE.sky.softBg}`}>
          <Stat label="Floor area" value={fmt(dims.L * dims.W)} unit="sq.ft" />
          <Stat label="Volume" value={fmt(load.volumeCuFt)} unit="cu.ft" />
          <Stat label="Wall area" value={fmt(2 * (dims.L + dims.W) * dims.H)} unit="sq.ft" />
        </div>
      )}

      {/* Project location + elevation moved to the first step (`about`): elevation
          feeds grains and dew point, so it has to be known before any of the
          numbers this wizard shows mean anything. */}

      <Callout tone="sky">
        If the space isn&apos;t a simple box, give us the overall footprint and mention the shape in the notes
        at the end. We&apos;d rather start from a rough number than no number.
      </Callout>
    </div>
  )
}

/**
 * Three wall build-ups, shown before the material dropdowns.
 *
 * Envelope questions are the ones customers guess at — most people know what their
 * building looks like and not what a permeance rating is. A picture they can point
 * at gets a better answer than a longer hint would.
 *
 * ⚠️ Order is Good → Better → Best and comes from the FILE NAMES, which do not match
 * the order the images were sent: 'Good' is the brick build-up, 'Best' is the
 * insulated metal panel. Verified by opening each file. Do not reorder from memory.
 *
 * Sources are 1448x1086 PNGs (~1.2MB each) in the owner's Downloads; these are
 * 900px webp derivatives at 24-36KB, generated with sharp.
 */
const SHELL_EXAMPLES = [
  {
    label: 'Good',
    src: '/rfq/shell-good.webp',
    alt: 'Cut-away of a brick wall: brick veneer, a black vapor barrier, wood sheathing, insulated wood studs, and an inner face carrying two coats of vapor proof paint.',
  },
  {
    label: 'Better',
    src: '/rfq/shell-better.webp',
    alt: 'Cut-away of a metal-clad wall: corrugated steel siding, insulated steel studs, and an inner face carrying two coats of vapor proof paint.',
  },
  {
    label: 'Best',
    src: '/rfq/shell-best.webp',
    alt: 'Cut-away of a metal-clad wall: corrugated steel siding, insulated steel studs, and an insulated metal panel (IMP) forming the inner face.',
  },
] as const

function StepShell({
  data, set, setData,
}: { data: RfqData; set: SetFn; setData: React.Dispatch<React.SetStateAction<RfqData>> }) {
  const preset = presetFor(data) as RoomPreset | undefined

  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
          Typical wall build-ups
        </p>
        {/* Hover magnifies to 2x so the callouts on the artwork are readable — at a
            third of the row they render around 7px and simply cannot be. The whole
            FIGURE scales, not the image inside it: the figure owns the rounded clip,
            so scaling the image alone would just crop it.

            transform-origin is pinned per column so the outer two grow INWARD rather
            than off the edge of the panel. Enabled from the sm breakpoint up only —
            there is no hover on touch, and at phone width these are already
            full-bleed. tabIndex + focus-visible gives the same magnification to
            anyone using a keyboard. */}
        <div className="grid gap-3 sm:grid-cols-3">
          {SHELL_EXAMPLES.map((x, i) => (
            <figure
              key={x.label}
              tabIndex={0}
              className={[
                'group relative z-0 overflow-hidden rounded-xl border border-hairline bg-surface',
                'transition-transform duration-200 ease-out',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
                'sm:hover:z-20 sm:hover:scale-[2] sm:focus-visible:z-20 sm:focus-visible:scale-[2]',
                // Where each card grows FROM at 2x. transform-origin names the point that
                // stays put, so the growth goes the other way: origin-left pins the left
                // edge and expands rightward.
                //
                // The outer two lean OUTWARD a quarter of the extra width and inward for
                // the rest (owner, 2026-08-20) — Good spreads left, Best spreads right,
                // Better stays centered. Pure origin-left/right would send them fully
                // inward across their neighbours, which is what they did at first.
                //
                // A quarter of one card is roughly 55px past the panel edge; no ancestor
                // sets overflow-hidden, so it is visible rather than clipped.
                i === 0 ? 'sm:origin-[25%_50%]'
                  : i === SHELL_EXAMPLES.length - 1 ? 'sm:origin-[75%_50%]'
                    : 'sm:origin-center',
              ].join(' ')}
            >
              {/* The artwork is drawn on white and stays on white in dark mode —
                  inverting it would misrepresent the materials. */}
              <Image
                src={x.src}
                alt={x.alt}
                width={900}
                height={675}
                sizes="(max-width: 640px) 100vw, 33vw"
                className="h-auto w-full bg-white"
              />
              <figcaption className="border-t border-hairline px-3 py-2 text-[12px] font-medium text-ink-secondary">
                {x.label}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
          Pick the closest match below. These are the three we see most often.
          <span className="hidden sm:inline"> Hover over one to enlarge it.</span>
        </p>
      </div>

      <Grid>
        <SelectField label="Walls" value={data.wallMaterial} onChange={v => set('wallMaterial', v)} options={WALL_MATERIALS.filter(m => !m.retired).map(m => m.label)} />
        <SelectField label="Roof / ceiling" value={data.ceilingMaterial} onChange={v => set('ceilingMaterial', v)} options={CEILING_MATERIALS.filter(m => !m.retired).map(m => m.label)} />
      </Grid>
      <SelectField label="Floor" value={data.floorMaterial} onChange={v => set('floorMaterial', v)} options={FLOOR_MATERIALS.filter(m => !m.retired).map(m => m.label)} />

      {/* ⚠️ BOTH OF THESE SIT ON THE PAGE, NOT BEHIND A DISCLOSURE (owner, 2026-08-25).
          They were collapsed under an "Advanced" button; the owner asked for them
          back in front of everybody, which is where they started.

          Both feed estimateLoad and both carry a LIVE DEFAULT — `vaporBarrier` is
          only ever tested `=== 'Yes'`, and `tightness` sets the whole infiltration term
          (Loose is exactly 6x Tight). Hiding a question whose default is already
          costing the customer money is the shape of bug this survey has hit twice:
          on 2026-08-19 tightness was commented out while it kept pricing every
          survey at average leakage, an assumption nobody was asked to confirm.
          Do not put either back behind a toggle. */}
      <Segmented<VaporBarrier>
        label="Is there a vapor barrier?"
        hint="Class I is polyethylene, Class II is kraft-faced batt, Class III is latex-painted gypsum."
        tone="sky"
        value={data.vaporBarrier}
        onChange={v => set('vaporBarrier', v)}
        options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }]}
      />

      <div>
        <Segmented<Tightness>
          label="How tight is the building?"
          tone="sky"
          value={data.tightness}
          onChange={v => set('tightness', v)}
          options={[
            { value: 'Tight', label: 'Tight' },
            { value: 'Average', label: 'Average' },
            { value: 'Loose', label: 'Loose' },
          ]}
        />
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">{TIGHTNESS_HELP[data.tightness]}</p>
      </div>


      <div className="space-y-4 rounded-xl border border-hairline bg-surface-soft p-4">
        <ConditionField
          label="The space around the room"
          hint="Moisture pushes in from whatever is on the other side of the wall, usually the rest of the plant rather than the weather."
          tempLabel="Surrounding temperature"
          data={data}
          conditionKey="surround"
          onChange={setData}
          typical={preset ? { tempF: preset.surroundTempF, value: preset.surroundRhPct, mode: 'rh' } : undefined}
        />
        <ConditionField
          label="Outdoor summer design"
          hint="The worst day the system has to hold. We confirm against ASHRAE design data for your location."
          tempLabel="Outdoor temperature"
          data={data}
          conditionKey="outdoor"
          onChange={setData}
        />
      </div>
    </div>
  )
}

function StepOpenings({ data, setData }: { data: RfqData; setData: React.Dispatch<React.SetStateAction<RfqData>> }) {
  const add = (type: typeof DOOR_TYPES[number]) => {
    setData(d => ({
      ...d,
      doors: [...d.doors, {
        id: `d${Date.now()}`,
        label: type.label,
        widthFt: type.widthFt,
        heightFt: type.heightFt,
        opensPerHour: 6,
        secondsOpen: type.secondsOpen,
        exposure: 'Surrounding space' as Exposure,
      }],
    }))
  }
  const update = (id: string, patch: Partial<DoorSpec>) =>
    setData(d => ({ ...d, doors: d.doors.map(x => (x.id === id ? { ...x, ...patch } : x)) }))
  const remove = (id: string) =>
    setData(d => ({ ...d, doors: d.doors.filter(x => x.id !== id) }))

  return (
    <div className="space-y-5">
      <Callout tone="amber">
        In most real buildings this one step outweighs walls, people and product combined. Every time a door
        opens, a slug of wet air walks in. Rough numbers are fine. A guess beats a blank.
      </Callout>

      <div className="space-y-3">
        {data.doors.map(door => (
          <div key={door.id} className="rounded-xl border border-hairline bg-surface-soft p-4">
            <div className="mb-3 flex items-center gap-2">
              <DoorOpen size={15} className="text-ink-muted" />
              <input
                value={door.label}
                onChange={e => update(door.id, { label: e.target.value })}
                className="flex-1 rounded-md bg-transparent px-1 py-0.5 text-[13.5px] font-semibold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
              />
              <button
                type="button"
                onClick={() => remove(door.id)}
                className="text-[12px] text-ink-muted transition-colors hover:text-rose-600 dark:hover:text-rose-400"
              >
                Remove
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <NumField label="Width (ft)" value={door.widthFt} onChange={v => update(door.id, { widthFt: v })} />
              <NumField label="Height (ft)" value={door.heightFt} onChange={v => update(door.id, { heightFt: v })} />
              <NumField label="Opens per hour" value={door.opensPerHour} onChange={v => update(door.id, { opensPerHour: v })} />
              <NumField label="Seconds open" value={door.secondsOpen} onChange={v => update(door.id, { secondsOpen: v })} />
            </div>
            <div className="mt-3">
              <Segmented<Exposure>
                tone="sky"
                value={door.exposure}
                onChange={v => update(door.id, { exposure: v })}
                options={[
                  { value: 'Surrounding space', label: 'Opens to Surrounding' },
                  { value: 'Outdoor', label: 'Opens to outside' },
                ]}
              />
            </div>
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-[12.5px] font-medium text-ink-secondary">Add an opening</p>
        <div className="flex flex-wrap gap-1.5">
          {DOOR_TYPES.map(t => (
            <button
              key={t.label}
              type="button"
              onClick={() => add(t)}
              className="rounded-lg border border-hairline bg-surface px-3 py-1.5 text-[12.5px] text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            >
              + {t.label}
            </button>
          ))}
        </div>
        {!data.doors.length && (
          <p className="mt-3 text-[12px] text-ink-muted">
            No openings? That&apos;s unusual but perfectly valid for a sealed vessel or vault. Carry on.
          </p>
        )}
      </div>
    </div>
  )
}

function NumField({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const id = useId()
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] text-ink-muted">{label}</label>
      <input
        id={id}
        type="number"
        value={Number.isFinite(value) ? value : ''}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className="w-full rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[13px] tabular-nums text-ink transition-colors hover:border-hairline-strong focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
      />
    </div>
  )
}

function StepInside({ data, set }: { data: RfqData; set: SetFn }) {
  const preset = presetFor(data) as RoomPreset | undefined
  const people = numOf(data.occupants)

  // Open the advanced block on arrival if any of its fields already carry a value,
  // so a returning customer is never shown a step that silently hides what they
  // typed. The initialiser runs once per mount, which is exactly the moment we
  // want to decide — typing inside the block must not re-evaluate and fight them.
  const advancedFilled = [
    data.productLoadLbHr, data.productDescription, data.wetAreaSqFt,
    data.gasCfh, data.ventCfm, data.exhaustCfm,
  ].some(v => (v ?? '').trim() !== '')
  const [advancedOpen, setAdvancedOpen] = useState(advancedFilled)

  return (
    <div className="space-y-5">
      {/* items-start, because the left cell carries a "typical" chip under its input
          and the right cell a conditional hint under its select. Left to stretch,
          the two cells matched heights and the fields drifted out of line with each
          other as those extras appeared and disappeared. */}
      <div className="grid items-start gap-4 sm:grid-cols-2">
        <div>
          <TextField label="How many people, typically?" value={data.occupants} onChange={v => set('occupants', v)} type="number" suffix="people" autoFocus />
          {preset && (
            <Typical
              label={`${preset.occupants}`}
              used={data.occupants === String(preset.occupants)}
              onUse={() => set('occupants', String(preset.occupants))}
            />
          )}
        </div>
        <SelectField
          label="What are they doing?"
          hint={people > 0 ? `${fmt(PEOPLE_LOADS[data.activity])} gr/hr each, ${fmt(people * PEOPLE_LOADS[data.activity])} gr/hr in total.` : undefined}
          value={data.activity}
          onChange={v => set('activity', v as ActivityLevel)}
          options={Object.keys(PEOPLE_LOADS)}
        />
      </div>

      {/* Why the two questions above are worth asking. People are the load
          customers most often wave off as negligible, and a number in gr/hr does
          not land the way a sweating panda does. The artwork carries its own
          callouts, so it needs to be readable — hence hover-to-enlarge, the same
          idiom as the wall build-ups on step 5 and the render in the rail.
          Centered origin here: this sits mid-column with room on both sides. */}
      <div className="flex items-center gap-5 rounded-xl border border-hairline bg-surface-soft p-4">
        {/* Same reasoning as the room render, and it matters more here: this
            artwork carries its own callout text, and text is what a lossy pass
            destroys first. Stored at 760px wide / q92, which comfortably covers
            the ~634 device pixels full magnification needs — but only if the
            image is laid out at that size, which is what CrispMagnifyImage does.
            Resting footprint is unchanged at 112/132px. */}
        <CrispMagnifyImage
          src="/rfq/panda-moisture.webp"
          alt="Illustration: people give off moisture both by exhaling and by perspiring, the amount depending on their activity level and the conditions around them."
          width={760}
          height={1013}
          scale={2.4}
          rest="h-[149px] w-[112px] sm:h-[176px] sm:w-[132px]"
          full="w-[269px] sm:w-[317px]"
          label="Enlarge the illustration of how people add moisture"
        />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            Why people count
          </p>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-secondary">
            Every person in the room is a small humidifier. They add water twice over, once
            breathing it out and again through the skin, and the harder they are working the
            more of it there is.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            A crew of ten doing moderate work puts out about{' '}
            <strong className="font-medium text-ink-secondary">
              {fmt(10 * PEOPLE_LOADS['Moderate Work'])} gr/hr
            </strong>
            , which is why the headcount above changes the answer. Hover the picture to enlarge it.
          </p>
        </div>
      </div>

      {/* Everything below is optional detail that most rooms never need. Folded
          behind one control so the step reads as two questions rather than nine.
          A real <button> with aria-expanded/aria-controls, not a styled div, so it
          announces its state. */}
      <div>
        <button
          type="button"
          onClick={() => setAdvancedOpen(o => !o)}
          aria-expanded={advancedOpen}
          aria-controls="rfq-inside-advanced"
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3.5 text-[12.5px] font-medium text-ink-secondary transition-colors hover:bg-surface-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          <ChevronDown size={14} className={`transition-transform ${advancedOpen ? 'rotate-180' : ''}`} />
          Advanced
          {!advancedOpen && (
            <span className="text-[11.5px] text-ink-muted">
              product moisture, open water, ventilation
            </span>
          )}
        </button>
      </div>

      {advancedOpen && (
      <div id="rfq-inside-advanced" className="space-y-5">
      <div className="rounded-xl border border-hairline bg-surface-soft p-4">
        <p className="text-[12.5px] font-medium text-ink-secondary">Moisture from product or process</p>
        <p className="mt-0.5 mb-3 text-[11.5px] leading-relaxed text-ink-muted">
          Water coming off wet product, packaging, washdown or a process. If you know it in gallons per hour,
          multiply by 8.34 to get pounds per hour.
        </p>
        <Grid>
          <TextField label="Water released" value={data.productLoadLbHr} onChange={v => set('productLoadLbHr', v)} type="number" suffix="lb/hr" />
          <TextField label="From what?" value={data.productDescription} onChange={v => set('productDescription', v)} placeholder="Wet cardboard, washdown, castings…" />
        </Grid>
      </div>

      <Grid>
        <TextField
          label="Open water surface"
          hint="Tanks, basins, pools, wet floors after washdown."
          value={data.wetAreaSqFt}
          onChange={v => set('wetAreaSqFt', v)}
          type="number"
          suffix="sq.ft"
        />
        <TextField
          label="Unvented gas burners"
          hint="Open flame in the space. Vented equipment doesn't count."
          value={data.gasCfh}
          onChange={v => set('gasCfh', v)}
          type="number"
          suffix="cu.ft/hr"
        />
      </Grid>

      <div className="rounded-xl border border-hairline bg-surface-soft p-4">
        <p className="text-[12.5px] font-medium text-ink-secondary">Ventilation and exhaust</p>
        <p className="mt-0.5 mb-3 text-[11.5px] leading-relaxed text-ink-muted">
          Fresh air brought in for people or to replace what hoods and fans pull out. ASHRAE 62 asks for
          roughly 15–25 cfm per person.
        </p>
        <Grid>
          <TextField label="Fresh air supplied" value={data.ventCfm} onChange={v => set('ventCfm', v)} type="number" suffix="cfm" />
          <TextField label="Air exhausted" value={data.exhaustCfm} onChange={v => set('exhaustCfm', v)} type="number" suffix="cfm" />
        </Grid>
      </div>
      </div>
      )}

      <Callout tone="sky">
        Nothing here applies? Leave it all blank. An empty field is an honest answer and we&apos;ll say so on
        the survey rather than inventing a number.
      </Callout>
    </div>
  )
}

function StepLeaving({
  data, set, setData, proc,
}: {
  data: RfqData; set: SetFn
  setData: React.Dispatch<React.SetStateAction<RfqData>>
  proc: ReturnType<typeof estimateProcess>
}) {
  const preset = presetFor(data) as ProcessPreset | undefined
  return (
    <div className="space-y-5">
      <ConditionField
        label="The condition you need off the dehumidifier"
        tempLabel="Leaving air temperature"
        data={data}
        conditionKey="leaving"
        onChange={setData}
        autoFocus
        typical={preset ? { tempF: preset.leavingTempF, value: preset.leavingGrains, mode: 'gr' } : undefined}
      />

      {numOf(data.leavingGrains) > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-sky-50/60 p-4 dark:bg-sky-500/5 sm:grid-cols-4">
          <Stat label="Temperature" value={`${fmt(numOf(data.leavingTempF))}°F`} />
          <Stat label="Grains" value={fmtGrains(proc.leavingGrains)} unit="gr/lb" />
          <Stat label="Dew point" value={fmtDewPoint(proc.leavingDewPointF)} />
          <Stat label="At leaving temp" value={`${fmt(proc.leavingRhPct, 1)}%`} unit="rh" />
        </div>
      )}

      {preset?.note && <Callout tone="sky">{preset.note}</Callout>}

      <TextArea
        label="What is the air doing?"
        hint="The process, the problem it solves, and any tolerance you have to hold."
        value={data.purpose}
        onChange={v => set('purpose', v)}
        placeholder="Supply to two coating pans; product blushes above 45% rh in the room…"
      />
    </div>
  )
}

function StepAirstream({ data, set }: { data: RfqData; set: SetFn }) {
  const preset = presetFor(data) as ProcessPreset | undefined
  return (
    <div className="space-y-5">
      <div>
        <TextField label="Process airflow" value={data.processCfm} onChange={v => set('processCfm', v)} type="number" suffix="cfm" autoFocus />
        {preset && (
          <Typical label={`${fmt(preset.cfm)} cfm`} used={data.processCfm === String(preset.cfm)} onUse={() => set('processCfm', String(preset.cfm))} />
        )}
      </div>

      <Segmented
        label="Where does that air come from?"
        tone="sky"
        value={data.airSource}
        onChange={v => set('airSource', v)}
        options={AIR_SOURCES.map(a => ({ value: a, label: a }))}
      />

      {data.airSource.startsWith('Mixed') && (
        <TextField label="Outdoor air fraction" value={data.mixOutdoorPct} onChange={v => set('mixOutdoorPct', v)} type="number" suffix="% OA" />
      )}

      <Callout tone="sky">
        Don&apos;t know the airflow yet? Put in your best guess and say so in the notes. We&apos;ll work it
        back from the drying job once we talk.
      </Callout>
    </div>
  )
}

function StepEntering({
  data, set, setData,
}: { data: RfqData; set: SetFn; setData: React.Dispatch<React.SetStateAction<RfqData>> }) {
  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-hairline bg-surface-soft p-4">
        <ConditionField
          label="Return / room air"
          hint="The condition of the air coming back to the unit from the space."
          data={data}
          conditionKey="surround"
          onChange={setData}
          autoFocus
        />
      </div>

      <div className="rounded-xl border border-hairline bg-surface-soft p-4">
        <ConditionField
          label="Outdoor summer design"
          hint="The worst day the unit has to hold. We confirm against ASHRAE design data for your location."
          data={data}
          conditionKey="outdoor"
          onChange={setData}
        />
      </div>

      {/* Location + elevation now live on the first step — see ROOM_FLOW. */}
    </div>
  )
}

function StepUnit({ data, set }: { data: RfqData; set: SetFn }) {
  return (
    <div className="space-y-5">
      <Grid>
        <SelectField label="Where does the unit go?" value={data.installLocation} onChange={v => set('installLocation', v)} options={INSTALL_LOCATIONS} />
        <SelectField label="Cabinet construction" value={data.construction} onChange={v => set('construction', v)} options={CONSTRUCTIONS} />
      </Grid>

      <div className="rounded-xl border border-hairline bg-surface-soft p-4">
        <p className="mb-3 text-[12.5px] font-medium text-ink-secondary">Utilities at the unit</p>
        <Grid>
          <SelectField label="Electrical service" value={data.voltage} onChange={v => set('voltage', v)} options={VOLTAGES} />
          <SelectField label="Regeneration heat" value={data.regenSource} onChange={v => set('regenSource', v)} options={REGEN_SOURCES} />
        </Grid>
        {/* "Natural gas available?" removed at the owner's request — the field went
            with it rather than being left to record a default nobody chose. */}
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <TextField label="Chilled water" value={data.chilledWaterEwt} onChange={v => set('chilledWaterEwt', v)} type="number" suffix="°F EWT" />
          <TextField label="Hot water" value={data.hotWaterEwt} onChange={v => set('hotWaterEwt', v)} type="number" suffix="°F EWT" />
          <TextField label="Steam" value={data.steamPsi} onChange={v => set('steamPsi', v)} type="number" suffix="psi" />
        </div>
      </div>

      <Grid>
        <SelectField label="Regeneration air source" value={data.regenAirSource} onChange={v => set('regenAirSource', v)} options={['Outdoor', 'Indoor']} />
        <SelectField label="Cooling" value={data.coolingType} onChange={v => set('coolingType', v)} options={COOLING_TYPES} />
      </Grid>

      {data.regenAirSource === 'Indoor' && (
        <TextField
          label="Indoor regeneration air condition"
          hint="Temperature and humidity where the regeneration air is drawn from."
          value={data.regenIndoorConditions}
          onChange={v => set('regenIndoorConditions', v)}
          placeholder="85°F / 55% rh in the mezzanine"
        />
      )}

      {/* "Package preference" removed entirely (owner, 2026-08-19), so Heating pairs
          with Pre-filter here rather than leaving a half-empty row. */}
      <Grid>
        <SelectField label="Heating" value={data.heatingType} onChange={v => set('heatingType', v)} options={HEATING_TYPES} />
        <SelectField label="Pre-filter" value={data.prefilterMerv} onChange={v => set('prefilterMerv', v)} options={MERV_OPTIONS} />
      </Grid>

      <Grid>
        <SelectField label="Final filter" value={data.finalMerv} onChange={v => set('finalMerv', v)} options={FINAL_FILTER_OPTIONS} />
      </Grid>

      <Segmented
        label="Is the environment clean or dirty?"
        tone="sky"
        value={data.environmentClean}
        onChange={v => set('environmentClean', v)}
        options={[{ value: 'Clean', label: 'Clean' }, { value: 'Dirty', label: 'Dirty' }]}
      />
      {data.environmentClean === 'Dirty' && (
        <TextField
          label="What's in the air?"
          hint="Corrosive chemicals, fumes, dust or salt all change the cabinet and the wheel."
          value={data.contaminants}
          onChange={v => set('contaminants', v)}
          placeholder="Chlorine wash-down, flour dust…"
        />
      )}

      <Grid>
        <SelectField label="Operating schedule" value={data.runtime} onChange={v => set('runtime', v)} options={RUNTIMES} />
        <TextField label="Size or weight limits" value={data.sizeRestrictions} onChange={v => set('sizeRestrictions', v)} placeholder="Must fit a 7ft door, 4,000 lb roof limit…" />
      </Grid>

      <TextField
        label="Sensible heating / cooling load, if known"
        hint="Only if the unit is expected to condition the space as well as dry it."
        value={data.sensibleLoadBtuh}
        onChange={v => set('sensibleLoadBtuh', v)}
        type="number"
        suffix="BTU/hr"
      />
    </div>
  )
}

/**
 * The `design` block returned by /api/rfq/elevation — the ASHRAE record for the
 * station nearest the site. Absent whenever no station was within range or the
 * lookup failed, which is why every consumer treats it as optional.
 */
type DesignLookup = {
  station: string
  wmo: string
  distanceMi: number
  version: string
  period: string
  stationElevationFt: number
  dehumDewPointF: number
  dehumGrains: number
  dehumMcdbF: number
  coolingDbF: number | null
  coolingMcwbF: number | null
  heatingDbF: number | null
}

/**
 * Site location, elevation and outdoor design conditions, all resolved from what
 * they typed.
 *
 * The lookup is a CONVENIENCE, never a dependency: the fields stay hand-editable
 * and a failure says so quietly and changes nothing. Elevation feeds grains and dew
 * point, so a wrong number here is wrong everywhere downstream — which is exactly
 * why the server resolves it from geodetic surveys rather than guessing.
 *
 * It also fills the OUTDOOR DESIGN CONDITION, which until now was seeded at
 * 95°F/55%rh for every survey ever submitted and never asked about on the room
 * track — a national placeholder quietly setting the ventilation and infiltration
 * load on every quote. It is now the site's own ASHRAE 0.4% dehumidification
 * design point, and it is shown on the page rather than filled in silently: it
 * moves the quoted load, and it comes from a station that may be tens of miles
 * away, so the customer needs to be able to see it to disagree with it.
 */
function SiteLocation({ data, set, setData }: {
  data: RfqData; set: SetFn; setData: React.Dispatch<React.SetStateAction<RfqData>>
}) {
  const [state, setState] = useState<'idle' | 'looking' | 'done' | 'failed'>('idle')
  const [matched, setMatched] = useState('')
  const [design, setDesign] = useState<DesignLookup | null>(null)

  const lookup = useCallback(async () => {
    const q = data.location.trim()
    if (q.length < 2) return
    setState('looking')
    setMatched('')
    setDesign(null)
    try {
      const res = await fetch(`/api/rfq/elevation?q=${encodeURIComponent(q)}`)
      const j = await res.json()
      if (!res.ok || !j?.ok || typeof j.elevationFt !== 'number') {
        setState('failed')
        return
      }

      // The design half is optional and independent: no station within range, or
      // the site being unreachable, must still leave a working elevation lookup.
      const d: DesignLookup | null =
        j.design && typeof j.design.dehumGrains === 'number' && typeof j.design.dehumMcdbF === 'number'
          ? j.design as DesignLookup
          : null

      setData(prev => {
        // ONE update, elevation first. setCondition converts between grains and
        // rh AT an elevation, so applying the outdoor condition against the old
        // elevation and then moving the elevation underneath it would store a
        // humidity that was never true anywhere.
        const withElev = { ...prev, elevationFt: String(j.elevationFt) }
        if (!d) return withElev
        return {
          ...setCondition(withElev, 'outdoor', {
            tempF: String(d.dehumMcdbF),
            value: String(d.dehumGrains),
            mode: 'gr',
          }),
          // No edition year here: this string is what the customer reads, in the
          // wizard and on their PDF. The vintage rides on its own field for staff.
          outdoorSource: `ASHRAE · ${d.station} · ${d.distanceMi} mi`,
          outdoorVintage: `ASHRAE ${d.version}${d.period ? `, ${d.period} observations` : ''}`,
        }
      })

      setMatched(String(j.matched ?? ''))
      setDesign(d)
      setState('done')
    } catch {
      setState('failed')
    }
  }, [data.location, setData])

  const canLookUp = data.location.trim().length >= 2 && state !== 'looking'

  return (
    <div className="rounded-xl border border-hairline bg-surface-soft p-4">
      <p className="mb-3 text-[12.5px] font-medium text-ink-secondary">Where the equipment is going</p>
      <Grid>
        {/* The button and its result sit under PROJECT LOCATION, not under elevation
            (moved 2026-08-20). Location is what it reads, and elevation is only one
            of the things it fills — the design conditions below are the rest. Under
            the elevation field it looked like an elevation-only control, which is
            what it used to be. */}
        <div>
          <TextField
            label="Project location"
            hint="City and state, or a ZIP. It sets the weather we design against."
            value={data.location}
            onChange={v => { set('location', v); setState('idle') }}
            placeholder="Covington, GA"
          />
          <button
            type="button"
            onClick={lookup}
            disabled={!canLookUp}
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-emerald-200 bg-brand-soft px-3 text-[12px] font-medium text-brand-ink transition-colors hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand dark:border-emerald-500/30 dark:hover:bg-emerald-500/20"
          >
            {state === 'looking'
              ? <><Loader2 size={13} className="animate-spin" /> Looking up…</>
              : <><MapPin size={13} /> Look up site conditions</>}
          </button>
          {state === 'done' && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
              {matched ? `${matched}. ` : ''}Elevation filled in from survey data. Edit it if you
              know better.
            </p>
          )}
          {state === 'failed' && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
              Couldn&apos;t find that one. Type the elevation, or leave it and we&apos;ll confirm it with you.
            </p>
          )}
        </div>
        <TextField
          label="Elevation"
          hint="Type it, or fill it from the location."
          value={data.elevationFt}
          onChange={v => { set('elevationFt', v); setState('idle') }}
          type="number"
          suffix="ft ASL"
        />
      </Grid>

      {/* The design conditions are stated outright rather than filled in silently.
          They move the quoted load, they come from a station that may be tens of
          miles away, and a customer who knows their site is wetter than the airport
          can only say so if they can see what we assumed. */}
      {state === 'done' && design && (
        <div className="mt-3 rounded-lg border border-hairline bg-surface p-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">
            Outdoor design conditions
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1.5">
            <Stat label="Summer design" value={fmt(design.dehumMcdbF, 1)} unit="°F db" />
            <Stat label="Moisture" value={fmt(design.dehumGrains, 1)} unit="gr/lb" />
            <Stat label="Dew point" value={fmt(design.dehumDewPointF, 1)} unit="°F" />
            {typeof design.heatingDbF === 'number' && (
              <Stat label="Winter design" value={fmt(design.heatingDbF, 1)} unit="°F db" />
            )}
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-ink-muted">
            ASHRAE 0.4% design, {design.station.toLowerCase()}, {design.distanceMi} miles away. This is
            what the estimate is sized against. Tell us if your site runs wetter.
          </p>
        </div>
      )}
    </div>
  )
}


function StepAbout({ data, set, setData }: {
  data: RfqData; set: SetFn; setData: React.Dispatch<React.SetStateAction<RfqData>>
}) {
  return (
    <div className="space-y-5">
      <Grid>
        <TextField label="Your name" value={data.contactName} onChange={v => set('contactName', v)} autoFocus required />
        <TextField label="Company" value={data.company} onChange={v => set('company', v)} required />
      </Grid>
      <Grid>
        <TextField label="Email" value={data.email} onChange={v => set('email', v)} type="email" placeholder="you@company.com" required />
        <TextField
          label="Phone"
          value={data.phone}
          onChange={v => set('phone', v)}
          type="tel"
          required
          hint="A quote is a conversation, and we will almost always need to ask you something."
        />
      </Grid>

      <SiteLocation data={data} set={set} setData={setData} />

      <div className="rounded-xl border border-hairline bg-surface-soft p-4">
        <p className="mb-3 text-[12.5px] font-medium text-ink-secondary">The project</p>
        <Grid>
          <TextField label="Project name" value={data.projectName} onChange={v => set('projectName', v)} placeholder="Building 4 dry storage" />
          <TextField label="End user / owner" value={data.endUser} onChange={v => set('endUser', v)} />
        </Grid>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Quote needed by" value={data.dateRequired} onChange={v => set('dateRequired', v)} type="date" />
          <TextField label="Expected order date" value={data.dateClose} onChange={v => set('dateClose', v)} type="date" />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <TextField label="Engineering firm, if any" value={data.engineeringFirm} onChange={v => set('engineeringFirm', v)} />
          <TextField label="Engineer's email or phone" value={data.engineerContact} onChange={v => set('engineerContact', v)} />
        </div>
      </div>

      {data.track === 'room' && (
        <TextArea
          label="What's the project trying to achieve?"
          hint="A sentence or two. The purpose steers every design decision we make."
          value={data.purpose}
          onChange={v => set('purpose', v)}
          placeholder="Stop condensation on finished parts in the north bay through the summer."
        />
      )}

      <TextArea
        label="Anything else we should know?"
        hint="Drawings, site constraints, an existing unit being replaced, a spec you're working to."
        value={data.notes}
        onChange={v => set('notes', v)}
        rows={3}
      />
    </div>
  )
}

function StepReview({
  data, load, proc, onDownloadPreview, downloading,
}: {
  data: RfqData
  load: ReturnType<typeof estimateLoad>
  proc: ReturnType<typeof estimateProcess>
  onDownloadPreview: () => void
  downloading: boolean
}) {
  const isRoom = data.track === 'room'
  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-emerald-50/60 p-5 dark:bg-emerald-500/5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-emerald-700 dark:text-emerald-400">
          Your survey in one line
        </p>
        <p className="mt-2 text-[16px] font-semibold leading-snug tracking-tight text-ink">
          {/* The lb/hr water figure used to close both of these sentences. Withheld
              from the customer for the same reason it left the readout — it reads as
              a selection when it is a planning estimate. Still calculated and still
              sent to our desk in `summary`. */}
          {isRoom
            ? load.complete
              ? `Hold ${fmt(load.volumeCuFt)} cu.ft at ${fmt(numOf(data.targetTempF))}°F / ${fmt(numOf(data.targetRhPct))}% rh.`
              : `Hold ${applicationLabel(data)} at ${fmt(numOf(data.targetTempF))}°F / ${fmt(numOf(data.targetRhPct))}% rh.`
            : proc.complete
              ? `Dry ${fmt(proc.cfm)} cfm to ${fmtGrains(proc.leavingGrains)} gr/lb, a ${fmtDewPoint(proc.leavingDewPointF)} dew point.`
              : `Deliver ${fmtGrains(proc.leavingGrains)} gr/lb leaving air for ${applicationLabel(data)}.`}
        </p>
        {isRoom && load.dominant && load.complete && (
          <p className="mt-2 text-[12.5px] leading-relaxed text-ink-secondary">
            The biggest driver is <strong className="font-medium text-ink">{shortLabel(load.dominant.label).toLowerCase()}</strong>.
            {load.dominant.key === 'doors' && ' Tightening door discipline is usually the cheapest capacity you will ever buy.'}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <ReviewBlock title="Contact" rows={[
          ['Name', data.contactName], ['Company', data.company], ['Email', data.email], ['Phone', data.phone],
        ]} />
        <ReviewBlock title="Project" rows={[
          ['Project', data.projectName], ['Application', applicationLabel(data)],
          ['Location', data.location], ['Quote needed', data.dateRequired],
        ]} />
      </div>

      <div className="rounded-xl border border-hairline bg-surface-soft p-4">
        <p className="text-[12.5px] font-medium text-ink-secondary">Take a look before you send</p>
        <p className="mt-0.5 text-[11.5px] leading-relaxed text-ink-muted">
          Builds the full PDF: every answer, plus a one-page summary of your numbers.
        </p>
        <button
          type="button"
          onClick={onDownloadPreview}
          disabled={downloading}
          className="mt-3 inline-flex h-9 items-center gap-2 rounded-lg border border-hairline-strong bg-surface px-3.5 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-surface-soft hover:text-ink disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
        >
          {downloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {downloading ? 'Building…' : 'Preview the PDF'}
        </button>
      </div>

      <p className="rounded-lg bg-surface-soft px-3.5 py-3 text-[11px] leading-relaxed text-ink-muted">
        {LOAD_DISCLAIMER}
      </p>
    </div>
  )
}

function ReviewBlock({ title, rows }: { title: string; rows: [string, string][] }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface p-4">
      <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{title}</p>
      <dl className="space-y-1.5">
        {rows.map(([k, v]) => (
          <div key={k} className="flex gap-3 text-[12.5px]">
            <dt className="w-24 flex-shrink-0 text-ink-muted">{k}</dt>
            <dd className={`min-w-0 truncate ${v ? 'text-ink' : 'text-ink-faint'}`}>{v || 'Not given'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

// ─── Validation & helpers ─────────────────────────────────────────────────────

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validateStep(step: StepKey, d: RfqData): boolean {
  switch (step) {
    case 'application':
      return !!d.application && (!d.application.startsWith('other') || d.applicationOther.trim().length > 1)
    case 'target':
      return numOf(d.targetTempF) !== 0 && d.targetRhPct.trim() !== ''
    case 'space':
      // Either way of answering counts — roomDims() resolves both to L/W/H, and a
      // volume with no usable size still lands at 0 here.
      { const g = roomDims(d); return g.L > 0 && g.W > 0 && g.H > 0 }
    case 'leaving':
      return numOf(d.leavingTempF) !== 0 && numOf(d.leavingGrains) > 0
    case 'airstream':
      return numOf(d.processCfm) > 0
    case 'about':
    case 'review':
      // Phone joined name/company/email as required 2026-08-17. Pricing a job
      // always needs a question answered, and an email round trip costs a day
      // each time. Same loose digit count as the support form: ten digits after
      // punctuation is stripped, checking that a number was really given rather
      // than that it is dialable.
      return d.contactName.trim().length > 1
        && EMAIL_RE.test(d.email.trim())
        && d.company.trim().length > 1
        && (d.phone.match(/\d/g) || []).length >= 10
    default:
      return true
  }
}

/** Takes the data, not just the step: the space step asks for different things
 *  depending on which size mode is showing, and telling someone in volume mode
 *  to "enter length, width and height" points at fields that are not on screen. */
function requirementHint(step: StepKey, d: RfqData): string {
  switch (step) {
    case 'application': return 'Pick an application to continue'
    case 'target':      return 'Enter a target temperature and humidity'
    case 'space':       return normalizeRoomSizeMode(d.roomSizeMode) === 'volume'
      ? 'Enter the room volume'
      : 'Enter length, width and height'
    case 'leaving':     return 'Enter the leaving air temperature and grains'
    case 'airstream':   return 'Enter the process airflow'
    case 'about':
    case 'review':      return 'Name, company, a valid email and a phone number, please'
    default:            return ''
  }
}

function numOf(v: string): number {
  const n = parseFloat(String(v ?? '').replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function shortLabel(label: string): string {
  return label
    .replace('Permeation through walls, roof and floor', 'Envelope permeation')
    .replace('Air leakage through the shell', 'Shell air leakage')
    .replace('Doors and openings', 'Doors & openings')
    .replace('People in the space', 'People')
    .replace('Product, packaging and process', 'Product & process')
    .replace('Wet surfaces and open water', 'Open water')
}

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'project'
}

/** Compact numbers stored alongside the record so the desk can triage at a glance. */
function summarizeRoom(load: ReturnType<typeof estimateLoad>) {
  return {
    track: 'room' as const,
    complete: load.complete,
    total_lb_per_hr: round(load.totalLbPerHr, 2),
    total_gr_per_hr: Math.round(load.totalGrPerHr),
    internal_gr_per_hr: Math.round(load.internalGrPerHr),
    ventilation_gr_per_hr: Math.round(load.ventilationGrPerHr),
    dry_air_cfm: Math.round(load.dryAirCfm),
    room_grains: round(load.roomGrains, 2),
    room_dew_point_f: round(load.roomDewPointF, 1),
    volume_cu_ft: Math.round(load.volumeCuFt),
    air_changes_per_hour: round(load.airChangesPerHour, 2),
    dominant: load.dominant?.label ?? null,
    // `detail` is the assumption behind the number — the leak rate the tightness
    // band resolved to, whether the vapor barrier was credited, how many minutes
    // an hour the doors stood open. Dropping it left the desk with a magnitude
    // and no way to see what produced it. Records written before 2026-08-24 have
    // no detail, so every reader must treat it as optional.
    breakdown: load.lines.map(l => ({ key: l.key, label: l.label, gr_per_hr: Math.round(l.grainsPerHour), detail: l.detail })),
  }
}

function summarizeProcess(proc: ReturnType<typeof estimateProcess>) {
  return {
    track: 'process' as const,
    complete: proc.complete,
    cfm: Math.round(proc.cfm),
    entering_grains: round(proc.enteringGrains, 2),
    leaving_grains: round(proc.leavingGrains, 2),
    depression_grains: round(proc.depression, 2),
    lb_per_hr: round(proc.lbPerHr, 2),
    leaving_dew_point_f: round(proc.leavingDewPointF, 1),
  }
}

const round = (n: number, d: number) => (Number.isFinite(n) ? Number(n.toFixed(d)) : 0)
