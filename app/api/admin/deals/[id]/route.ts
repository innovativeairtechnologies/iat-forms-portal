import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { sanitizeDealField } from '../validate'
import { statusForStage, OPEN_STAGES, type DealStage } from '@/lib/deals'

const EDITABLE_FIELDS = [
  'customer', 'assigned_to', 'date_quoted', 'status', 'unit_model', 'job_name',
  'total_cost', 'confidence', 'projected', 'rep', 'rep_contact', 'notes', 'group_name',
  'checklist', // follow-up steps map (migration 047)
  'focused', 'project_type', // migration 048
  'stage', 'expected_close', 'closed_reason', 'next_step', 'next_step_due', // migration 061
  'company_id', 'primary_contact_id', // migration 062
  // stage_changed_at is deliberately NOT here — it's server-derived below.
] as const

// Inline-edit endpoint — the Focused view's patchLocal/persist-on-blur pattern
// (mirrors CustomerPortalCard.tsx) hits this on every cell blur, so it stays a
// partial patch rather than a full-record replace.
//
// Stage/status invariant (migration 061): `stage` is authoritative, `status`
// is its derived compatibility shadow. A patch that sets stage also sets
// status; a patch that sets only status (legacy Won/Lost buttons, raw API
// callers) gets a stage derived for it — reopening (status null) restores the
// last open stage from history. Every real stage change stamps
// stage_changed_at and appends a deal_stage_history row.
//
// Returns the FULL updated row: the client folds it into its last-known-good
// map so server-derived fields (stage_changed_at, synced status) can never
// drift out of the optimistic-update machinery.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireDealsAuth(); if (err) return err
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const patch: Record<string, unknown> = {}
  for (const f of EDITABLE_FIELDS) {
    if (body[f] === undefined) continue
    const check = sanitizeDealField(f, body[f])
    if (check.error) return NextResponse.json({ error: check.error }, { status: 400 })
    patch[f] = check.value
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  // ── Company link (migration 062) ─────────────────────────────────────────
  // `customer` (text) is a derived display cache once a company is linked:
  // setting company_id rewrites it to the company's name. Unlinking (null)
  // leaves the text as-is. Both FKs are existence-checked so a stale id is a
  // clean 400 rather than a raw FK-violation 500.
  if (patch.company_id) {
    const { data: company } = await supabaseAdmin
      .from('companies').select('id, name').eq('id', patch.company_id).maybeSingle()
    if (!company) return NextResponse.json({ error: 'Company not found — it may have been deleted.' }, { status: 400 })
    patch.customer = company.name
  }
  // Changing (or clearing) the company invalidates the old primary contact
  // unless the same patch explicitly sets a new one.
  if (patch.company_id !== undefined && patch.primary_contact_id === undefined) {
    patch.primary_contact_id = null
  }
  if (patch.primary_contact_id) {
    const { data: contact } = await supabaseAdmin
      .from('contacts').select('id, company_id').eq('id', patch.primary_contact_id).maybeSingle()
    if (!contact) return NextResponse.json({ error: 'Contact not found — it may have been deleted.' }, { status: 400 })
    // The contact must belong to the deal's (new or current) company.
    let effectiveCompany = patch.company_id as string | undefined
    if (effectiveCompany === undefined) {
      const { data: cur } = await supabaseAdmin.from('deals').select('company_id').eq('id', id).maybeSingle()
      effectiveCompany = (cur?.company_id as string | null) ?? undefined
    }
    if (contact.company_id !== effectiveCompany) {
      return NextResponse.json({ error: 'That contact belongs to a different company.' }, { status: 400 })
    }
  }

  // ── Stage/status sync ────────────────────────────────────────────────────
  let fromStage: DealStage | null = null
  if (patch.stage !== undefined || patch.status !== undefined) {
    const { data: current, error: curErr } = await supabaseAdmin
      .from('deals').select('stage').eq('id', id).single()
    if (curErr || !current) {
      return NextResponse.json({ error: 'Deal not found — it may have been deleted.' }, { status: 404 })
    }
    fromStage = current.stage as DealStage

    if (patch.stage !== undefined) {
      patch.status = statusForStage(patch.stage as DealStage)
    } else if (patch.status === 'Won') {
      patch.stage = 'won'
    } else if (patch.status === 'Lost') {
      patch.stage = 'lost'
    } else if (patch.status === null && (fromStage === 'won' || fromStage === 'lost')) {
      // Reopening a closed deal — restore the last open stage it lived in.
      const { data: hist } = await supabaseAdmin
        .from('deal_stage_history')
        .select('to_stage')
        .eq('deal_id', id)
        .in('to_stage', [...OPEN_STAGES])
        .order('changed_at', { ascending: false })
        .limit(1)
      patch.stage = (hist?.[0]?.to_stage as DealStage | undefined) ?? 'quoted'
    }

    if (patch.stage !== undefined && patch.stage !== fromStage) {
      patch.stage_changed_at = new Date().toISOString()
    } else {
      fromStage = null // no real transition — don't log history
      delete patch.stage // avoid a no-op column write
    }
  }

  // .select('*') so (a) a stale/deleted id is a clean 404, not a silent ok:true
  // (two people work this pipeline), and (b) the client gets the server-truth
  // row back to fold into its optimistic state.
  const { data, error } = await supabaseAdmin.from('deals').update(patch).eq('id', id).select('*')
  if (error) {
    // focused / project_type land with migration 048 — before it's run, editing
    // those two surfaces a friendly hint instead of a raw column-missing 500.
    if (/column .*(focused|project_type).* does not exist/i.test(error.message)) {
      return NextResponse.json(
        { error: 'Focus & project type need migration 048_deal_focus_followups.sql (run it in the Supabase SQL editor).' },
        { status: 503 },
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!data || data.length === 0) return NextResponse.json({ error: 'Deal not found — it may have been deleted.' }, { status: 404 })
  const deal = data[0]

  // Best-effort history append — a failure here must never fail the edit.
  if (fromStage !== null) {
    try {
      const surfaceUser = await getAdminSurfaceUser()
      await supabaseAdmin.from('deal_stage_history').insert({
        deal_id: id,
        from_stage: fromStage,
        to_stage: deal.stage,
        actor: surfaceUser?.displayName ?? null,
        note: (patch.closed_reason as string | undefined) ?? null,
      })
    } catch (e) {
      console.error('[deals] stage history insert failed (edit itself saved):', e)
    }
  }

  return NextResponse.json({ ok: true, deal })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireDealsAuth(); if (err) return err
  const { id } = await ctx.params
  const { error } = await supabaseAdmin.from('deals').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
