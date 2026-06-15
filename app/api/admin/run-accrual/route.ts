import { NextResponse } from 'next/server'
import { getAdminUser } from '@/lib/admin-auth'
import { runWeeklyAccrual } from '@/lib/accrual'
import { logAudit } from '@/lib/audit'

export async function POST() {
  const admin = await getAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await runWeeklyAccrual()
    console.log(`[admin/run-accrual] Processed ${result.processed} employees, skipped ${result.skipped}`)
    await logAudit({
      actor: { id: admin.user.id, name: admin.displayName },
      action: 'accrual.run',
      entityType: 'accrual',
      summary: `Ran weekly PTO/sick accrual — ${result.processed} processed, ${result.skipped} skipped`,
      metadata: { processed: result.processed, skipped: result.skipped },
    })
    return NextResponse.json(result)
  } catch (err) {
    console.error('[admin/run-accrual] Error:', err)
    return NextResponse.json({ error: String(err) }, { status: 500 })
  }
}
