import { NextRequest, NextResponse } from 'next/server'
import { requireDealsAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { isRealDate } from '@/lib/deals'

/* ────────────────────────────────────────────────────────────────────────────
   Deal follow-up reminders (deal_follow_ups, migration 048) — the CRM's
   follow-up calendar. POST creates one for a deal (the modal's "Schedule
   Follow-up" button); toggling done / deleting live at [id]/route.ts.
   requireDealsAuth, same trust boundary as the rest of the deals API.

   Pre-migration the table doesn't exist; POST returns the migration hint as a
   503 rather than a raw Postgres 500.
   ──────────────────────────────────────────────────────────────────────────── */

const MIGRATION_HINT = 'Follow-ups need migration 048_deal_focus_followups.sql (run it in the Supabase SQL editor).'

const isMissingTable = (msg: string) =>
  /deal_follow_ups/.test(msg) && /(does not exist|schema cache|not find)/i.test(msg)

export async function POST(req: NextRequest) {
  const err = await requireDealsAuth(); if (err) return err
  const body = await req.json().catch(() => ({}))

  // deal_id is now OPTIONAL (migration 064): a row with no deal is a standalone
  // calendar event. When there's no deal, the note IS the event, so it's
  // required; a deal follow-up can leave it blank (the deal is the label).
  const dealId = typeof body.deal_id === 'string' && body.deal_id ? body.deal_id : null

  const due = typeof body.due_date === 'string' ? body.due_date : ''
  if (!isRealDate(due)) return NextResponse.json({ error: 'due_date must be a valid YYYY-MM-DD date' }, { status: 400 })

  const rawNote = typeof body.note === 'string' ? body.note.trim() : ''
  if (rawNote.length > 500) return NextResponse.json({ error: 'note is too long (500 chars max)' }, { status: 400 })
  if (!dealId && !rawNote) return NextResponse.json({ error: 'Give the event a name.' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('deal_follow_ups')
    .insert({ deal_id: dealId, due_date: due, note: rawNote || null, auto_generated: false })
    .select('*')
    .single()

  if (error) {
    if (isMissingTable(error.message)) return NextResponse.json({ error: MIGRATION_HINT }, { status: 503 })
    if (/foreign key/i.test(error.message)) {
      return NextResponse.json({ error: 'Deal not found — it may have been deleted.' }, { status: 404 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, followUp: data })
}
