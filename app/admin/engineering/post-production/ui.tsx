'use client'

import type { ReactNode } from 'react'
import { CARD_TONE, TagPill } from '@/components/admin/list-card'
import type { Tone } from '@/components/admin/list'
import {
  CATEGORY_SHORT, CATEGORY_TONE, FINDING_STATUS_LABELS, FINDING_STATUS_TONE,
  SEVERITY_LABELS, SEVERITY_TONE, STANDING_TONE, THEME_STATUS_LABELS, THEME_STATUS_TONE,
  VERDICT_LABELS, VERDICT_TONE,
  type Category, type FindingStatus, type PreflightVerdict, type Severity,
  type Standing, type ThemeStatus,
} from '@/lib/post-production'

/* Shared chips for the Post-Production section. Every one of them is a soft-wash
   Tone pill from the design system — no new colors, no hex literals, and the
   single brand green stays where it belongs (the one primary action per view,
   focus rings, active indicators). */

function Pill({ tone, children, title }: { tone: Tone; children: ReactNode; title?: string }) {
  const t = CARD_TONE[tone]
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1.5 text-[10.5px] font-semibold px-2 py-[3px] rounded-md whitespace-nowrap ${t.bg} ${t.fg}`}
    >
      {children}
    </span>
  )
}

export function CategoryChip({ category }: { category: Category }) {
  return <TagPill tone={CATEGORY_TONE[category]}>{CATEGORY_SHORT[category]}</TagPill>
}

export function SeverityChip({ severity }: { severity: Severity }) {
  return <Pill tone={SEVERITY_TONE[severity]}>{SEVERITY_LABELS[severity]}</Pill>
}

export function FindingStatusChip({ status }: { status: FindingStatus }) {
  return <Pill tone={FINDING_STATUS_TONE[status]}>{FINDING_STATUS_LABELS[status]}</Pill>
}

export function ThemeStatusChip({ status }: { status: ThemeStatus }) {
  return <Pill tone={THEME_STATUS_TONE[status]}>{THEME_STATUS_LABELS[status]}</Pill>
}

export function VerdictChip({ verdict }: { verdict: PreflightVerdict }) {
  return <Pill tone={VERDICT_TONE[verdict]}>{VERDICT_LABELS[verdict]}</Pill>
}

/** The two-week clock. `undated` renders in slate and says "No date" rather than
 *  reading as healthy — a finding nobody has committed to is not on track. */
export function StandingChip({ standing }: { standing: Standing }) {
  if (standing.kind === 'done') return <Pill tone="emerald">{standing.label}</Pill>
  return <Pill tone={STANDING_TONE[standing.kind]}>{standing.label}</Pill>
}

/** Empty state that says something. Every one of these in the section explains
 *  what would put a row here, because "No results" next to a filter tells a
 *  person nothing about whether the filter or the data is the problem. */
export function Nothing({ children }: { children: ReactNode }) {
  return <div className="px-5 py-14 text-center text-[13px] text-ink-muted leading-relaxed">{children}</div>
}

/** Section tabs. Underline style per DESIGN.md — 2px brand bottom border on the
 *  active one, muted ink on the rest. */
export function SubNav({
  items, active,
}: {
  items: { href: string; label: string; count?: number }[]
  active: string
}) {
  return (
    <div className="flex items-center gap-1 px-5 border-b border-hairline overflow-x-auto">
      {items.map(i => {
        const on = i.href === active
        return (
          <a
            key={i.href}
            href={i.href}
            className={`inline-flex items-center gap-2 h-11 px-3 text-[13px] whitespace-nowrap border-b-2 transition-colors ${
              on
                ? 'border-brand text-ink font-medium'
                : 'border-transparent text-ink-muted hover:text-ink-secondary'
            }`}
          >
            {i.label}
            {i.count != null && i.count > 0 && (
              <span className="text-[10.5px] font-semibold px-1.5 py-[1px] rounded bg-surface-strong text-ink-muted tabular-nums">
                {i.count}
              </span>
            )}
          </a>
        )
      })}
    </div>
  )
}
