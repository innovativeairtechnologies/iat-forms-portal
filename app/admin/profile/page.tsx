'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, User, Save, LogOut, Check, Shield } from 'lucide-react'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

export default function ProfilePage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/admin/profile')
      .then(r => r.json())
      .then(data => {
        setDisplayName(data.display_name || '')
        setEmail(data.email || '')
        setLoading(false)
      })
  }, [])

  const initials = displayName.trim()
    ? displayName.trim().split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : 'A'

  const save = async () => {
    setSaving(true)
    await fetch('/api/admin/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ display_name: displayName }),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
    // Re-render server layout so the sidebar name updates
    router.refresh()
  }

  const logout = async () => {
    const supabase = createSupabaseBrowser()
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-5 h-5 border-2 border-[#089447] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto">

      {/* Header */}
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors mb-5"
        >
          <ArrowLeft size={13} />
          Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gray-800 dark:bg-zinc-700 flex items-center justify-center text-white text-[18px] font-bold flex-shrink-0 select-none">
            {initials}
          </div>
          <div>
            <h1 className="text-[22px] font-bold text-gray-900 dark:text-white tracking-tight leading-tight">
              {displayName || 'Admin'}
            </h1>
            <p className="text-[13px] text-gray-400 mt-0.5">{email} · Admin</p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 max-w-xl space-y-4">

        {/* Profile */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card p-6">
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-4">Profile</h2>
          <div className="space-y-4">
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Display Name
              </label>
              <div className="relative">
                <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300 dark:text-gray-600 pointer-events-none" />
                <input
                  value={displayName}
                  onChange={e => { setDisplayName(e.target.value); setSaved(false) }}
                  placeholder="Your name"
                  className="w-full pl-9 pr-4 py-2.5 text-[13px] border border-gray-200 dark:border-zinc-700 rounded-xl outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 bg-white dark:bg-zinc-800 text-gray-900 dark:text-white placeholder:text-gray-300 dark:placeholder:text-gray-600 transition-all"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-1.5">
                Email
              </label>
              <input
                value={email}
                disabled
                className="w-full px-4 py-2.5 text-[13px] border border-gray-100 dark:border-zinc-700 rounded-xl bg-gray-50 dark:bg-zinc-800/50 text-gray-400 dark:text-gray-600 cursor-not-allowed"
              />
              <p className="text-[11px] text-gray-300 dark:text-gray-600 mt-1">Email is managed via Supabase Auth</p>
            </div>
            <button
              onClick={save}
              disabled={saving || !displayName.trim()}
              className={`inline-flex items-center gap-2 text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all disabled:opacity-40 ${
                saved
                  ? 'bg-[#f0faf4] dark:bg-[#089447]/20 text-[#089447]'
                  : 'bg-[#089447] hover:bg-[#077a3c] text-white shadow-sm'
              }`}
            >
              {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> {saving ? 'Saving…' : 'Save Changes'}</>}
            </button>
          </div>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card p-6">
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
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card p-6">
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-4">Security</h2>
          <div className="flex items-center justify-between py-3 border border-gray-100 dark:border-zinc-800 rounded-xl px-4">
            <div>
              <p className="text-[13px] font-medium text-gray-700 dark:text-gray-300">Authentication</p>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Managed via Supabase Auth — use the Dashboard to reset passwords
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Shield size={13} className="text-[#089447]" />
              <span className="text-[11px] font-semibold text-[#089447]">Protected</span>
            </div>
          </div>
        </div>

        {/* Session */}
        <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-gray-100 dark:border-zinc-800 shadow-card p-6">
          <h2 className="text-[13px] font-bold text-gray-900 dark:text-white mb-1">Session</h2>
          <p className="text-[12px] text-gray-400 mb-4">You are signed in as {email}.</p>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 text-[13px] font-semibold text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 px-4 py-2.5 rounded-xl transition-all border border-gray-200 dark:border-zinc-700 hover:border-red-200 dark:hover:border-red-800 hover:bg-red-50 dark:hover:bg-red-950/20"
          >
            <LogOut size={14} />
            Sign Out
          </button>
        </div>

      </div>
    </div>
  )
}
