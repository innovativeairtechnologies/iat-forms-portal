import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import {
  allowedActions, checkFence, fenceMessage, stateOf,
  type ClockSettings, type PunchAction, type Segment, type Shift,
} from '@/lib/time-clock'

// ─── The punch endpoint ──────────────────────────────────────────────────────
//
// Every button on the clock lands here. GET returns the caller's current state so
// the UI can draw exactly the right buttons; POST applies one action.
//
// 🔴 IDENTITY IS THE SESSION, NEVER THE BODY. The employee id is resolved from
// the Supabase session on the server — there is no "who am I" field to forge, so
// nobody can punch on somebody else's number. This is also why the QR cannot be a
// bare kiosk token like /t/<code>: a token that anyone can scan is fine for
// "which drill is this", and completely wrong for "who worked eight hours".
//
// ⚠️ WHERE THE FENCE IS ENFORCED, AND WHERE IT IS NOT:
//   • clock_in  — ENFORCED. This is the one the request was about: no clocking on
//                 from the sofa.
//   • clock_out — RECORDED, NOT REFUSED. Refusing an off-site clock-out strands
//                 somebody in an open shift they cannot close, which is worse than
//                 the thing it prevents and lands on an admin either way. The
//                 distance is stored and the admin board flags it.
//   • lunch / break / switch_job — no fence. GPS drops behind roll-up doors and
//                 inside the shop; stranding a mid-shift button on it would make
//                 the clock unreliable at exactly the moment somebody is using it.

export const dynamic = 'force-dynamic'

type Ctx = {
  employeeId: string
  settings: ClockSettings
  shift: Shift | null
  openSegment: Segment | null
}

async function load(): Promise<{ ctx: Ctx } | { error: NextResponse }> {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Not signed in' }, { status: 401 }) }

  // employees.id IS the auth user id (both reference auth.users) — see lib/staff.
  const { data: emp } = await supabaseAdmin
    .from('employees').select('id, is_active').eq('id', user.id).maybeSingle()
  if (!emp || !emp.is_active) {
    return { error: NextResponse.json({ error: 'No active employee record for this account' }, { status: 403 }) }
  }

  const { data: settings } = await supabaseAdmin
    .from('time_clock_settings').select('*').maybeSingle()
  if (!settings) return { error: NextResponse.json({ error: 'Time clock is not configured' }, { status: 500 }) }

  const { data: shift } = await supabaseAdmin
    .from('time_shifts').select('*')
    .eq('employee_id', emp.id).is('ended_at', null).maybeSingle()

  let openSegment: Segment | null = null
  if (shift) {
    const { data: seg } = await supabaseAdmin
      .from('time_segments').select('*')
      .eq('shift_id', shift.id).is('ended_at', null).maybeSingle()
    openSegment = (seg as Segment) ?? null
  }

  return { ctx: { employeeId: emp.id, settings: settings as ClockSettings, shift: (shift as Shift) ?? null, openSegment } }
}

export async function GET() {
  const r = await load()
  if ('error' in r) return r.error
  const { ctx } = r
  const state = stateOf(ctx.shift, ctx.openSegment)

  // Today's segments, so the UI can show "6h 12m today" without a second call.
  let todaySegments: Segment[] = []
  if (ctx.shift) {
    const { data } = await supabaseAdmin
      .from('time_segments').select('*').eq('shift_id', ctx.shift.id).order('started_at')
    todaySegments = (data as Segment[]) ?? []
  }

  return NextResponse.json({
    state,
    allowed: allowedActions(state),
    shift: ctx.shift,
    openSegment: ctx.openSegment,
    segments: todaySegments,
    site: { label: ctx.settings.site_label, radius_m: ctx.settings.radius_m, enforced: ctx.settings.enforce_geofence },
  })
}

export async function POST(req: NextRequest) {
  const r = await load()
  if ('error' in r) return r.error
  const { ctx } = r

  const body = await req.json().catch(() => null) as
    | { action?: PunchAction; job_number?: string | null; lat?: number; lng?: number; accuracy_m?: number; source?: string }
    | null
  if (!body?.action) return NextResponse.json({ error: 'No action' }, { status: 400 })

  const state = stateOf(ctx.shift, ctx.openSegment)
  const action = body.action
  if (!allowedActions(state).includes(action)) {
    // Almost always a stale tab: the phone still shows "Clock in" after somebody
    // clocked in on the terminal. Say so, and let the UI refetch.
    return NextResponse.json({ error: 'That is not available right now', state, stale: true }, { status: 409 })
  }

  const job = typeof body.job_number === 'string' ? body.job_number.trim().slice(0, 60) || null : null
  const now = new Date().toISOString()
  const fix = { lat: body.lat, lng: body.lng, accuracy_m: body.accuracy_m }
  const verdict = checkFence(ctx.settings, fix)
  const source = body.source === 'qr' ? 'qr' : 'web'

  // ── clock in — the only gated action ──
  if (action === 'clock_in') {
    if (!verdict.ok) {
      await supabaseAdmin.from('time_clock_denials').insert({
        employee_id: ctx.employeeId, action, lat: fix.lat ?? null, lng: fix.lng ?? null,
        accuracy_m: fix.accuracy_m ?? null, distance_m: verdict.distance_m, reason: verdict.reason,
      })
      return NextResponse.json(
        { error: fenceMessage(verdict.reason, ctx.settings, verdict.distance_m), reason: verdict.reason, distance_m: verdict.distance_m },
        { status: 403 },
      )
    }
    const { data: created, error } = await supabaseAdmin.from('time_shifts').insert({
      employee_id: ctx.employeeId, started_at: now,
      start_lat: fix.lat ?? null, start_lng: fix.lng ?? null,
      start_accuracy_m: fix.accuracy_m ?? null, start_distance_m: verdict.distance_m, source,
    }).select('id').single()
    // 23505 = the one-open-shift index caught a double tap. Not an error worth
    // showing: they are clocked in, which is what they wanted.
    if (error) {
      if (error.code === '23505') return NextResponse.json({ ok: true, deduped: true })
      return NextResponse.json({ error: 'Could not clock in' }, { status: 500 })
    }
    await supabaseAdmin.from('time_segments').insert({
      shift_id: created.id, kind: 'work', job_number: job, started_at: now,
    })
    return NextResponse.json({ ok: true })
  }

  if (!ctx.shift) return NextResponse.json({ error: 'Not clocked in' }, { status: 409 })
  const closeOpen = async () => {
    if (ctx.openSegment) {
      await supabaseAdmin.from('time_segments').update({ ended_at: now }).eq('id', ctx.openSegment.id)
    }
  }

  switch (action) {
    case 'clock_out': {
      await closeOpen()
      await supabaseAdmin.from('time_shifts').update({
        ended_at: now, end_lat: fix.lat ?? null, end_lng: fix.lng ?? null,
        end_accuracy_m: fix.accuracy_m ?? null, end_distance_m: verdict.distance_m,
      }).eq('id', ctx.shift.id)
      return NextResponse.json({ ok: true, offsite: !verdict.ok })
    }
    case 'lunch_start':
    case 'break_start': {
      await closeOpen()
      await supabaseAdmin.from('time_segments').insert({
        shift_id: ctx.shift.id, kind: action === 'lunch_start' ? 'lunch' : 'break', started_at: now,
      })
      return NextResponse.json({ ok: true })
    }
    case 'lunch_end':
    case 'break_end': {
      await closeOpen()
      // Back onto whatever job was running before the break, so a five-minute
      // break does not silently dump the rest of the day into "unallocated".
      const { data: prior } = await supabaseAdmin
        .from('time_segments').select('job_number')
        .eq('shift_id', ctx.shift.id).eq('kind', 'work')
        .order('started_at', { ascending: false }).limit(1).maybeSingle()
      await supabaseAdmin.from('time_segments').insert({
        shift_id: ctx.shift.id, kind: 'work', job_number: prior?.job_number ?? null, started_at: now,
      })
      return NextResponse.json({ ok: true })
    }
    case 'switch_job': {
      // Same job re-selected: do nothing rather than chopping the day into
      // adjacent identical segments that read as churn on the timesheet.
      if ((ctx.openSegment?.job_number ?? null) === job && ctx.openSegment?.kind === 'work') {
        return NextResponse.json({ ok: true, unchanged: true })
      }
      await closeOpen()
      await supabaseAdmin.from('time_segments').insert({
        shift_id: ctx.shift.id, kind: 'work', job_number: job, started_at: now,
      })
      return NextResponse.json({ ok: true })
    }
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
