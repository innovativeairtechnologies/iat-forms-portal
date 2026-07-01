import { NextRequest, NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { logAudit } from '@/lib/audit'
import { DEFAULT_MILESTONE_STAGES } from '@/lib/customer'
import { sendCustomerWelcomeEmail } from '@/lib/resend-customer'
import { genTempPassword } from '@/lib/temp-password'

type InvitePayload = {
  company_name?: string
  primary_contact_name?: string
  contact_email?: string
  phone?: string
  customer_location?: string
  existing_customer_id?: string
  equipment_id?: string                 // link this existing unit
  equipment?: {                         // …or create/upsert a unit by serial
    serial_number?: string
    model_number?: string
    voltage?: string
    location?: string
    ship_date?: string
    warranty_months?: number
    notes?: string
  }
  seed_tracker?: boolean                 // default true
  link_ticket_id?: string                // the ticket that triggered this invite (from a request approval)
  link_request_id?: string               // the customer_portal_requests row to mark approved
}

export async function POST(req: NextRequest) {
  const admin = await getAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json()) as InvitePayload
  const companyName = body.company_name?.trim()
  const contactEmail = body.contact_email?.trim().toLowerCase()
  const contactName = body.primary_contact_name?.trim() || null
  const phone = body.phone?.trim() || null

  if (!companyName)  return NextResponse.json({ error: 'Company name is required.' },  { status: 400 })
  if (!contactEmail) return NextResponse.json({ error: 'Contact email is required.' }, { status: 400 })

  // ── 1. Resolve (or create) the customer company ────────────────────────────
  let customerId = body.existing_customer_id || null
  if (!customerId) {
    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('id')
      .ilike('contact_email', contactEmail)
      .maybeSingle()
    customerId = existing?.id ?? null
  }
  let createdNew = false
  if (!customerId) {
    const { data: created, error } = await supabaseAdmin
      .from('customers')
      .insert({
        company_name: companyName,
        primary_contact_name: contactName,
        contact_email: contactEmail,
        phone,
        location: body.customer_location?.trim() || null,
      })
      .select('id')
      .single()
    if (error || !created) {
      return NextResponse.json({ error: error?.message || 'Could not create the customer.' }, { status: 500 })
    }
    customerId = created.id
    createdNew = true
  }
  // Re-using an existing company (e.g. re-inviting after a "Remove from portal")
  // → make sure the account is active again.
  if (!createdNew) {
    await supabaseAdmin.from('customers').update({ status: 'active' }).eq('id', customerId)
  }

  // ── 2. Create the customer's login (email + password) ──────────────────────
  // Temp password the customer changes on first login (the /customer/welcome gate).
  const tempPassword = genTempPassword()
  const { data: createdUser, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email: contactEmail,
    password: tempPassword,
    email_confirm: true,
    user_metadata: { name: contactName || companyName },
  })
  if (createErr || !createdUser?.user?.id) {
    const msg = /already.*regist|exists/i.test(createErr?.message || '')
      ? 'An account with this email already exists.'
      : (createErr?.message || 'Could not create the login.')
    return NextResponse.json({ error: msg }, { status: 400 })
  }
  const userId = createdUser.user.id

  // ── 3. Mark the profile as a customer linked to the company ────────────────
  // (the new-user trigger created it as 'employee' — override here)
  const { error: profileErr } = await supabaseAdmin
    .from('profiles')
    .upsert({ id: userId, role: 'customer', display_name: contactName || companyName, customer_id: customerId })
  if (profileErr) {
    return NextResponse.json({ error: profileErr.message }, { status: 500 })
  }

  // ── 4. Link or create the equipment for this customer ──────────────────────
  let equipmentId: string | null = null
  const denorm = {
    customer_id: customerId,
    customer_company: companyName,
    customer_name: contactName,
    customer_email: contactEmail,
    customer_phone: phone,
  }
  if (body.equipment_id) {
    equipmentId = body.equipment_id
    await supabaseAdmin.from('equipment').update(denorm).eq('id', body.equipment_id)
  } else if (body.equipment?.serial_number?.trim()) {
    const eq = body.equipment
    const { data: upserted, error } = await supabaseAdmin
      .from('equipment')
      .upsert(
        {
          serial_number: eq.serial_number!.trim(),
          model_number: eq.model_number?.trim() || null,
          voltage: eq.voltage?.trim() || null,
          location: eq.location?.trim() || null,
          ship_date: eq.ship_date || null,
          warranty_months: Number.isFinite(eq.warranty_months as number) ? Number(eq.warranty_months) : 12,
          notes: eq.notes?.trim() || null,
          ...denorm,
        },
        { onConflict: 'serial_number' }
      )
      .select('id')
      .single()
    if (!error && upserted) equipmentId = upserted.id
  }

  // ── 4b. Stamp customer_id onto the triggering ticket + backfill by email ───
  // Best-effort: the account already exists by this point, so a hiccup here
  // shouldn't fail the whole invite or roll anything back.
  let backfilledTicketCount = 0
  try {
    if (body.link_ticket_id) {
      await supabaseAdmin.from('tickets').update({ customer_id: customerId }).eq('id', body.link_ticket_id)
    }
    const { data: backfilled } = await supabaseAdmin
      .from('tickets')
      .update({ customer_id: customerId })
      .ilike('customer_email', contactEmail)
      .is('customer_id', null)
      .select('id')
    backfilledTicketCount = backfilled?.length ?? 0
  } catch (e) {
    console.error('[customers/invite] ticket linking failed:', e)
  }

  // ── 5. Seed the default build/ship tracker (only if none yet) ──────────────
  if (equipmentId && body.seed_tracker !== false) {
    const { count } = await supabaseAdmin
      .from('equipment_milestones')
      .select('id', { count: 'exact', head: true })
      .eq('equipment_id', equipmentId)
    if (!count) {
      await supabaseAdmin.from('equipment_milestones').insert(
        DEFAULT_MILESTONE_STAGES.map((s, i) => ({
          equipment_id: equipmentId,
          stage: s.stage,
          status: 'pending',
          sort_order: i,
        }))
      )
    }
  }

  // ── 6. Email the temp password + login link (best-effort) ──────────────────
  // No magic link: admin-generated links use the implicit flow (token lands in the
  // URL) and need each redirect origin allowlisted in Supabase — brittle across
  // preview/prod. A temp password the customer changes on first login mirrors the
  // employee flow and just works. The login link uses THIS request's origin, so a
  // preview invite points at the preview and a prod invite at prod.
  const loginUrl = `${req.nextUrl.origin}/login`

  let emailSent = false
  try {
    const res = await sendCustomerWelcomeEmail({
      to: contactEmail,
      contactName,
      companyName,
      tempPassword,
      loginUrl,
    })
    emailSent = !res.error
  } catch (e) {
    console.error('[customers/invite] welcome email threw:', e)
  }

  // ── 6b. Mark the originating portal-access request approved ────────────────
  if (body.link_request_id) {
    await supabaseAdmin
      .from('customer_portal_requests')
      .update({
        status: 'approved',
        decided_by: admin.user.id,
        decided_at: new Date().toISOString(),
        resulting_customer_id: customerId,
      })
      .eq('id', body.link_request_id)
      .eq('status', 'pending')
  }

  // ── 7. Audit ───────────────────────────────────────────────────────────────
  await logAudit({
    actor: { id: admin.user.id, name: admin.displayName },
    action: 'customer.invite',
    entityType: 'customer',
    entityId: customerId,
    summary: `Invited ${companyName} (${contactEmail})${equipmentId ? ' and linked equipment' : ''}`,
    metadata: {
      contact_email: contactEmail,
      equipment_id: equipmentId,
      email_sent: emailSent,
      linked_ticket_id: body.link_ticket_id ?? null,
      backfilled_ticket_count: backfilledTicketCount,
      approved_request_id: body.link_request_id ?? null,
    },
  })

  return NextResponse.json({
    ok: true,
    customer_id: customerId,
    equipment_id: equipmentId,
    email_sent: emailSent,
    login_url: loginUrl,
    // returned so staff can hand off credentials if email delivery isn't set up yet
    temp_password: tempPassword,
  }, { status: 201 })
}
