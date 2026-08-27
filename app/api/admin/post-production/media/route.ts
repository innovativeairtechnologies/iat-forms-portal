import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { requireEngineeringAuth } from '@/lib/api-auth'

/* Serves one object out of the PRIVATE post-production bucket by 307-redirecting
   to a short-lived signed URL, so an <img src>, a <video src> and an <audio src>
   all just work with no client-side fetch/JSON juggling. Same trick as
   /api/tool-crib/photo and the ticket-attachment download route.

   ⚠️ Gated on `engineering_jobs` — the SAME perm as the pages — deliberately
   tighter than the tool-crib equivalent. A crib photo is a picture of a drill
   and every staff member is allowed to see every tool, so bucket membership is
   the authorization there. These are photographs of a customer's unit and
   voice notes of people criticising each other's work; whoever can open the
   board is exactly who may see them.

   Path shape is exactly what upload-url mints: `<kind>/<epoch-ms>-<base36>.<ext>`.
   Validating the SHAPE rather than doing a per-object DB lookup is deliberate —
   a finding renders several attachments and a detail page renders several
   findings, so a query per thumbnail would be pure waste. Every object in this
   bucket is walkaround media and every viewer here may see all of it. */

const PATH_RE = /^(photo|video|audio)\/\d{10,}-[a-z0-9]+\.[a-z0-9]{2,5}$/i

export async function GET(req: NextRequest) {
  const auth = await requireEngineeringAuth()
  if (auth instanceof NextResponse) return auth

  const path = req.nextUrl.searchParams.get('path') || ''
  if (!PATH_RE.test(path)) return NextResponse.json({ error: 'Invalid path' }, { status: 400 })

  // Five minutes: long enough to load a 50MB clip on shop wifi, short enough
  // that a copied URL is not a lasting hole.
  const { data, error } = await supabaseAdmin.storage
    .from('post-production').createSignedUrl(path, 60 * 5)
  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.redirect(data.signedUrl, 307)
}
