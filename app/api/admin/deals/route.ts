import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeDealField } from './validate'

const OPTIONAL_FIELDS = [
  'assigned_to', 'date_quoted', 'status', 'unit_model', 'job_name',
  'total_cost', 'confidence', 'projected', 'rep', 'rep_contact', 'notes', 'group_name',
] as const

// Create a new deal. Sales and admin both reach this (requireDealsAuth) —
// the deal pipeline is meant to be self-service for reps, unlike every other
// admin write endpoint (see lib/api-auth.ts requireDealsAuth for why).
export async function POST(req: NextRequest) {
  const err = await requireDealsAuth(); if (err) return err
  const body = await req.json().catch(() => ({}))

  const customerCheck = sanitizeDealField('customer', body.customer)
  if (customerCheck.error) return NextResponse.json({ error: customerCheck.error }, { status: 400 })

  const insert: Record<string, unknown> = { customer: customerCheck.value, group_name: 'MAIN' }
  for (const f of OPTIONAL_FIELDS) {
    if (body[f] === undefined) continue
    if (f === 'group_name' && (body[f] === '' || body[f] === null)) continue // blank group → keep MAIN
    const check = sanitizeDealField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    insert[f] = check.value
  }

  const { data, error } = await supabaseAdmin.from('deals').insert(insert).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, deal: data })
}
