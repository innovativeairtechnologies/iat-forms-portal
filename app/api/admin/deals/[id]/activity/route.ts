import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { DealActivityKind } from '@/lib/supabase'

/* ────────────────────────────────────────────────────────────────────────────
   Deal activity log (deal_activity, migration 047) — fed by the detail
   modal's Quick Actions (call/email/meeting/proposal) and checklist toggles.
   Same trust boundary as the rest of the deals API (requireDealsAuth).

   Pre-migration the table doesn't exist; GET degrades to
   { activities: [], unavailable: true } so the modal can show a setup hint
   instead of an error, and POST returns the setup message as a 503.
   ──────────────────────────────────────────────────────────────────────────── */

const KINDS: DealActivityKind[] = ['call', 'email', 'meeting', 'proposal', 'checklist', 'note']

// Default summaries when a quick action is logged without a note.
const DEFAULT_SUMMARY: Record<string, string> = {
  call: 'Logged a call',
  email: 'Sent an email',
  meeting: 'Scheduled a meeting',
  proposal: 'Sent a proposal',
  note: 'Added a note',
}

const MIGRATION_HINT = 'Activity log needs migration 047_deal_workflow.sql (run it in the Supabase SQL editor).'

const isMissingTable = (msg: string) =>
  /deal_activity/.test(msg) && /(does not exist|schema cache|not find)/i.test(msg)

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireDealsAuth(); if (err) return err
  const { id } = await ctx.params

  const { data, error } = await supabaseAdmin
    .from('deal_activity')
    .select('*')
    .eq('deal_id', id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (error) {
    if (isMissingTable(error.message)) return NextResponse.json({ activities: [], unavailable: true })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ activities: data ?? [] })
}

export async function POST(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const err = await requireDealsAuth(); if (err) return err
  const { id } = await ctx.params
  const body = await req.json().catch(() => ({}))

  const kind = body.kind as string
  if (!KINDS.includes(kind as DealActivityKind)) {
    return NextResponse.json({ error: `kind must be one of ${KINDS.join(', ')}` }, { status: 400 })
  }
  const rawSummary = typeof body.summary === 'string' ? body.summary.trim() : ''
  if (rawSummary.length > 2000) {
    return NextResponse.json({ error: 'summary is too long (2000 chars max)' }, { status: 400 })
  }
  const summary = rawSummary || DEFAULT_SUMMARY[kind] || 'Update'

  const surfaceUser = await getAdminSurfaceUser()
  const { data, error } = await supabaseAdmin
    .from('deal_activity')
    .insert({ deal_id: id, kind, summary, actor: surfaceUser?.displayName ?? null })
    .select('*')
    .single()

  if (error) {
    if (isMissingTable(error.message)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
    // FK violation → the deal was deleted under us
    if (/foreign key/i.test(error.message)) {
      return NextResponse.json({ error: 'Deal not found — it may have been deleted.' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, activity: data })
}
