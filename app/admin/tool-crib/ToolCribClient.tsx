'use client'

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Wrench, Search, Plus, ChevronRight, QrCode, UserPlus } from 'lucide-react'
import type { CribToolStatus } from '@/lib/supabase'
import { CRIB_STATUS, cribTotals, formatCost, toolThumbPath } from '@/lib/tool-crib'
import { StatusPill, IdentityCell, tabCx, tabCountCx, timeAgo } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar,
  CardTable, Row, EmptyRow, Pagination, usePagedList, ToneAvatar,
} from '@/components/admin/list-card'
import { ToolThumb } from '@/components/admin/ToolThumb'
import type { CribToolRow, EmployeeOption } from './page'
import AddToolModal from './AddToolModal'
import AssignToolsModal from './AssignToolsModal'

type Filter = 'all' | CribToolStatus

/* Mobile keeps identity · status · holder (3 visible cells = 3 mobile tracks).
   Category, cost and the chevron return at sm+. See docs/mobile.md — the two
   tiers stay in sync only while the visible-cell count matches the mobile track
   count. The one-card table wrapper only applies the min-width floor from sm up,
   so the phone layout keeps its reduced column set instead of scrolling. */
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

export default function ToolCribClient({ tools, employees }: { tools: CribToolRow[]; employees: EmployeeOption[] }) {
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [adding, setAdding] = useState(false)
  const [assigning, setAssigning] = useState(false)

  // Dataset-wide rollups (unaffected by tab/search) — the two numbers leadership
  // asks for. Deliberately only two: a row of six KPIs would be decoration, and
  // DESIGN.md says color carries meaning or nothing. The dot colors mirror the
  // status pills they summarize (checked-out = sky, lost = rose).
  const totals = useMemo(() => cribTotals(tools), [tools])
  const availableCount = useMemo(() => tools.filter(t => t.status === 'available').length, [tools])

  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => tools.filter(t => {
    const hit = !q ||
      t.tag_code.toLowerCase().includes(q) ||
      t.name.toLowerCase().includes(q) ||
      (t.category ?? '').toLowerCase().includes(q) ||
      (t.make ?? '').toLowerCase().includes(q) ||
      (t.model ?? '').toLowerCase().includes(q) ||
      (t.home_location ?? '').toLowerCase().includes(q) ||
      (t.holder_name ?? '').toLowerCase().includes(q)
    return hit && (filter === 'all' || t.status === filter)
  }), [tools, q, filter])

  // Client-side pagination over the filtered set (server already loads all rows).
  const { page, setPage, perPage, setPerPage, totalPages, start, end } =
    usePagedList(filtered.length, { initialPerPage: 10, resetKey: `${filter}|${q}` })
  const pageRows = filtered.slice(start, end)

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
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
                className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-white text-[13px] font-semibold px-4 py-2.5 rounded-lg transition-colors"
              >
                <Plus size={15} />Add tool
              </button>
            </>
          }
        />

        <StatStrip>
          <Stat
            tone="sky"
            label="Out on the floor"
            value={formatCost(totals.onFloor)}
            sub={`${totals.checkedOut} ${totals.checkedOut === 1 ? 'tool' : 'tools'} checked out`}
          />
          <Stat
            tone="rose"
            label="Gone missing"
            value={formatCost(totals.lost)}
            sub="Tools marked lost"
          />
        </StatStrip>

        {/* Status filter tabs — the underline meets the band's bottom hairline,
            and each tab carries its live per-status count. */}
        <div className="flex items-center gap-1 px-5 border-b border-hairline overflow-x-auto scrollbar-hide">
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

        <Toolbar>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search name, code, holder…"
              /* 16px on mobile — anything smaller makes iOS Safari zoom the
                 viewport on focus (fixed portal-wide 2026-07-14). */
              className="pl-8 pr-3 h-9 text-[16px] sm:text-[12.5px] w-full sm:w-72 bg-surface-soft border border-hairline rounded-lg text-ink-secondary placeholder:text-ink-faint outline-none transition-all focus-visible:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
            />
          </div>
          <div className="flex-1" />
          <span className="text-[12px] text-ink-faint tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'tool' : 'tools'}
          </span>
        </Toolbar>

        <CardTable
          minWidth={780}
          cols={COLS}
          head={
            <>
              <span>Tool</span>
              <span className="hidden sm:block">Category</span>
              <span>Status</span>
              <span>Holder</span>
              <div className="hidden sm:block text-right">Cost</div>
              <span className="hidden sm:block" />
            </>
          }
        >
          {pageRows.length === 0 ? (
            <EmptyRow>
              <Wrench size={28} className="text-ink-faint mx-auto mb-3" />
              <p>
                {tools.length === 0
                  ? 'No tools yet. Add one, print its label, stick it on.'
                  : 'No tools match.'}
              </p>
            </EmptyRow>
          ) : (
            pageRows.map((t) => {
              const s = CRIB_STATUS[t.status]
              // Retired tools read as dimmed. Row has no className slot, so the
              // dimming lives on a thin wrapper (opacity cascades to the row).
              const retired = t.status === 'retired'
              return (
                <div key={t.id} className={retired ? 'opacity-60' : undefined}>
                  <Row cols={COLS} href={`/admin/tool-crib/${t.id}`}>
                    <IdentityCell
                      leading={<ToolThumb path={toolThumbPath(t.photo_urls)} size={30} />}
                      title={t.name}
                      subtitle={[t.tag_code, t.make, t.home_location].filter(Boolean).join(' · ')}
                    />

                    <div className="hidden sm:block text-[12.5px] text-ink-muted truncate">
                      {t.category || '—'}
                    </div>

                    <div><StatusPill tone={s.tone}>{s.label}</StatusPill></div>

                    {/* Holder — the answer to the question the feature exists for.
                        The avatar joins at sm+ (mobile keeps the original text-only
                        cell so the 3-track phone layout stays tight). */}
                    <div className="flex items-center gap-2 min-w-0 text-[12.5px]">
                      {t.status === 'checked_out' ? (
                        <>
                          {t.holder_name && (
                            <span className="hidden sm:block flex-shrink-0">
                              <ToneAvatar name={t.holder_name} size={24} />
                            </span>
                          )}
                          <span className="truncate">
                            {t.holder_name
                              ? <span className="text-ink-secondary">{t.holder_name}</span>
                              : <span className="text-ink-faint italic">Unknown holder</span>}
                            {t.held_since && (
                              <span className="hidden sm:inline text-ink-faint"> · {timeAgo(t.held_since)}</span>
                            )}
                          </span>
                        </>
                      ) : (
                        <span className="text-ink-faint">—</span>
                      )}
                    </div>

                    <div className="hidden sm:block text-right text-[12.5px] text-ink-muted tabular-nums">
                      {formatCost(t.purchase_cost)}
                    </div>

                    <ChevronRight
                      size={14}
                      className="hidden sm:block text-ink-faint group-hover:text-ink-muted transition-colors"
                    />
                  </Row>
                </div>
              )
            })
          )}
        </CardTable>

        {filtered.length > 0 && (
          <Pagination
            page={page}
            perPage={perPage}
            total={filtered.length}
            totalPages={totalPages}
            onPage={setPage}
            onPerPage={setPerPage}
            unit="tools"
          />
        )}
      </ListCard>

      {adding && <AddToolModal onClose={() => setAdding(false)} />}
      {assigning && (
        <AssignToolsModal
          employees={employees}
          availableCount={availableCount}
          onClose={() => setAssigning(false)}
        />
      )}
    </ListCardPage>
  )
}
