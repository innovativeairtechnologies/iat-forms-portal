import { NextResponse } from 'next/server'
import { getAdminSurfaceUser } from '@/lib/admin-auth'
import { getDirectory } from '@/lib/directory'

export const dynamic = 'force-dynamic'

/* The company directory for client surfaces (the /admin/profile section).
   Server components call getDirectory() straight — this exists only because
   the profile page is a client component.

   Gated on the LOOSE getAdminSurfaceUser(): the same roster already renders at
   /admin/me/directory, which is in OPEN_ADMIN_PREFIXES, so every admin-surface
   role can see it. It is still a gate — an anonymous or customer session gets
   401, never the staff contact list. */

export async function GET() {
  const user = await getAdminSurfaceUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  return NextResponse.json({ people: await getDirectory() })
}
