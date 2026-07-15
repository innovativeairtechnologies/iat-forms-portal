'use client'

import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

// "Go back to wherever you came from" — replaces the old /forms directory links.
// Uses browser history so a form opened from any page returns there; falls back
// to the public /support page when there's no history (e.g. an anonymous visitor
// who opened a form from a shared/QR/email link in a fresh tab). Not '/', which
// redirects unauthenticated visitors to /login — a dead end for external fillers.
export default function BackLink({
  label = 'Back',
  fallback = '/support',
  className = '',
}: {
  label?: string
  fallback?: string
  className?: string
}) {
  const router = useRouter()
  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== 'undefined' && window.history.length > 1) router.back()
        else router.push(fallback)
      }}
      className={className}
    >
      <ArrowLeft size={13} />
      {label}
    </button>
  )
}
