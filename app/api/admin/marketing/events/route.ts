import { NextRequest, NextResponse } from 'next/server'
import { requireMarketingAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildEventInsert, MIGRATION_HINT, isMissingTable } from '../validate'

/* ────────────────────────────────────────────────────────────────────────────
   Marketing calendar events (marketing_events, migration 071) — POST creates
   one from the side panel's composer. Editing / deleting live at [id]/route.ts.

   Pre-migration the table doesn't exist; POST returns the migration hint as a
   503 rather than a raw Postgres 500 (the deals follow-ups precedent).
   ──────────────────────────────────────────────────────────────────────────── */

export async function POST(req: NextRequest) {
  const auth = await requireMarketingAuth()
  if (auth instanceof NextResponse) return auth

  const body = await req.json().catch(() => ({}))
  const { values, error: invalid } = buildEventInsert(body)
  if (invalid) return NextResponse.json({ error: invalid }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('marketing_events')
    .insert({ ...values, created_by: auth.userId })
    .select('*')
    .single()

  if (error) {
    if (isMissingTable(error.message)) {
      return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, event: data })
}
