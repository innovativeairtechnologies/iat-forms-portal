'use client'

/* Shared chrome for every HVAC/R lesson widget.
 *
 * The models and drills differ wildly; their frame must not. One card, one
 * caption above, one control strip below — so a learner moving between
 * subjects never has to re-learn where the controls are.
 *
 * Everything here is semantic tokens (DESIGN.md). The only place raw colour
 * appears in this feature is `lib/hvacr/palette.ts`, and only inside the model
 * geometry itself.
 */

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

export function WidgetFrame({
  caption,
  children,
  controls,
  tabs,
}: {
  caption: string
  children: React.ReactNode
  controls?: React.ReactNode
  tabs?: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
      <p className="px-5 pb-3 pt-4 text-[13px] leading-relaxed text-ink-secondary">{caption}</p>
      {tabs ? <div className="flex flex-wrap gap-1.5 px-5 pb-3">{tabs}</div> : null}
      {children}
      {controls ? (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-hairline px-5 py-3">
          {controls}
        </div>
      ) : null}
    </div>
  )
}

/** A padded body for widgets that are not a 3D canvas. */
export function WidgetBody({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  return <div className={cn('px-5 pb-5', className)}>{children}</div>
}

export function WidgetHint({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] text-ink-muted">{children}</span>
}

/** 11px uppercase overline (DESIGN §3.2). */
export function Overline({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{children}</div>
  )
}

/* ── Controls ─────────────────────────────────────────────────────────────── */

const focusRing =
  'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

/** Segmented / tab control. Active state is the Notion ink inversion, not the
 *  brand accent — the accent is reserved for the one primary action. */
export function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-8 rounded-lg border px-3 text-[12px] font-medium transition-colors duration-150',
        focusRing,
        active
          ? 'border-ink bg-ink text-canvas'
          : 'border-hairline-strong bg-surface text-ink-secondary hover:bg-surface-soft hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

/** The single primary action in a widget — check, submit, start. */
export function PrimaryButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-9 rounded-lg bg-brand px-3.5 text-[13px] font-medium text-white transition-colors duration-150',
        'hover:bg-brand-hover active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50',
        focusRing,
      )}
    >
      {children}
    </button>
  )
}

export function GhostButton({
  onClick,
  children,
  disabled,
}: {
  onClick: () => void
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        'h-9 rounded-lg px-3 text-[13px] font-medium text-ink-muted transition-colors duration-150',
        'hover:bg-surface-strong hover:text-ink disabled:cursor-not-allowed disabled:opacity-40',
        focusRing,
      )}
    >
      {children}
    </button>
  )
}

export function Slider({
  label,
  min,
  max,
  step,
  value,
  onChange,
  readout,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (v: number) => void
  readout: string
}) {
  return (
    <label className="flex flex-wrap items-center gap-2 text-[12px] text-ink-secondary">
      <span>{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className={cn('h-1 w-[150px] cursor-pointer accent-brand', focusRing)}
      />
      <span className="min-w-[72px] font-medium tabular-nums text-ink">{readout}</span>
    </label>
  )
}

export function NumberField({
  label,
  value,
  onChange,
  suffix,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  suffix?: string
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-ink-secondary">{label}</span>
      <span className="relative inline-flex items-center">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            'h-9 w-[130px] rounded-lg border border-hairline bg-surface px-2.5 text-[13px] tabular-nums text-ink',
            'hover:border-hairline-strong focus:border-brand',
            suffix && 'pr-9',
            focusRing,
          )}
        />
        {suffix ? (
          <span className="pointer-events-none absolute right-2.5 text-[12px] text-ink-muted">{suffix}</span>
        ) : null}
      </span>
    </label>
  )
}

export function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-medium text-ink-secondary">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(
          'h-9 rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-ink',
          'hover:border-hairline-strong focus:border-brand',
          focusRing,
        )}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </label>
  )
}

/** Result / explanation panel. Tone carries meaning here (DESIGN §2.4). */
export function ResultNote({
  tone = 'neutral',
  children,
}: {
  tone?: 'neutral' | 'correct' | 'incorrect'
  children: React.ReactNode
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-3.5 py-3 text-[13px] leading-relaxed',
        tone === 'correct' &&
          'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300',
        tone === 'incorrect' &&
          'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300',
        tone === 'neutral' && 'border-hairline bg-surface-soft text-ink-secondary',
      )}
    >
      {children}
    </div>
  )
}

export function ScorePill({ correct, total }: { correct: number; total: number }) {
  const perfect = correct === total
  return (
    <span
      className={cn(
        'rounded-full px-2.5 py-1 text-[10px] font-semibold tabular-nums',
        perfect
          ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400'
          : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400',
      )}
    >
      {correct} / {total} correct
    </span>
  )
}

/* ── Exercise shell ───────────────────────────────────────────────────────── */

export function ExerciseCard({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-xl border border-hairline bg-surface p-5">
      <Overline>Practice</Overline>
      {/* Type styles go on the span, not the h3. `.learn-prose-interactive h3`
          in globals.css sets `font-size: inherit; font-weight: inherit` at
          specificity (0,1,1), which beats a Tailwind utility (0,1,0) — so
          classes put directly on the heading are silently dropped. */}
      <h3 className="mt-1.5">
        <span className="text-[16px] font-semibold tracking-[-0.011em] text-ink">{title}</span>
      </h3>
      <p className="mt-1 text-[13px] leading-relaxed text-ink-muted">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  )
}

/* ── Hooks ────────────────────────────────────────────────────────────────── */

/** Reads the OS motion preference. Every looping animation in this feature is
 *  gated on it — DESIGN §7 allows one entrance per view and nothing perpetual,
 *  and these models only earn the exception while they are teaching. */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mq.matches)
    const onChange = () => setReduced(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])
  return reduced
}
