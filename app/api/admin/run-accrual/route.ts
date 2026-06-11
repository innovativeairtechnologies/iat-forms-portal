import { NextResponse } from 'next/server'
import { isAdminAuthenticated } from '@/lib/admin-auth'
import { runWeeklyAccrual } from '@/lib/accrual'

export async function POST() {
  if (!(await isAdminAuthenticated())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runWeeklyAccrual()
    console.log(`[admin/run-accrual] Processed ${result.processed} employees, skipped ${result.skipped}`)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[admin/run-accrual] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
