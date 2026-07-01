import { NextRequest, NextResponse } from 'next/server'
import { getCustomerUser } from '@/lib/customer-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'

const RESOLUTIONS = ['repair', 'replace', 'credit'] as const
type Resolution = (typeof RESOLUTIONS)[number]

// A logged-in customer filing a warranty claim on one of their own units
// (migration 036). Lands in warranty_requests as 'pending' for an admin to
// approve (opens a real ticket) or deny at /admin/customers.
export async function POST(req: NextRequest) {
  const session = await getCustomerUser()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = (await req.json().catch(() => ({}))) as {
    equipment_id?: string
    description?: string
    problem_started?: string
    resolution?: string
  }

  const equipmentId = (body.equipment_id || '').trim()
  const description = (body.description || '').trim()
  const problemStarted = (body.problem_started || '').trim() || null
  const resolution: Resolution = RESOLUTIONS.includes(body.resolution as Resolution)
    ? (body.resolution as Resolution)
    : 'repair'

  if (!equipmentId) return NextResponse.json({ error: 'Missing unit.' }, { status: 400 })
  if (!description) return NextResponse.json({ error: 'Please describe the issue.' }, { status: 400 })
  if (description.length > 5000) return NextResponse.json({ error: 'That description is too long.' }, { status: 400 })

  // Re-verify the unit actually belongs to this customer — never trust a
  // client-supplied equipment_id blindly.
  const { data: equipment, error: eqError } = await supabaseAdmin
    .from('equipment')
    .select('id, serial_number, customer_id')
    .eq('id', equipmentId)
    .eq('customer_id', session.customerId)
    .maybeSingle()

  if (eqError) return NextResponse.json({ error: eqError.message }, { status: 500 })
  if (!equipment) return NextResponse.json({ error: 'Unit not found on your account.' }, { status: 404 })

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('warranty_requests')
    .insert({
      customer_id: session.customerId,
      equipment_id: equipment.id,
      serial_number: equipment.serial_number,
      description,
      problem_started: problemStarted,
      resolution,
    })
    .select('id')
    .single()

  if (insertError) {
    // Unique-violation on the "one pending claim per unit" partial index —
    // treat as an idempotent success rather than an error (same idiom as
    // customer_portal_requests).
    if (insertError.code === '23505') {
      const { data: existing } = await supabaseAdmin
        .from('warranty_requests')
        .select('id')
        .eq('equipment_id', equipment.id)
        .eq('status', 'pending')
        .maybeSingle()
      return NextResponse.json({ ok: true, already_pending: true, id: existing?.id ?? null })
    }
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, id: inserted.id })
}
