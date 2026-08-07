import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSooAuth } from '@/lib/api-auth'
import { assemble, type UnitFacts, type ProjectSetpoints } from '@/lib/soo'
import { ensureLibrarySeeded, getSooLibrary } from '@/lib/soo-library'

/* Assemble the document from the confirmed facts.
 *
 * No model, no network, no randomness — `assemble()` is a pure function of
 * (library, facts, setpoints). This route exists on the server rather than in
 * the client only so the LIBRARY is authoritative: the browser never chooses
 * which clauses apply.
 *
 * The result deliberately carries `excluded`, `blocked` and `uncovered`
 * alongside the document body, and all three are stored. "What was left out and
 * why" is the completeness receipt — without it, a reader cannot tell a clause
 * that does not apply from one nobody ever wrote.
 */

export const dynamic = 'force-dynamic'

export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const auth = await requireSooAuth()
  if (auth instanceof NextResponse) return auth

  const { id } = await ctx.params
  const { data: doc } = await supabaseAdmin.from('soo_documents').select('*').eq('id', id).single()
  if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  if (doc.status === 'approved') {
    return NextResponse.json(
      { error: 'This sequence is approved. Reopen it before reassembling.' },
      { status: 409 },
    )
  }
  if (!doc.facts) {
    return NextResponse.json({ error: 'Confirm the unit configuration first.' }, { status: 400 })
  }

  // Version 1 must be on file before anything can be approved against it.
  await ensureLibrarySeeded().catch((e) => console.error('SOO library seed error:', e))

  const library = await getSooLibrary()
  const result = assemble(library, doc.facts as UnitFacts, (doc.setpoints ?? {}) as ProjectSetpoints)

  // Overrides are keyed by clause. A clause that no longer survives assembly —
  // because a fact changed — must not keep a stale human edit alive: it would
  // reappear the moment that fact changed back, carrying text written against a
  // configuration the unit no longer has.
  const liveKeys = new Set<string>()
  const walk = (clauses: { key: string; children: { key: string; children: unknown[] }[] }[]) => {
    for (const c of clauses) {
      liveKeys.add(c.key)
      walk(c.children as never)
    }
  }
  walk(result.sections.flatMap((s) => s.clauses) as never)

  const overrides = Array.isArray(doc.overrides)
    ? (doc.overrides as { clause_key: string }[]).filter((o) => liveKeys.has(o.clause_key))
    : []
  const dropped = Array.isArray(doc.overrides) ? (doc.overrides as unknown[]).length - overrides.length : 0

  const { data, error } = await supabaseAdmin
    .from('soo_documents')
    .update({
      assembled: result,
      overrides,
      library_version: result.libraryVersion,
      assembled_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single()

  if (error || !data) {
    console.error('SOO assemble error:', error)
    return NextResponse.json({ error: 'Assembled, but could not save.' }, { status: 500 })
  }

  return NextResponse.json({ document: data, droppedOverrides: dropped })
}
