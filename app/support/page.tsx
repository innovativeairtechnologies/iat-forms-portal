'use client'

import { useState } from 'react'
import Logo from '@/components/Logo'
import Link from 'next/link'
import { ArrowRight, Search } from 'lucide-react'

// ─── Card data ───────────────────────────────────────────────────────────────

const SUBMIT_CARDS = [
  {
    id: 'equipment',
    icon: '🛠️',
    title: 'Equipment Support Ticket',
    desc: 'Report a system issue — our engineers will pre-screen your request before the call',
    badge: 'Start here',
    primary: true,
    href: '/support/equipment-support',
    disabled: false,
  },
  {
    id: 'troubleshooting',
    icon: '🩺',
    title: 'Troubleshooting Checklist',
    desc: 'Not sure where to start? Walk the key diagnostic checks so you can share the right readings with our team',
    badge: null,
    primary: false,
    href: '/support/troubleshooting',
    disabled: false,
  },
  {
    id: 'parts',
    icon: '🔧',
    title: 'Parts & Warranty Request',
    desc: 'Request replacement parts or start a warranty claim',
    badge: null,
    primary: false,
    href: null,
    disabled: true,
  },
  {
    id: 'pm',
    icon: '📋',
    title: 'Preventive Maintenance',
    desc: 'Schedule a PM visit or request service documentation',
    badge: null,
    primary: false,
    href: null,
    disabled: true,
  },
]

const KB_CARDS = [
  {
    id: 'temp',
    icon: '🌡️',
    title: 'Temperature Control Guides',
    desc: 'Setpoint calibration, PID tuning, and temperature troubleshooting',
    slug: 'temperature-control-setpoint',
  },
  {
    id: 'airflow',
    icon: '💨',
    title: 'Airflow Balancing',
    desc: 'Process & react airflow setup and damper adjustment guides',
    slug: 'airflow-balancing',
  },
  {
    id: 'cooling',
    icon: '❄️',
    title: 'Cooling System Diagnostics',
    desc: 'DX and chilled water troubleshooting, pre/post cooling checks',
    slug: 'cooling-system-diagnostics',
  },
]

type Tab = 'all' | 'equipment' | 'kb'

// ─── Main page ────────────────────────────────────────────────────────────────

export default function SupportPortal() {
  const [tab, setTab] = useState<Tab>('all')

  const showSubmit = tab === 'all' || tab === 'equipment'
  const showKb = tab === 'all' || tab === 'kb'
  const activeSubmitCount = SUBMIT_CARDS.filter(c => !c.disabled).length

  return (
    <div className="min-h-screen bg-white dark:bg-zinc-950">

      {/* Header */}
      <header className="sticky top-0 z-20 h-14 flex items-center border-b border-gray-200 dark:border-zinc-800 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md">
        <div className="max-w-[900px] mx-auto px-6 w-full flex items-center justify-between">
          <Link href="/support" className="flex items-center gap-2 no-underline">
            <Logo size={28} className="flex-shrink-0" />
            <div className="flex items-center gap-1.5">
              <span className="text-[15px] font-bold text-gray-900 dark:text-white tracking-tight">IAT</span>
              <span className="text-[14px] text-gray-300 dark:text-gray-600">/</span>
              <span className="text-[15px] font-medium text-gray-500 dark:text-gray-400">Support</span>
            </div>
          </Link>
          <Link
            href="/support/status"
            className="flex items-center gap-1.5 text-[13px] font-medium text-gray-500 dark:text-gray-400 hover:text-[#089447] dark:hover:text-[#089447] transition-colors"
          >
            <Search size={14} />
            Check ticket status
          </Link>
        </div>
      </header>

      {/* Hero */}
      <div className="max-w-[900px] mx-auto px-6 pt-14 pb-6 text-center">
        <h1 className="text-[clamp(32px,5vw,46px)] font-bold tracking-[-1.5px] leading-none text-gray-900 dark:text-white mb-2.5">
          Customer Support
        </h1>
        <p className="text-[15px] text-gray-400 mb-2">Submit a ticket and our team will respond within 1 business day.</p>
        <p className="text-[14px] text-gray-400 max-w-xl mx-auto leading-relaxed">Your equipment details and system status are pre-screened automatically so our engineers arrive prepared — no repeat questions on the call.</p>
      </div>

      {/* Tab bar */}
      <div className="max-w-[900px] mx-auto px-6 border-b border-gray-200 dark:border-zinc-800 flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {([
          { id: 'all',       label: 'All',            count: activeSubmitCount + KB_CARDS.length },
          { id: 'equipment', label: 'Equipment',       count: activeSubmitCount },
          { id: 'kb',        label: 'Knowledge Base',  count: KB_CARDS.length },
        ] as { id: Tab; label: string; count: number }[]).map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-4 py-3 text-[13px] font-medium border-b-2 whitespace-nowrap transition-all -mb-px ${
              tab === t.id
                ? 'border-[#089447] text-[#089447]'
                : 'border-transparent text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
            }`}
          >
            {t.label}
            <span className="ml-1.5 text-[11px] text-gray-300 dark:text-gray-600">{t.count}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="max-w-[900px] mx-auto px-6 py-8 pb-20">

        {/* Submit a Request */}
        {showSubmit && (
          <div className="mb-10">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[10px] bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[14px] flex-shrink-0">🎫</div>
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">Submit a Request</span>
              <span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600">{activeSubmitCount} active option{activeSubmitCount === 1 ? '' : 's'}</span>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
              {SUBMIT_CARDS.map(card => (
                <CardItem key={card.id} card={card} />
              ))}
            </div>
          </div>
        )}

        {/* Knowledge Base */}
        {showKb && (
          <div className="mb-8">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 rounded-[10px] bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[14px] flex-shrink-0">📖</div>
              <span className="text-[15px] font-bold text-gray-900 dark:text-white">Knowledge Base</span>
              <span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600">{KB_CARDS.length} guides</span>
              <Link
                href="/support/kb"
                className="ml-auto flex items-center gap-1 text-[12px] font-semibold text-[#089447] hover:text-[#077a3c] transition-colors"
              >
                Browse all <ArrowRight size={12} />
              </Link>
            </div>

            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
              {KB_CARDS.map(card => (
                <Link
                  key={card.id}
                  href={`/support/kb/${card.slug}`}
                  className="group bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 h-40 flex flex-col transition-all duration-150 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-gray-300 dark:hover:border-zinc-700"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  <div className="w-9 h-9 rounded-[10px] bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[16px] mb-auto flex-shrink-0">
                    {card.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 mb-1">
                      <p className="text-[14px] font-semibold text-gray-900 dark:text-white leading-snug">{card.title}</p>
                      <ArrowRight size={13} className="opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 text-gray-400" />
                    </div>
                    <p className="text-[11px] text-gray-400 leading-relaxed">{card.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Status strip */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gray-50 dark:bg-zinc-900 rounded-xl border border-gray-200 dark:border-zinc-800">
          <div className="w-2 h-2 rounded-full bg-[#089447] flex-shrink-0" />
          <span className="text-[12px] text-gray-400">
            All systems operational &nbsp;·&nbsp; Average response time: <strong className="text-gray-600 dark:text-gray-300 font-semibold">4 hours</strong>
          </span>
        </div>

      </div>
    </div>
  )
}

// ─── Card component ───────────────────────────────────────────────────────────

type CardDef = typeof SUBMIT_CARDS[number]

function CardItem({ card }: { card: CardDef }) {
  const base =
    'relative bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-5 h-40 flex flex-col text-left w-full transition-all duration-150'
  const shadow = 'shadow-[0_1px_2px_rgba(0,0,0,0.05)]'

  if (card.disabled) {
    return (
      <div className={`${base} ${shadow} opacity-50 cursor-not-allowed`}>
        <div className="w-9 h-9 rounded-[10px] bg-gray-100 dark:bg-zinc-800 flex items-center justify-center text-[16px] mb-auto flex-shrink-0">
          {card.icon}
        </div>
        <div>
          <p className="text-[14px] font-semibold text-gray-900 dark:text-white leading-snug mb-1">{card.title}</p>
          <p className="text-[11px] text-gray-400 leading-relaxed">{card.desc}</p>
        </div>
      </div>
    )
  }

  return (
    <Link
      href={card.href!}
      className={`${base} ${shadow} group hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 hover:border-gray-300 dark:hover:border-zinc-700 ${
        card.primary
          ? 'bg-gradient-to-br from-[#f0faf4] to-[#fafffd] dark:from-[rgba(8,148,71,0.14)] dark:to-[rgba(8,148,71,0.05)] border-[rgba(8,148,71,0.35)] dark:border-[rgba(8,148,71,0.4)]'
          : ''
      }`}
    >
      {card.badge && (
        <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full bg-[rgba(8,148,71,0.12)] text-[#089447]">
          {card.badge}
        </span>
      )}
      <div className={`w-9 h-9 rounded-[10px] flex items-center justify-center text-[16px] mb-auto flex-shrink-0 ${
        card.primary ? 'bg-[rgba(8,148,71,0.14)]' : 'bg-gray-100 dark:bg-zinc-800'
      }`}>
        {card.icon}
      </div>
      <div>
        <div className="flex items-center gap-1.5 mb-1">
          <p className={`text-[14px] font-semibold leading-snug ${
            card.primary ? 'text-[#067838] dark:text-[#34d873]' : 'text-gray-900 dark:text-white'
          }`}>{card.title}</p>
          <ArrowRight size={13} className={`opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 ${card.primary ? 'text-[#089447]' : 'text-gray-400'}`} />
        </div>
        <p className="text-[11px] text-gray-400 leading-relaxed">{card.desc}</p>
      </div>
    </Link>
  )
}
