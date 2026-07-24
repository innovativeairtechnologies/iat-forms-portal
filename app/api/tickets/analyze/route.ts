import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { generateTroubleshootingTips } from '@/lib/troubleshooting-ai'

// Live pre-submit AI tips for the unified support form's "AI Analysis" step.
// Stateless — generates 1-3 safe steps from the answers so far; the actual submit
// (/api/tickets) reuses whatever the customer saw here, so there's no second model
// call. Public + rate-limited. The shared generator already reads the full merged
// field set (equipment + diagnostics).
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { name: 'tickets-analyze', max: 20, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()
    // On a failed check, degrade gracefully (empty tips) rather than erroring —
    // matches the client, which shows "you can still submit" if tips don't load.
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, 'analyze_ticket')
    if (!recaptcha.ok) return NextResponse.json({ recommendations: [] })
    const recommendations = await generateTroubleshootingTips(body)
    return NextResponse.json({ recommendations })
  } catch (err) {
    console.error('[tickets/analyze] error:', err)
    return NextResponse.json({ recommendations: [] })
  }
}
