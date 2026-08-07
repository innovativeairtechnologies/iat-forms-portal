'use client'

/* A schematic with positioned overlay points on top of it.
 *
 * Shared by the component-map explorer and the label-the-diagram drill so a
 * hotspot lands in the same place in both. Points are percentages of the
 * diagram box, which keeps them attached to the drawing as it scales.
 */

import { cn } from '@/lib/utils'

export function DiagramCanvas({
  viewBox,
  svg,
  maxWidth = 560,
  children,
}: {
  viewBox: string
  /** Static markup from `lib/hvacr/exercises.ts` — never user input, which is
   *  why setting it directly is safe here. */
  svg: string
  maxWidth?: number
  children?: React.ReactNode
}) {
  return (
    <div className="relative mx-auto w-full" style={{ maxWidth }}>
      <svg
        viewBox={viewBox}
        xmlns="http://www.w3.org/2000/svg"
        className="block w-full"
        aria-hidden="true"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      {children}
    </div>
  )
}

/** An empty target on the diagram, or the chip a learner dropped into it. */
export function DiagramSpot({
  x,
  y,
  state = 'empty',
  onClick,
  children,
  label,
}: {
  x: number
  y: number
  state?: 'empty' | 'filled' | 'correct' | 'incorrect'
  onClick?: () => void
  children?: React.ReactNode
  label?: string
}) {
  const empty = state === 'empty'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{ left: `${x}%`, top: `${y}%` }}
      className={cn(
        'absolute -translate-x-1/2 -translate-y-1/2 transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        empty
          ? 'h-8 w-8 rounded-full border-2 border-dashed border-hairline-strong bg-surface hover:border-brand'
          : 'rounded-full border px-2.5 py-1 text-[11px] font-medium whitespace-nowrap',
        state === 'filled' && 'border-hairline-strong bg-surface-strong text-ink',
        state === 'correct' &&
          'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
        state === 'incorrect' &&
          'border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/15 dark:text-rose-300',
      )}
    >
      {children}
    </button>
  )
}

/** A draggable-by-click label sitting in the pool below a diagram. */
export function DiagramChip({
  selected,
  onClick,
  children,
}: {
  selected: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={cn(
        'rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand',
        selected
          ? 'border-brand bg-brand-soft text-brand-ink'
          : 'border-hairline-strong bg-surface text-ink-secondary hover:bg-surface-soft hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}
