import { NextRequest, NextResponse } from 'next/server'
import { requireAdminAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { DEFAULT_MILESTONE_STAGES, isMilestoneSequenceValid } from '@/lib/customer'

const VALID = ['pending', 'in_progress', 'complete']

// Seed the default build/ship timeline for a unit (no-op if it already has one),
// then return the current milestones.
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireAdminAuth(); if (err) return err
  const { id } = await ctx.params

  const { count } = await supabaseAdmin
    .from('equipment_milestones')
    .select('id', { count: 'exact', head: true })
    .eq('equipment_id', id)

  if (!count) {
    const { error } = await supabaseAdmin.from('equipment_milestones').insert(
      DEFAULT_MILESTONE_STAGES.map((s, i) => ({
        equipment_id: id, stage: s.stage, status: 'pending', sort_order: i,
      }))
    )
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: milestones } = await supabaseAdmin
    .from('equipment_milestones')
    .select('*')
    .eq('equipment_id', id)
    .order('sort_order', { ascending: true })

  return NextResponse.json({ ok: true, milestones: milestones ?? [] })
}

// Advance / edit a single milestone. Marking complete auto-stamps occurred_at
// unless an explicit date is provided.
export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireAdminAuth(); if (err) return err
  const { id } = await ctx.params
  const { milestoneId, status, occurred_at, note } = await req.json()
  if (!milestoneId) return NextResponse.json({ error: 'milestoneId is required' }, { status: 400 })

  const patch: Record<string, unknown> = {}
  if (status !== undefined) {
    if (!VALID.includes(status)) return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    // Enforce in-order progress: fetch the unit's timeline, apply the proposed change,
    // and reject if it would skip a step or leave a gap.
    const { data: all } = await supabaseAdmin
      .from('equipment_milestones')
      .select('id, status, sort_order')
      .eq('equipment_id', id)
      .order('sort_order', { ascending: true })
    const proposed = (all ?? []).map((m) => (m.id === milestoneId ? { ...m, status } : m))
    if (!isMilestoneSequenceValid(proposed)) {
      return NextResponse.json(
        { error: 'Milestones must be completed in order — finish the earlier steps first.' },
        { status: 409 },
      )
    }
    patch.status = status
  }
  if (occurred_at !== undefined) {
    patch.occurred_at = occurred_at || null
  } else if (status === 'complete') {
    patch.occurred_at = new Date().toISOString()
  } else if (status !== undefined && status !== 'complete') {
    patch.occurred_at = null
  }
  if (note !== undefined) patch.note = note || null

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { error } = await supabaseAdmin
    .from('equipment_milestones')
    .update(patch)
    .eq('id', milestoneId)
    .eq('equipment_id', id)        // scope the update to this unit
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
