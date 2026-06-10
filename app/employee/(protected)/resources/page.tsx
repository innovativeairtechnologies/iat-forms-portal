import Link from 'next/link'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { FileText, ArrowUpRight, LifeBuoy, ImageIcon, Zap, Calculator } from 'lucide-react'

export const dynamic = 'force-dynamic'

type FormRow = { id: string; title: string; description: string | null; slug: string; categories: { name: string } | null }

// Live tools/apps (and ones coming soon) surfaced to employees alongside forms.
const APPS = [
  { title: 'Support Ticketing', desc: 'Submit and track customer equipment support tickets.', href: '/support', icon: LifeBuoy, status: 'live' as const },
  { title: 'Email Graphic Generator', desc: 'Generate branded email graphics.', href: null, icon: ImageIcon, status: 'soon' as const },
  { title: 'Voltage Formula', desc: 'Quick voltage / electrical calculations.', href: null, icon: Zap, status: 'soon' as const },
  { title: 'US Rotors Pricing Calculator', desc: 'Price out US Rotors configurations.', href: null, icon: Calculator, status: 'soon' as const },
]

export default async function ResourcesPage() {
  const { data } = await supabaseAdmin
    .from('forms')
    .select('id, title, description, slug, categories(name)')
    .eq('is_active', true)
    .order('title')

  const forms = (data || []) as unknown as FormRow[]

  return (
    <div className="flex-1 overflow-auto">

      {/* Page header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Hub</p>
        <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Resources</h1>
        <p className="text-[13px] text-gray-400 mt-0.5">Every form and tool at IAT, in one place.</p>
      </div>

      <div className="p-8 space-y-10">

        {/* Forms */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-[10px] bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <FileText size={15} className="text-gray-500 dark:text-gray-400" />
            </div>
            <span className="text-[15px] font-bold text-gray-900 dark:text-white">Forms</span>
            <span className="text-[11px] font-semibold text-gray-300 dark:text-gray-600">{forms.length}</span>
          </div>

          {forms.length === 0 ? (
            <p className="text-[13px] text-gray-400">No active forms yet.</p>
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(250px,1fr))] gap-3">
              {forms.map(f => (
                <Link
                  key={f.id}
                  href={`/forms/${f.slug}`}
                  className="group bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 flex flex-col h-36 transition-all hover:-translate-y-0.5 hover:shadow-md hover:border-gray-200 dark:hover:border-zinc-700"
                  style={{ boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}
                >
                  <div className="flex items-start justify-between">
                    <div className="w-9 h-9 rounded-[10px] bg-[#089447]/10 flex items-center justify-center flex-shrink-0">
                      <FileText size={16} className="text-[#089447]" />
                    </div>
                    <ArrowUpRight size={15} className="text-gray-300 dark:text-gray-600 group-hover:text-[#089447] transition-colors" />
                  </div>
                  <div className="mt-auto">
                    <p className="text-[14px] font-semibold text-gray-900 dark:text-white leading-snug line-clamp-2">{f.title}</p>
                    {f.categories?.name && (
                      <p className="text-[11px] text-gray-400 mt-1">{f.categories.name}</p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Tools & Apps */}
        <section>
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-[10px] bg-gray-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
              <LayoutGridIcon />
            </div>
            <span className="text-[15px] font-bold text-gray-900 dark:text-white">Tools &amp; Apps</span>
          </div>

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
        </section>
      </div>
    </div>
  )
}

// Small inline icon to avoid an extra import name clash in this server component.
function LayoutGridIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500 dark:text-gray-400">
      <rect width="7" height="7" x="3" y="3" rx="1" /><rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" /><rect width="7" height="7" x="3" y="14" rx="1" />
    </svg>
  )
}
