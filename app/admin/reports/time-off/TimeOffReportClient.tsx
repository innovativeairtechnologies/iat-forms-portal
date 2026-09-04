'use client'

import { useMemo, useState } from 'react'
import { Clock, Download, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react'
import { ListCardPage, ListCard, CardHead, StatStrip, Stat } from '@/components/admin/list-card'

type Employee = {
  id: string
  name: string | null
  email: string | null
  job_title: string | null
  hire_date: string | null
  pto_balance: number
  sick_balance: number
  pto_accrual_rate: number | null
  sick_accrual_rate: number | null
}

type Tier = {
  id: number
  label: string
  min_tenure_years: number
  max_tenure_years: number | null
  pto_weekly_rate: number
  sort_order: number
}

type Config = {
  sick_weekly_rate: number
  pto_cap_hours: number
  sick_cap_hours: number
} | null

type SortKey = 'name' | 'pto' | 'sick'
type SortDir = 'asc' | 'desc'

function tenureYears(hireDate: string | null): number | null {
  if (!hireDate) return null
  const hire = new Date(hireDate + 'T00:00:00')
  const now = new Date()
  const years = now.getFullYear() - hire.getFullYear()
  const hadAnniversary =
    now.getMonth() > hire.getMonth() ||
    (now.getMonth() === hire.getMonth() && now.getDate() >= hire.getDate())
  return hadAnniversary ? years : years - 1
}

function tenureLabel(hireDate: string | null): string {
  if (!hireDate) return '—'
  const hire = new Date(hireDate + 'T00:00:00')
  const now = new Date()
  const totalMonths =
    (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth())
  if (totalMonths < 0) return '—'
  const years = Math.floor(totalMonths / 12)
  const months = totalMonths % 12
  if (years === 0) return `${months}mo`
  if (months === 0) return `${years}yr`
  return `${years}yr ${months}mo`
}

function findTier(hireDate: string | null, tiers: Tier[]): Tier | null {
  const years = tenureYears(hireDate)
  if (years === null) return null
  return (
    tiers.find(
      t =>
        years >= t.min_tenure_years &&
        (t.max_tenure_years === null || years < t.max_tenure_years),
    ) ?? null
  )
}

function fmtHrs(n: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDays(n: number): string {
  return (n / 8).toLocaleString('en-US', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function capPct(balance: number, cap: number): number {
  return Math.min(100, Math.round((balance / cap) * 100))
}

function CapBar({ pct, atCap }: { pct: number; atCap: boolean }) {
  return (
    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-surface-soft">
      <div
        className={`h-full rounded-full transition-all ${atCap ? 'bg-amber-400' : 'bg-brand'}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  )
}

function SortBtn({
  label,
  col,
  sortKey,
  dir,
  onSort,
}: {
  label: string
  col: SortKey
  sortKey: SortKey
  dir: SortDir
  onSort: (col: SortKey) => void
}) {
  const active = sortKey === col
  const Icon = active ? (dir === 'asc' ? ChevronUp : ChevronDown) : ChevronsUpDown
  return (
    <button
      onClick={() => onSort(col)}
      className="inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-ink-muted transition-colors hover:text-ink"
    >
      {label}
      <Icon size={11} />
    </button>
  )
}

export default function TimeOffReportClient({
  staff,
  tiers,
  config,
  canEdit,
}: {
  staff: Employee[]
  tiers: Tier[]
  config: Config
  canEdit: boolean
}) {
  const ptoCap = config?.pto_cap_hours ?? 240
  const sickCap = config?.sick_cap_hours ?? 160
  const sickRate = config?.sick_weekly_rate ?? 1.54

  const [sortKey, setSortKey] = useState<SortKey>('name')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [search, setSearch] = useState('')

  function handleSort(col: SortKey) {
    if (col === sortKey) {
      setSortDir(d => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(col)
      setSortDir(col === 'name' ? 'asc' : 'desc')
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return staff.filter(e => !q || (e.name ?? '').toLowerCase().includes(q))
  }, [staff, search])

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      let cmp = 0
      if (sortKey === 'name') cmp = (a.name ?? '').localeCompare(b.name ?? '')
      else if (sortKey === 'pto') cmp = a.pto_balance - b.pto_balance
      else cmp = a.sick_balance - b.sick_balance
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [filtered, sortKey, sortDir])

  const totalPto = staff.reduce((s, e) => s + e.pto_balance, 0)
  const totalSick = staff.reduce((s, e) => s + e.sick_balance, 0)
  const atPtoCap = staff.filter(e => e.pto_balance >= ptoCap).length
  const atSickCap = staff.filter(e => e.sick_balance >= sickCap).length

  return (
    <ListCardPage>
      {/* stat strip */}
      <StatStrip>
        <Stat tone="slate" label="Staff employees" value={staff.length} />
        <Stat tone="emerald" label="Total PTO hours" value={fmtHrs(totalPto)} sub={`${fmtDays(totalPto)} days`} />
        <Stat tone="sky" label="Total sick hours" value={fmtHrs(totalSick)} sub={`${fmtDays(totalSick)} days`} />
        <Stat tone="amber" label="At PTO cap" value={atPtoCap} sub={`${ptoCap} hr limit`} />
        <Stat tone="amber" label="At sick cap" value={atSickCap} sub={`${sickCap} hr limit`} />
      </StatStrip>

      {/* main table card */}
      <ListCard>
        <CardHead
          overline="Reports"
          title="Time Off"
          count={`${sorted.length} of ${staff.length} employees`}
          actions={
            <>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search name…"
                className="h-8 rounded-md border border-hairline bg-canvas px-3 text-[13px] text-ink placeholder:text-ink-faint focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
              <button
                onClick={() => window.print()}
                className="flex h-8 items-center gap-1.5 rounded-md border border-hairline bg-canvas px-3 text-[12px] font-medium text-ink-muted transition-colors hover:bg-surface-soft hover:text-ink"
              >
                <Download size={13} />
                Export
              </button>
            </>
          }
        />

        <div className="overflow-x-auto">
          <table className="w-full text-[13px] tabular-nums">
            <thead>
              <tr className="border-b border-hairline-soft bg-surface-soft">
                <th className="px-5 py-2.5 text-left">
                  <SortBtn label="Employee" col="name" sortKey={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted">Hire Date</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted">Tenure</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted">Tier</th>
                <th className="px-3 py-2.5 text-right">
                  <SortBtn label="PTO hrs" col="pto" sortKey={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-muted">PTO days</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-muted">PTO cap %</th>
                <th className="px-3 py-2.5 text-right">
                  <SortBtn label="Sick hrs" col="sick" sortKey={sortKey} dir={sortDir} onSort={handleSort} />
                </th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-muted">Sick days</th>
                <th className="px-3 py-2.5 text-right text-[11px] font-medium uppercase tracking-wider text-ink-muted">Sick cap %</th>
                <th className="px-3 py-2.5 text-left text-[11px] font-medium uppercase tracking-wider text-ink-muted">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-hairline-soft">
              {sorted.length === 0 && (
                <tr>
                  <td colSpan={11} className="px-5 py-10 text-center text-[13px] text-ink-muted">
                    No employees match that search.
                  </td>
                </tr>
              )}
              {sorted.map(emp => {
                const tier = findTier(emp.hire_date, tiers)
                const atPto = emp.pto_balance >= ptoCap
                const atSick = emp.sick_balance >= sickCap
                const ptoPct = capPct(emp.pto_balance, ptoCap)
                const sickPct = capPct(emp.sick_balance, sickCap)
                const ptoRate = emp.pto_accrual_rate ?? tier?.pto_weekly_rate ?? null

                return (
                  <tr
                    key={emp.id}
                    className="group transition-colors hover:bg-surface-soft"
                  >
                    {/* name + link */}
                    <td className="px-5 py-3">
                      {canEdit ? (
                        <a
                          href={`/admin/employees/${emp.id}`}
                          className="block font-medium text-ink no-underline hover:text-brand"
                        >
                          {emp.name ?? emp.email ?? emp.id}
                        </a>
                      ) : (
                        <span className="font-medium text-ink">{emp.name ?? emp.email ?? emp.id}</span>
                      )}
                      {emp.job_title && (
                        <span className="block text-[11.5px] text-ink-muted">{emp.job_title}</span>
                      )}
                    </td>

                    {/* hire date */}
                    <td className="px-3 py-3 text-ink-muted">
                      {emp.hire_date
                        ? new Date(emp.hire_date + 'T00:00:00').toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'short',
                            day: 'numeric',
                          })
                        : '—'}
                    </td>

                    {/* tenure */}
                    <td className="px-3 py-3 text-ink-muted">{tenureLabel(emp.hire_date)}</td>

                    {/* tier */}
                    <td className="px-3 py-3">
                      {tier ? (
                        <span className="inline-flex items-center gap-1">
                          <span className="text-ink">{tier.label}</span>
                          <span className="text-ink-muted">
                            ({ptoRate !== null ? `${ptoRate.toFixed(2)} hr/wk` : '—'})
                          </span>
                        </span>
                      ) : (
                        <span className="text-ink-faint">No hire date</span>
                      )}
                    </td>

                    {/* PTO hours */}
                    <td className="px-3 py-3 text-right font-medium text-ink">
                      <span className={atPto ? 'text-amber-600 dark:text-amber-400' : ''}>
                        {fmtHrs(emp.pto_balance)}
                      </span>
                    </td>

                    {/* PTO days */}
                    <td className="px-3 py-3 text-right text-ink-muted">{fmtDays(emp.pto_balance)}</td>

                    {/* PTO cap % */}
                    <td className="px-3 py-3 text-right">
                      <div>
                        <span className={`text-[12px] font-medium ${atPto ? 'text-amber-600 dark:text-amber-400' : 'text-ink-muted'}`}>
                          {ptoPct}%
                        </span>
                        <CapBar pct={ptoPct} atCap={atPto} />
                      </div>
                    </td>

                    {/* sick hours */}
                    <td className="px-3 py-3 text-right font-medium text-ink">
                      <span className={atSick ? 'text-amber-600 dark:text-amber-400' : ''}>
                        {fmtHrs(emp.sick_balance)}
                      </span>
                    </td>

                    {/* sick days */}
                    <td className="px-3 py-3 text-right text-ink-muted">{fmtDays(emp.sick_balance)}</td>

                    {/* sick cap % */}
                    <td className="px-3 py-3 text-right">
                      <div>
                        <span className={`text-[12px] font-medium ${atSick ? 'text-amber-600 dark:text-amber-400' : 'text-ink-muted'}`}>
                          {sickPct}%
                        </span>
                        <CapBar pct={sickPct} atCap={atSick} />
                      </div>
                    </td>

                    {/* status pill */}
                    <td className="px-3 py-3">
                      {atPto && atSick ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          Both at cap
                        </span>
                      ) : atPto ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          PTO at cap
                        </span>
                      ) : atSick ? (
                        <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                          Sick at cap
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600 dark:bg-slate-500/10 dark:text-slate-400">
                          Accruing
                        </span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>

            {/* totals row */}
            {sorted.length > 0 && (
              <tfoot>
                <tr className="border-t-2 border-hairline bg-surface-soft">
                  <td className="px-5 py-2.5 text-[12px] font-medium text-ink-muted" colSpan={4}>
                    {sorted.length} employees shown
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] font-medium text-ink">
                    {fmtHrs(sorted.reduce((s, e) => s + e.pto_balance, 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-ink-muted">
                    {fmtDays(sorted.reduce((s, e) => s + e.pto_balance, 0))}
                  </td>
                  <td />
                  <td className="px-3 py-2.5 text-right text-[12px] font-medium text-ink">
                    {fmtHrs(sorted.reduce((s, e) => s + e.sick_balance, 0))}
                  </td>
                  <td className="px-3 py-2.5 text-right text-[12px] text-ink-muted">
                    {fmtDays(sorted.reduce((s, e) => s + e.sick_balance, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* policy footnote */}
        <div className="border-t border-hairline-soft px-5 py-3 flex flex-wrap gap-x-6 gap-y-1 text-[11.5px] text-ink-muted">
          <span>
            <Clock size={11} className="mr-1 inline-block" />
            Accrues weekly every Monday at 4 am ET
          </span>
          <span>PTO cap {ptoCap} hrs · Sick cap {sickCap} hrs</span>
          <span>Sick rate {sickRate.toFixed(2)} hr/wk (flat)</span>
          <span>PTO rate by tenure tier</span>
          <span>1 day = 8 hrs</span>
        </div>
      </ListCard>
    </ListCardPage>
  )
}
