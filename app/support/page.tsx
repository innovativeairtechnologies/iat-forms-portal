import Link from 'next/link'
import Logo from '@/components/Logo'
import { PortalHero, HeroAction } from '@/components/PortalHero'
import {
  LifeBuoy, Wrench, ClipboardList,
  Search, ArrowRight,
  type LucideIcon,
} from 'lucide-react'

// ─── Submit-a-request cards ────────────────────────────────────────────────────

type SubmitCard = {
  id: string
  icon: LucideIcon
  title: string
  desc: string
  badge: string | null
  primary: boolean
  href: string | null
  disabled: boolean
}

const SUBMIT_CARDS: SubmitCard[] = [
  {
    id: 'equipment',
    icon: LifeBuoy,
    title: 'Equipment Support',
    desc: 'Report an issue and walk the guided checks — we share tips along the way and pre-screen everything so our support team arrives prepared.',
    badge: 'Start here',
    primary: true,
    href: '/support/equipment-support',
    disabled: false,
  },
  {
    id: 'parts',
    icon: Wrench,
    title: 'Parts & Warranty Request',
    desc: 'Request replacement parts or start a warranty claim.',
    badge: null,
    primary: false,
    href: null,
    disabled: true,
  },
  {
    id: 'pm',
    icon: ClipboardList,
    title: 'Preventive Maintenance',
    desc: 'Schedule a PM visit or request service documentation.',
    badge: null,
    primary: false,
    href: null,
    disabled: true,
  },
]

/* ─── Filter tabs — TEMPORARILY HIDDEN (2026-06-24, "coming back") ──────────────
   The All / Forms / Knowledge Center tab bar is parked, not deleted. To restore:
     1. add `'use client'` at the top of this file
     2. re-add `import { useState } from 'react'`
     3. restore the state + derived flags:
          type Tab = 'all' | 'equipment' | 'kb'
          const [tab, setTab] = useState<Tab>('all')
          const showSubmit = tab === 'all' || tab === 'equipment'
          const showKb     = tab === 'all' || tab === 'kb'
     4. render the <nav> below between the hero and the sections, and gate each
        <section> on showSubmit / showKb.

   <nav className="flex overflow-x-auto border-b border-zinc-200 dark:border-zinc-800 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
     {([
       { id: 'all',       label: 'All' },
       { id: 'equipment', label: 'Forms' },
       { id: 'kb',        label: 'Knowledge Center' },
     ] as { id: Tab; label: string }[]).map(t => (
       <button
         key={t.id}
         onClick={() => setTab(t.id)}
         className={`-mb-px whitespace-nowrap border-b-2 px-4 py-3 text-[13px] font-medium transition-all ${
           tab === t.id
             ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
             : 'border-transparent text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'
         }`}
       >
         {t.label}
       </button>
     ))}
   </nav>
─────────────────────────────────────────────────────────────────────────────── */

const CARD_BASE =
  'relative flex h-full min-h-[150px] flex-col rounded-2xl border bg-white p-5 shadow-sm transition-all dark:bg-zinc-900 dark:shadow-none'

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function SupportPortal() {
  const activeCount = SUBMIT_CARDS.filter((c) => !c.disabled).length

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-800 dark:bg-[#0a0a0b] dark:text-zinc-200">

      {/* Header — mirrors the customer / employee portal chrome */}
      <header className="sticky top-0 z-30 h-14 border-b border-zinc-200 bg-white/90 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/85">
        <div className="mx-auto flex h-full max-w-[1000px] items-center justify-between px-5">
          <Link href="/support" className="flex items-center gap-2.5 no-underline">
            <Logo size={26} className="flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[14px] font-bold tracking-tight text-zinc-900 dark:text-white">IAT</span>
              <span className="text-[13px] text-zinc-300 dark:text-zinc-600">/</span>
              <span className="text-[13px] font-medium text-zinc-500 dark:text-zinc-400">Support</span>
            </div>
          </Link>
          <Link
            href="/support/status"
            className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-500 transition-colors hover:text-emerald-600 dark:text-zinc-400 dark:hover:text-emerald-400"
          >
            <Search size={14} /> Check ticket status
          </Link>
        </div>
      </header>

      {/* Body */}
      <main className="mx-auto max-w-[1000px] space-y-8 px-5 py-8">

        <PortalHero
          eyebrow="Customer Support"
          title="How can we help?"
          subtitle="Open a support request and we'll walk you through it, pre-screening your equipment details so our team arrives prepared."
          actions={<HeroAction href="/support/status" icon={Search} label="Check ticket status" />}
        />

        {/* ── Filter tabs render here when restored (see note above) ── */}

        {/* Submit a Request — only the live action gets a card; the rest are a quiet note */}
        <section>
          <SectionHeader icon={LifeBuoy} title="Submit a Request" meta={`${activeCount} active option${activeCount === 1 ? '' : 's'}`} />
          <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
            {SUBMIT_CARDS.filter((c) => !c.disabled).map((card) => (
              <SubmitCardItem key={card.id} card={card} />
            ))}
          </div>
          <p className="mt-3 text-[12px] leading-relaxed text-zinc-400 dark:text-zinc-500">
            Parts &amp; Warranty, Preventive Maintenance and the Knowledge Base — coming soon.
          </p>
        </section>

        {/* Status strip */}
        <div className="flex items-center gap-2 rounded-xl border border-zinc-200 bg-white px-4 py-3 dark:border-zinc-800 dark:bg-zinc-900">
          <span className="inline-flex h-2 w-2 flex-shrink-0 rounded-full bg-emerald-500" />
          <span className="text-[12px] text-zinc-500 dark:text-zinc-400">
            All systems operational&nbsp;·&nbsp;Average response time:{' '}
            <strong className="font-semibold text-zinc-700 dark:text-zinc-200">4 hours</strong>
          </span>
        </div>

      </main>
    </div>
  )
}

// ─── Pieces ─────────────────────────────────────────────────────────────────────

function SectionHeader({ icon: Icon, title, meta, badge }: { icon: LucideIcon; title: string; meta?: string; badge?: string }) {
  return (
    <div className="mb-4 flex items-center gap-2.5">
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
        <Icon size={15} />
      </span>
      <span className="text-[15px] font-bold text-zinc-900 dark:text-white">{title}</span>
      {meta && <span className="text-[11px] font-semibold text-zinc-400">{meta}</span>}
      {badge && (
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:bg-zinc-800">
          {badge}
        </span>
      )}
    </div>
  )
}

function SubmitCardItem({ card }: { card: SubmitCard }) {
  const Icon = card.icon

  if (card.disabled) {
    return (
      <div className={`${CARD_BASE} cursor-not-allowed border-zinc-200 opacity-60 dark:border-zinc-800`}>
        <span className="absolute right-3 top-3 rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400 dark:bg-zinc-800">
          Soon
        </span>
        <span className="mb-auto flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-400 dark:bg-zinc-800">
          <Icon size={17} />
        </span>
        <div className="mt-3">
          <p className="text-[14px] font-semibold leading-snug text-zinc-700 dark:text-zinc-300">{card.title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{card.desc}</p>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={card.href!}
      className={`group ${CARD_BASE} hover:-translate-y-0.5 hover:shadow-md ${
        card.primary
          ? 'border-emerald-300 bg-gradient-to-br from-emerald-50 to-white ring-1 ring-emerald-100 dark:border-emerald-500/40 dark:from-emerald-500/10 dark:to-zinc-900 dark:ring-emerald-500/20'
          : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-800 dark:hover:border-zinc-700'
      }`}
    >
      {card.badge && (
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400">
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400" />
          {card.badge}
        </span>
      )}
      <span
        className={`mb-auto flex h-9 w-9 items-center justify-center rounded-xl ${
          card.primary
            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400'
            : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
        }`}
      >
        <Icon size={17} />
      </span>
      <div className="mt-3">
        <div className="flex items-center gap-1.5">
          <p className={`text-[14px] font-semibold leading-snug ${card.primary ? 'text-emerald-800 dark:text-emerald-300' : 'text-zinc-900 dark:text-white'}`}>
            {card.title}
          </p>
          <ArrowRight size={13} className={`flex-shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${card.primary ? 'text-emerald-600' : 'text-zinc-400'}`} />
        </div>
        <p className="mt-1 text-[11px] leading-relaxed text-zinc-400">{card.desc}</p>
      </div>
    </Link>
  )
}
