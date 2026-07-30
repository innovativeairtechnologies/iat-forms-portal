import { NextRequest, NextResponse } from 'next/server'
import { requireCaseStudiesAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { unitFromEquipment } from '@/lib/case-studies'
import type { Equipment } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** List all case studies (list page). */
export async function GET() {
  const auth = await requireCaseStudiesAuth()
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('case_studies')
    .select('*, customers(id, company_name), case_study_units(id, model_number)')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('Case studies list error:', error)
    return NextResponse.json({ error: 'Could not load case studies.' }, { status: 500 })
  }
  return NextResponse.json({ case_studies: data ?? [] })
}

/**
 * Create a new draft. Body: { customer_id? }. When a customer is given, the
 * study starts with their name/location context and one snapshotted unit row
 * per registered equipment record — identity pre-filled, the required facts
 * (application/conditions/airflow) deliberately left blank for a human.
 */
export async function POST(req: NextRequest) {
  const auth = await requireCaseStudiesAuth()
  if (auth instanceof NextResponse) return auth

  const { customer_id } = (await req.json().catch(() => ({}))) as { customer_id?: string }

  let title = 'Untitled case study'
  let region: string | null = null
  if (customer_id) {
    const { data: customer } = await supabaseAdmin
      .from('customers')
      .select('company_name, location')
      .eq('id', customer_id)
      .single()
    if (!customer) return NextResponse.json({ error: 'Customer not found.' }, { status: 404 })
    title = `${customer.company_name} case study`
    region = customer.location
  }

  const { data: study, error } = await supabaseAdmin
    .from('case_studies')
    .insert({
      customer_id: customer_id ?? null,
      title,
      region,
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (error || !study) {
    console.error('Case study create error:', error)
    return NextResponse.json({ error: 'Could not create the case study.' }, { status: 500 })
  }

  if (customer_id) {
    const { data: equipment } = await supabaseAdmin
      .from('equipment')
      .select('*')
      .eq('customer_id', customer_id)
      .order('created_at', { ascending: true })
    if (equipment?.length) {
      const rows = (equipment as Equipment[]).map((e, i) => ({
        ...unitFromEquipment(e),
        sort_order: i,
        case_study_id: study.id,
      }))
      // Best-effort: a failed snapshot leaves an empty study, not a failed create.
      const { error: unitErr } = await supabaseAdmin.from('case_study_units').insert(rows)
      if (unitErr) console.error('Case study unit snapshot error:', unitErr)
    }
  }

  return NextResponse.json({ id: study.id })
}
