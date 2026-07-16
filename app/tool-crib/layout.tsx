import { redirect } from 'next/navigation'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { normalizeRole, isAdminSurfaceRole } from '@/lib/roles'
import ToolCribShell from './ToolCribShell'

export const dynamic = 'force-dynamic'

/* The shared scan surface, open to EVERY signed-in staff member.
 *
 * Top-level rather than under /employee/* on purpose: middleware's /employee
 * block bounces every admin-surface role to /admin, which would include
 * production_manager — the person who actually runs the crib.
 *
 * Because it isn't under /employee/(protected), it doesn't inherit that layout's
 * prop-drilled employees row, so identity is resolved here.
 */
export default async function ToolCribLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login?redirect=/tool-crib')

  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabaseAdmin.from('profiles').select('role').eq('id', user.id).single(),
    supabaseAdmin.from('employees').select('id, name').eq('id', user.id).single(),
  ])

  const role = normalizeRole(profile?.role)
  if (role === 'customer') redirect('/customer')

  const backHref = isAdminSurfaceRole(role) ? '/admin' : '/employee/profile'

  /* NOTE: deliberately does NOT sign the user out when the employees row is
     missing, unlike app/employee/(protected)/layout.tsx. Signing someone out
     mid-scan reads as a crash, and an admin without an employees row has a
     perfectly valid session — they just can't hold a tool (held_by FKs to
     employees). Let them in; the scan endpoint explains the problem in words. */
  return (
    <ToolCribShell name={employee?.name ?? null} backHref={backHref}>
      {children}
    </ToolCribShell>
  )
}
