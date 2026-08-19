'use client'

import { useCallback, useId, useMemo, useState } from 'react'
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
  HEATING_TYPES, INSTALL_LOCATIONS, LOAD_DISCLAIMER, MERV_OPTIONS, MOISTURE_MODES, MOISTURE_SUFFIX,
  PACKAGE_PREFS, PEOPLE_LOADS, PROCESS_PRESETS, REGEN_SOURCES, ROOM_PRESETS, RUNTIMES,
  TIGHTNESS_HELP, VOLTAGES, WALL_MATERIALS,
  applicationLabel, applyProcessPreset, applyRoomPreset, dewPointF, emptyRfq, estimateLoad,
  estimateProcess, fmt, fmtDewPoint, fmtGrains, grains, normalizeMode, presetFor, setCondition,
  type ActivityLevel, type ConditionKey, type DoorSpec, type Exposure, type MoistureMode,
  type ProcessPreset, type RfqData, type RoomPreset, type Tightness, type Track, type VaporBarrier,
} from '@/lib/rfq'

// ─── Steps ────────────────────────────────────────────────────────────────────

type StepKey =
  | 'application' | 'target' | 'space' | 'shell' | 'openings' | 'inside'
  | 'leaving' | 'airstream' | 'entering'
  | 'unit' | 'about' | 'review'

type Tone = 'emerald' | 'sky' | 'amber' | 'rose' | 'violet'

const STEPS: Record<StepKey, { title: string; kicker: string; icon: LucideIcon; tone: Tone }> = {
  application: { title: 'What are we protecting?', kicker: 'Pick the closest match — it fills in the rest', icon: Sparkles, tone: 'emerald' },
  target:      { title: 'Your target condition',   kicker: 'The condition you need held inside',           icon: Thermometer, tone: 'sky' },
  space:       { title: 'The space',                kicker: 'Rough dimensions are fine',                    icon: Ruler, tone: 'violet' },
  shell:       { title: 'The shell around it',      kicker: 'What the room is built from',                  icon: Layers, tone: 'amber' },
  openings:    { title: 'Doors and openings',       kicker: 'Usually the single biggest load',              icon: DoorOpen, tone: 'rose' },
  inside:      { title: "What's happening inside",  kicker: 'People, product, water, ventilation',          icon: Users, tone: 'emerald' },
  leaving:     { title: 'Leaving air you need',     kicker: 'The condition off the dehumidifier',           icon: Wind, tone: 'sky' },
  airstream:   { title: 'The airstream',            kicker: 'How much air, and where it comes from',        icon: Gauge, tone: 'violet' },
  entering:    { title: 'Entering conditions',      kicker: 'What the unit has to work against',            icon: Thermometer, tone: 'amber' },
  unit:        { title: 'The unit',                 kicker: 'Utilities, construction, filtration',          icon: Cog, tone: 'sky' },
  about:       { title: 'You and the project',      kicker: 'Who to send the quote to, and where it is going', icon: Mail, tone: 'violet' },
  review:      { title: 'Review and send',          kicker: 'One last look before it reaches our desk',     icon: CheckCircle2, tone: 'emerald' },
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
  emerald: { chip: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400', ring: 'ring-emerald-200 dark:ring-emerald-500/30', dot: 'bg-emerald-500', bar: 'bg-emerald-500', text: 'text-emerald-700 dark:text-emerald-400', softBg: 'bg-emerald-50/60 dark:bg-emerald-500/5' },
  sky:     { chip: 'bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400',                 ring: 'ring-sky-200 dark:ring-sky-500/30',         dot: 'bg-sky-500',     bar: 'bg-sky-500',     text: 'text-sky-700 dark:text-sky-400',         softBg: 'bg-sky-50/60 dark:bg-sky-500/5' },
  amber:   { chip: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',         ring: 'ring-amber-200 dark:ring-amber-500/30',     dot: 'bg-amber-500',   bar: 'bg-amber-500',   text: 'text-amber-700 dark:text-amber-400',     softBg: 'bg-amber-50/60 dark:bg-amber-500/5' },
  rose:    { chip: 'bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-400',             ring: 'ring-rose-200 dark:ring-rose-500/30',       dot: 'bg-rose-500',    bar: 'bg-rose-500',    text: 'text-rose-700 dark:text-rose-400',       softBg: 'bg-rose-50/60 dark:bg-rose-500/5' },
  violet:  { chip: 'bg-violet-50 text-violet-700 dark:bg-violet-500/10 dark:text-violet-400',     ring: 'ring-violet-200 dark:ring-violet-500/30',   dot: 'bg-violet-500',  bar: 'bg-violet-500',  text: 'text-violet-700 dark:text-violet-400',   softBg: 'bg-violet-50/60 dark:bg-violet-500/5' },
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
  label, hint, value, onChange, options, tone = 'emerald',
}: {
  label?: string; hint?: string; value: T; onChange: (v: T) => void
  options: { value: T; label: string }[]; tone?: Tone
}) {
  const groupId = useId()
  const hintId = `${groupId}-hint`
  return (
    <div>
      {/* A radiogroup has no single labellable control, so it is labelled by its
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
  const valueId = useId()
  const modeId = useId()
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
            <input
              id={tempId}
              type="number"
              inputMode="decimal"
              value={tempF}
              autoFocus={autoFocus}
              onChange={e => onChange(setCondition(data, conditionKey, { tempF: e.target.value }))}
              className={`${inputCx} pr-10 tabular-nums`}
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[12px] text-ink-muted">°F</span>
          </div>
        </div>

        <div>
          <label htmlFor={valueId} className="mb-1 block text-[11px] text-ink-muted">Moisture</label>
          <div className="flex gap-1.5">
            <input
              id={valueId}
              type="number"
              inputMode="decimal"
              value={value}
              aria-describedby={hint ? hintId : undefined}
              onChange={e => onChange(setCondition(data, conditionKey, { value: e.target.value }))}
              className={`${inputCx} min-w-0 flex-1 tabular-nums`}
            />
            <div className="relative flex-shrink-0">
              <label htmlFor={modeId} className="sr-only">Moisture unit for {label}</label>
              <select
                id={modeId}
                value={mode}
                onChange={e => onChange(setCondition(data, conditionKey, { mode: e.target.value as MoistureMode }))}
                className={`${inputCx} w-[104px] cursor-pointer appearance-none pl-2.5 pr-7 text-[12.5px]`}
              >
                {MOISTURE_MODES.map(m => <option key={m.value} value={m.value}>{m.short}</option>)}
              </select>
              <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ink-faint" />
            </div>
          </div>
        </div>
      </div>

      <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{modeMeta.hint}</p>

      {typical && (
        <Typical
          label={`${typical.tempF}°F / ${typical.value}${MOISTURE_SUFFIX[typical.mode].replace('°F', '°F').replace('% rh', '% rh')}`}
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
function ConditionReadout({ tempF, rhPct, elevationFt, tone = 'sky' }: {
  tempF: number; rhPct: number; elevationFt: number; tone?: Tone
}) {
  if (!tempF || !rhPct) return null
  return (
    <div className={`grid grid-cols-2 gap-3 rounded-xl p-4 sm:grid-cols-4 ${TONE[tone].softBg}`}>
      <Stat label="Temperature" value={`${fmt(tempF)}°F`} />
      <Stat label="Relative humidity" value={`${fmt(rhPct, rhPct < 10 ? 1 : 0)}%`} />
      <Stat label="Grains" value={fmtGrains(grains(tempF, rhPct, elevationFt))} unit="gr/lb" />
      <Stat label="Dew point" value={fmtDewPoint(dewPointF(tempF, rhPct, elevationFt))} />
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
      {used ? `Using typical: ${label}` : `Typical: ${label} — use it`}
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
    setIndex(i => Math.min(Math.max(i + delta, 0), flow.length - 1))
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
      setError('We could not build the PDF in this browser. Your details are safe — try again, or send the request and we will generate it on our side.')
    } finally {
      setDownloading(false)
    }
  }, [buildPdf, data.company, data.projectName])

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
          summary: data.track === 'room' ? summariseRoom(load) : summariseProcess(proc),
          ...(recaptcha_token ? { recaptcha_token } : {}),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Submission failed')
      setReference(json.reference)
      setStage('done')
      window.scrollTo({ top: 0, behavior: 'smooth' })
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
                Thanks — we have everything we need to start.
              </h1>
              <p className="mt-3 text-[14px] leading-relaxed text-ink-secondary">
                Your request is with our application engineering team. Reference{' '}
                <strong className="font-semibold tabular-nums text-ink">{reference}</strong>. We&apos;ll come back
                to <strong className="font-semibold text-ink">{data.email}</strong> — and if anything in your
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
                onClick={() => { setData(emptyRfq()); setIndex(0); setStage('fork'); setReference(''); setError(null) }}
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
        <Rail flow={flow} index={index} onJump={i => { setDirection(i > index ? 1 : -1); setIndex(i) }} />

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
                <span className="text-[12px] text-ink-muted">{requirementHint(step)}</span>
              )}
            </div>
          </div>

          {/* Live readout */}
          <div className="lg:sticky lg:top-[76px] lg:self-start">
            <Readout data={data} load={load} proc={proc} />
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
      lede: 'You need a space held at a condition — a warehouse, cold store, dry room, production hall.',
      bullets: ['You know the temperature and humidity you want inside', 'People, product or equipment live in that space', 'We calculate the moisture load from the room itself'],
      tone: 'emerald',
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
            A few guided questions — about three minutes. We fill in typical values as you go, show you
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
            Not sure? Pick <strong className="font-medium text-ink-secondary">a room or building</strong> — it&apos;s
            the more common of the two, and you can switch on the next screen.
          </p>
        </motion.div>
      </main>
    </Shell>
  )
}

function Rail({ flow, index, onJump }: { flow: StepKey[]; index: number; onJump: (i: number) => void }) {
  return (
    <div className="flex items-center gap-1.5" role="navigation" aria-label="Progress">
      {flow.map((k, i) => {
        const done = i < index
        const now = i === index
        return (
          <button
            key={k}
            type="button"
            onClick={() => i <= index && onJump(i)}
            disabled={i > index}
            title={STEPS[k].title}
            aria-current={now ? 'step' : undefined}
            className={`h-1.5 flex-1 rounded-full transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              now ? TONE[STEPS[k].tone].bar : done ? 'bg-brand' : 'bg-surface-strong'
            } ${i <= index ? 'cursor-pointer' : 'cursor-default'}`}
          />
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
        Typical Industry Conditions
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
        Indicative figures for the conditions entered — for discussion, not for equipment selection.
      </p>
    </div>
  )
}

// LINE_BAR (the per-source colour ramp for the load breakdown bars) was removed
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
    case 'about':       return <StepAbout data={data} set={set} />
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
        <Callout tone="emerald">
          <strong className="font-semibold">What we&apos;re protecting:</strong> {chosen.driver}. We&apos;ve
          pre-filled typical values for this application — change anything that doesn&apos;t match your site.
        </Callout>
      )}

      {chosen?.key.startsWith('other') && (
        <TextField
          label="Tell us what it is"
          hint="A sentence is plenty — what the space or process does, and what the moisture is hurting."
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

      <ConditionReadout tempF={numOf(data.targetTempF)} rhPct={numOf(data.targetRhPct)} elevationFt={elev} />

      {preset?.note && <Callout tone="sky">{preset.note}</Callout>}

      <Callout tone="amber">
        Answer in whichever unit your spec is written in — the four above are the same air, and we convert
        as you type. Grains and dew point are what actually size equipment:{' '}
        <strong className="font-semibold">30% rh</strong> is a very different amount of water at 50°F than
        at 90°F, while a dew point does not move when the temperature does.
      </Callout>
    </div>
  )
}

function StepSpace({ data, set, load }: { data: RfqData; set: SetFn; load: ReturnType<typeof estimateLoad> }) {
  return (
    <div className="space-y-5">
      <Grid cols={3}>
        <TextField label="Length" value={data.roomL} onChange={v => set('roomL', v)} type="number" suffix="ft" autoFocus />
        <TextField label="Width" value={data.roomW} onChange={v => set('roomW', v)} type="number" suffix="ft" />
        <TextField label="Height" value={data.roomH} onChange={v => set('roomH', v)} type="number" suffix="ft" />
      </Grid>

      {load.volumeCuFt > 0 && (
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-violet-50/60 p-4 dark:bg-violet-500/5 sm:grid-cols-3">
          <Stat label="Floor area" value={fmt(numOf(data.roomL) * numOf(data.roomW))} unit="sq.ft" />
          <Stat label="Volume" value={fmt(load.volumeCuFt)} unit="cu.ft" />
          <Stat label="Wall area" value={fmt(2 * (numOf(data.roomL) + numOf(data.roomW)) * numOf(data.roomH))} unit="sq.ft" />
        </div>
      )}

      {/* Project location + elevation moved to the first step (`about`): elevation
          feeds grains and dew point, so it has to be known before any of the
          numbers this wizard shows mean anything. */}

      <Callout tone="violet">
        If the space isn&apos;t a simple box, give us the overall footprint and mention the shape in the notes
        at the end. We&apos;d rather start from a rough number than no number.
      </Callout>
    </div>
  )
}

function StepShell({
  data, set, setData,
}: { data: RfqData; set: SetFn; setData: React.Dispatch<React.SetStateAction<RfqData>> }) {
  const preset = presetFor(data) as RoomPreset | undefined
  return (
    <div className="space-y-5">
      <Grid>
        <SelectField label="Walls" value={data.wallMaterial} onChange={v => set('wallMaterial', v)} options={WALL_MATERIALS.map(m => m.label)} />
        <SelectField label="Roof / ceiling" value={data.ceilingMaterial} onChange={v => set('ceilingMaterial', v)} options={CEILING_MATERIALS.map(m => m.label)} />
      </Grid>
      <SelectField label="Floor" value={data.floorMaterial} onChange={v => set('floorMaterial', v)} options={FLOOR_MATERIALS.map(m => m.label)} />

      <Segmented<VaporBarrier>
        label="Is there a vapour barrier?"
        hint="Class I is polyethylene · Class II is kraft-faced batt · Class III is latex-painted gypsum."
        tone="amber"
        value={data.vaporBarrier}
        onChange={v => set('vaporBarrier', v)}
        options={[{ value: 'Yes', label: 'Yes' }, { value: 'No', label: 'No' }, { value: 'Not sure', label: 'Not sure' }]}
      />

      <div>
        <Segmented<Tightness>
          label="How tight is the building?"
          tone="amber"
          value={data.tightness}
          onChange={v => set('tightness', v)}
          options={[
            { value: 'Tight', label: 'Tight' },
            { value: 'Average', label: 'Average' },
            { value: 'Loose', label: 'Loose' },
            { value: 'Not sure', label: 'Not sure' },
          ]}
        />
        <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">{TIGHTNESS_HELP[data.tightness]}</p>
      </div>

      <div className="space-y-4 rounded-xl border border-hairline bg-surface-soft p-4">
        <ConditionField
          label="The space around the room"
          hint="Moisture pushes in from whatever is on the other side of the wall — usually the rest of the plant, not the weather."
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
      <Callout tone="rose">
        In most real buildings this one step outweighs walls, people and product combined. Every time a door
        opens, a slug of wet air walks in. Rough numbers are fine — a guess beats a blank.
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
                tone="rose"
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
            No openings? That&apos;s unusual but perfectly valid for a sealed vessel or vault — carry on.
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
  return (
    <div className="space-y-5">
      <Grid>
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
          hint={people > 0 ? `${fmt(PEOPLE_LOADS[data.activity])} gr/hr each — ${fmt(people * PEOPLE_LOADS[data.activity])} gr/hr in total.` : undefined}
          value={data.activity}
          onChange={v => set('activity', v as ActivityLevel)}
          options={Object.keys(PEOPLE_LOADS)}
        />
      </Grid>

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

      <Callout tone="emerald">
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
        tone="violet"
        value={data.airSource}
        onChange={v => set('airSource', v)}
        options={AIR_SOURCES.map(a => ({ value: a, label: a }))}
      />

      {data.airSource.startsWith('Mixed') && (
        <TextField label="Outdoor air fraction" value={data.mixOutdoorPct} onChange={v => set('mixOutdoorPct', v)} type="number" suffix="% OA" />
      )}

      <Callout tone="violet">
        Don&apos;t know the airflow yet? Put in your best guess and say so in the notes — we&apos;ll work it
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
        <div className="mt-3">
          <Segmented
            label="Natural gas available?"
            tone="sky"
            value={data.gasAvailable ? 'yes' : 'no'}
            onChange={v => set('gasAvailable', v === 'yes')}
            options={[{ value: 'yes', label: 'Yes' }, { value: 'no', label: 'No' }]}
          />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <TextField label="Chilled water" value={data.chilledWaterEwt} onChange={v => set('chilledWaterEwt', v)} type="number" suffix="°F EWT" />
          <TextField label="Hot water" value={data.hotWaterEwt} onChange={v => set('hotWaterEwt', v)} type="number" suffix="°F EWT" />
          <TextField label="Steam" value={data.steamPsi} onChange={v => set('steamPsi', v)} type="number" suffix="psi" />
        </div>
      </div>

      <Grid>
        <SelectField label="Regeneration air source" value={data.regenAirSource} onChange={v => set('regenAirSource', v)} options={['Outdoor', 'Indoor', 'Let IAT recommend']} />
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

      <Grid>
        <SelectField label="Heating" value={data.heatingType} onChange={v => set('heatingType', v)} options={HEATING_TYPES} />
        <SelectField label="Package preference" value={data.packagePref} onChange={v => set('packagePref', v)} options={PACKAGE_PREFS} />
      </Grid>

      <Grid>
        <SelectField label="Pre-filter" value={data.prefilterMerv} onChange={v => set('prefilterMerv', v)} options={MERV_OPTIONS} />
        <SelectField label="Final filter" value={data.finalMerv} onChange={v => set('finalMerv', v)} options={MERV_OPTIONS} />
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
          hint="Corrosive chemicals, fumes, dust, salt — it changes the cabinet and the wheel."
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
 * Site location + elevation, with elevation looked up from what they typed.
 *
 * The lookup is a CONVENIENCE, never a dependency: the field stays hand-editable,
 * a lookup failure says so quietly and changes nothing, and a value the customer
 * has typed themselves is never overwritten. Elevation feeds grains and dew point,
 * so a wrong number here is wrong everywhere downstream — which is exactly why the
 * server resolves it from geodetic surveys rather than guessing.
 */
function SiteLocation({ data, set }: { data: RfqData; set: SetFn }) {
  const [state, setState] = useState<'idle' | 'looking' | 'done' | 'failed'>('idle')
  const [matched, setMatched] = useState('')
  const [source, setSource] = useState('')

  const lookup = useCallback(async () => {
    const q = data.location.trim()
    if (q.length < 2) return
    setState('looking')
    setMatched('')
    try {
      const res = await fetch(`/api/rfq/elevation?q=${encodeURIComponent(q)}`)
      const j = await res.json()
      if (!res.ok || !j?.ok || typeof j.elevationFt !== 'number') {
        setState('failed')
        return
      }
      set('elevationFt', String(j.elevationFt))
      setMatched(String(j.matched ?? ''))
      setSource(String(j.source ?? ''))
      setState('done')
    } catch {
      setState('failed')
    }
  }, [data.location, set])

  const canLookUp = data.location.trim().length >= 2 && state !== 'looking'

  return (
    <div className="rounded-xl border border-hairline bg-surface-soft p-4">
      <p className="mb-3 text-[12.5px] font-medium text-ink-secondary">Where the equipment is going</p>
      <Grid>
        <TextField
          label="Project location"
          hint="City and state, or a ZIP — it sets the weather we design against."
          value={data.location}
          onChange={v => { set('location', v); setState('idle') }}
          placeholder="Covington, GA"
        />
        <div>
          <TextField
            label="Elevation"
            hint="Type it, or fill it from the location."
            value={data.elevationFt}
            onChange={v => { set('elevationFt', v); setState('idle') }}
            type="number"
            suffix="ft ASL"
          />
          <button
            type="button"
            onClick={lookup}
            disabled={!canLookUp}
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-3 text-[12px] font-medium text-ink-secondary transition-colors hover:bg-surface-strong disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {state === 'looking'
              ? <><Loader2 size={13} className="animate-spin" /> Looking up…</>
              : <><MapPin size={13} /> Look up elevation</>}
          </button>
          {state === 'done' && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
              {matched ? `${matched} · ` : ''}from {source || 'survey data'}. Edit it if you know better.
            </p>
          )}
          {state === 'failed' && (
            <p className="mt-1.5 text-[11.5px] leading-relaxed text-ink-muted">
              Couldn&apos;t find that one — type the elevation, or leave it and we&apos;ll confirm it with you.
            </p>
          )}
        </div>
      </Grid>
    </div>
  )
}

function StepAbout({ data, set }: { data: RfqData; set: SetFn }) {
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
          hint="A quote is a conversation — we will almost always need to ask you something."
        />
      </Grid>

      <SiteLocation data={data} set={set} />

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
              ? `Dry ${fmt(proc.cfm)} cfm to ${fmtGrains(proc.leavingGrains)} gr/lb — ${fmtDewPoint(proc.leavingDewPointF)} dew point.`
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
          Builds the full PDF — every answer, plus a one-page summary of your numbers.
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
      return numOf(d.roomL) > 0 && numOf(d.roomW) > 0 && numOf(d.roomH) > 0
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

function requirementHint(step: StepKey): string {
  switch (step) {
    case 'application': return 'Pick an application to continue'
    case 'target':      return 'Enter a target temperature and humidity'
    case 'space':       return 'Enter length, width and height'
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
function summariseRoom(load: ReturnType<typeof estimateLoad>) {
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
    breakdown: load.lines.map(l => ({ key: l.key, label: l.label, gr_per_hr: Math.round(l.grainsPerHour) })),
  }
}

function summariseProcess(proc: ReturnType<typeof estimateProcess>) {
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
