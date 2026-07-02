import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'

// Permanently delete a customer company AND its portal logins. This is distinct
// from POST .../remove, which only revokes access and keeps the record. Deleting
// the logins (auth.admin.deleteUser) frees those emails for reuse; the company's
// equipment is kept (equipment.customer_id → SET NULL).
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('company_name')
    .eq('id', id)
    .single()
  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })

  // Capture the login ids BEFORE deleting the company row (that row-delete sets
  // profiles.customer_id to NULL via the SET NULL FK, so we'd lose them after).
  const { data: logins } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('customer_id', id)
    .eq('role', 'customer')
  const loginIds = (logins ?? []).map((p) => p.id)

  // Delete the company row first. If this fails we haven't touched the (irreversible)
  // auth-user deletes yet, so the record stays intact for a clean retry — no partial
  // "can't log in but still listed" state. (equipment.customer_id → SET NULL.)
  const { error } = await supabaseAdmin.from('customers').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Now remove the captured logins so their emails free up (cascades their profiles).
  let removedLogins = 0
  for (const uid of loginIds) {
    const { error: e } = await supabaseAdmin.auth.admin.deleteUser(uid)
    if (!e) removedLogins++
  }
  // Safety net for any profile rows that didn't cascade with the auth user.
  if (loginIds.length) await supabaseAdmin.from('profiles').delete().in('id', loginIds)

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'customer.delete',
    entityType: 'customer',
    entityId: id,
    summary: `Deleted customer ${customer.company_name}`,
    metadata: { removed_logins: removedLogins },
  })

  return NextResponse.json({ success: true, removed_logins: removedLogins })
}
