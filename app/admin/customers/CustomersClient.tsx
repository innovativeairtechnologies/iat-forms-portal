'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Building2, Search, Plus, ChevronRight, Boxes } from 'lucide-react'
import type { Customer } from '@/lib/supabase'
import { HEADER_BOX, BODY_BOX, rowCx, StatusPill, Th } from '@/components/admin/list'
import NewCustomerWizard from '@/components/admin/NewCustomerWizard'

type CustomerRow = Customer & { unit_count: number }
type Filter = 'all' | 'active' | 'inactive'

const COLS = 'grid-cols-[1.5fr_1.5fr_1fr_84px_104px_28px]'

export default function CustomersClient({ customers }: { customers: CustomerRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [showWizard, setShowWizard] = useState(false)

  const matchesTab = (c: CustomerRow, f: Filter) => (f === 'all' ? true : c.status === f)

  const q = search.toLowerCase()
  const filtered = customers.filter((c) => {
    const matchesSearch =
      !q ||
      c.company_name.toLowerCase().includes(q) ||
      (c.primary_contact_name || '').toLowerCase().includes(q) ||
      (c.contact_email || '').toLowerCase().includes(q)
    return matchesSearch && matchesTab(c, filter)
  })

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Header */}
      <div className="px-8 pt-8 pb-6 border-b border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-[12px] font-semibold text-gray-400 uppercase tracking-widest mb-1">Operations</p>
            <h1 className="text-[26px] font-bold text-gray-900 dark:text-white tracking-tight">Customers</h1>
            <p className="text-[13px] text-gray-400 mt-0.5">
              {customers.length} {customers.length === 1 ? 'account' : 'accounts'} with portal access
            </p>
          </div>
          <button
            onClick={() => setShowWizard(true)}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm"
          >
            <Plus size={15} />
            New Customer
          </button>
        </div>
      </div>

      <div className="p-8">
        {/* Filter tabs */}
        <div className="flex items-center gap-6 mb-4 border-b border-zinc-200 dark:border-zinc-800 flex-wrap">
          {(
            [
              ['all', 'All'],
              ['active', 'Active'],
              ['inactive', 'Inactive'],
            ] as [Filter, string][]
          ).map(([f, label]) => {
            const count = customers.filter((c) => matchesTab(c, f)).length
            const active = filter === f
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`relative pb-2.5 text-[13px] whitespace-nowrap transition-colors ${
                  active
                    ? 'font-semibold text-zinc-900 dark:text-white'
                    : 'font-medium text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300'
                }`}
              >
                {label}
                <span className={`ml-1.5 text-[11px] tabular-nums ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-zinc-300 dark:text-zinc-600'}`}>
                  {count}
                </span>
                {active && <span className="absolute left-0 right-0 -bottom-px h-[2px] rounded-full bg-emerald-500" />}
              </button>
            )
          })}
        </div>

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

        {/* Floating header */}
        <div className={`grid ${COLS} ${HEADER_BOX}`}>
          <Th>Company</Th>
          <Th>Contact</Th>
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
                className={`${rowCx(COLS, { i })} group ${c.status === 'inactive' ? 'opacity-60' : ''}`}
              >
                {/* Company */}
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-6 h-6 rounded-md bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center flex-shrink-0">
                    <Building2 size={13} className="text-zinc-500 dark:text-zinc-400" />
                  </span>
                  <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition-colors">
                    {c.company_name}
                  </span>
                </div>
                {/* Contact */}
                <div className="min-w-0 text-zinc-600 dark:text-zinc-300 truncate">
                  {c.primary_contact_name || c.contact_email || '—'}
                  {c.primary_contact_name && c.contact_email && (
                    <span className="text-zinc-400 dark:text-zinc-500"> · {c.contact_email}</span>
                  )}
                </div>
                {/* Location */}
                <div className="min-w-0 text-zinc-500 dark:text-zinc-400 truncate">{c.location || '—'}</div>
                {/* Units */}
                <div className="flex items-center gap-1.5 text-zinc-600 dark:text-zinc-300 tabular-nums">
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
                <div className="flex justify-center">
                  <ChevronRight size={14} className="text-zinc-300 dark:text-zinc-600 group-hover:text-emerald-500 transition-colors" />
                </div>
              </Link>
            ))
          )}
        </div>
      </div>

      {/* New customer wizard */}
      {showWizard && <NewCustomerWizard onClose={() => setShowWizard(false)} onCreated={() => router.refresh()} />}
    </div>
  )
}
