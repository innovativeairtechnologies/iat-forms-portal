'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Check, X, ArrowRight, Loader2 } from 'lucide-react'
import Logo from '@/components/Logo'
import { motion, AnimatePresence } from 'framer-motion'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import type { Employee } from '@/lib/supabase'
// supabase browser client used for auth.updateUser only


// ── Password requirement definitions ──────────────────────────────────────────
const REQUIREMENTS = [
  { id: 'length',    label: 'At least 8 characters',       test: (p: string) => p.length >= 8 },
  { id: 'upper',     label: '1 uppercase letter (A–Z)',     test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',     label: '1 lowercase letter (a–z)',     test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',    label: '1 number (0–9)',               test: (p: string) => /[0-9]/.test(p) },
  { id: 'special',   label: '1 special character (!@#$…)',  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export default function WelcomePage() {
  const router   = useRouter()
  const supabase = createSupabaseBrowser()

  const [employee, setEmployee] = useState<Employee | null>(null)
  const [loadError, setLoadError] = useState('')
  const [step, setStep]         = useState<'password' | 'profile'>('password')

  // Password step
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPw, setShowPw]         = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwTouched, setPwTouched]   = useState(false)

  // Profile step
  const [profile, setProfile] = useState({ name: '', job_title: '', department: '', phone: '', bio: '' })

  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  useEffect(() => {
    const load = async () => {
      const res = await fetch('/api/employees/me')
      if (res.status === 401) { router.push('/login'); return }
      const json = await res.json()
      if (!res.ok) {
        setLoadError(json.error || 'Could not load your account. Please contact your admin.')
        return
      }
      setEmployee(json.employee)
      setProfile(p => ({ ...p, name: json.employee.name || '' }))
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const met       = useMemo(() => REQUIREMENTS.map(r => ({ ...r, ok: r.test(password) })), [password])
  const allMet    = met.every(r => r.ok)
  const pwMatch   = password === confirm && confirm.length > 0
  const canSubmit = allMet && pwMatch

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setStep('profile')
  }

  const submitProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!employee) return
    setSaving(true)
    setError('')

    // Set the password and mark setup as complete in auth metadata
    const { error: pwErr } = await supabase.auth.updateUser({
      password,
      data: { setup_complete: true },
    })
    if (pwErr) { setError(pwErr.message); setSaving(false); return }

    // Save profile
    const { error: profileErr } = await supabase
      .from('employees')
      .update(profile)
      .eq('id', employee.id)

    if (profileErr) { setError(profileErr.message); setSaving(false); return }

    // Post-setup, land in /admin like every other internal role (/home routes
    // production to /admin/home via landingForRole). The old /employee/profile
    // target still works, but /admin is now the consolidated employee portal.
    router.push('/home')
    router.refresh()
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-white gap-4">
        {loadError ? (
          <div className="text-center px-6 max-w-sm">
            <p className="text-[15px] font-semibold text-gray-800 mb-2">Something went wrong</p>
            <p className="text-[13px] text-gray-400">{loadError}</p>
            <button onClick={() => router.push('/login')}
              className="mt-4 text-[13px] text-[#089447] hover:underline">
              Back to login
            </button>
          </div>
        ) : (
          <Loader2 size={22} className="text-[#089447] animate-spin" />
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">

      {/* Header */}
      <header className="border-b border-gray-100 px-6 h-14 flex items-center">
        <div className="flex items-center gap-2.5">
          <Logo size={22} className="flex-shrink-0" />
          <span className="text-[14px] font-bold text-gray-900">IAT Portal</span>
        </div>
      </header>

      {/* Progress indicator */}
      <div className="border-b border-gray-100 bg-gray-50 px-6 py-3 flex items-center gap-3">
        <Step n={1} label="Set Password" active={step === 'password'} done={step === 'profile'} />
        <div className="h-px flex-1 bg-gray-200" />
        <Step n={2} label="Your Profile"  active={step === 'profile'}  done={false} />
      </div>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">

          <AnimatePresence mode="wait">

            {/* ── Step 1: Set password ── */}
            {step === 'password' && (
              <motion.div key="password"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}>

                <div className="mb-8">
                  <h1 className="text-[26px] font-bold text-gray-900 tracking-tight mb-1.5">Welcome to IAT Portal</h1>
                  <p className="text-[14px] text-gray-400">
                    You&apos;ve been invited. Let&apos;s start by setting your password.
                  </p>
                </div>

                <form onSubmit={submitPassword} className="space-y-5">

                  {/* Email — read-only */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Email</label>
                    <input value={employee.email} disabled
                      className="w-full text-[14px] text-gray-400 bg-gray-50 border border-gray-150 rounded-xl px-4 py-3 cursor-not-allowed" />
                  </div>

                  {/* Password */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">New Password</label>
                    <div className="relative">
                      <input
                        type={showPw ? 'text' : 'password'}
                        value={password}
                        onChange={e => { setPassword(e.target.value); setPwTouched(true) }}
                        autoFocus
                        placeholder="Create a strong password"
                        className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 pr-11 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300"
                      />
                      <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                        {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {/* Requirements */}
                    <AnimatePresence>
                      {pwTouched && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="mt-3 space-y-1.5 overflow-hidden"
                        >
                          {met.map(req => (
                            <motion.div key={req.id}
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              className="flex items-center gap-2">
                              <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${req.ok ? 'bg-[#089447]' : 'bg-gray-100'}`}>
                                {req.ok
                                  ? <Check size={10} className="text-white" strokeWidth={3} />
                                  : <X size={9} className="text-gray-300" strokeWidth={2.5} />
                                }
                              </div>
                              <span className={`text-[12px] transition-colors duration-200 ${req.ok ? 'text-[#089447] font-medium' : 'text-gray-400'}`}>
                                {req.label}
                              </span>
                            </motion.div>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Confirm password */}
                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="Re-enter your password"
                        className={`w-full text-[14px] text-gray-800 bg-gray-50 border rounded-xl px-4 py-3 pr-11 outline-none focus:ring-2 transition-all placeholder:text-gray-300 ${
                          confirm.length > 0
                            ? pwMatch
                              ? 'border-[#089447] focus:border-[#089447] focus:ring-[#089447]/10'
                              : 'border-red-300 focus:border-red-400 focus:ring-red-100'
                            : 'border-gray-200 focus:border-[#089447] focus:ring-[#089447]/10'
                        }`}
                      />
                      <button type="button" tabIndex={-1} onClick={() => setShowConfirm(v => !v)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                        {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                    {confirm.length > 0 && !pwMatch && (
                      <p className="text-[12px] text-red-400 mt-1.5">Passwords don&apos;t match.</p>
                    )}
                  </div>

                  <button type="submit" disabled={!canSubmit}
                    className="w-full flex items-center justify-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[14px] font-semibold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm mt-2">
                    Continue <ArrowRight size={15} />
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── Step 2: Complete profile ── */}
            {step === 'profile' && (
              <motion.div key="profile"
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.2 }}>

                <div className="mb-8">
                  <h1 className="text-[26px] font-bold text-gray-900 tracking-tight mb-1.5">Complete Your Profile</h1>
                  <p className="text-[14px] text-gray-400">
                    Tell your team a bit about yourself. You can always update this later.
                  </p>
                </div>

                <form onSubmit={submitProfile} className="space-y-4">
                  {[
                    { key: 'name',        label: 'Full Name',   placeholder: 'Jane Doe',            required: true  },
                    { key: 'job_title',   label: 'Job Title',   placeholder: 'HVAC Technician',     required: false },
                    { key: 'department',  label: 'Department',  placeholder: 'Field Services',      required: false },
                    { key: 'phone',       label: 'Phone',       placeholder: '(555) 000-0000',      required: false },
                  ].map(({ key, label, placeholder, required }) => (
                    <div key={key}>
                      <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                        {label}{!required && <span className="normal-case font-normal text-gray-300 ml-1">— optional</span>}
                      </label>
                      <input
                        value={(profile as Record<string, string>)[key]}
                        onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))}
                        required={required}
                        placeholder={placeholder}
                        type={key === 'phone' ? 'tel' : 'text'}
                        className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300"
                      />
                    </div>
                  ))}

                  <div>
                    <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">
                      Bio / Hobbies <span className="normal-case font-normal text-gray-300">— optional</span>
                    </label>
                    <textarea value={profile.bio} onChange={e => setProfile(p => ({ ...p, bio: e.target.value }))}
                      rows={3} placeholder="Tell your team a bit about yourself…"
                      className="w-full text-[14px] text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 outline-none focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10 transition-all placeholder:text-gray-300 resize-none" />
                  </div>

                  {error && (
                    <p className="text-[13px] text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
                  )}

                  <div className="flex items-center gap-3 pt-1">
                    <button type="button" onClick={() => setStep('password')}
                      className="px-5 py-3 rounded-xl text-[14px] font-medium text-gray-400 hover:text-gray-700 transition-colors">
                      Back
                    </button>
                    <button type="submit" disabled={saving || !profile.name.trim()}
                      className="flex-1 flex items-center justify-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[14px] font-semibold py-3 rounded-xl transition-all disabled:opacity-40 shadow-sm">
                      {saving ? <><Loader2 size={15} className="animate-spin" /> Setting up…</> : <>Go to My Portal <ArrowRight size={15} /></>}
                    </button>
                  </div>
                </form>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}

function Step({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 transition-colors ${
        done   ? 'bg-[#089447] text-white' :
        active ? 'bg-[#089447] text-white' :
                 'bg-gray-200 text-gray-400'
      }`}>
        {done ? <Check size={11} strokeWidth={3} /> : n}
      </div>
      <span className={`text-[12px] font-medium transition-colors ${active || done ? 'text-gray-700' : 'text-gray-400'}`}>
        {label}
      </span>
    </div>
  )
}
