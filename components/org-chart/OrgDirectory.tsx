'use client'

import { useMemo, useState } from 'react'
import { Network, List as ListIcon, Search, Mail, Phone } from 'lucide-react'
import OrgChart, { type OrgEmployee, paletteFor, initialsOf, shownEmail } from '@/components/org-chart/OrgChart'

/* Shared org-chart shell with a Chart/List toggle. Used read-only as the employee
   /directory (canEdit off) and editable at /admin/org-chart (canEdit on). Chart view =
   the org chart; List view = a searchable roster of cards for quick contact lookups. */

export default function OrgDirectory({
  employees,
  canEdit = false,
  title = 'Directory',
  adminName,
}: {
  employees: OrgEmployee[]
  canEdit?: boolean
  title?: string
  adminName?: string
}) {
  const [view, setView] = useState<'chart' | 'list'>('chart')
  const [query, setQuery] = useState('')
  const [dept, setDept] = useState<string | null>(null)

  // Admins (canEdit) manage visibility, so they see everyone in the list; employees
  // see only people who are visible on the chart.
  const visible = useMemo(
    () => (canEdit ? employees : employees.filter((e) => e.org_visible)),
    [employees, canEdit],
  )

  const departments = useMemo(() => {
    const s = new Set<string>()
    visible.forEach((e) => { if (e.department?.trim()) s.add(e.department.trim()) })
    return Array.from(s).sort()
  }, [visible])

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return visible
      .filter((e) => {
        if (dept && e.department !== dept) return false
        if (!q) return true
        return [e.name, e.job_title, e.department, e.email, ...(e.interests || [])]
          .filter(Boolean).some((v) => String(v).toLowerCase().includes(q))
      })
      .sort((a, b) => (a.name || '').localeCompare(b.name || ''))
  }, [visible, query, dept])

  const toggle = (
    <div className="inline-flex rounded-lg border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      <button
        onClick={() => setView('chart')}
        className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium transition-colors ${
          view === 'chart' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
        }`}
      >
        <Network size={14} /> Chart
      </button>
      <button
        onClick={() => setView('list')}
        className={`inline-flex items-center gap-1.5 h-8 px-3 text-[12px] font-medium border-l border-zinc-200 dark:border-zinc-800 transition-colors ${
          view === 'list' ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white'
            : 'text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
        }`}
      >
        <ListIcon size={14} /> List
      </button>
    </div>
  )

  if (view === 'chart') {
    return <OrgChart employees={employees} canEdit={canEdit} title={title} adminName={adminName} toolbarExtra={toggle} />
  }

  return (
    <div className="flex-1 min-h-0 flex flex-col overflow-hidden bg-zinc-50 dark:bg-[#0a0a0b]">
      <div className="flex items-center gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <Network size={18} className="text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
          <h1 className="text-[15px] font-bold text-zinc-900 dark:text-white">{title}</h1>
          <span className="hidden sm:inline text-[12px] text-zinc-400 dark:text-zinc-500">
            · {filtered.length} {filtered.length === 1 ? 'person' : 'people'}
          </span>
          <div className="ml-2">{toggle}</div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-5 py-2 border-b border-zinc-200 dark:border-zinc-800 bg-white/60 dark:bg-zinc-900/20 flex-shrink-0 overflow-x-auto">
        <div className="relative flex-shrink-0">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search people…"
            className="h-8 w-52 pl-8 pr-3 text-[12px] rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
          />
        </div>
        <div className="flex items-center gap-1.5">
          {departments.map((d) => {
            const p = paletteFor(d)
            const on = dept === d
            return (
              <button
                key={d}
                onClick={() => setDept(on ? null : d)}
                className={`inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-[11px] font-medium border transition-colors whitespace-nowrap ${
                  on ? 'border-zinc-300 dark:border-zinc-600 bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100'
                     : 'border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: p.bar }} />
                {d}
              </button>
            )
          })}
        </div>
      </div>

      <div className="flex-1 min-h-0 overflow-auto p-4">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-40 text-[13px] text-zinc-400">No one matches your search.</div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
            {filtered.map((e) => {
              const p = paletteFor(e.department)
              return (
                <div key={e.id} className="flex items-start gap-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-3">
                  {e.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={e.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="w-10 h-10 rounded-full flex items-center justify-center text-[13px] font-bold flex-shrink-0" style={{ background: p.avBg, color: p.avText }}>
                      {initialsOf(e.name)}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="text-[13px] font-semibold text-zinc-900 dark:text-white truncate">{e.name}</div>
                    <div className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                      {e.job_title || '—'}{e.department ? ` · ${e.department}` : ''}
                    </div>
                    <div className="mt-1.5 flex flex-col gap-0.5">
                      {shownEmail(e.email) && (
                        <a href={`mailto:${shownEmail(e.email)}`} className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-emerald-600 dark:hover:text-emerald-400 truncate">
                          <Mail size={12} className="flex-shrink-0" />{shownEmail(e.email)}
                        </a>
                      )}
                      {e.phone && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400 truncate">
                          <Phone size={12} className="flex-shrink-0" />{e.phone}
                        </span>
                      )}
                    </div>
                    {(e.interests || []).length > 0 && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {e.interests.slice(0, 4).map((t) => (
                          <span key={t} className="text-[10px] px-1.5 py-[1px] rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
