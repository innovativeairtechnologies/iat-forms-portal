import type { ReactNode } from 'react'
import { initialsOf } from '@/components/admin/list'

/* Token-clean presentational primitives for the company home (/home). Built
   directly on the Quiet Precision semantic tokens (DESIGN.md): warm canvas behind
   everything, white cards with 1px hairline borders + 12px radius, no resting
   shadows, one green accent reserved for the hero's primary action. Server-safe. */

/** A masonry cell: white surface card, hairline border, breaks cleanly in a CSS
 *  columns layout, with its own bottom rhythm. */
export function HomeCard({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mb-5 break-inside-avoid overflow-hidden rounded-xl border border-hairline bg-surface ${className}`}>
      {children}
    </div>
  )
}

export function CardHead({ icon, title, action }: { icon?: ReactNode; title: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-hairline-soft px-5 py-3.5">
      <div className="flex min-w-0 items-center gap-2">
        {icon && <span className="flex-shrink-0 text-ink-muted">{icon}</span>}
        <h2 className="truncate text-[13.5px] font-semibold tracking-[-0.006em] text-ink">{title}</h2>
      </div>
      {action && <div className="flex-shrink-0">{action}</div>}
    </div>
  )
}

/** 11px uppercase micro-overline for in-card group labels. */
export function Overline({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <p className={`text-[11px] font-semibold uppercase tracking-wider text-ink-muted ${className}`}>{children}</p>
  )
}

/** Stacked day/month date chip. `emphasis` inverts it (ink on canvas) — the
 *  Notion move — to flag a pinned/important item without spending a second green. */
export function DateTile({ day, mon, emphasis = false }: { day: string; mon: string; emphasis?: boolean }) {
  return (
    <div
      className={`flex h-11 w-11 flex-shrink-0 flex-col items-center justify-center rounded-lg ${
        emphasis ? 'bg-ink text-canvas' : 'bg-surface-strong text-ink-secondary'
      }`}
    >
      <span className="text-[15px] font-semibold leading-none tabular-nums">{day}</span>
      <span className="mt-0.5 text-[9px] font-semibold uppercase leading-none tracking-wide">{mon}</span>
    </div>
  )
}

/** Round avatar — the employee's photo when set, otherwise their initials on a
 *  neutral chip. Plain <img> so it works regardless of next/image domain config. */
export function PersonAvatar({ name, src, size = 36 }: { name: string; src?: string | null; size?: number }) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={name}
        width={size}
        height={size}
        className="flex-shrink-0 rounded-full bg-surface-strong object-cover"
        style={{ width: size, height: size }}
      />
    )
  }
  return (
    <span
      className="flex flex-shrink-0 items-center justify-center rounded-full bg-surface-strong font-semibold text-ink-secondary"
      style={{ width: size, height: size, fontSize: Math.round(size * 0.38) }}
    >
      {initialsOf(name)}
    </span>
  )
}
