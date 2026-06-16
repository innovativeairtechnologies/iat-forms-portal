import Link from 'next/link'
import { ExternalLink, ClipboardList, Calculator, Package, Clock, MapPin } from 'lucide-react'

export const dynamic = 'force-dynamic'

export default function USRotorsOverviewPage() {
  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">US Rotors</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Overview</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Dehumidification rotors &amp; cassettes · Effective November 1, 2026</p>
      </div>

      <div className="p-8 space-y-6 max-w-3xl">

        {/* About card */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-3">About US Rotors</h2>
          <p className="text-[13px] text-gray-500 dark:text-gray-400 leading-relaxed">
            US Rotors is our sister brand specializing in desiccant dehumidification rotors and cassettes. Products
            ship FOB Baton Rouge with approximately a 4-week lead time. Pricing is confidential — share only with
            authorized distributors and end customers under NDA.
          </p>

          <div className="mt-5 grid grid-cols-3 gap-3">
            {[
              { icon: Package, label: 'Products', value: 'Rotors & Cassettes' },
              { icon: MapPin,  label: 'Ships from', value: 'Baton Rouge, LA' },
              { icon: Clock,   label: 'Lead time',  value: '~4 weeks' },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3">
                <div className="flex items-center gap-2 mb-1">
                  <Icon size={13} className="text-gray-400" />
                  <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
                </div>
                <p className="text-[13px] font-medium text-gray-800 dark:text-gray-100">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Quick actions */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 dark:border-zinc-800">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">Quick Actions</p>
          </div>
          <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60">
            <li>
              <Link
                href="/employee/us-rotors/order"
                className="group grid grid-cols-[1fr_auto] items-center px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500">
                    <ClipboardList size={16} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white group-hover:text-[#0274db] transition-colors">C-Series Order Form</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Submit a new C-Series rotor order</p>
                  </div>
                </div>
                <span className="text-[12px] font-semibold text-[#0274db] opacity-0 group-hover:opacity-100 transition-opacity">Open →</span>
              </Link>
            </li>
            <li>
              <a
                href="/tools/us-rotors-pricing-calculator.html"
                target="_blank"
                rel="noopener noreferrer"
                className="group grid grid-cols-[1fr_auto] items-center px-6 py-4 hover:bg-gray-50/70 dark:hover:bg-zinc-800/30 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0 pr-4">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-gray-100 dark:bg-zinc-800 text-gray-400 dark:text-gray-500">
                    <Calculator size={16} strokeWidth={1.8} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white group-hover:text-[#0274db] transition-colors">Pricing Calculator</p>
                    <p className="text-[12px] text-gray-400 mt-0.5">Price out rotor configurations &amp; generate quotes</p>
                  </div>
                </div>
                <span className="flex items-center gap-1 text-[12px] font-semibold text-[#0274db] opacity-0 group-hover:opacity-100 transition-opacity">
                  Open <ExternalLink size={11} />
                </span>
              </a>
            </li>
          </ul>
        </div>

        {/* Product lines */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 p-6">
          <h2 className="text-[15px] font-semibold text-gray-900 dark:text-white mb-4">Product Lines</h2>
          <div className="space-y-3">
            {[
              {
                name: 'C-Series — Standard Depth (200mm)',
                desc: 'Entry-level depth series for standard humidity control applications. Available in rotor-only, cassette-only, or rotor + cassette.',
              },
              {
                name: 'C-Series — 400mm Depth',
                desc: 'Deep-bed series for high-performance desiccant processes. Includes purge seal option. Segmented construction available on 1730mm+ sizes.',
              },
            ].map(p => (
              <div key={p.name} className="bg-gray-50 dark:bg-zinc-800/50 rounded-xl px-4 py-3">
                <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-100 mb-0.5">{p.name}</p>
                <p className="text-[12px] text-gray-400 leading-relaxed">{p.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Key order notes */}
        <div className="bg-[#0274db]/5 dark:bg-[#0274db]/10 rounded-2xl border border-[#0274db]/15 dark:border-[#0274db]/20 p-5">
          <p className="text-[13px] font-semibold text-[#0274db] mb-2">Order Notes</p>
          <ul className="space-y-1.5 text-[12px] text-gray-500 dark:text-gray-400">
            <li>· Packaging &amp; handling: 2% domestic / 4% international</li>
            <li>· Credit card surcharge: +3% (Net 30 available for approved accounts)</li>
            <li>· Drop-ship parcel fee: +$50</li>
            <li>· Extended warranty available for rotor media and cassette frames</li>
            <li>· All prices are confidential — do not share without authorization</li>
          </ul>
        </div>

      </div>
    </div>
  )
}
