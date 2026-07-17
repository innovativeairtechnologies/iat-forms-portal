import { NextResponse, type NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireProductionAuth } from '@/lib/api-auth'
import { cleanActorName } from '@/lib/production'

// The floor roster behind each board's "who are you?" picker (migration 055).
//
// These are NAMES ON A LIST, not accounts. Deliberately not `employees`: the
// floor has no portal logins, and `employees` isn't staff-only anyway (every
// customer invite gets a row — see lib/staff.ts). Nothing here is an auth
// boundary; it exists so someone taps their name instead of typing it.

export async function POST(req: NextRequest) {
  const err = await requireProductionAuth()
  if (err) return err

  const body = await req.json().catch(() => ({}))
  const departmentId = String(body.department_id ?? '').trim()
  // Same cleaner the public board uses, so a roster name and a typed name can't
  // normalise differently and render as two different people.
  const name = cleanActorName(body.name)

  if (!departmentId || !name) {
    return NextResponse.json({ error: 'A department and a name are required.' }, { status: 400 })
  }

  const { data: dept } = await supabaseAdmin
    .from('production_departments')
    .select('id')
    .eq('id', departmentId)
    .maybeSingle()
  if (!dept) return NextResponse.json({ error: 'That department no longer exists.' }, { status: 404 })

  const { data: last } = await supabaseAdmin
    .from('production_people')
    .select('sort_order')
    .eq('department_id', departmentId)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const { data, error } = await supabaseAdmin
    .from('production_people')
    .insert({ department_id: departmentId, name, sort_order: (last?.sort_order ?? 0) + 10 })
    .select('id')
    .single()

  if (error) {
    // 23505 = UNIQUE(department_id, name).
    if (error.code === '23505') {
      return NextResponse.json({ error: 'That name is already on this roster.' }, { status: 409 })
    }
    console.error('[production/people] insert failed', error)
    return NextResponse.json({ error: 'Could not add that person.' }, { status: 500 })
  }

  return NextResponse.json({ id: data.id }, { status: 201 })
}

export async function DELETE(req: NextRequest) {
  const err = await requireProductionAuth()
  if (err) return err

  const id = new URL(req.url).searchParams.get('id')?.trim()
  if (!id) return NextResponse.json({ error: 'Missing person.' }, { status: 400 })

  // A hard delete is right here, unlike tasks: roster rows carry no history.
  // Past check-offs stored the name as a SNAPSHOT on the task/event (never an
  // FK), so removing someone from the picker never rewrites who did what.
  const { error: delErr } = await supabaseAdmin.from('production_people').delete().eq('id', id)
  if (delErr) {
    console.error('[production/people] delete failed', delErr)
    return NextResponse.json({ error: 'Could not remove that person.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
