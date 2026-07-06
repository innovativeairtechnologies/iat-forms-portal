import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { Caveat } from 'next/font/google'

/* Full-bleed layout for the employee whiteboard — same auth gate as the
   (protected) group but WITHOUT EmployeeShell (no sidebar / top bar), so the
   board owns the whole viewport and feels like a whiteboard, not a website.
   Route groups don't affect URLs: /employee/board lives here. */

export const dynamic = 'force-dynamic'

// Marker-handwriting face for the board greeting/title.
const hand = Caveat({ subsets: ['latin'], weight: ['500', '600', '700'], variable: '--font-hand' })

export default async function CanvasLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return <div className={hand.variable}>{children}</div>
}
