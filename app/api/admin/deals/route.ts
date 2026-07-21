import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { sanitizeDealField } from './validate'
import { AUTO_FOLLOW_UP_DAYS, followUpDateFrom, statusForStage, type DealStage } from '@/lib/deals'
import { normalizeCompany } from '@/lib/crm-normalize'

const OPTIONAL_FIELDS = [
  'assigned_to', 'date_quoted', 'status', 'unit_model', 'job_name',
  'total_cost', 'confidence', 'projected', 'rep', 'rep_contact', 'notes', 'group_name',
  'project_type', // focused is intentionally NOT settable at create — a new deal
                  // starts un-focused; the ★ curates the Focused list afterward.
  'stage', 'expected_close', 'next_step', 'next_step_due', // migration 061
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

  // Stage/status invariant (migration 061): stage is authoritative. An explicit
  // stage sets its status shadow; a legacy status-only create gets a stage.
  if (insert.stage !== undefined) {
    insert.status = statusForStage(insert.stage as DealStage)
  } else if (insert.status === 'Won') {
    insert.stage = 'won'
  } else if (insert.status === 'Lost') {
    insert.stage = 'lost'
  } // else: DB default 'lead'

  // ── Company link (migration 062): every NEW deal lands linked ────────────
  // Explicit company_id wins; otherwise exact-normalized match against
  // existing companies; otherwise auto-create a prospect. Typos create
  // near-duplicates occasionally — the Companies tab's duplicate detection is
  // the standing cleanup for that. A trailing parenthetical on the typed name
  // ("QCorp (20+ compacts)") moves into an empty job_name, matching the
  // backfill's convention.
  let companyCreated: Record<string, unknown> | null = null
  const explicitCompany = sanitizeDealField('company_id', body.company_id)
  if (typeof body.company_id === 'string' && !explicitCompany.error && explicitCompany.value) {
    const { data: company } = await supabaseAdmin
      .from('companies').select('id, name').eq('id', explicitCompany.value).maybeSingle()
    if (!company) return NextResponse.json({ error: 'Company not found — it may have been deleted.' }, { status: 400 })
    insert.company_id = company.id
    insert.customer = company.name
  } else {
    const { base, hint, normalized } = normalizeCompany(insert.customer as string)
    const { data: match } = await supabaseAdmin
      .from('companies').select('id, name').eq('normalized_name', normalized).maybeSingle()
    if (match) {
      insert.company_id = match.id
      insert.customer = match.name
    } else {
      const { data: created } = await supabaseAdmin
        .from('companies').insert({ name: base, normalized_name: normalized }).select('*').maybeSingle()
      if (created) {
        companyCreated = created
        insert.company_id = created.id
        insert.customer = created.name
      } // creation failure (e.g. race) → deal still lands, just unlinked
    }
    if (hint && !insert.job_name) insert.job_name = hint
  }
  if (typeof body.primary_contact_id === 'string' && insert.company_id) {
    const { data: contact } = await supabaseAdmin
      .from('contacts').select('id, company_id').eq('id', body.primary_contact_id).maybeSingle()
    if (contact && contact.company_id === insert.company_id) insert.primary_contact_id = contact.id
  }

  const { data, error } = await supabaseAdmin.from('deals').insert(insert).select('*').single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Seed the deal's first stage-history row so funnel math has a floor.
  // Best-effort: a failure must never fail deal creation.
  try {
    const surfaceUser = await getAdminSurfaceUser()
    await supabaseAdmin.from('deal_stage_history').insert({
      deal_id: data.id,
      from_stage: null,
      to_stage: data.stage ?? 'lead',
      actor: surfaceUser?.displayName ?? null,
    })
  } catch { /* history is additive — deal still created */ }

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

  // companyCreated rides along so the client can add it to its companies
  // state without a refetch (matched/explicit companies are already there).
  return NextResponse.json({ ok: true, deal: data, followUp, companyCreated })
}
