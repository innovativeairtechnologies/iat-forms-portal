import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeRole, homeForRole } from '@/lib/roles'
import { getPermMatrix } from '@/lib/permissions'
import { getHomeData } from '@/lib/home-data'
import { FUN_FACTS } from '@/lib/home-content'
import { HomeView } from './HomeView'

/* /home — the shared company intranet home. Every internal user lands here first
   after login (see lib/roles.landingForRole + middleware); "Launch IAT Portal"
   sends each person on to their real workspace. Rebuilt from the SharePoint
   intranet into the Quiet Precision design system (DESIGN.md). */

export const dynamic = 'force-dynamic'

export default async function CompanyHome() {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role, display_name').eq('id', user.id).single()
  const role = normalizeRole(profile?.role)
  if (role === 'customer') redirect('/customer') // internal-only; middleware also guards

  const [{ data: emp }, matrix, data] = await Promise.all([
    supabaseAdmin.from('employees').select('name').eq('id', user.id).single(),
    getPermMatrix().catch(() => undefined),
    getHomeData(),
  ])

  const displayName = (emp?.name || profile?.display_name || user.email || '').trim()
  const firstName = displayName.split(' ')[0] || ''
  const launchHref = homeForRole(role, matrix)

  // Greeting + date + fun fact of the day, anchored to Eastern time.
  const now = new Date()
  const hourET = parseInt(now.toLocaleString('en-US', { timeZone: 'America/New_York', hour: '2-digit', hour12: false }), 10)
  const dateET = now.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'long', month: 'long', day: 'numeric' })
  const greeting = hourET < 12 ? 'Good morning' : hourET < 17 ? 'Good afternoon' : 'Good evening'
  const doy = Math.floor(
    (Date.parse(now.toLocaleDateString('en-US', { timeZone: 'America/New_York' })) - Date.parse(`1/1/${now.getFullYear()}`)) / 864e5,
  )
  const funIdx = ((doy % FUN_FACTS.length) + FUN_FACTS.length) % FUN_FACTS.length

  return (
    <HomeView
      displayName={displayName}
      launchHref={launchHref}
      greeting={greeting}
      dateET={dateET}
      firstName={firstName}
      funIdx={funIdx}
      data={data}
    />
  )
}
