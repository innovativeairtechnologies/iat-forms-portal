export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { recentJobs } from '@/lib/pp-data'
import type { PpTag } from '@/lib/post-production'
import TagsClient from './TagsClient'

/* /admin/engineering/post-production/tags — the QR stickers.
 *
 * Print one, stick it on the unit or the test-bay wall, and anybody on the floor
 * can file a post-production finding without a portal account. Migration 099.
 */
export default async function TagsPage() {
  const actor = await getAdminSurfaceUser()
  if (!actor) redirect('/login')
  if (!actor.can('engineering_jobs')) redirect('/admin')

  const [{ data: tags }, jobs] = await Promise.all([
    supabaseAdmin.from('pp_tags').select('*').order('created_at', { ascending: false }),
    recentJobs(40),
  ])

  // How many walks each tag has produced — the only honest measure of whether a
  // sticker is in a place people actually stand.
  const { data: walks } = await supabaseAdmin
    .from('pp_walkarounds')
    .select('tag_id, status')
    .not('tag_id', 'is', null)

  const used = new Map<string, { walks: number; open: number }>()
  for (const w of (walks ?? []) as { tag_id: string; status: string }[]) {
    const c = used.get(w.tag_id) ?? { walks: 0, open: 0 }
    c.walks += 1
    if (w.status === 'walking') c.open += 1
    used.set(w.tag_id, c)
  }

  return (
    <TagsClient
      tags={((tags ?? []) as PpTag[]).map(t => ({ ...t, ...(used.get(t.id) ?? { walks: 0, open: 0 }) }))}
      jobs={jobs}
    />
  )
}
