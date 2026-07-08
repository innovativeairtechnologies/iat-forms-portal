'use client'

import { useState } from 'react'
import { ChevronRight, Check, Lock, Loader2, KeyRound } from 'lucide-react'
import {
  PERM_LABELS,
  NON_DELEGATABLE_PERMS,
  ROLE_LABELS,
  type Perm,
  type PermMatrix,
  type StaffRole,
} from '@/lib/roles'

// The 5 scoped roles the matrix edits. `admin` is all-access (locked column);
// production/customer are barred from /admin so they aren't shown.
const EDITABLE_ROLES: Exclude<StaffRole, 'admin' | 'production'>[] = [
  'sales', 'hr', 'marketing', 'engineering', 'production_manager',
]
const ALL_PERMS = Object.keys(PERM_LABELS) as Perm[]

export default function PermissionsMatrix({ initialMatrix }: { initialMatrix: PermMatrix }) {
  const [grants, setGrants] = useState<Record<string, Set<Perm>>>(() => {
    const g: Record<string, Set<Perm>> = {}
    for (const r of EDITABLE_ROLES) g[r] = new Set(initialMatrix[r] ?? [])
    return g
  })
  const [saving, setSaving] = useState<string | null>(null) // `${role}:${perm}` in flight
  const [error, setError] = useState<string | null>(null)

  const flip = (role: string, perm: Perm, on: boolean) =>
    setGrants((prev) => {
      const next = { ...prev, [role]: new Set(prev[role]) }
      if (on) next[role].add(perm)
      else next[role].delete(perm)
      return next
    })

  const toggle = async (role: string, perm: Perm) => {
    if (NON_DELEGATABLE_PERMS.includes(perm) || saving) return
    const key = `${role}:${perm}`
    const granted = !grants[role].has(perm)
    setError(null)
    setSaving(key)
    flip(role, perm, granted) // optimistic
    try {
      const res = await fetch('/api/admin/permissions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, perm, granted }),
        // Never let a hung request wedge the whole grid (every toggle is
        // disabled while one save is in flight): time out so finally always runs.
        signal: AbortSignal.timeout(15000),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError(j.error || 'Failed to save — please try again.')
        flip(role, perm, !granted) // revert
      }
    } catch {
      setError('Failed to save — please try again.')
      flip(role, perm, !granted) // revert
    } finally {
      setSaving(null)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300 min-h-0">
      <div className="sticky top-0 z-10 flex items-center gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#0a0a0b]/90 backdrop-blur">
        <div className="flex items-center gap-1.5 text-[13px]">
          <span className="text-zinc-400 dark:text-zinc-500">System</span>
          <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-700" />
          <span className="font-semibold text-zinc-900 dark:text-zinc-100">Permissions</span>
        </div>
      </div>

      <div className="p-5 space-y-4 max-w-5xl">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound size={18} className="text-emerald-600 dark:text-emerald-400" />
            <h1 className="text-[20px] font-bold text-zinc-900 dark:text-white tracking-tight">Permissions</h1>
          </div>
          <p className="text-[13px] text-zinc-500 dark:text-zinc-400 mt-1 max-w-2xl">
            Toggle which sections each role can see and reach. Changes take effect on the person&apos;s next
            navigation — turning a permission on adds its tab to their sidebar and lets them open its pages.
            Admins always have full access. Scoped roles are view-only on edits (except Deals) for now.
          </p>
        </div>

        {error && (
          <div className="text-[13px] text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 rounded-xl px-4 py-2.5">
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]" style={{ minWidth: 720 }}>
              <thead>
                <tr className="border-b border-zinc-100 dark:border-zinc-800">
                  <th className="text-left font-semibold text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 px-4 py-3 sticky left-0 bg-white dark:bg-zinc-900/40">
                    Permission
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 w-16">
                    Admin
                  </th>
                  {EDITABLE_ROLES.map((r) => (
                    <th key={r} className="px-3 py-3 text-center font-semibold text-[11px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 w-24">
                      {ROLE_LABELS[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {ALL_PERMS.map((perm) => {
                  const adminOnly = NON_DELEGATABLE_PERMS.includes(perm)
                  return (
                    <tr key={perm} className="border-b border-zinc-50 dark:border-zinc-800/50 last:border-0">
                      <td className="px-4 py-2.5 sticky left-0 bg-white dark:bg-zinc-900/40">
                        <span className="font-medium text-zinc-700 dark:text-zinc-200">{PERM_LABELS[perm]}</span>
                        {adminOnly && (
                          <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-zinc-400 dark:text-zinc-500">Admin only</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <Check size={15} className="inline text-emerald-500" aria-label="Admin always has access" />
                      </td>
                      {EDITABLE_ROLES.map((role) => {
                        const key = `${role}:${perm}`
                        const on = grants[role].has(perm)
                        if (adminOnly) {
                          return (
                            <td key={role} className="px-3 py-2.5 text-center">
                              <Lock size={13} className="inline text-zinc-300 dark:text-zinc-600" aria-label="Admin-only permission" />
                            </td>
                          )
                        }
                        return (
                          <td key={role} className="px-3 py-2.5 text-center">
                            <button
                              type="button"
                              onClick={() => toggle(role, perm)}
                              disabled={!!saving}
                              role="switch"
                              aria-checked={on}
                              aria-label={`${on ? 'Revoke' : 'Grant'} ${PERM_LABELS[perm]} for ${ROLE_LABELS[role]}`}
                              className={
                                'relative inline-flex h-5 w-9 items-center rounded-full transition-colors disabled:opacity-60 ' +
                                (on ? 'bg-emerald-500' : 'bg-zinc-200 dark:bg-zinc-700')
                              }
                            >
                              {saving === key ? (
                                <Loader2 size={11} className="absolute left-1/2 -translate-x-1/2 animate-spin text-white" />
                              ) : (
                                <span
                                  className={
                                    'inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ' +
                                    (on ? 'translate-x-4' : 'translate-x-1')
                                  }
                                />
                              )}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-[11px] text-zinc-400 dark:text-zinc-600 pt-1 pb-4">
          Every change is recorded in the Audit Log. “Admin only” permissions (editing permissions, the customer-Jerry
          preview, and Jerry&apos;s Brain) can&apos;t be delegated.
        </p>
      </div>
    </div>
  )
}
