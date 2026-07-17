import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServer } from '@/lib/supabase-server'
import { normalizeRole } from '@/lib/roles'

/* Serves a tool photo out of the PRIVATE crib-photos bucket by 307-redirecting
   to a short-lived signed URL — so an <img src> just works, with no client-side
   fetch/JSON juggling. Same trick as the ticket-attachment download route.

   Gated to any authenticated non-customer, deliberately looser than the
   admin-only registry: the employee scan page (/tool-crib/[code], open to every
   staff member incl. base `production`) shows the tool's photo, and those users
   hold no admin perms. That's safe — every object in this bucket is a tool
   photo, and every staff viewer is already allowed to see every tool, so
   bucket membership IS the authorization. We therefore do NOT do a per-image DB
   lookup (the list renders many thumbnails; a query per thumbnail would be pure
   waste); we validate the path SHAPE instead so it can't escape the bucket or
   name another object type.

   Path shape is exactly what photo-url mints: `<epoch-ms>-<base36>.<ext>`. */
const PATH_RE = /^\d{10,}-[a-z0-9]+\.(png|jpe?g|webp|gif)$/i

export async function GET(req: NextRequest) {
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles').select('role').eq('id', user.id).single()
  if (normalizeRole(profile?.role) === 'customer') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const path = req.nextUrl.searchParams.get('path') || ''
  if (!PATH_RE.test(path)) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('crib-photos')
    .createSignedUrl(path, 60 * 5) // 5 min — long enough to load, short enough not to leak
  if (error || !data) {
    return NextResponse.json({ error: 'Photo not found' }, { status: 404 })
  }
  return NextResponse.redirect(data.signedUrl, 307)
}
