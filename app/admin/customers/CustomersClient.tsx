'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Search, Plus, ChevronRight, Boxes } from 'lucide-react'
import type { Customer } from '@/lib/supabase'
import { HEADER_BOX, BODY_BOX, rowCx, StatusPill, Th, TableScroll, ListPageHeader, IdentityCell, tabCx, tabCountCx } from '@/components/admin/list'
import { useBulkSelect, SelectBox, BulkBar, BulkDeleteButton } from '@/components/admin/bulk-select'
import NewCustomerWizard from '@/components/admin/NewCustomerWizard'
import CustomerRequestsQueue, { type CustomerPortalRequestRow } from './CustomerRequestsQueue'
import WarrantyRequestsQueue, { type WarrantyRequestRow } from './WarrantyRequestsQueue'

type CustomerRow = Customer & { unit_count: number }
type Filter = 'all' | 'active' | 'inactive' | 'requests' | 'warranty'

// Mobile keeps company-identity + status; select/location/units/chevron at sm+.
const COLS = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[34px_2fr_1fr_84px_104px_28px]'

export default function CustomersClient({
  customers,
  requests,
  warrantyRequests,
}: {
  customers: CustomerRow[]
  requests: CustomerPortalRequestRow[]
  warrantyRequests: WarrantyRequestRow[]
}) {
  const router = useRouter()
  const sel = useBulkSelect()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [showWizard, setShowWizard] = useState(false)

  const pendingRequestCount = requests.filter((r) => r.status === 'pending').length
  const pendingWarrantyCount = warrantyRequests.filter((r) => r.status === 'pending').length

  const matchesTab = (c: CustomerRow, f: Filter) => (f === 'all' ? true : f === 'requests' || f === 'warranty' ? false : c.status === f)

  const q = search.toLowerCase()
  const filtered = customers.filter((c) => {
    const matchesSearch =
      !q ||
      c.company_name.toLowerCase().includes(q) ||
      (c.primary_contact_name || '').toLowerCase().includes(q) ||
      (c.contact_email || '').toLowerCase().includes(q)
    return matchesSearch && matchesTab(c, filter)
  })

  const allSelected = filtered.length > 0 && filtered.every(c => sel.has(c.id))

  // Clear the selection when the visible set changes (filter/search/tab) so a
  // bulk delete can never touch rows outside the current view.
  useEffect(() => { sel.clear() }, [filter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Header */}
      <ListPageHeader
        overline="Operations"
        title="Customers"
        count={`${customers.length} ${customers.length === 1 ? 'account' : 'accounts'} with portal access`}
        actions={
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Plus size={15} />
            New Customer
          </button>
        }
      >
        {/* Filter tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['inactive', 'Inactive'],
              ['requests', 'Requests'],
              ['warranty', 'Warranty'],
            ] as [Filter, string][]
          ).map(([f, label]) => {
            const count =
              f === 'requests' ? pendingRequestCount : f === 'warranty' ? pendingWarrantyCount : customers.filter((c) => matchesTab(c, f)).length
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

        {filter === 'requests' ? (
          <CustomerRequestsQueue requests={requests} />
        ) : filter === 'warranty' ? (
          <WarrantyRequestsQueue requests={warrantyRequests} />
        ) : (
          <>
        {/* Search */}
        <div className="flex items-center gap-2.5 mb-4 flex-wrap">
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="pl-8 pr-3 h-9 text-[12.5px] w-64 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-lg text-zinc-700 dark:text-zinc-200 placeholder:text-zinc-400 dark:placeholder:text-zinc-500 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all"
            />
          </div>
          <span className="ml-auto text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">
            {filtered.length} {filtered.length === 1 ? 'account' : 'accounts'}
          </span>
        </div>

        {/* Floating header — hidden on mobile, where the rows read as a plain feed */}
        <TableScroll minWidth={760}>
        <div className={`hidden sm:grid ${COLS} ${HEADER_BOX}`}>
          <SelectBox checked={allSelected} onChange={() => sel.setAll(filtered.map(c => c.id), !allSelected)} />
          <Th>Company</Th>
          <Th>Location</Th>
          <Th>Units</Th>
          <Th>Status</Th>
          <Th />
        </div>

        {/* Body */}
        <div className={BODY_BOX}>
          {filtered.length === 0 ? (
            <div className="py-16 text-center">
              <Building2 size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">
                {customers.length === 0
                  ? 'No customers yet. Create one from a Submittal to give them portal access.'
                  : 'No customers match.'}
              </p>
            </div>
          ) : (
            filtered.map((c, i) => (
              <Link
                key={c.id}
                href={`/admin/customers/${c.id}`}
                className={`${rowCx(COLS, { i, selected: sel.has(c.id) })} group ${c.status === 'inactive' ? 'opacity-60' : ''}`}
              >
                {/* Select */}
                <SelectBox className="hidden sm:flex" checked={sel.has(c.id)} onChange={() => sel.toggle(c.id)} />
                {/* Identity — company over contact */}
                <IdentityCell
                  icon={<Building2 size={13} />}
                  title={c.company_name}
                  subtitle={
                    c.primary_contact_name && c.contact_email
                      ? `${c.primary_contact_name} · ${c.contact_email}`
                      : c.primary_contact_name || c.contact_email || undefined
                  }
                />
                {/* Location */}
                <div className="hidden sm:block min-w-0 text-zinc-500 dark:text-zinc-400 truncate">{c.location || '—'}</div>
                {/* Units */}
                <div className="hidden sm:flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 tabular-nums">
                  <Boxes size={13} className="text-zinc-300 dark:text-zinc-600" />
                  {c.unit_count}
                </div>
                {/* Status */}
                <div>
                  {c.status === 'inactive' ? (
                    <StatusPill tone="slate">Inactive</StatusPill>
                  ) : (
                    <StatusPill tone="emerald">Active</StatusPill>
                  )}
                </div>
                {/* Chevron */}
                <div className="hidden sm:flex justify-center">
                  <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>
        </TableScroll>
        </>
        )}
      </div>

      {filter !== 'requests' && filter !== 'warranty' && (
        <BulkBar count={sel.count} onClear={sel.clear}>
          <BulkDeleteButton entity="customers" ids={sel.ids} onDone={sel.clear} />
        </BulkBar>
      )}

      {/* New customer wizard */}
      {showWizard && <NewCustomerWizard onClose={() => setShowWizard(false)} onCreated={() => router.refresh()} />}
    </div>
  )
}
