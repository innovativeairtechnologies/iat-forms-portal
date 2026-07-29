import { ChevronRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'
import { ListPageHeader } from '@/components/admin/list'
import { TOOL_APPS } from '@/lib/tools'

/* Self-service "Internal Apps" launcher in the admin shell — open to every
   admin-surface role via OPEN_ADMIN_PREFIXES ('/admin/me'). Same catalog as
   /admin/tools (lib/tools.ts) minus the perm-gated Presentations entry: these
   are the field apps every employee can reach, which the Company Home hero
   links to. */

export const dynamic = 'force-dynamic'

export default function SelfServiceAppsPage() {
  return (
    <div className="flex-1 overflow-auto">
      <ListPageHeader overline="Self-service" title="Internal Apps" count={`${TOOL_APPS.length} internal apps`} />

      <div className="p-4 sm:p-8">
        <div className="bg-white dark:bg-zinc-900/40 rounded-xl border border-zinc-200 dark:border-zinc-800 shadow-sm dark:shadow-none overflow-hidden">
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {TOOL_APPS.map(app => {
              const Icon = app.icon
              const body = (
                <>
                  <div className="flex items-center gap-3 min-w-0 pr-4">
                    <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-zinc-100 dark:bg-zinc-800 text-zinc-400 dark:text-zinc-500">
                      <Icon size={16} strokeWidth={1.8} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-zinc-900 dark:text-white truncate group-hover:text-[#089447] transition-colors flex items-center gap-2">
                        {app.title}
                        {app.tag && (
                          <span className="text-[10px] font-bold uppercase tracking-wide text-[#089447] bg-[#089447]/10 px-1.5 py-0.5 rounded-full">{app.tag}</span>
                        )}
                      </p>
                      <p className="text-[12px] text-zinc-400 dark:text-zinc-500 mt-0.5 line-clamp-1">{app.desc}</p>
                    </div>
                  </div>
                  <span className="flex items-center gap-1 text-[12px] font-semibold text-zinc-300 dark:text-zinc-600 group-hover:text-[#089447] transition-colors">
                    {app.external && <ExternalLink size={13} className="opacity-0 group-hover:opacity-100 transition-opacity" />}
                    Open <ChevronRight size={14} />
                  </span>
                </>
              )
              const rowClass = 'group grid grid-cols-[1fr_auto] items-center gap-3 px-5 sm:px-6 py-4 transition-colors hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30'
              return (
                <li key={app.title}>
                  {app.external ? (
                    <a href={app.href} target="_blank" rel="noopener noreferrer" className={rowClass}>{body}</a>
                  ) : (
                    <Link href={app.href} className={rowClass}>{body}</Link>
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
