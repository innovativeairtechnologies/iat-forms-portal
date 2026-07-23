'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Eye, EyeOff, ArrowRight, X, FileText, Users, Bell } from 'lucide-react'
import Image from 'next/image'
import Logo from '@/components/Logo'
import { motion } from 'framer-motion'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import { normalizeRole, landingForRole } from '@/lib/roles'
import { safeRedirect } from '@/lib/redirect'

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}

function LoginForm() {
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)
  const [showPw, setShowPw]     = useState(false)
  const router       = useRouter()
  const searchParams = useSearchParams()
  const supabase     = createSupabaseBrowser()

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
    if (authError || !data.user) {
      setError('Incorrect email or password. Please try again.')
      setLoading(false)
      return
    }

    // Read role from profiles table
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    const role = normalizeRole(profile?.role)

    // Record the sign-in (IP / location / device captured server-side). The
    // session cookie is already set, so this same-origin POST is authenticated.
    // Fire-and-forget with keepalive so it survives the imminent navigation and
    // never delays the redirect; a logging failure is intentionally ignored.
    const portal =
      role === 'customer' ? 'customer' : role === 'production' ? 'employee' : 'admin'
    void fetch('/api/auth/login-event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ portal, method: 'password' }),
      keepalive: true,
    }).catch(() => {})

    // Customer — first-time setup sets the password via /customer/welcome
    if (role === 'customer') {
      const setupComplete = data.user.user_metadata?.setup_complete
      if (!setupComplete) {
        router.push('/customer/welcome')
      } else {
        // Customers stay inside /customer regardless of what the param says.
        const redirect = safeRedirect(searchParams.get('redirect'), '/customer')
        router.push(redirect.startsWith('/customer') ? redirect : '/customer')
      }
      router.refresh()
      return
    }

    // Base production first-time setup still sets its password via the employee
    // welcome page (customers use /customer/welcome). After setup it lands in
    // /admin like every other internal role (landingForRole → /admin/home).
    const setupComplete = data.user.user_metadata?.setup_complete
    if (role === 'production' && !setupComplete) {
      router.push('/employee/welcome')
      router.refresh()
      return
    }

    // Everyone else internal — full admin, the 5 scoped roles, AND set-up
    // production — lands via landingForRole, honoring a deep link (?redirect=).
    // Middleware re-gates whatever we push to, so honoring it can't widen access:
    // an unpermitted target just bounces to that role's home. (safeRedirect blocks
    // off-site absolute URLs — /login?redirect=https://evil.com — see lib/redirect.ts.)
    router.push(safeRedirect(searchParams.get('redirect'), landingForRole(role)))
    router.refresh()
  }

  return (
    // Login is a light-only design (hardcoded white form panel). Pin the UA
    // color-scheme to light so an OS/system-dark theme (next-themes adds .dark
    // to <html>) can't darken the inputs, password-reveal, autofill, etc.
    <div className="min-h-screen flex" style={{ colorScheme: 'light' }}>

      {/* ── Left panel ── */}
      <div
        className="hidden lg:flex w-1/2 flex-col relative overflow-hidden"
        style={{ background: 'linear-gradient(145deg, #040d07 0%, #071a10 40%, #0a2418 100%)' }}
      >
        {/* Grid */}
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'linear-gradient(rgba(8,148,71,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(8,148,71,0.06) 1px, transparent 1px)',
          backgroundSize: '52px 52px',
        }} />

        {/* Glow orbs */}
        <div className="absolute top-0 right-0 w-[480px] h-[480px] pointer-events-none"
          style={{ background: 'radial-gradient(circle at 80% 10%, rgba(8,148,71,0.2) 0%, transparent 60%)' }} />
        <div className="absolute bottom-0 left-0 w-[400px] h-[400px] pointer-events-none"
          style={{ background: 'radial-gradient(circle at 10% 90%, rgba(8,148,71,0.12) 0%, transparent 60%)' }} />

        {/* Content */}
        <div className="relative z-10 flex flex-col h-full px-14 py-12">

          {/* Logo */}
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex items-center gap-3">
            {/* Always-dark brand panel → use the all-white mark */}
            <Image src="/iat-logo-white.png" alt="IAT" width={22} height={28} className="flex-shrink-0" />
            <div>
              <p className="text-[13px] font-bold text-white leading-none">IAT Portal</p>
              <p className="text-[11px] text-[#089447] leading-none mt-0.5 font-mono">Internal Operations</p>
            </div>
          </motion.div>

          {/* Headline */}
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] }} className="mt-auto">
            <p className="text-[11px] font-mono tracking-[0.2em] text-[#089447] uppercase mb-5">
              One Platform. Every Role.
            </p>
            <h1 className="text-[42px] font-bold text-white leading-[1.1] tracking-tight mb-6">
              One portal.<br />
              Every form.<br />
              <span style={{ color: '#089447' }}>Zero subscriptions.</span>
            </h1>
            <p className="text-[15px] leading-relaxed max-w-sm" style={{ color: 'rgba(255,255,255,0.5)' }}>
              A custom-built internal platform for Innovative Air Technologies — forms, time off, employee management, and more.
            </p>
          </motion.div>

          {/* Feature pills */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            className="flex flex-col gap-3 mt-10">
            {[
              { icon: FileText, label: 'Drag-and-drop form builder & submissions' },
              { icon: Bell,     label: 'Email notifications & request approvals' },
              { icon: Users,    label: 'Employee directory, PTO & sick time' },
            ].map(({ icon: Icon, label }) => (
              <div key={label} className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(8,148,71,0.15)', border: '1px solid rgba(8,148,71,0.25)' }}>
                  <Icon size={13} color="#089447" />
                </div>
                <span className="text-[13px] font-medium" style={{ color: 'rgba(255,255,255,0.6)' }}>{label}</span>
              </div>
            ))}
          </motion.div>

          {/* Bottom note */}
          <p className="mt-10 text-[11px] font-mono" style={{ color: 'rgba(8,148,71,0.35)' }}>
            © 2026 Innovative Air Technologies
          </p>
        </div>
      </div>

      {/* ── Right panel ── */}
      <div className="flex-1 flex flex-col bg-white">

        {/* Mobile logo */}
        <div className="lg:hidden flex items-center gap-2.5 px-8 pt-8">
          <Logo size={26} className="flex-shrink-0" />
          <span className="text-[13px] font-bold text-gray-900">IAT Portal</span>
        </div>

        {/* Form area */}
        <div className="flex-1 flex items-center justify-center px-8 py-12">
          <motion.div initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-[360px]">

            <div className="mb-8">
              <h2 className="text-[28px] font-bold text-gray-900 tracking-tight leading-tight mb-2">
                Welcome back.
              </h2>
              <p className="text-[14px] text-gray-400">
                Sign in to access the IAT portal.
              </p>
            </div>

            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => { setEmail(e.target.value); setError('') }}
                  autoFocus
                  placeholder="you@iat.com"
                  className="w-full bg-white border border-gray-200 text-gray-900 text-[14px] rounded-xl px-4 py-3 outline-none transition-all placeholder:text-gray-300 focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={e => { setPassword(e.target.value); setError('') }}
                    placeholder="••••••••••••"
                    className="w-full bg-white border border-gray-200 text-gray-900 text-[14px] rounded-xl px-4 py-3 pr-11 outline-none transition-all placeholder:text-gray-300 focus:border-[#089447] focus:ring-2 focus:ring-[#089447]/10"
                  />
                  <button type="button" tabIndex={-1} onClick={() => setShowPw(v => !v)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500 transition-colors">
                    {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-[12px] text-red-500 bg-red-50 border border-red-100 rounded-lg px-3 py-2.5">
                  <X size={12} className="flex-shrink-0" />{error}
                </motion.div>
              )}

              <button type="submit" disabled={loading || !email || !password}
                className="w-full flex items-center justify-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-[14px] font-semibold py-3 rounded-xl transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm">
                {loading ? (
                  <span className="animate-pulse">Signing in…</span>
                ) : (
                  <>Sign In <ArrowRight size={15} /></>
                )}
              </button>
            </form>

            <p className="text-center text-[12px] text-gray-300 mt-8">
              Secured · Internal access only
            </p>
          </motion.div>
        </div>
      </div>
    </div>
  )
}
