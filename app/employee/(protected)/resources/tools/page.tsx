import Link from 'next/link'
import { ImageIcon, Zap, Calculator, ChevronRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Live tools/apps available to employees. The three static tools live in
// public/tools/<slug>/ and open in a new tab (they're standalone HTML apps).
const APPS = [
  { title: 'Order Status Card Generator', desc: 'Generate branded order-status cards for customer emails.', href: '/tools/order-status-card.html', icon: ImageIcon, status: 'live' as const, external: true },
  { title: 'Voltage Scaling Calculator', desc: 'Convert and scale voltages across configurations.', href: '/tools/voltage-scaling-calculator.html', icon: Zap, status: 'live' as const, external: true },
  { title: 'US Rotors Pricing Calculator', desc: 'Price out US Rotors rotor configurations.', href: '/tools/us-rotors-pricing-calculator.html', icon: Calculator, status: 'live' as const, external: true },
]

export default function ResourcesToolsPage() {
  return (
    <div className="flex-1 overflow-auto">

      {/* Header (same structure as /admin/forms) */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Resources</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Tools &amp; Apps</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Internal tools — more coming soon.</p>
      </div>

      <div className="p-8">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card overflow-hidden">
          <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60">
            {APPS.map(app => {
              const Icon = app.icon
              const body = (
                <>
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500">
                      <Icon size={16} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[14px] font-semibold text-gray-900 dark:text-white truncate ${app.status === 'live' ? 'group-hover:text-[#089447] transition-colors' : ''}`}>{app.title}</p>
                      <p className="text-[12px] text-gray-400 mt-0.5 line-clamp-1">{app.desc}</p>
                    </div>
                  </div>
                  {app.status === 'live'
                    ? <span className="flex items-center gap-1 text-[12px] font-semibold text-[#089447] opacity-0 group-hover:opacity-100 transition-opacity">Open <ChevronRight size={14} /></span>
                    : <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full flex-shrink-0">Soon</span>}
                </>
              )
              const rowClass = 'grid grid-cols-[1fr_auto] items-center px-6 py-4 transition-colors'
              const hoverClass = 'group hover:bg-gray-50/70 dark:hover:bg-zinc-800/30'
              if (app.status !== 'live' || !app.href) {
                return <li key={app.title} className={`${rowClass} opacity-60`}>{body}</li>
              }
              return (
                <li key={app.title}>
                  {app.external ? (
                    <a href={app.href} target="_blank" rel="noopener noreferrer" className={`${hoverClass} ${rowClass}`}>{body}</a>
                  ) : (
                    <Link href={app.href} className={`${hoverClass} ${rowClass}`}>{body}</Link>
                  )}
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
