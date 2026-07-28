import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { genTempPassword } from '@/lib/temp-password'
import { sendCustomerWelcomeEmail } from '@/lib/resend-customer'
import { provisionCustomerPortalAccount, provisionSummary } from '@/lib/customer-portal'

// Reset this customer's login to a fresh temp password and re-send the welcome
// email. Used when an invite was lost, or to re-activate a removed account.
export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await ctx.params

  const { data: customer } = await supabaseAdmin
    .from('customers')
    .select('id, company_name, primary_contact_name, contact_email')
    .eq('id', id)
    .single()
  if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
  if (!customer.contact_email) {
    return NextResponse.json({ error: 'This customer has no contact email on file.' }, { status: 400 })
  }

  // The portal login linked to this customer.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id')
    .eq('customer_id', id)
    .eq('role', 'customer')
    .limit(1)
    .maybeSingle()
  if (!profile?.id) {
    return NextResponse.json({ error: 'No portal login exists for this customer yet.' }, { status: 400 })
  }

  const tempPassword = genTempPassword()
  const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(profile.id, { password: tempPassword })
  if (updErr) return NextResponse.json({ error: updErr.message }, { status: 500 })

  // Re-sending an invite re-activates the account if it had been removed.
  await supabaseAdmin.from('customers').update({ status: 'active' }).eq('id', id)

  // Mirror the reset onto the customer-portal deployment with the SAME temp
  // password, so the credentials in the welcome email work on either portal.
  // Without this the two drift on every resend: the customer gets a password
  // that works internally and fails on the customer portal — which is exactly
  // how an invite appears "broken" to them. `create` is idempotent, so it also
  // provisions an account that never made it across the first time.
  const provision = await provisionCustomerPortalAccount({
    op: 'create',
    customerId: id,
    email: customer.contact_email,
    companyName: customer.company_name,
    displayName: customer.primary_contact_name,
    tempPassword,
  })
  if (!provision.ok && !provision.skipped) {
    console.error('[customers/resend-invite] customer-portal provisioning failed:', provision.reason)
  }

  const loginUrl = `${req.nextUrl.origin}/login`
  let emailSent = false
  try {
    const res = await sendCustomerWelcomeEmail({
      to: customer.contact_email,
      contactName: customer.primary_contact_name,
      companyName: customer.company_name,
      tempPassword,
      loginUrl,
    })
    emailSent = !res.error
  } catch (e) {
    console.error('[customers/resend-invite] welcome email threw:', e)
  }

  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'customer.resend_invite',
    entityType: 'customer',
    entityId: id,
    summary: `Re-sent portal invite to ${customer.company_name} (${customer.contact_email})`,
    metadata: { email_sent: emailSent, customer_portal_provisioned: provisionSummary(provision) },
  })

  return NextResponse.json({
    ok: true,
    temp_password: tempPassword,
    login_url: loginUrl,
    email_sent: emailSent,
    // Surfaced so the UI can warn instead of handing over credentials that only
    // work on one of the two portals.
    customer_portal_provisioned: provision.ok,
  })
}
