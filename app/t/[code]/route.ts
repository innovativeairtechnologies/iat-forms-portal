import { NextRequest, NextResponse } from 'next/server'
import { normalizeTagCode } from '@/lib/tool-crib'

/* The URL printed on every physical tool label: https://<portal>/t/IAT-0042
 *
 * Deliberately dumb and deliberately short-named. A label is glued to a drill
 * and can never be reprinted, so the URL it carries must outlive every rename
 * and re-route this feature ever goes through. `/t/` is a semantically empty
 * stub with nothing to outgrow — if "Tool Crib" becomes "Tool Room" in 2027, or
 * the scan surface moves, only the redirect target below changes and every
 * sticker in the building keeps working.
 *
 * Nothing else should ever be added to this file.
 *
 * Auth is handled by middleware, which gates /t/* and carries the original path
 * as ?redirect= so scanning while logged out lands back here after sign-in.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const normalized = normalizeTagCode(code)

  // An unreadable code still goes to the scan surface rather than 404ing at a
  // bare route — /tool-crib can explain itself and offer the typed-code field.
  const target = normalized ? `/tool-crib/${normalized}` : '/tool-crib?bad=1'

  return NextResponse.redirect(new URL(target, _req.url), 307)
}
