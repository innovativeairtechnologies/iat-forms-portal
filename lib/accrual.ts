import { supabaseAdmin } from './supabase-admin'
import type { AccrualTier, AccrualConfig } from './supabase'
import { getCustomerIds } from './staff'
import { currentNyWeekStart, nyDateOf, nyWeekStart } from './et-clock'

/**
 * Which employees have ALREADY been credited by a scheduled run this Eastern week.
 *
 * ⛔ Until 2026-09-02 this function did not exist and there was no guard of any
 * kind: a second invocation added another week's hours to every balance and wrote
 * a second set of ledger rows. The job was safe only because it had exactly one
 * cron entry, which meant it could not be pinned to a fixed Eastern hour without
 * first making a repeat run harmless. This is that.
 *
 * The check is derived from `accrual_log` — the ledger itself — rather than from a
 * "last run" marker. A marker is a CLAIM written at one moment: if the run then
 * dies halfway, the marker says done and nobody is ever credited, or it says not
 * done and everyone is credited twice. Reading the ledger is per employee and
 * self-healing, so a run that crashes after 6 of 14 people simply finishes the
 * remaining 8 next time.
 *
 * Rows are matched by their EASTERN week, not by a UTC timestamp window: the job
 * runs at 4am ET, which is the previous calendar day in UTC for part of the year.
 */
async function alreadyAccruedThisWeek(): Promise<Set<string>> {
  const weekStart = currentNyWeekStart()
  // 8 days is comfortably more than one week, so the window always contains the
  // whole of the current Eastern week no matter which day or hour this runs.
  const since = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabaseAdmin
    .from('accrual_log')
    .select('employee_id, created_at')
    .eq('reason', 'scheduled')
    .gte('created_at', since)

  // Fail CLOSED: if the ledger cannot be read we cannot prove this week is
  // unaccrued, and crediting twice is worse than crediting late. Money-adjacent.
  if (error) throw new Error(`Cannot verify prior accrual, refusing to run: ${error.message}`)

  const done = new Set<string>()
  for (const row of data ?? []) {
    if (nyWeekStart(nyDateOf(new Date(row.created_at))) === weekStart) done.add(row.employee_id)
  }
  return done
}

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
  /** Employees a scheduled run had already credited this Eastern week. */
  already_accrued: number
  /** The Monday (Eastern) of the week this run belongs to. */
  week_start: string
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
    customerIds,
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
    getCustomerIds(),
  ])

  if (empError)  throw new Error(`Failed to fetch employees: ${empError.message}`)
  if (tierError) throw new Error(`Failed to fetch accrual tiers: ${tierError.message}`)
  if (cfgError)  throw new Error(`Failed to fetch accrual config: ${cfgError.message}`)

  const config = configs?.[0] as AccrualConfig | undefined
  if (!config) throw new Error('accrual_config row missing — run migration 007.')

  // Exclude customers: every customer invite creates an employees row (migration 001
  // trigger), so without this filter the weekly accrual writes phantom PTO/sick +
  // accrual_log rows to customer accounts. Fail-closed (money-adjacent).
  const staff = (employees ?? []).filter((e) => !customerIds.has(e.id))
  const weekStart = currentNyWeekStart()
  if (!staff.length) {
    return { processed: 0, skipped: 0, already_accrued: 0, week_start: weekStart, employees: [], ran_at: new Date().toISOString() }
  }

  const alreadyDone = await alreadyAccruedThisWeek()

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
  let alreadyAccrued = 0

  for (const emp of staff) {
    // Already credited by a scheduled run this Eastern week — the whole point of
    // the guard. Counted separately from `skipped`, which means "nothing to accrue"
    // (at the cap); conflating them would hide a repeat run inside a normal number.
    if (alreadyDone.has(emp.id)) { alreadyAccrued++; continue }

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
    already_accrued: alreadyAccrued,
    week_start: weekStart,
    employees: results,
    ran_at: new Date().toISOString(),
  }
}
