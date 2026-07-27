import { NextResponse } from 'next/server'
import { requireBridgeAuth } from '@/lib/bridge-auth'
import { getSrvSections } from '@/lib/srv-config'

export const dynamic = 'force-dynamic'

/**
 * Bridge: the live SRV section content.
 *
 * Served from the DB-backed config (getSrvSections) rather than the code default,
 * so an admin's edits at /admin/srv take effect on the customer portal
 * immediately — and, critically, so the form the customer FILLS matches the
 * sections the submit endpoint VALIDATES against. If the two ever drifted, a
 * customer could complete a form that then fails validation.
 */
export async function POST(request: Request) {
  const auth = await requireBridgeAuth(request, '/api/bridge/srv-config')
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status })

  try {
    const sections = await getSrvSections()
    return NextResponse.json({ sections })
  } catch (e) {
    console.error('[bridge/srv-config] failed:', e)
    return NextResponse.json({ error: 'Could not load SRV content' }, { status: 500 })
  }
}
