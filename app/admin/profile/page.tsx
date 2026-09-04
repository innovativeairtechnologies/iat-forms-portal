'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, User, Save, LogOut, Check, Shield, Users } from 'lucide-react'
import Link from 'next/link'
import ThemeToggle from '@/components/ThemeToggle'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { DirectoryList } from '@/components/dashboards/DirectoryCard'
import type { DirectoryPerson } from '@/lib/directory'
import { ROLE_LABELS, type Role } from '@/lib/roles'

/* Ported off the pre-DESIGN.md styling — raw gray/zinc palettes, the hard-coded
   brand hex and resting shadows — onto semantic tokens 2026-09-04, when the
   company directory section was added. A token-correct card dropped into a
   legacy page would have read as a different app. Behaviour is unchanged: edit
   display name, theme, sign out. */

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-hairline bg-surface overflow-hidden">
      <div className="flex items-center h-9 px-4 border-b border-hairline-soft">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{title}</h2>
      </div>
      {children}
    </div>
  )
}

export default function ProfilePage() {
  const router = useRouter()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [people, setPeople] = useState<DirectoryPerson[] | null>(null)

  useEffect(() => {
    fetch('/api/admin/profile')
      .then(r => r.json())
      .then(data => {
        setDisplayName(data.display_name || '')
        setEmail(data.email || '')
        setRole(data.role ?? null)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  // The directory loads separately so a slow or failed roster read never blocks
  // the part of this page the person actually came here for.
  useEffect(() => {
    fetch('/api/admin/directory')
      .then(r => (r.ok ? r.json() : { people: [] }))
      .then(d => setPeople(d.people ?? []))
      .catch(() => setPeople([]))
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
        <div className="w-5 h-5 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-canvas">

      {/* Header */}
      <div className="px-4 sm:px-8 pt-6 sm:pt-8 pb-4 sm:pb-6 border-b border-hairline bg-surface">
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 text-[12px] font-medium text-ink-muted hover:text-ink transition-colors mb-5"
        >
          <ArrowLeft size={13} />
          Dashboard
        </Link>
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-xl bg-surface-strong text-ink flex items-center justify-center text-[18px] font-semibold flex-shrink-0 select-none">
            {initials}
          </div>
          <div className="min-w-0">
            <h1 className="text-[22px] font-semibold text-ink tracking-[-0.01em] leading-tight truncate">
              {displayName || 'Your profile'}
            </h1>
            <p className="text-[13px] text-ink-muted mt-0.5 truncate">
              {email}{role ? ` · ${ROLE_LABELS[role] ?? role}` : ''}
            </p>
          </div>
        </div>
      </div>

      <div className="p-4 sm:p-8 grid gap-4 lg:grid-cols-2 items-start max-w-5xl">

        <div className="space-y-4 min-w-0">

          {/* Profile */}
          <Section title="Profile">
            <div className="p-4 space-y-4">
              <div>
                <label htmlFor="display-name" className="block text-[11px] font-semibold text-ink-muted uppercase tracking-[0.06em] mb-1.5">
                  Display name
                </label>
                <div className="relative">
                  <User size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
                  <input
                    id="display-name"
                    value={displayName}
                    onChange={e => { setDisplayName(e.target.value); setSaved(false) }}
                    placeholder="Your name"
                    className="w-full h-9 pl-9 pr-4 text-[13px] rounded-lg border border-hairline bg-surface text-ink placeholder:text-ink-faint outline-none focus:border-brand focus:ring-2 focus:ring-focus transition-colors"
                  />
                </div>
              </div>
              <div>
                <label htmlFor="profile-email" className="block text-[11px] font-semibold text-ink-muted uppercase tracking-[0.06em] mb-1.5">
                  Email
                </label>
                <input
                  id="profile-email"
                  value={email}
                  disabled
                  className="w-full h-9 px-4 text-[13px] rounded-lg border border-hairline bg-surface-soft text-ink-muted cursor-not-allowed"
                />
                <p className="text-[11px] text-ink-faint mt-1.5">Email is managed by your sign-in account.</p>
              </div>
              <button
                onClick={save}
                disabled={saving || !displayName.trim()}
                className={`inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-medium transition-colors disabled:opacity-40 ${
                  saved ? 'bg-brand-soft text-brand-ink' : 'bg-brand hover:bg-brand-hover text-white'
                }`}
              >
                {saved ? <><Check size={14} /> Saved</> : <><Save size={14} /> {saving ? 'Saving…' : 'Save changes'}</>}
              </button>
            </div>
          </Section>

          {/* Appearance */}
          <Section title="Appearance">
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">Theme</p>
                <p className="text-[11px] text-ink-muted mt-0.5">Switch between light and dark mode.</p>
              </div>
              <ThemeToggle />
            </div>
          </Section>

          {/* Security */}
          <Section title="Security">
            <div className="p-4 flex items-center justify-between gap-4">
              <div className="min-w-0">
                <p className="text-[13px] font-medium text-ink">Authentication</p>
                <p className="text-[11px] text-ink-muted mt-0.5">
                  Handled by your company sign-in. Password resets go through IT.
                </p>
              </div>
              <span className="inline-flex items-center gap-1.5 flex-shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand-ink">
                <Shield size={12} />
                Protected
              </span>
            </div>
          </Section>

          {/* Session */}
          <Section title="Session">
            <div className="p-4">
              <p className="text-[12px] text-ink-muted mb-3">You are signed in as {email}.</p>
              <button
                onClick={logout}
                className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-secondary border border-hairline hover:border-hairline-strong hover:bg-surface-strong hover:text-ink transition-colors"
              >
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </Section>
        </div>

        {/* Company directory — the quick "who is that / what's their number"
            lookup, next to your own details rather than a page away. */}
        <div className="rounded-xl border border-hairline bg-surface overflow-hidden flex flex-col max-h-[560px] min-w-0">
          <div className="flex items-center gap-2 h-9 px-4 border-b border-hairline-soft">
            <Users size={13} className="text-ink-faint flex-shrink-0" />
            <h2 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Company directory</h2>
            {people && (
              <span className="ml-auto text-[11px] text-ink-faint tabular-nums">
                {people.length} {people.length === 1 ? 'person' : 'people'}
              </span>
            )}
          </div>

          {people === null ? (
            <p className="px-4 py-6 text-[12px] text-ink-muted text-center">Loading the directory…</p>
          ) : (
            <DirectoryList people={people} />
          )}

          <Link
            href="/admin/me/directory"
            className="flex-shrink-0 px-4 py-2 border-t border-hairline-soft text-[11px] font-medium text-ink-muted hover:text-ink transition-colors"
          >
            View full directory &amp; org chart →
          </Link>
        </div>

      </div>
    </div>
  )
}
