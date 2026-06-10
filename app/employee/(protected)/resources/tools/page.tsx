import Link from 'next/link'
import { LifeBuoy, ImageIcon, Zap, Calculator, ArrowUpRight } from 'lucide-react'

export const dynamic = 'force-dynamic'

// Live tools/apps (and ones coming soon) available to employees.
const APPS = [
  { title: 'Support Ticketing', desc: 'Submit and track customer equipment support tickets.', href: '/support', icon: LifeBuoy, status: 'live' as const },
  { title: 'Email Graphic Generator', desc: 'Generate branded email graphics.', href: null, icon: ImageIcon, status: 'soon' as const },
  { title: 'Voltage Formula', desc: 'Quick voltage / electrical calculations.', href: null, icon: Zap, status: 'soon' as const },
  { title: 'US Rotors Pricing Calculator', desc: 'Price out US Rotors configurations.', href: null, icon: Calculator, status: 'soon' as const },
]

export default function ResourcesToolsPage() {
  return (
    <div className="flex-1 overflow-auto">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Resources</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Tools &amp; Apps</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Internal tools — more coming soon.</p>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
          {APPS.map(app => {
            const Icon = app.icon
            const inner = (
              <>
                <div className="flex items-start justify-between">
                  <div className="w-9 h-9 rounded-[10px] bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Icon size={16} className="text-gray-500 dark:text-gray-400" />
                  </div>
                  {app.status === 'live'
                    ? <ArrowUpRight size={15} className="text-gray-300 dark:text-gray-600 group-hover:text-[#089447] transition-colors" />
                    : <span className="text-[10px] font-bold uppercase tracking-wide text-gray-400 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded-full">Soon</span>}
                </div>
                <div className="mt-auto">
                  <p className="text-[14px] font-semibold text-gray-900 dark:text-white leading-snug">{app.title}</p>
                  <p className="text-[11px] text-gray-400 mt-1 leading-relaxed line-clamp-2">{app.desc}</p>
                </div>
              </>
            )
            const base = 'bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 flex flex-col h-36'
            return app.status === 'live' && app.href ? (
              <Link key={app.title} href={app.href} className={`group ${base} transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-gray-200 dark:hover:border-zinc-700`} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                {inner}
              </Link>
            ) : (
              <div key={app.title} className={`${base} opacity-60`} style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                {inner}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
