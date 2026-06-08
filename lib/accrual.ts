import { supabaseAdmin } from './supabase-admin'

export interface AccrualEmployeeResult {
  employee_id: string
  name: string
  pto_delta: number
  sick_delta: number
  new_pto_balance: number
  new_sick_balance: number
}

export interface AccrualRunResult {
  processed: number
  skipped: number
  employees: AccrualEmployeeResult[]
  ran_at: string
}

export async function runBiweeklyAccrual(): Promise<AccrualRunResult> {
  const { data: employees, error } = await supabaseAdmin
    .from('employees')
    .select('id, name, email, pto_balance, sick_balance, pto_accrual_rate, sick_accrual_rate')
    .order('name')

  if (error) throw new Error(`Failed to fetch employees: ${error.message}`)
  if (!employees?.length) {
    return { processed: 0, skipped: 0, employees: [], ran_at: new Date().toISOString() }
  }

  const results: AccrualEmployeeResult[] = []
  const logEntries: {
    employee_id: string
    type: string
    hours_delta: number
    reason: string
    note: string
  }[] = []

  for (const emp of employees) {
    const ptoDelta  = Number(emp.pto_accrual_rate)  || 0
    const sickDelta = Number(emp.sick_accrual_rate) || 0

    if (ptoDelta === 0 && sickDelta === 0) continue

    const newPto  = Number(emp.pto_balance)  + ptoDelta
    const newSick = Number(emp.sick_balance) + sickDelta

    const { error: updateErr } = await supabaseAdmin
      .from('employees')
      .update({ pto_balance: newPto, sick_balance: newSick })
      .eq('id', emp.id)

    if (updateErr) {
      console.error(`[accrual] failed to update ${emp.id}:`, updateErr.message)
      continue
    }

    if (ptoDelta  > 0) logEntries.push({ employee_id: emp.id, type: 'pto',  hours_delta: ptoDelta,  reason: 'scheduled', note: 'Biweekly accrual' })
    if (sickDelta > 0) logEntries.push({ employee_id: emp.id, type: 'sick', hours_delta: sickDelta, reason: 'scheduled', note: 'Biweekly accrual' })

    results.push({
      employee_id: emp.id,
      name: emp.name || emp.email,
      pto_delta:        ptoDelta,
      sick_delta:       sickDelta,
      new_pto_balance:  newPto,
      new_sick_balance: newSick,
    })
  }

  if (logEntries.length) {
    const { error: logErr } = await supabaseAdmin.from('accrual_log').insert(logEntries)
    if (logErr) console.error('[accrual] log insert failed:', logErr.message)
  }

  return {
    processed: results.length,
    skipped:   employees.length - results.length,
    employees: results,
    ran_at:    new Date().toISOString(),
  }
}
