import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireSooAuth } from '@/lib/api-auth'
import { blankFacts } from '@/lib/soo'

/* List and create Sequence of Operation documents.
 *
 * ONE DOCUMENT = ONE UNIT. The master SOO we started from covered five models in
 * a single narrative, which is why it hedges throughout ("where provided"); the
 * portal produces a document per unit instead, so every statement can be
 * definite. There is no units child table.
 *
 * A new document starts with a blank fact set — every key present and NULL. That
 * is deliberate: null means UNKNOWN, so the assembler blocks the clauses that
 * depend on it and lists them for a human, rather than quietly excluding them.
 * An empty document therefore reports "42 clauses need facts", not "here is your
 * sequence" with holes in it.
 */

export const dynamic = 'force-dynamic'

export async function GET() {
  const auth = await requireSooAuth()
  if (auth instanceof NextResponse) return auth

  const { data, error } = await supabaseAdmin
    .from('soo_documents')
    .select('id, title, customer_name, project_name, unit_tag, status, library_version, assembled_at, updated_at')
    .order('updated_at', { ascending: false })

  if (error) {
    console.error('SOO list error:', error)
    return NextResponse.json({ error: 'Could not load documents.' }, { status: 500 })
  }
  return NextResponse.json({ documents: data ?? [] })
}

export async function POST(req: NextRequest) {
  const auth = await requireSooAuth()
  if (auth instanceof NextResponse) return auth

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null
  const customerName = typeof body?.customer_name === 'string' ? body.customer_name.trim() : ''
  const projectName = typeof body?.project_name === 'string' ? body.project_name.trim() : ''
  const unitTag = typeof body?.unit_tag === 'string' ? body.unit_tag.trim() : null

  const title = projectName || customerName || 'Untitled sequence'

  const { data, error } = await supabaseAdmin
    .from('soo_documents')
    .insert({
      title,
      customer_name: customerName,
      project_name: projectName,
      unit_tag: unitTag || null,
      status: 'draft',
      facts: { ...blankFacts(), customer: customerName || null, project_name: projectName || null, unit_tag: unitTag || null },
      setpoints: {},
      created_by: auth.userId,
    })
    .select('id')
    .single()

  if (error || !data) {
    console.error('SOO create error:', error)
    return NextResponse.json({ error: 'Could not create the document.' }, { status: 500 })
  }
  return NextResponse.json({ id: data.id }, { status: 201 })
}
