'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileText, Loader2, Plus, ShieldCheck } from 'lucide-react'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar, CardTable, Row,
  EmptyRow, ListSearch, FilterDropdown, Pagination, usePagedList,
} from '@/components/admin/list-card'
import { StatusPill, type Tone } from '@/components/admin/list'
import type { ProposalStatus } from '@/lib/proposals'

const STATUS_LABELS: Record<ProposalStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
}

const STATUS_TONE: Record<ProposalStatus, Tone> = {
  draft: 'slate',
  in_review: 'amber',
  approved: 'emerald',
}

/** Only what the list needs — the page deliberately does not select the blobs. */
type ProposalRow = {
  id: string
  title: string
  customer_name: string
  job_name: string
  status: ProposalStatus
  verification: unknown | null
  sizing_result: { selection?: { model?: string; unitsRequired?: number } } | null
  updated_at: string
}

const COLS = 'grid-cols-[minmax(200px,1.3fr)_minmax(150px,1fr)_minmax(150px,1fr)_120px_110px]'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function ProposalsClient({ proposals }: { proposals: ProposalRow[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('__all')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return proposals.filter((p) => {
      if (status !== '__all' && p.status !== status) return false
      if (!q) return true
      const hay = [p.title, p.customer_name, p.job_name, p.sizing_result?.selection?.model]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [proposals, search, status])

  const { page, setPage, perPage, setPerPage, totalPages, start, end } = usePagedList(
    filtered.length, { resetKey: `${search}|${status}` }
  )

  const counts = useMemo(() => ({
    draft: proposals.filter((p) => p.status === 'draft').length,
    in_review: proposals.filter((p) => p.status === 'in_review').length,
    approved: proposals.filter((p) => p.status === 'approved').length,
  }), [proposals])

  const createFresh = async () => {
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/proposals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) {
        setCreateError(json.error || 'Could not create the proposal.')
        return
      }
      router.push(`/admin/proposals/${json.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Sales"
          title="Proposals"
          count={`${proposals.length} proposal${proposals.length === 1 ? '' : 's'} · drafted from a sizing selection, approved before it leaves the building`}
          actions={
            <>
              {createError && <span className="text-[12px] text-rose-600">{createError}</span>}
              <button
                type="button"
                onClick={createFresh}
                disabled={creating}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 rounded-lg bg-brand text-white text-[13px] font-medium hover:bg-brand-hover active:scale-[0.98] transition-all disabled:opacity-60"
              >
                {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                New proposal
              </button>
            </>
          }
        />
        <StatStrip>
          <Stat tone="slate" label="Drafts" value={counts.draft} />
          <Stat tone="amber" label="In review" value={counts.in_review} />
          <Stat tone="emerald" label="Approved" value={counts.approved} sub="Watermark lifted" />
        </StatStrip>
        <Toolbar>
          <ListSearch value={search} onChange={setSearch} placeholder="Search proposals…" />
          <FilterDropdown
            icon={FileText}
            allLabel="All statuses"
            value={status}
            onChange={setStatus}
            options={(['draft', 'in_review', 'approved'] as const).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        </Toolbar>
        <CardTable
          cols={COLS}
          minWidth={880}
          head={
            <>
              <span>Proposal</span>
              <span>Customer</span>
              <span>Equipment</span>
              <span>Status</span>
              <span className="justify-self-end">Updated</span>
            </>
          }
        >
          {filtered.length === 0 ? (
            <EmptyRow>
              {proposals.length === 0
                ? 'No proposals yet. Start one here, from a deal, or from a Sizing Studio selection.'
                : 'Nothing matches that filter.'}
            </EmptyRow>
          ) : (
            filtered.slice(start, end).map((p) => {
              const sel = p.sizing_result?.selection
              const units = sel?.unitsRequired ?? 1
              return (
                <Row key={p.id} cols={COLS} href={`/admin/proposals/${p.id}`}>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink truncate">
                      {p.title || 'Untitled proposal'}
                    </span>
                    <span className="block text-[11.5px] text-ink-muted truncate">
                      {p.job_name || 'No job named'}
                    </span>
                  </span>
                  <span className="text-[12.5px] text-ink-secondary truncate">
                    {p.customer_name || <span className="text-ink-faint">Not set</span>}
                  </span>
                  <span className="min-w-0 text-[12.5px] text-ink-secondary truncate">
                    {sel?.model ? (
                      <>
                        {units > 1 && <span className="tabular-nums text-ink-muted">{units} × </span>}
                        {sel.model}
                        {/* A verified proposal carries engineering-grade performance;
                            an unverified one is still planning coefficients. */}
                        {p.verification ? (
                          <ShieldCheck
                            size={13}
                            className="ml-1.5 inline-block align-[-2px] text-emerald-600 dark:text-emerald-400"
                            aria-label="Verified against DryWare"
                          />
                        ) : null}
                      </>
                    ) : (
                      <span className="text-ink-faint">No selection</span>
                    )}
                  </span>
                  <span><StatusPill tone={STATUS_TONE[p.status]}>{STATUS_LABELS[p.status]}</StatusPill></span>
                  <span className="justify-self-end text-[12px] text-ink-muted tabular-nums">{fmtDate(p.updated_at)}</span>
                </Row>
              )
            })
          )}
        </CardTable>
        <Pagination
          page={page} perPage={perPage} total={filtered.length} totalPages={totalPages}
          onPage={setPage} onPerPage={setPerPage} unit="proposals"
        />
      </ListCard>
    </ListCardPage>
  )
}
