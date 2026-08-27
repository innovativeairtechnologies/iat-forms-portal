export const dynamic = 'force-dynamic'

import { notFound, redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getPreflight, listThemes } from '@/lib/pp-data'
import PreflightClient from './PreflightClient'

/* One pre-production check — the meeting itself. */
export default async function PreflightPage({ params }: { params: Promise<{ id: string }> }) {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const { id } = await params
  const data = await getPreflight(id)
  if (!data) notFound()

  return <PreflightClient preflight={data.preflight} items={data.items} themes={await listThemes()} />
}
