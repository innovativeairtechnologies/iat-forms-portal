import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'
import { unflattenSrvData } from '@/lib/srv'
import { getSrvReview } from '@/lib/srv-form'
import { getSrvSections } from '@/lib/srv-config'
import type { Equipment } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Bridge: everything the customer SRV page needs, in one call.
 *
 * Bundled deliberately — sections, units, prefill and any in-flight revision all
 * have to agree with each other, and four separate round-trips could interleave
 * with an admin editing /admin/srv and hand the customer a form whose sections
 * don't match what submit will validate against.
 *
 * The revision path reconstructs the structured payload from the FLATTENED
 * submission via unflattenSrvData. That reconstruction has to happen here: it
 * needs the live section definitions, and `submissions` is commingled with every
 * internal form response so it can never be read from the customer side.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/srv-bootstrap')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  if (!customerId) return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })
  const resumeId = requireString(auth.body, 'resumeId')

  try {
    const sections = await getSrvSections()

    const [{ data: customer }, { data: equipmentData }] = await Promise.all([
      supabaseAdmin
        .from('customers')
        .select('company_name, primary_contact_name, contact_email, phone, location')
        .eq('id', customerId)
        .maybeSingle(),
      supabaseAdmin
        .from('equipment')
        .select('id, model_number, serial_number, location')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .order('created_at', { ascending: true }),
    ])

    if (!customer) return NextResponse.json({ error: 'Unknown customer' }, { status: 404 })

    const units = ((equipmentData || []) as Partial<Equipment>[]).map((u) => ({
      id: u.id!,
      model_number: u.model_number || '',
      serial_number: u.serial_number || '',
      location: u.location || null,
    }))

    // Revision path — only a RETURNED, not-yet-superseded SRV owned by this
    // customer can be reopened. Ownership is by data._customer_id only; the
    // internal page also accepts an email match, which is dropped here for the
    // same reason as the other bridges (no caller-supplied identity is trusted).
    let revision: Record<string, unknown> | null = null
    if (resumeId) {
      const { data: sub } = await supabaseAdmin
        .from('submissions')
        .select('id, data')
        .eq('id', resumeId)
        .single()
      const review = sub ? getSrvReview(sub.data) : null
      const owns = sub && sub.data?.['_customer_id'] === customerId
      if (owns && review?.decision === 'return' && !review.superseded_by) {
        const state = unflattenSrvData(sub.data as Record<string, unknown>, sections)
        revision = {
          priorId: sub.id,
          reviewerNotes: review.notes,
          revisionNumber: (parseInt(String(sub.data?.['Revision'] || '1'), 10) || 1) + 1,
          ...state,
        }
      }
    }

    return NextResponse.json({
      sections,
      units,
      prefill: {
        companyName: customer.company_name,
        contactName: customer.primary_contact_name || '',
        email: (customer.contact_email || '').toLowerCase(),
        phone: customer.phone || '',
        location: customer.location || '',
      },
      revision,
    })
  } catch (e) {
    console.error('[bridge/srv-bootstrap] failed:', e)
    return NextResponse.json({ error: 'Could not load the SRV form' }, { status: 500 })
  }
}
