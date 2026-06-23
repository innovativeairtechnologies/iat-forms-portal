import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/rate-limit'
import { generateTroubleshootingTips } from '@/lib/troubleshooting-ai'

// Stateless AI tips for the in-form "AI Analysis" card — generates suggestions
// from the answers so far WITHOUT persisting anything. The real submit
// (/api/troubleshooting) is what stores the row + tips.
export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { name: 'troubleshooting-analyze', max: 20, windowSeconds: 600 })
  if (limited) return limited

  try {
    const body = await req.json()
    const recommendations = await generateTroubleshootingTips(body)
    return NextResponse.json({ recommendations })
  } catch (err) {
    console.error('[troubleshooting/analyze] error:', err)
    return NextResponse.json({ recommendations: [] })
  }
}
