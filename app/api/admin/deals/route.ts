import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeDealField } from './validate'
import { AUTO_FOLLOW_UP_DAYS, followUpDateFrom } from '@/lib/deals'

const OPTIONAL_FIELDS = [
  'assigned_to', 'date_quoted', 'status', 'unit_model', 'job_name',
  'total_cost', 'confidence', 'projected', 'rep', 'rep_contact', 'notes', 'group_name',
  'project_type', // focused is intentionally NOT settable at create — a new deal
                  // starts un-focused; the ★ curates the Focused list afterward.
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

  // Monday-parity automation: a fresh deal gets a follow-up reminder 2 weeks
  // out (from creation, not the quote date). Single-deal path only — the bulk
  // importer deliberately does NOT do this (would spawn one per imported row).
  // The client passes auto_follow_up_date in ITS timezone (this route runs UTC
  // on Vercel, which would drift a day for evening US users); fall back to a
  // server-computed date if it's missing/malformed. Best-effort: a missing
  // deal_follow_ups table (pre-048) or any failure must never fail deal
  // creation, so the reminder is returned as null instead.
  const dueDate = typeof body.auto_follow_up_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.auto_follow_up_date)
    ? body.auto_follow_up_date
    : followUpDateFrom(new Date(), AUTO_FOLLOW_UP_DAYS)
  let followUp = null
  try {
    const { data: fu } = await supabaseAdmin
      .from('deal_follow_ups')
      .insert({
        deal_id: data.id,
        due_date: dueDate,
        note: 'Auto follow-up (2 weeks after deal created)',
        auto_generated: true,
      })
      .select('*')
      .single()
    followUp = fu ?? null
  } catch { /* pre-048 or insert failed — deal still created */ }

  return NextResponse.json({ ok: true, deal: data, followUp })
}
