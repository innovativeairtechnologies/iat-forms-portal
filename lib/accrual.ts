import { supabaseAdmin } from './supabase-admin'
import type { AccrualTier, AccrualConfig } from './supabase'

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

// Returns completed years of tenure as of today (bumps on hire-date anniversary)
function yearsCompleted(hireDateStr: string): number {
  const hire  = new Date(hireDateStr)
  const today = new Date()
  let years = today.getFullYear() - hire.getFullYear()
  const monthDiff = today.getMonth() - hire.getMonth()
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < hire.getDate())) years--
  return Math.max(0, years)
}

function getPtoRate(hireDateStr: string | null, tiers: AccrualTier[]): number {
  if (!hireDateStr || !tiers.length) return 0
  const years = yearsCompleted(hireDateStr)
  const tier  = tiers.find(t =>
    years >= t.min_tenure_years &&
    (t.max_tenure_years === null || years < t.max_tenure_years)
  )
  // Fall back to highest tier if somehow nothing matches
  return tier
    ? Number(tier.pto_weekly_rate)
    : Number(tiers[tiers.length - 1].pto_weekly_rate)
}

export async function runWeeklyAccrual(): Promise<AccrualRunResult> {
  const [
    { data: employees, error: empError },
    { data: tiers,     error: tierError },
    { data: configs,   error: cfgError  },
  ] = await Promise.all([
    supabaseAdmin
      .from('employees')
      .select('id, name, email, hire_date, pto_balance, sick_balance')
      .eq('is_active', true)
      .order('name'),
    supabaseAdmin
      .from('accrual_tiers')
      .select('*')
      .order('sort_order'),
    supabaseAdmin
      .from('accrual_config')
      .select('*')
      .eq('id', 1)
      .limit(1),
  ])

  if (empError)  throw new Error(`Failed to fetch employees: ${empError.message}`)
  if (tierError) throw new Error(`Failed to fetch accrual tiers: ${tierError.message}`)
  if (cfgError)  throw new Error(`Failed to fetch accrual config: ${cfgError.message}`)

  const config = configs?.[0] as AccrualConfig | undefined
  if (!config) throw new Error('accrual_config row missing — run migration 007.')

  if (!employees?.length) {
    return { processed: 0, skipped: 0, employees: [], ran_at: new Date().toISOString() }
  }

  const ptoCap      = Number(config.pto_cap_hours)
  const sickCap     = Number(config.sick_cap_hours)
  const rawSickRate = Number(config.sick_weekly_rate)

  const results: AccrualEmployeeResult[] = []
  const logEntries: {
    employee_id: string
    type: string
    hours_delta: number
    reason: string
    note: string
  }[] = []
  let skipped = 0

  for (const emp of employees) {
    const rawPtoRate  = getPtoRate(emp.hire_date, (tiers ?? []) as AccrualTier[])
    const ptoBalance  = Number(emp.pto_balance)
    const sickBalance = Number(emp.sick_balance)

    // Cap-aware: only accrue the portion that fits before the ceiling
    const ptoDelta  = ptoBalance  >= ptoCap  ? 0 : Math.min(rawPtoRate,  ptoCap  - ptoBalance)
    const sickDelta = sickBalance >= sickCap ? 0 : Math.min(rawSickRate, sickCap - sickBalance)

    if (ptoDelta === 0 && sickDelta === 0) { skipped++; continue }

    const newPto  = ptoBalance  + ptoDelta
    const newSick = sickBalance + sickDelta

    const { error: updateErr } = await supabaseAdmin
      .from('employees')
      .update({
        pto_balance:       newPto,
        sick_balance:      newSick,
        pto_accrual_rate:  rawPtoRate,   // keep employee row in sync for UI
        sick_accrual_rate: rawSickRate,
      })
      .eq('id', emp.id)

    if (updateErr) {
      console.error(`[accrual] failed to update ${emp.id}:`, updateErr.message)
      skipped++
      continue
    }

    if (ptoDelta  > 0) logEntries.push({ employee_id: emp.id, type: 'pto',  hours_delta: ptoDelta,  reason: 'scheduled', note: 'Weekly accrual' })
    if (sickDelta > 0) logEntries.push({ employee_id: emp.id, type: 'sick', hours_delta: sickDelta, reason: 'scheduled', note: 'Weekly accrual' })

    results.push({
      employee_id:      emp.id,
      name:             emp.name || emp.email,
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
    skipped,
    employees: results,
    ran_at: new Date().toISOString(),
  }
}
