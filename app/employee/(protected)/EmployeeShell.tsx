'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { User, Calendar, LogOut, Menu, X, Users } from 'lucide-react'
import Image from 'next/image'
import { useState } from 'react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { Employee } from '@/lib/supabase'
import { cn } from '@/lib/utils'

const NAV = [
  { href: '/employee/profile',   label: 'My Profile',  icon: User     },
  { href: '/employee/requests',  label: 'Time Off',    icon: Calendar },
  { href: '/employee/directory', label: 'Directory',   icon: Users    },
]

export default function EmployeeShell({ employee, children }: { employee: Employee; children: React.ReactNode }) {
  const pathname    = usePathname()
  const router      = useRouter()
  const supabase    = createSupabaseBrowser()
  const [open, setOpen] = useState(false)

  const initials = employee.name.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) || '?'

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/employee/login')
    router.refresh()
  }

  const NavLinks = () => (
    <>
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href)
        return (
          <Link key={href} href={href} onClick={() => setOpen(false)}
            className={cn(
              'flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-all',
              active
                ? 'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            )}
          >
            <Icon size={15} className={active ? 'text-[#089447]' : 'text-gray-400'} />
            {label}
          </Link>
        )
      })}
    </>
  )

  return (
    <div className="min-h-screen flex bg-[#F7F6F3]">

      {/* ── Desktop sidebar ── */}
      <aside className="hidden md:flex w-[220px] bg-white border-r border-gray-100 flex-col flex-shrink-0 h-screen sticky top-0">
        <div className="flex items-center gap-2.5 px-4 pt-5 pb-5">
          <Link href="/employee/profile" className="flex items-center gap-2.5 group flex-1 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-sm border border-black/[0.06]">
              <Image src="/iat-logo.png" alt="IAT" width={22} height={22} style={{ mixBlendMode: 'multiply' }} />
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-gray-900 leading-none tracking-tight group-hover:text-[#089447] transition-colors">IAT Portal</p>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">Employee</p>
            </div>
          </Link>
        </div>

        <nav className="flex-1 px-2 py-1 space-y-0.5">
          <p className="text-[10px] font-semibold text-gray-300 uppercase tracking-widest px-2 pb-2">Menu</p>
          <NavLinks />
        </nav>

        <div className="p-2 border-t border-gray-100 space-y-0.5">
          <div className="flex items-center gap-2.5 px-3 py-2.5">
            <div className="w-7 h-7 rounded-full bg-gray-800 flex items-center justify-center text-white text-[11px] font-bold flex-shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-gray-700 leading-none truncate">{employee.name || employee.email}</p>
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{employee.job_title || 'Employee'}</p>
            </div>
          </div>
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-400 hover:bg-gray-50 hover:text-gray-700 transition-all">
            <LogOut size={15} className="text-gray-300" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-gray-100 flex items-center justify-between px-4 h-14">
        <Link href="/employee/profile" className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-white flex-shrink-0 flex items-center justify-center shadow-sm border border-black/[0.06]">
            <Image src="/iat-logo.png" alt="IAT" width={18} height={18} style={{ mixBlendMode: 'multiply' }} />
          </div>
          <span className="text-[13px] font-bold text-gray-900">IAT Portal</span>
        </Link>
        <button onClick={() => setOpen(true)} className="text-gray-600 p-1"><Menu size={20} /></button>
      </div>
      <div className="md:hidden h-14 flex-shrink-0" />

      {/* Mobile drawer */}
      {open && (
        <div className="md:hidden fixed inset-0 z-50 flex" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
          <div className="relative w-[260px] bg-white flex flex-col h-full shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
              <span className="text-[13px] font-bold text-gray-900">IAT Portal</span>
              <button onClick={() => setOpen(false)} className="text-gray-400 p-1"><X size={18} /></button>
            </div>
            <nav className="flex-1 px-3 py-3 space-y-0.5">
              <NavLinks />
            </nav>
            <div className="p-3 border-t border-gray-100">
              <button onClick={logout}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium text-gray-400 hover:bg-gray-50 transition-all">
                <LogOut size={15} className="text-gray-300" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Main content ── */}
      <div className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </div>
    </div>
  )
}
