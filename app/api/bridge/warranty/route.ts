import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireBridgeAuth, requireString } from '@/lib/bridge-auth'

export const dynamic = 'force-dynamic'

const RESOLUTIONS = ['repair', 'replace', 'credit'] as const

/**
 * Bridge: file a warranty claim (the one customer→internal WRITE so far).
 *
 * Reproduces app/api/customer/warranty-requests/route.ts exactly, including:
 *  • re-verifying the unit belongs to this customer before inserting — the
 *    client's equipment_id is never trusted (defense in depth: the customer app
 *    checks too, but this side must not rely on that);
 *  • snapshotting serial_number from the equipment ROW, not the request body;
 *  • treating a 23505 unique violation as SUCCESS. `warranty_requests_one_pending_per_unit`
 *    allows one pending claim per unit, so a double-submit is idempotent, not an error.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/warranty')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  const customerId = requireString(auth.body, 'customerId')
  const equipmentId = requireString(auth.body, 'equipmentId')
  if (!customerId) return NextResponse.json({ error: 'Missing customerId' }, { status: 400 })
  if (!equipmentId) return NextResponse.json({ error: 'Missing unit.' }, { status: 400 })

  const description = requireString(auth.body, 'description')
  if (!description) return NextResponse.json({ error: 'Please describe the issue.' }, { status: 400 })
  if (description.length > 5000) {
    return NextResponse.json({ error: 'That description is too long.' }, { status: 400 })
  }

  const problemStarted = requireString(auth.body, 'problem_started')
  const rawResolution = requireString(auth.body, 'resolution')
  const resolution = RESOLUTIONS.includes(rawResolution as (typeof RESOLUTIONS)[number])
    ? (rawResolution as (typeof RESOLUTIONS)[number])
    : 'repair'

  // Ownership re-check — scoped by BOTH ids, so a unit belonging to another
  // customer simply isn't found.
  const { data: equipment } = await supabaseAdmin
    .from('equipment')
    .select('id, serial_number')
    .eq('id', equipmentId)
    .eq('customer_id', customerId)
    .maybeSingle()

  if (!equipment) {
    return NextResponse.json({ error: 'Unit not found on your account.' }, { status: 404 })
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('warranty_requests')
    .insert({
      customer_id: customerId,
      equipment_id: equipment.id,
      serial_number: equipment.serial_number,
      description,
      problem_started: problemStarted,
      resolution,
    })
    .select('id')
    .single()

  if (insertError) {
    // One pending claim per unit already exists — surface it as success so a
    // retry or double-tap doesn't read as a failure to the customer.
    if (insertError.code === '23505') {
      const { data: pending } = await supabaseAdmin
        .from('warranty_requests')
        .select('id')
        .eq('equipment_id', equipment.id)
        .eq('status', 'pending')
        .maybeSingle()
      return NextResponse.json({ status: 'already_pending', id: pending?.id ?? null })
    }
    return NextResponse.json({ error: 'Could not file the claim.' }, { status: 500 })
  }

  return NextResponse.json({ status: 'ok', id: inserted.id })
}
