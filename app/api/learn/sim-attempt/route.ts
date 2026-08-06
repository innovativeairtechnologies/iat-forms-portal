import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { SCENARIOS_BY_ID } from '@/lib/cpco'

// POST /api/learn/sim-attempt
//   { scenarioId: string, passed: boolean, keystrokes: number, wrongScreens?: number }
//
// Records a simulator run for the control panel course. Session-scoped exactly
// like /api/learn/progress: user_id comes from the session, never the body.
//
// The row keeps the BEST run — `passed` is sticky and the keystroke number only
// improves — mirroring how quiz attempts behave. The client is trusted about
// the run itself (it is a training exercise, not an exam surface); the server
// still refuses unknown scenarios and clamps the numbers so the table can't be
// filled with garbage.
export async function POST(request: Request) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: {
    scenarioId?: string
    passed?: boolean
    keystrokes?: number
    wrongScreens?: number
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const scenario = typeof body.scenarioId === 'string' ? SCENARIOS_BY_ID.get(body.scenarioId) : null
  if (!scenario) {
    return NextResponse.json({ error: 'Unknown scenario' }, { status: 400 })
  }

  const passed = body.passed === true
  const keystrokes = clampInt(body.keystrokes, 0, 10_000)
  const wrongScreens = clampInt(body.wrongScreens, 0, 1_000)
  if (keystrokes === null) {
    return NextResponse.json({ error: 'keystrokes required' }, { status: 400 })
  }

  const { data: existing, error: readError } = await supabaseAdmin
    .from('learn_sim_attempts')
    .select('id, passed, keystrokes, attempts, first_passed_at')
    .eq('user_id', user.id)
    .eq('scenario_id', scenario.id)
    .maybeSingle()

  if (readError) return NextResponse.json({ error: readError.message }, { status: 500 })

  const now = new Date().toISOString()
  // Sticky pass; the recorded run only ever gets better. A failed retake after
  // a pass bumps the attempt count and nothing else.
  const bestPassed = passed || !!existing?.passed
  const improvesRun = passed && (!existing?.passed || keystrokes < (existing?.keystrokes ?? Infinity))

  const row = {
    user_id: user.id,
    scenario_id: scenario.id,
    passed: bestPassed,
    keystrokes: improvesRun ? keystrokes : (existing?.keystrokes ?? keystrokes),
    optimal_keystrokes: scenario.optimalKeystrokes,
    wrong_screens: improvesRun ? (wrongScreens ?? 0) : undefined,
    attempts: (existing?.attempts ?? 0) + 1,
    first_passed_at: existing?.first_passed_at ?? (passed ? now : null),
    updated_at: now,
  }

  const { error: writeError } = await supabaseAdmin
    .from('learn_sim_attempts')
    .upsert(stripUndefined(row), { onConflict: 'user_id,scenario_id' })

  if (writeError) return NextResponse.json({ error: writeError.message }, { status: 500 })

  return NextResponse.json({
    ok: true,
    passed: bestPassed,
    firstPass: passed && !existing?.passed,
  })
}

function clampInt(v: unknown, min: number, max: number): number | null {
  if (typeof v !== 'number' || !Number.isFinite(v)) return null
  return Math.min(max, Math.max(min, Math.trunc(v)))
}

function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T
}
