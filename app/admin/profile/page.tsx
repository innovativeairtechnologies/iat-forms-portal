'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, User, Mail, Save, LogOut, Check, Shield } from 'lucide-react'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'

export default function ProfilePage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    setName(localStorage.getItem('admin_display_name') || 'Admin')
    setEmail(localStorage.getItem('admin_email') || '')
  }, [])

  const initials = name.trim()
    ? name.trim().split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A'

  const save = () => {
    localStorage.setItem('admin_display_name', name.trim() || 'Admin')
    localStorage.setItem('admin_email', email.trim())
    // Dispatch so DashboardShell avatar updates without reload
    window.dispatchEvent(new Event('admin-profile-updated'))
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const logout = async () => {
    await fetch('/api/admin/auth', { method: 'DELETE' })
    router.push('/login')
    router.refresh()
  }

  if (!mounted) return null

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-gray-800 bg-white dark:bg-gray-900">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-5"
        >
          <ArrowLeft size={13} />
          Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 dark:bg-gray-700 flex items-center justify-center text-white text-[18px] font-bold flex-shrink-0 select-none">
            {initials}
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
              {name || 'Admin'}
            </h1>
            <p className="text-[13px] text-gray-400 mt-0.5">Admin · Innovative Air Technologies</p>
          </div>
        </div>
      </div>

      <div className="p-8 max-w-xl space-y-4">

        {/* Profile */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-6">
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Display Name
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
                <input
                  value={name}
                  onChange={(e) => { setName(e.target.value); setSaved(false) }}
                  placeholder="Your name"
                  className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Email
              </label>
              <div className="relative">
                <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
                <input
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setSaved(false) }}
                  type="email"
                  placeholder="admin@company.com"
                  className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-gray-200 dark:border-gray-700 rounded-xl outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-all"
                />
              </div>
            </div>
            <button
              onClick={save}
              className={`inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all ${
                saved
                  ? 'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]'
                  : 'bg-[#089447] hover:bg-[#077a3c] text-white shadow-sm'
              }`}
            >
              {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> Save Changes</>}
            </button>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-6">
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-4">Appearance</h2>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Theme</p>
              <p className="text-[11px] text-gray-400 mt-0.5">Switch between light and dark mode</p>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Security */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-6">
          <div className="flex items-center gap-2 mb-4">
            <h2 className="text-[13px] font-bold text-gray-900 dark:text-white">Security</h2>
          </div>
          <div className="flex items-center justify-between py-3 border border-gray-100 dark:border-gray-800 rounded-xl px-4">
            <div>
              <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Admin Password</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Managed via{' '}
                <code className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-[10px]">ADMIN_PASSWORD</code>
                {' '}in your environment
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={13} className="text-[#089447]" />
              <span className="text-[11px] font-semibold text-[#089447]">Protected</span>
            </div>
          </div>
        </div>

        {/* Session */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-100 dark:border-gray-800 shadow-card p-6">
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-1">Session</h2>
          <p className="text-[12px] text-gray-400 mb-4">Sessions expire after 8 hours of inactivity.</p>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-4 py-2.5 rounded-xl transition-all border border-gray-200 dark:border-gray-700 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>

      </div>
    </div>
  )
}
