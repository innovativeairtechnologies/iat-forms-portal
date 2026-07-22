'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Wrench, Search, Plus, ChevronRight, QrCode, UserPlus } from 'lucide-react'
import type { CribToolStatus } from '@/lib/supabase'
import { CRIB_STATUS, cribTotals, formatCost, toolThumbPath } from '@/lib/tool-crib'
import {
  HEADER_BOX, BODY_BOX, rowCx, StatusPill, Th, TableScroll,
  ListPageHeader, IdentityCell, tabCx, tabCountCx, timeAgo,
} from '@/components/admin/list'
import { ToolThumb } from '@/components/admin/ToolThumb'
import type { CribToolRow, EmployeeOption } from './page'
import AddToolModal from './AddToolModal'
import AssignToolsModal from './AssignToolsModal'

type Filter = 'all' | CribToolStatus

/* Mobile keeps identity · status · holder (3 visible cells = 3 mobile tracks).
   Category, cost and age return at sm+. See docs/mobile.md — the two tiers stay
   in sync only while the visible-cell count matches the mobile track count. */
const COLS =
  'grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,2fr)_150px_130px_150px_90px_28px]'

const TABS: [Filter, string][] = [
  ['all', 'All'],
  ['available', 'Available'],
  ['checked_out', 'Out'],
  ['maintenance', 'Maintenance'],
  ['lost', 'Lost'],
  ['retired', 'Retired'],
]

/* The two numbers leadership asks for. Deliberately only two — a row of six
   KPIs would be decoration, and DESIGN.md says color carries meaning or nothing. */
function Tile({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="flex-1 min-w-[160px] bg-surface border border-hairline rounded-xl px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="text-[22px] text-ink mt-1 tabular-nums" style={{ fontWeight: 620 }}>{value}</p>
      <p className="text-[11px] text-ink-muted mt-0.5">{hint}</p>
    </div>
  )
}

export default function ToolCribClient({ tools, employees }: { tools: CribToolRow[]; employees: EmployeeOption[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [assigning, setAssigning] = useState(false)

  const totals = useMemo(() => cribTotals(tools), [tools])
  const availableCount = useMemo(() => tools.filter(t => t.status === 'available').length, [tools])

  const q = search.trim().toLowerCase()
  const filtered = tools.filter(t => {
    const hit = !q ||
      t.tag_code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.category ?? '').toLowerCase().includes(q) ||
      (t.make ?? '').toLowerCase().includes(q) ||
      (t.model ?? '').toLowerCase().includes(q) ||
      (t.home_location ?? '').toLowerCase().includes(q) ||
      (t.holder_name ?? '').toLowerCase().includes(q)
    return hit && (filter === 'all' || t.status === filter)
  })

  return (
    <div className="flex-1 overflow-auto bg-canvas">
      <ListPageHeader
        overline="Operations"
        title="Tool Crib"
        count={`${tools.length} ${tools.length === 1 ? 'tool' : 'tools'} tracked`}
        actions={
          <>
            <button
              onClick={() => setAssigning(true)}
              className="flex items-center gap-2 bg-surface border border-hairline hover:bg-surface-soft text-ink-secondary text-[13px] font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              <UserPlus size={15} />Assign tools
            </button>
            <Link
              href="/admin/tool-crib/labels"
              className="flex items-center gap-2 bg-surface border border-hairline hover:bg-surface-soft text-ink-secondary text-[13px] font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              <QrCode size={15} />Print labels
            </Link>
            <button
              onClick={() => setAdding(true)}
              className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-brand-ink text-[13px] font-semibold px-4 py-2.5 rounded-lg transition-colors"
            >
              <Plus size={15} />Add tool
            </button>
          </>
        }
      >
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map(([f, label]) => {
            const count = f === 'all' ? tools.length : tools.filter(t => t.status === f).length
            const active = filter === f
            return (
              <button key={f} onClick={() => setFilter(f)} className={tabCx(active)}>
                {label}
                <span className={tabCountCx(active)}>{count}</span>
              </button>
            )
          })}
        </div>
      </ListPageHeader>

      <div className="p-4 sm:p-8">
        <div className="flex gap-3 mb-5 flex-wrap">
          <Tile
            label="Out on the floor"
            value={formatCost(totals.onFloor)}
            hint={`${totals.checkedOut} ${totals.checkedOut === 1 ? 'tool' : 'tools'} checked out`}
          />
          <Tile
            label="Gone missing"
            value={formatCost(totals.lost)}
            hint="Tools marked lost"
          />
        </div>

        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, code, holder…"
              /* 16px on mobile — anything smaller makes iOS Safari zoom the
                 viewport on focus (fixed portal-wide 2026-07-14). */
              className="pl-8 pr-3 h-9 text-[16px] sm:text-[12.5px] w-full sm:w-72 bg-surface border border-hairline rounded-lg text-ink-secondary placeholder:text-ink-faint outline-none transition-all focus-visible:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
          </div>
          <span className="ml-auto text-[12px] text-ink-faint tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'tool' : 'tools'}
          </span>
        </div>

        <TableScroll minWidth={780}>
          <div className={`hidden sm:grid ${COLS} ${HEADER_BOX}`}>
            <Th>Tool</Th>
            <Th>Category</Th>
            <Th>Status</Th>
            <Th>Holder</Th>
            <Th align="right">Cost</Th>
            <Th />
          </div>

          <div className={BODY_BOX}>
            {filtered.length === 0 ? (
              <div className="py-16 text-center">
                <Wrench size={28} className="text-ink-faint mx-auto mb-3" />
                <p className="text-[13px] text-ink-muted">
                  {tools.length === 0
                    ? 'No tools yet. Add one, print its label, stick it on.'
                    : 'No tools match.'}
                </p>
              </div>
            ) : (
              filtered.map((t, i) => {
                const s = CRIB_STATUS[t.status]
                const retired = t.status === 'retired'
                return (
                  <Link
                    key={t.id}
                    href={`/admin/tool-crib/${t.id}`}
                    className={`${rowCx(COLS, { i })} group ${retired ? 'opacity-60' : ''}`}
                  >
                    <IdentityCell
                      leading={<ToolThumb path={toolThumbPath(t.photo_urls)} size={30} />}
                      title={t.name}
                      subtitle={[t.tag_code, t.make, t.home_location].filter(Boolean).join(' · ')}
                    />

                    <div className="hidden sm:block text-[12.5px] text-ink-muted truncate">
                      {t.category || '—'}
                    </div>

                    <div><StatusPill tone={s.tone}>{s.label}</StatusPill></div>

                    {/* Holder. On a phone this is the third and last cell — it's
                        the answer to the question the feature exists for. */}
                    <div className="text-[12.5px] text-ink-secondary truncate">
                      {t.status === 'checked_out'
                        ? (t.holder_name ?? <span className="text-ink-faint italic">Unknown holder</span>)
                        : <span className="text-ink-faint">—</span>}
                      {t.status === 'checked_out' && t.held_since && (
                        <span className="hidden sm:inline text-ink-faint"> · {timeAgo(t.held_since)}</span>
                      )}
                    </div>

                    <div className="hidden sm:block text-right text-[12.5px] text-ink-muted tabular-nums">
                      {formatCost(t.purchase_cost)}
                    </div>

                    <ChevronRight
                      size={14}
                      className="hidden sm:block text-ink-faint group-hover:text-ink-muted transition-colors"
                    />
                  </Link>
                )
              })
            )}
          </div>
        </TableScroll>
      </div>

      {adding && <AddToolModal onClose={() => setAdding(false)} />}
      {assigning && (
        <AssignToolsModal
          employees={employees}
          availableCount={availableCount}
          onClose={() => setAssigning(false)}
        />
      )}
    </div>
  )
}
