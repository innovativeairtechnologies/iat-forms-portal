import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { rateLimit } from '@/lib/rate-limit'
import { cleanActorName, shopDate } from '@/lib/production'

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/board/<token>/check — check a task off, or un-check it.
//
// PUBLIC and UNAUTHENTICATED. The URL token is the entire capability, so the
// rules here are strict:
//
//   • The token resolves the department SERVER-side. The department is never
//     taken from the body.
//   • The task is then loaded and verified to belong to THAT department before
//     any write. Without that check the token would be a universal write key —
//     anyone with the Fabrication link could tick off Electrical's work by
//     posting a different task id.
//   • The only client-supplied values that survive are the action (whitelisted
//     to two literals) and the actor's name (cleaned, capped, and understood to
//     be unverified). Everything else — title, department, cadence, dates — is
//     re-read from the DB, never echoed back from the request. Same discipline
//     as app/api/tickets/request-account/route.ts:57-63.
//
// The name is an honor-system signature, not authentication. That is the
// accepted trade for a floor with no logins, and it is why boards must not hold
// anything sensitive (see the SECURITY note in migration 055).
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS = ['done', 'reopen'] as const
type Action = (typeof ACTIONS)[number]

export async function POST(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  // Before parsing the body, so malformed floods are limited too.
  //
  // 240/10min is high on purpose and is NOT the security control (the token is;
  // and rateLimit fails OPEN by design anyway). The whole shop shares one NAT
  // IP, so the limit is per-department-per-office, not per-person: a 10-person
  // crew clearing a 20-item board in a morning is ~200 legitimate requests from
  // a single address. The in-house 5–10/10min for public writes assumes one
  // customer on one connection and would lock the floor out by 9am.
  const limited = await rateLimit(req, { name: 'board-check', max: 240, windowSeconds: 600 })
  if (limited) return limited

  try {
    const { token } = await params
    const body = await req.json().catch(() => ({}))

    // ── Resolve the capability ────────────────────────────────────────────────
    // .eq(), never .ilike(): a wildcard would match loosely AND throw away the
    // token's entropy.
    const { data: dept } = await supabaseAdmin
      .from('production_departments')
      .select('id, is_active')
      .eq('token', token)
      .maybeSingle()

    // Same 404 for a bad token and a retired department — never confirm which
    // tokens are real.
    if (!dept || !dept.is_active) {
      return NextResponse.json({ error: 'This board is no longer available.' }, { status: 404 })
    }

    // ── Validate the body ─────────────────────────────────────────────────────
    const taskId = String(body.taskId ?? '').trim()
    const action = ACTIONS.includes(body.action as Action) ? (body.action as Action) : null
    const actorName = cleanActorName(body.actorName)

    if (!taskId || !action) {
      return NextResponse.json({ error: 'Missing or invalid request.' }, { status: 400 })
    }
    if (!actorName) {
      return NextResponse.json({ error: 'Tell us who you are first.' }, { status: 400 })
    }

    // ── Prove the task belongs to THIS board ──────────────────────────────────
    // The department id comes from the token lookup above — never from the body.
    // This is the check that stops one board's link writing to another's work.
    const { data: task } = await supabaseAdmin
      .from('production_tasks')
      .select('id, status, cadence, project_id')
      .eq('id', taskId)
      .eq('department_id', dept.id)
      .is('archived_at', null)
      .maybeSingle()

    if (!task) {
      return NextResponse.json({ error: 'That task is no longer on this board.' }, { status: 404 })
    }

    // A project task is only checkable while its project is live on the board
    // (active, not archived). Standing duties (project_id null) skip this. Guards
    // a stale board or ?project link from ticking off a completed build's work.
    if (task.project_id) {
      const { data: proj } = await supabaseAdmin
        .from('production_projects')
        .select('id')
        .eq('id', task.project_id)
        .eq('status', 'active')
        .is('archived_at', null)
        .maybeSingle()
      if (!proj) {
        return NextResponse.json({ error: 'That task is no longer on this board.' }, { status: 404 })
      }
    }

    // Blocked work is not checkable from the floor — a manager clears the block
    // first. Enforced here and not just hidden in the UI.
    if (task.status === 'blocked') {
      return NextResponse.json(
        { error: 'That task is blocked — your manager needs to clear it first.' },
        { status: 409 }
      )
    }

    // ── Write ─────────────────────────────────────────────────────────────────
    // done_on is the SHOP-local date, which is what makes recurring tasks reset
    // correctly (see effectiveDone in lib/production.ts). Storing a UTC date
    // here would roll the board over at 8pm local.
    const patch =
      action === 'done'
        ? {
            status: 'done' as const,
            done_on: shopDate(),
            done_by: actorName,
            done_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }
        : {
            status: 'open' as const,
            done_on: null,
            done_by: null,
            done_at: null,
            updated_at: new Date().toISOString(),
          }

    const { error: updErr } = await supabaseAdmin
      .from('production_tasks')
      .update(patch)
      .eq('id', task.id)
      // Re-assert the scope on the write itself, not just the read above. Cheap,
      // and it means a future refactor that loosens the lookup can't silently
      // turn this into a cross-department write.
      .eq('department_id', dept.id)

    if (updErr) {
      console.error('[board-check] update failed', updErr)
      return NextResponse.json({ error: 'Could not save that. Try again.' }, { status: 500 })
    }

    // Trail. Best-effort: the check-off already succeeded and the floor must not
    // see an error for a bookkeeping miss — but log it, because a silently empty
    // trail defeats the point of having one.
    const { error: evErr } = await supabaseAdmin.from('production_task_events').insert({
      task_id: task.id,
      action: action === 'done' ? 'done' : 'reopened',
      actor_name: actorName,
      source: 'board',
    })
    if (evErr) console.error('[board-check] event insert failed', evErr)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[board-check] unhandled', err)
    return NextResponse.json({ error: 'Something went wrong. Please try again.' }, { status: 500 })
  }
}
