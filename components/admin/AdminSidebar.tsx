'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { LayoutDashboard, Inbox, FileText, PlusCircle, LogOut } from 'lucide-react'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/submissions', label: 'Submissions', icon: Inbox },
  { href: '/admin/forms', label: 'Forms', icon: FileText },
]

export default function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const logout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.push('/admin/login')
    router.refresh()
  }

  return (
    <aside className="w-56 bg-[#1a1a2e] flex flex-col flex-shrink-0 min-h-screen">
      {/* Logo */}
      <div className="px-5 pt-6 pb-5 border-b border-white/10">
        <p className="text-[10px] text-white/40 uppercase tracking-widest mb-0.5">IAT</p>
        <p className="text-sm font-bold text-white">Forms Portal</p>
        <p className="text-[10px] text-white/40 mt-0.5">Admin</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 space-y-0.5 px-2">
        {NAV.map((item) => {
          const active = item.exact ? pathname === item.href : pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-[6px] text-sm transition-colors',
                active
                  ? 'bg-white/10 text-white font-semibold'
                  : 'text-white/60 hover:bg-white/5 hover:text-white'
              )}
            >
              <item.icon size={16} />
              {item.label}
            </Link>
          )
        })}

        <div className="pt-2 pb-1">
          <div className="h-px bg-white/10 mx-1" />
        </div>

        <Link
          href="/admin/forms/new"
          className="flex items-center gap-3 px-3 py-2 rounded-[6px] text-sm text-[#0a7cff] hover:bg-white/5 transition-colors"
        >
          <PlusCircle size={16} />
          New Form
        </Link>
      </nav>

      {/* Footer */}
      <div className="px-2 pb-4">
        <button
          onClick={logout}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-[6px] text-sm text-white/40 hover:text-white hover:bg-white/5 transition-colors"
        >
          <LogOut size={16} />
          Sign Out
        </button>
      </div>
    </aside>
  )
}
