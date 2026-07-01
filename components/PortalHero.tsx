import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/* Shared greeting band used at the top of every portal dashboard (employee home,
   IAT Learn, future portals). Theme-aware: a light surface in light mode, a dark
   surface in dark mode — it follows the app theme like everything else, rather
   than being permanently inverted. Server-safe (no hooks). */

export function PortalHero({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: string
  title: string
  subtitle?: React.ReactNode
  actions?: React.ReactNode
}) {
  return (
    <section className="relative overflow-hidden rounded-2xl border border-zinc-200 bg-white px-6 py-6 shadow-sm dark:border-transparent dark:bg-zinc-900 dark:shadow-none dark:ring-1 dark:ring-white/10 sm:px-8 sm:py-7">
      {/* Emerald brand glow — mirrors the admin greeting card */}
      <div
        className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full opacity-[0.18] blur-3xl dark:opacity-25"
        style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }}
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">{eyebrow}</p>
          )}
          <h1 className="mt-1 text-[24px] font-bold leading-tight tracking-tight text-zinc-900 dark:text-white sm:text-[26px]">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500 dark:text-zinc-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </section>
  )
}

/* Hero action button. `primary` is the solid emerald CTA; `ghost` is the subtle
   secondary. Both theme-aware. Link-based so it works in server components. */
export function HeroAction({
  href,
  icon: Icon,
  label,
  variant = 'ghost',
}: {
  href: string
  icon?: LucideIcon
  label: string
  variant?: 'primary' | 'ghost'
}) {
  const base =
    'inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[12.5px] font-semibold transition-colors whitespace-nowrap'
  const cls =
    variant === 'primary'
      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 dark:bg-emerald-500 dark:hover:bg-emerald-400'
      : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 ring-1 ring-zinc-200 dark:bg-white/10 dark:hover:bg-white/[0.16] dark:text-white dark:ring-white/15'
  return (
    <Link href={href} className={`${base} ${cls}`}>
      {Icon && <Icon size={15} className="flex-shrink-0" />}
      {label}
    </Link>
  )
}
