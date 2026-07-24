'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Loader2, UserPlus, Clock, LogIn } from 'lucide-react'
import { getRecaptchaToken } from '@/components/use-recaptcha'

type CtaStatus = 'idle' | 'loading' | 'submitted' | 'already_pending' | 'already_linked' | 'error'

// Shared "Request Portal Access" CTA — used on both the ticket success screen
// (EquipmentTicketForm) and the status-lookup result (StatusClient), so the
// state machine and copy stay identical across both entry points.
export default function RequestAccountCta({
  ticketNumber,
  email,
  suppress = false,
  initialStatus = 'idle',
  className = '',
}: {
  ticketNumber: string
  email: string
  suppress?: boolean
  initialStatus?: CtaStatus
  className?: string
}) {
  const [status, setStatus] = useState<CtaStatus>(initialStatus)
  const [error, setError] = useState<string | null>(null)

  if (suppress) return null

  const submit = async () => {
    setStatus('loading')
    setError(null)
    try {
      const recaptcha_token = await getRecaptchaToken('request_account')
      const res = await fetch('/api/tickets/request-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket_number: ticketNumber, email, ...(recaptcha_token ? { recaptcha_token } : {}) }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong.')
      setStatus((json.status as CtaStatus) || 'submitted')
    } catch (e) {
      setStatus('error')
      setError(e instanceof Error ? e.message : 'Something went wrong.')
    }
  }

  if (status === 'already_linked') {
    return (
      <div className={`flex items-center gap-2.5 rounded-xl border border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-800/40 px-4 py-3 ${className}`}>
        <LogIn size={15} className="text-gray-400 flex-shrink-0" />
        <p className="text-[12.5px] text-gray-500 dark:text-gray-400">
          This ticket is linked to a portal account —{' '}
          <Link href="/login" className="font-semibold text-[#089447] hover:text-[#077a3c]">log in</Link> to see it there.
        </p>
      </div>
    )
  }

  if (status === 'submitted' || status === 'already_pending') {
    return (
      <div className={`flex items-center gap-2.5 rounded-xl border border-[#089447]/20 bg-[#089447]/5 px-4 py-3 ${className}`}>
        <Clock size={15} className="text-[#089447] flex-shrink-0" />
        <p className="text-[12.5px] text-gray-600 dark:text-gray-300">
          Portal access requested — we&apos;ll review it and email you once it&apos;s approved.
        </p>
      </div>
    )
  }

  return (
    <div className={`flex items-center justify-between gap-3 rounded-xl border border-[#089447]/20 bg-[#089447]/5 px-4 py-3 ${className}`}>
      <div className="min-w-0">
        <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100">See this — and all your equipment — in one place</p>
        {error && <p className="text-[11.5px] text-red-500 mt-0.5">{error}</p>}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={status === 'loading'}
        className="flex flex-shrink-0 items-center gap-1.5 text-[12.5px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] disabled:opacity-50 px-3.5 py-2 rounded-lg transition-all"
      >
        {status === 'loading' ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
        Request portal access
      </button>
    </div>
  )
}
