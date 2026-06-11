import { NextRequest, NextResponse } from 'next/server'
import { runWeeklyAccrual } from '@/lib/accrual'

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization')
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runWeeklyAccrual()
    console.log(`[cron/accrue-pto] Processed ${result.processed} employees, skipped ${result.skipped}`)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/accrue-pto] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
