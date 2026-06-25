'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'

// Reached /customer with a live auth session that can't be resolved to a customer
// account — e.g. the login isn't linked to a company (profiles.customer_id is null,
// which happens if the customer's company row was deleted: the FK is ON DELETE SET
// NULL). Server-redirecting to /login here would loop, because middleware sends a
// "logged-in customer" straight back to /customer. So we sign out locally (clears
// the session) and then go to /login, which now renders as logged-out. No loop.
export default function CustomerSessionError() {
  const router = useRouter()
  useEffect(() => {
    ;(async () => {
      try {
        await createSupabaseBrowser().auth.signOut({ scope: 'local' })
      } catch {
        // ignore — a local sign-out clears the cookies regardless
      }
      router.replace('/login')
    })()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-[#0a0a0b]">
      <div className="flex items-center gap-2 text-[14px] text-zinc-500 dark:text-zinc-400">
        <Loader2 size={18} className="animate-spin" /> Returning you to sign in…
      </div>
    </div>
  )
}
