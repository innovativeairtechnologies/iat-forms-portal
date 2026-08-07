import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSooAuth } from '@/lib/api-auth'
import { FACT_SPECS, PROJECT_KEYS, type FactKey, type ProjectKey, type UnitFacts } from '@/lib/soo'

/* Read and update one Sequence of Operation document.
 *
 * ⚠️ `assembled`, `library_version`, `assembled_at` and `status` are NOT
 * patchable here — each is derived by its own route (assemble / status). The
 * assembled document is the output of a deterministic function over confirmed
 * facts; letting a request body write it directly would make the whole
 * traceability story a lie, since nothing downstream could tell an assembled
 * clause from one somebody posted.
 */

export const dynamic = 'force-dynamic'

/** Human-typed fields only. Everything else is server-derived. */
const PATCHABLE = ['title', 'customer_name', 'project_name', 'unit_tag', 'review_notes'] as const

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSooAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await ctx.params
  const { data, error } = await supabaseAdmin.from('soo_documents').select('*').eq('id', id).single()
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ document: data })
}

/**
 * Coerce an incoming facts object against FACT_SPECS.
 *
 * Never throws and never invents. An unknown key is dropped; a value of the
 * wrong shape becomes null (= unknown), which BLOCKS the clauses that need it
 * rather than letting a junk value through to gate one. Same posture as
 * parseSizingInputs in lib/sizing.ts.
 */
function coerceFacts(raw: unknown, current: UnitFacts): UnitFacts {
  if (!raw || typeof raw !== 'object') return current
  const incoming = raw as Record<string, unknown>
  const out = { ...current } as Record<string, unknown>

  for (const key of Object.keys(FACT_SPECS) as FactKey[]) {
    if (!(key in incoming)) continue
    const v = incoming[key]
    if (v === null || v === undefined || v === '') {
      out[key] = null
      continue
    }
    const spec = FACT_SPECS[key]
    if (spec.kind === 'boolean') {
      out[key] = typeof v === 'boolean' ? v : v === 'true' ? true : v === 'false' ? false : null
    } else if (spec.kind === 'number') {
      const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
      out[key] = Number.isFinite(n) ? n : null
    } else if (spec.kind === 'enum') {
      out[key] = spec.options?.includes(String(v)) ? String(v) : null
    } else if (spec.kind === 'object') {
      out[key] = typeof v === 'object' ? v : null
    } else {
      out[key] = String(v)
    }
  }
  return out as UnitFacts
}

function coerceSetpoints(raw: unknown): Record<string, number | null> {
  const out: Record<string, number | null> = {}
  if (!raw || typeof raw !== 'object') return out
  const incoming = raw as Record<string, unknown>
  for (const key of PROJECT_KEYS as ProjectKey[]) {
    if (!(key in incoming)) continue
    const v = incoming[key]
    if (v === null || v === undefined || v === '') {
      out[key] = null
      continue
    }
    const n = typeof v === 'number' ? v : Number(String(v).replace(/,/g, ''))
    out[key] = Number.isFinite(n) ? n : null
  }
  return out
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSooAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await ctx.params
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  if (!body) return NextResponse.json({ error: 'Malformed body' }, { status: 400 })

  const { data: current } = await supabaseAdmin.from('soo_documents').select('*').eq('id', id).single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  // An approved document is the record of what was signed off. Editing it would
  // silently change a controls narrative someone already put their name to.
  if (current.status === 'approved') {
    return NextResponse.json(
      { error: 'This sequence is approved. Reopen it before making changes.' },
      { status: 409 },
    )
  }

  const update: Record<string, unknown> = {}
  for (const key of PATCHABLE) {
    if (typeof body[key] === 'string') update[key] = body[key]
  }
  if ('facts' in body) update.facts = coerceFacts(body.facts, (current.facts ?? {}) as UnitFacts)
  if ('setpoints' in body) update.setpoints = coerceSetpoints(body.setpoints)
  if ('conflicts' in body) update.conflicts = Array.isArray(body.conflicts) ? body.conflicts : []
  if ('provenance' in body && body.provenance && typeof body.provenance === 'object') {
    update.provenance = body.provenance
  }
  if ('overrides' in body) {
    // Overrides are clause-keyed text edits. `note` is what makes an edit to a
    // control constant admissible — approvalBlockers enforces it, so it is
    // carried through verbatim rather than normalised away.
    update.overrides = Array.isArray(body.overrides)
      ? body.overrides
          .filter((o): o is Record<string, unknown> => !!o && typeof o === 'object')
          .map((o) => ({
            clause_key: String(o.clause_key ?? ''),
            text: String(o.text ?? ''),
            ...(typeof o.note === 'string' && o.note.trim() ? { note: o.note.trim() } : {}),
          }))
          .filter((o) => o.clause_key)
      : []
  }

  if (Object.keys(update).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('soo_documents')
    .update(update)
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('SOO update error:', error)
    return NextResponse.json({ error: 'Could not save.' }, { status: 500 })
  }
  return NextResponse.json({ document: data })
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSooAuth({ approve: true })
  if (auth instanceof NextResponse) return auth

  const { id } = await ctx.params
  const { data: current } = await supabaseAdmin
    .from('soo_documents')
    .select('status, submittal_path')
    .eq('id', id)
    .single()
  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (current.status === 'approved') {
    return NextResponse.json({ error: 'Reopen the sequence before deleting it.' }, { status: 409 })
  }

  if (current.submittal_path) {
    const { error: rmErr } = await supabaseAdmin.storage.from('soo-submittals').remove([current.submittal_path])
    if (rmErr) console.error('SOO submittal remove error:', rmErr)
  }

  const { error } = await supabaseAdmin.from('soo_documents').delete().eq('id', id)
  if (error) {
    console.error('SOO delete error:', error)
    return NextResponse.json({ error: 'Could not delete.' }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
