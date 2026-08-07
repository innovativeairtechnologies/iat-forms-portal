export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { clauseImpact, gatingFactKeys, type SooDocument, type UnitFacts } from '@/lib/soo'
import { getSooLibrary } from '@/lib/soo-library'
import SooEditor, { type FactImpact } from './SooEditor'

export default async function SooDocumentPage(props: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSurfaceUser()
  if (!admin) redirect('/login')
  if (!admin.can('soo')) redirect('/admin')

  const { id } = await props.params
  const { data } = await supabaseAdmin.from('soo_documents').select('*').eq('id', id).single()
  if (!data) notFound()

  const doc = data as SooDocument
  const library = await getSooLibrary()

  // "This dropdown moves 6 clauses." Computed on the server because it needs the
  // live library, which the browser never sees — and because it is the single
  // thing standing between a careful review and a rubber-stamp, so it must be
  // present on first paint rather than after a round-trip.
  const facts = (doc.facts ?? {}) as UnitFacts
  const impact: FactImpact = {}
  for (const key of gatingFactKeys(library)) impact[key] = clauseImpact(library, facts, key)

  return (
    <SooEditor
      doc={doc}
      impact={impact}
      libraryVersion={library.version}
      canApprove={admin.role === 'admin' || admin.role === 'engineering'}
    />
  )
}
