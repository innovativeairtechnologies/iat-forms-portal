'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Plus, ChevronRight, Boxes } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Customer } from '@/lib/supabase'
import { StatusPill, tabCx, tabCountCx } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar,
  CardTable, Row, EmptyRow, Pagination, usePagedList, ListSearch, ToneAvatar,
} from '@/components/admin/list-card'
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

  // Dataset-wide summary (independent of the active tab/search).
  const activeCount = customers.filter((c) => c.status === 'active').length
  const inactiveCount = customers.filter((c) => c.status === 'inactive').length
  const totalUnits = customers.reduce((sum, c) => sum + c.unit_count, 0)

  const allSelected = filtered.length > 0 && filtered.every((c) => sel.has(c.id))

  // Client-side pagination over the filtered set (default 10 · resets on filter/search).
  const pg = usePagedList(filtered.length, { initialPerPage: 10, resetKey: `${filter}|${search}` })
  const pageRows = filtered.slice(pg.start, pg.end)

  const isList = filter !== 'requests' && filter !== 'warranty'

  // Clear the selection when the visible set changes (filter/search/tab) so a
  // bulk delete can never touch rows outside the current view.
  useEffect(() => { sel.clear() }, [filter, search]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Operations"
          title="Customers"
          count={`${customers.length} ${customers.length === 1 ? 'account' : 'accounts'} with portal access`}
          actions={
            <button
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-2 h-9 px-3.5 rounded-lg bg-brand hover:bg-brand-hover text-white text-[13px] font-medium transition-colors"
            >
              <Plus size={15} />
              New Customer
            </button>
          }
        />

        {/* Filter tabs */}
        <div className="flex items-center gap-1 px-5 border-b border-hairline overflow-x-auto scrollbar-hide">
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

        {isList && (
          <>
            {/* Summary strip */}
            <StatStrip>
              <Stat tone="sky"     label="Accounts" value={customers.length.toLocaleString()} />
              <Stat tone="emerald" label="Active"   value={activeCount.toLocaleString()} />
              <Stat tone="slate"   label="Inactive" value={inactiveCount.toLocaleString()} />
              <Stat tone="violet"  label="Units"    value={totalUnits.toLocaleString()} sub="under portal access" />
            </StatStrip>

            {/* Search */}
            <Toolbar>
              <ListSearch value={search} onChange={setSearch} placeholder="Search…" width={256} />
              <div className="flex-1" />
              <span className="text-[12px] text-ink-muted tabular-nums">
                {filtered.length} {filtered.length === 1 ? 'account' : 'accounts'}
              </span>
            </Toolbar>

            {/* Table — Company · Location · Units · Status */}
            <CardTable
              cols={COLS}
              minWidth={760}
              head={
                <>
                  <SelectBox
                    className="hidden sm:flex"
                    checked={allSelected}
                    onChange={() => sel.setAll(filtered.map((c) => c.id), !allSelected)}
                  />
                  <span>Company</span>
                  <span className="hidden sm:block">Location</span>
                  <span className="hidden sm:block">Units</span>
                  <span>Status</span>
                  <span className="hidden sm:block" />
                </>
              }
            >
              {filtered.length === 0 ? (
                <EmptyRow>
                  <Building2 size={28} className="text-ink-faint block mx-auto mb-3" />
                  {customers.length === 0
                    ? 'No customers yet. Create one from a Submittal to give them portal access.'
                    : 'No customers match.'}
                </EmptyRow>
              ) : (
                pageRows.map((c) => {
                  const dim = c.status === 'inactive'
                  const subtitle =
                    c.primary_contact_name && c.contact_email
                      ? `${c.primary_contact_name} · ${c.contact_email}`
                      : c.primary_contact_name || c.contact_email || '—'
                  return (
                    <Row key={c.id} cols={COLS} href={`/admin/customers/${c.id}`} selected={sel.has(c.id)}>
                      {/* Select */}
                      <SelectBox className="hidden sm:flex" checked={sel.has(c.id)} onChange={() => sel.toggle(c.id)} />
                      {/* Identity — company over contact */}
                      <div className={cn('flex items-center gap-2.5 min-w-0', dim && 'opacity-60')}>
                        <ToneAvatar name={c.company_name} />
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{c.company_name}</p>
                          <p className="text-[11.5px] text-ink-muted truncate">{subtitle}</p>
                        </div>
                      </div>
                      {/* Location */}
                      <div className={cn('hidden sm:block min-w-0 text-[13px] text-ink-secondary truncate', dim && 'opacity-60')}>{c.location || '—'}</div>
                      {/* Units */}
                      <div className={cn('hidden sm:flex items-center gap-1.5 text-[13px] text-ink-secondary tabular-nums', dim && 'opacity-60')}>
                        <Boxes size={13} className="text-ink-faint" />
                        {c.unit_count}
                      </div>
                      {/* Status */}
                      <div className={cn(dim && 'opacity-60')}>
                        {dim ? <StatusPill tone="slate">Inactive</StatusPill> : <StatusPill tone="emerald">Active</StatusPill>}
                      </div>
                      {/* Chevron */}
                      <div className={cn('hidden sm:flex justify-center', dim && 'opacity-60')}>
                        <ChevronRight size={14} className="text-ink-faint group-hover:text-brand transition-colors" />
                      </div>
                    </Row>
                  )
                })
              )}
            </CardTable>

            <Pagination
              page={pg.page}
              perPage={pg.perPage}
              total={filtered.length}
              totalPages={pg.totalPages}
              onPage={pg.setPage}
              onPerPage={pg.setPerPage}
              unit="accounts"
            />
          </>
        )}
      </ListCard>

      {/* Requests / Warranty tabs swap to their own queues (each renders its own
          white cards, so they live on the canvas below the header card). */}
      {filter === 'requests' && (
        <div className="mt-4">
          <CustomerRequestsQueue requests={requests} />
        </div>
      )}
      {filter === 'warranty' && (
        <div className="mt-4">
          <WarrantyRequestsQueue requests={warrantyRequests} />
        </div>
      )}

      {isList && (
        <BulkBar count={sel.count} onClear={sel.clear}>
          <BulkDeleteButton entity="customers" ids={sel.ids} onDone={sel.clear} />
        </BulkBar>
      )}

      {/* New customer wizard */}
      {showWizard && <NewCustomerWizard onClose={() => setShowWizard(false)} onCreated={() => router.refresh()} />}
    </ListCardPage>
  )
}
