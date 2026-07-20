export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { HomePage } from '@/app/home/HomePage'

/* Company Home for base employees — the shared intranet landing rendered INSIDE
   the employee shell (app/employee/(protected)/layout.tsx supplies the sidebar). */

export default async function EmployeeHome() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: emp } = await supabaseAdmin
    .from('employees').select('name').eq('id', user.id).single()

  // Employee shell shows a 56px (h-14) PortalTopBar above the page — subtract it
  // so the bento pins to the viewport without scrolling.
  return <HomePage name={(emp?.name || user.email || '').trim()} heightClass="lg:h-[calc(100dvh-68px)]" />
}
