'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Check, X, ArrowRight, Loader2 } from 'lucide-react'
import Logo from '@/components/Logo'
import { motion, AnimatePresence } from 'framer-motion'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// Mirror of the employee welcome password rules.
const REQUIREMENTS = [
  { id: 'length',  label: 'At least 8 characters',       test: (p: string) => p.length >= 8 },
  { id: 'upper',   label: '1 uppercase letter (A–Z)',     test: (p: string) => /[A-Z]/.test(p) },
  { id: 'lower',   label: '1 lowercase letter (a–z)',     test: (p: string) => /[a-z]/.test(p) },
  { id: 'number',  label: '1 number (0–9)',               test: (p: string) => /[0-9]/.test(p) },
  { id: 'special', label: '1 special character (!@#$…)',  test: (p: string) => /[^A-Za-z0-9]/.test(p) },
]

export default function CustomerWelcomePage() {
  const router   = useRouter()
  const supabase = createSupabaseBrowser()

  const [email, setEmail]   = useState<string | null>(null)
  const [password, setPassword]       = useState('')
  const [confirm, setConfirm]         = useState('')
  const [showPw, setShowPw]           = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pwTouched, setPwTouched]     = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // The set-password link already exchanged a session via /auth/callback, so the
  // customer is authenticated here. No session → back to login.
  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.replace('/login'); return }
      if (user.user_metadata?.setup_complete) { router.replace('/customer'); return }
      setEmail(user.email ?? '')
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const met       = useMemo(() => REQUIREMENTS.map(r => ({ ...r, ok: r.test(password) })), [password])
  const allMet    = met.every(r => r.ok)
  const pwMatch   = password === confirm && confirm.length > 0
  const canSubmit = allMet && pwMatch && !saving

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSubmit) return
    setSaving(true)
    setError('')

    const { error: pwErr } = await supabase.auth.updateUser({
      password,
      data: { setup_complete: true },
    })
    if (pwErr) { setError(pwErr.message); setSaving(false); return }

    router.push('/customer')
    router.refresh()
  }

  if (email === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <Loader2 size={22} className="text-[#089447] animate-spin" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white flex flex-col" style={{ colorScheme: 'light' }}>

      {/* Header */}
      <header className="border-b border-gray-100 px-6 h-14 flex items-center">
        <div className="flex items-center gap-2.5">
          <Logo size={22} className="flex-shrink-0" />
          <span className="text-[14px] font-bold text-gray-900">IAT Customer Portal</span>
        </div>
      </header>

      {/* Content */}
      <div className="flex-1 flex items-start justify-center px-6 py-12">
        <div className="w-full max-w-[440px]">
          <motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>

            <div className="mb-8">
              <h1 className="text-[26px] font-bold text-gray-900 tracking-tight mb-1.5">Set your password</h1>
              <p className="text-[14px] text-gray-400">
                Welcome to your IAT portal. Create a password to view your equipment, build &amp; shipping status, and support.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-5">

              {/* Email — read-only */}
              <div>
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-1.5">Email</label>
                <input value={email} disabled
                  className="w-full text-[14px] text-gray-400 bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 cursor-not-allowed" />
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

                <AnimatePresence>
                  {pwTouched && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.2 }}
                      className="mt-3 space-y-1.5 overflow-hidden">
                      {met.map(req => (
                        <div key={req.id} className="flex items-center gap-2">
                          <div className={`w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-colors duration-200 ${req.ok ? 'bg-[#089447]' : 'bg-gray-100'}`}>
                            {req.ok
                              ? <Check size={10} className="text-white" strokeWidth={3} />
                              : <X size={9} className="text-gray-300" strokeWidth={2.5} />}
                          </div>
                          <span className={`text-[12px] transition-colors duration-200 ${req.ok ? 'text-[#089447] font-medium' : 'text-gray-400'}`}>
                            {req.label}
                          </span>
                        </div>
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

              {error && (
                <p className="text-[13px] text-red-500 bg-red-50 border border-red-100 rounded-xl px-4 py-2.5">{error}</p>
              )}

              <button type="submit" disabled={!canSubmit}
                className="w-full flex items-center justify-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[14px] font-semibold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm mt-2">
                {saving ? <><Loader2 size={15} className="animate-spin" /> Setting up…</> : <>Go to My Portal <ArrowRight size={15} /></>}
              </button>
            </form>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
