'use client'

/* ────────────────────────────────────────────────────────────────────────────
   Tabs — the canonical underline tab strip (DESIGN.md §6).

   2px brand bottom border + `text-ink` on the active tab, `text-ink-muted`
   inactive. Replaces the hex-hardcoded `tabCx` helper in components/admin/list.tsx
   for new work; that helper stays until its call sites are swept.

   Counts render as a neutral chip that goes brand-soft when the tab is active —
   the same "count belongs to the thing it labels" convention the admin lists use.
   ──────────────────────────────────────────────────────────────────────────── */

export type TabDef<K extends string = string> = {
  key: K
  label: string
  /** Rendered in a chip beside the label. Numbers, or strings like "3/5". */
  count?: string | number
}

export function Tabs<K extends string>({
  tabs, active, onChange, className = '',
}: {
  tabs: readonly TabDef<K>[]
  active: K
  onChange: (key: K) => void
  className?: string
}) {
  return (
    <div role="tablist" className={`flex-shrink-0 flex items-center gap-1 border-b border-hairline px-3 ${className}`}>
      {tabs.map((t) => {
        const on = t.key === active
        return (
          <button
            key={t.key}
            role="tab"
            aria-selected={on}
            onClick={() => onChange(t.key)}
            className={`-mb-px inline-flex items-center gap-2 border-b-2 px-3 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              on
                ? 'border-brand text-ink'
                : 'border-transparent text-ink-muted hover:text-ink-secondary'
            }`}
          >
            {t.label}
            {t.count !== undefined && t.count !== '' && (
              <span
                className={`rounded-full px-1.5 text-[11px] font-semibold tabular-nums ${
                  on ? 'bg-brand-soft text-brand-ink' : 'bg-surface-strong text-ink-muted'
                }`}
              >
                {t.count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
