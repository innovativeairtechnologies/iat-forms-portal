import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

// Remove a customer's portal access: delete their login(s) so they can no longer
// sign in, and mark the account inactive. The company + its equipment records are
// kept (equipment stays linked) — re-invite later to restore access.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, company_name')
    .eq('id', id)
    .single()
  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })

  const { data: logins } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('customer_id', id)
    .eq('role', 'customer')

  let removedLogins = 0
  for (const p of logins ?? []) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(p.id)
    if (!error) removedLogins++
  }
  // Clean up any profile rows that didn't cascade with the auth user.
  await supabaseAdmin.from('profiles').delete().eq('customer_id', id).eq('role', 'customer')

  await supabaseAdmin.from('customers').update({ status: 'inactive' }).eq('id', id)

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'customer.remove',
    entityType: 'customer',
    entityId: id,
    summary: `Removed portal access for ${customer.company_name}`,
    metadata: { removed_logins: removedLogins },
  })

  return NextResponse.json({ ok: true, removed_logins: removedLogins })
}
