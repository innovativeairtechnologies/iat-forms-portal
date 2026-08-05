import { notFound, redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import ProposalEditor from './ProposalEditor'
import type { Proposal } from '@/lib/proposals'

export const dynamic = 'force-dynamic'

export default async function ProposalPage({ params }: { params: Promise<{ id: string }> }) {
  const admin = await getAdminSurfaceUser()
  if (!admin) redirect('/login')
  if (!admin.can('proposals')) redirect('/admin')

  const { id } = await params
  const { data } = await supabaseAdmin.from('proposals').select('*').eq('id', id).single()
  if (!data) notFound()

  // Whether the Approve button renders at all. The server route re-checks it —
  // this only decides what is drawn.
  const canApprove = admin.role === 'admin'

  return <ProposalEditor initial={data as Proposal} canApprove={canApprove} />
}
