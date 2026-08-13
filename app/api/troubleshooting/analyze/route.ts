import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { verifyRecaptcha } from '@/lib/recaptcha'
import { generateTroubleshootingTips } from '@/lib/troubleshooting-ai'

// Stateless AI tips for the in-form "AI Analysis" card — generates suggestions
// from the answers so far WITHOUT persisting anything. The real submit
// (/api/troubleshooting) is what stores the row + tips.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { name: 'troubleshooting-analyze', max: 20, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()
    // Unauthenticated endpoint that spends a paid model call, so it gets the same
    // gate its twin /api/tickets/analyze already had (added 2026-08-13). Degrade
    // to empty tips rather than erroring — the client treats no tips as "you can
    // still submit", so a failed check never blocks a real customer.
    const recaptcha = await verifyRecaptcha(body.recaptcha_token, 'analyze_troubleshooting')
    if (!recaptcha.ok) {
      console.warn('[troubleshooting/analyze] reCAPTCHA check failed:', recaptcha.reason)
      return NextResponse.json({ recommendations: [] })
    }
    const recommendations = await generateTroubleshootingTips(body)
    return NextResponse.json({ recommendations })
  } catch (err) {
    console.error('[troubleshooting/analyze] error:', err)
    return NextResponse.json({ recommendations: [] })
  }
}
