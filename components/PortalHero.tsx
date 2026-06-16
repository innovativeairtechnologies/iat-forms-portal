import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

/* Shared dark greeting band used at the top of every portal dashboard
   (employee home, IAT Learn, and future portals). Server-safe — no hooks, no
   'use client' — so it drops into both RSC and client trees. Dark in both light
   and dark mode by design: it reads as a header band on a light page and is
   separated from the near-black app background by the subtle ring. */

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
    <section className="relative overflow-hidden rounded-2xl bg-zinc-900 ring-1 ring-white/10 px-6 py-6 sm:px-8 sm:py-7">
      {/* Emerald brand glow — mirrors the admin greeting card */}
      <div
        className="pointer-events-none absolute -top-16 -right-12 h-56 w-56 rounded-full opacity-25 blur-3xl"
        style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute -bottom-24 -left-10 h-56 w-56 rounded-full opacity-10 blur-3xl"
        style={{ background: 'radial-gradient(circle, #10b981, transparent 70%)' }}
      />

      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          {eyebrow && (
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-400">{eyebrow}</p>
          )}
          <h1 className="mt-1 text-[24px] sm:text-[26px] font-bold leading-tight tracking-tight text-white">{title}</h1>
          {subtitle && <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-400">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2.5">{actions}</div>}
      </div>
    </section>
  )
}

/* Hero action button. `primary` is the solid emerald CTA; `ghost` is the
   translucent-white secondary. Link-based so it works in server components. */
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
      ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-sm shadow-emerald-500/20'
      : 'bg-white/10 hover:bg-white/[0.16] text-white ring-1 ring-white/15'
  return (
    <Link href={href} className={`${base} ${cls}`}>
      {Icon && <Icon size={15} className="flex-shrink-0" />}
      {label}
    </Link>
  )
}
