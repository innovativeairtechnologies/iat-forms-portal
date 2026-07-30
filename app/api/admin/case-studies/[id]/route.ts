import { NextRequest, NextResponse } from 'next/server'
import { requireCaseStudiesAuth } from '@/lib/api-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Gap, NumberFlag, Sections, UnitInput } from '@/lib/case-studies'

export const dynamic = 'force-dynamic'

const STUDY_SELECT = '*, customers(*), case_study_units(*)'

async function loadStudy(id: string) {
  const { data } = await supabaseAdmin
    .from('case_studies')
    .select(STUDY_SELECT)
    .eq('id', id)
    .order('sort_order', { referencedTable: 'case_study_units', ascending: true })
    .single()
  return data
}

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireCaseStudiesAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await props.params

  const study = await loadStudy(id)
  if (!study) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ case_study: study })
}

// Fields a plain PATCH may write. Sections/claims arrive via their own keys
// below; status NEVER moves through here (that's the status route's job, with
// its marketing/admin gate — listing it here would bypass that gate).
const PATCHABLE = [
  'title', 'customer_disclosure', 'industry', 'region',
  'context_input', 'problem_before', 'outcome_after', 'review_notes',
] as const

export async function PATCH(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireCaseStudiesAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await props.params

  const body = (await req.json().catch(() => null)) as
    | (Partial<Record<(typeof PATCHABLE)[number], string>> & {
        edited_sections?: Sections
        gaps?: Gap[]
        flags?: NumberFlag[]
        units?: UnitInput[]
      })
    | null
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('case_studies')
    .select('id, status')
    .eq('id', id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Approved studies are locked — reopen (status route) to edit. review_notes
  // stays writable so marketing can annotate without unlocking the copy.
  const locked = existing.status === 'approved'

  const patch: Record<string, unknown> = {}
  for (const key of PATCHABLE) {
    if (!(key in body)) continue
    if (locked && key !== 'review_notes') {
      return NextResponse.json({ error: 'This case study is approved and locked. Reopen it to edit.' }, { status: 409 })
    }
    patch[key] = body[key]
  }
  if (body.customer_disclosure && !['anonymized', 'named'].includes(body.customer_disclosure)) {
    return NextResponse.json({ error: 'Invalid disclosure.' }, { status: 400 })
  }

  // Review artifacts: the edited working copy + gap/flag resolution toggles.
  // draft_sections is deliberately NOT patchable — the original stays immutable.
  if (body.edited_sections !== undefined) {
    if (locked) return NextResponse.json({ error: 'This case study is approved and locked. Reopen it to edit.' }, { status: 409 })
    patch.edited_sections = body.edited_sections
  }
  if (body.gaps !== undefined) {
    if (locked) return NextResponse.json({ error: 'This case study is approved and locked. Reopen it to edit.' }, { status: 409 })
    patch.gaps = body.gaps
  }
  if (body.flags !== undefined) {
    if (locked) return NextResponse.json({ error: 'This case study is approved and locked. Reopen it to edit.' }, { status: 409 })
    patch.flags = body.flags
  }

  if (Object.keys(patch).length) {
    const { error } = await supabaseAdmin.from('case_studies').update(patch).eq('id', id)
    if (error) {
      console.error('Case study patch error:', error)
      return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
    }
  }

  // Full unit-set replace (the editor always sends the complete list). Replace
  // rather than diff: unit rows are small, editor-owned, and have no children.
  if (body.units !== undefined) {
    if (locked) return NextResponse.json({ error: 'This case study is approved and locked. Reopen it to edit.' }, { status: 409 })
    if (!Array.isArray(body.units) || body.units.length > 50) {
      return NextResponse.json({ error: 'Invalid units.' }, { status: 400 })
    }
    const rows = body.units.map((u, i) => ({
      case_study_id: id,
      equipment_id: u.equipment_id || null,
      model_number: String(u.model_number ?? ''),
      serial_number: u.serial_number || null,
      voltage: u.voltage || null,
      location: u.location || null,
      install_date: u.install_date || null,
      application: String(u.application ?? ''),
      entering_conditions: String(u.entering_conditions ?? ''),
      target_conditions: String(u.target_conditions ?? ''),
      airflow: String(u.airflow ?? ''),
      notes: u.notes || null,
      sort_order: i,
    }))
    const { error: delErr } = await supabaseAdmin.from('case_study_units').delete().eq('case_study_id', id)
    if (delErr) {
      console.error('Case study units clear error:', delErr)
      return NextResponse.json({ error: 'Could not save the units.' }, { status: 500 })
    }
    if (rows.length) {
      const { error: insErr } = await supabaseAdmin.from('case_study_units').insert(rows)
      if (insErr) {
        console.error('Case study units insert error:', insErr)
        return NextResponse.json({ error: 'Could not save the units.' }, { status: 500 })
      }
    }
  }

  const study = await loadStudy(id)
  return NextResponse.json({ case_study: study })
}

export async function DELETE(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const auth = await requireCaseStudiesAuth()
  if (auth instanceof NextResponse) return auth
  const { id } = await props.params

  const { data: existing } = await supabaseAdmin
    .from('case_studies')
    .select('id, status')
    .eq('id', id)
    .single()
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // Deleting an APPROVED study destroys published-quality content — that's a
  // marketing/admin call, same gate as approving it. Drafts are fair game for
  // anyone who can create them.
  if (existing.status === 'approved') {
    const approver = await requireCaseStudiesAuth({ approve: true })
    if (approver instanceof NextResponse) return approver
  }

  const { error } = await supabaseAdmin.from('case_studies').delete().eq('id', id)
  if (error) {
    console.error('Case study delete error:', error)
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
