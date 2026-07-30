'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { BookOpenCheck, Building2, Loader2, Plus } from 'lucide-react'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar, CardTable, Row,
  EmptyRow, ListSearch, FilterDropdown, Pagination, usePagedList, ToneAvatar,
} from '@/components/admin/list-card'
import { StatusPill, type Tone } from '@/components/admin/list'
import { STATUS_LABELS, type CaseStudy, type CaseStudyStatus } from '@/lib/case-studies'

const STATUS_TONE: Record<CaseStudyStatus, Tone> = {
  draft: 'slate',
  in_review: 'amber',
  approved: 'emerald',
}

const COLS = 'grid-cols-[minmax(220px,1.4fr)_minmax(140px,1fr)_110px_120px_110px]'

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function CaseStudiesClient({ studies }: { studies: CaseStudy[] }) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('__all')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return studies.filter((s) => {
      if (status !== '__all' && s.status !== status) return false
      if (!q) return true
      const hay = [s.title, s.customers?.company_name, s.industry, s.region]
        .filter(Boolean).join(' ').toLowerCase()
      return hay.includes(q)
    })
  }, [studies, search, status])

  const { page, setPage, perPage, setPerPage, totalPages, start, end } = usePagedList(
    filtered.length, { resetKey: `${search}|${status}` }
  )

  const counts = useMemo(() => ({
    draft: studies.filter((s) => s.status === 'draft').length,
    in_review: studies.filter((s) => s.status === 'in_review').length,
    approved: studies.filter((s) => s.status === 'approved').length,
  }), [studies])

  const createFresh = async () => {
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/case-studies', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      const json = await res.json()
      if (!res.ok) {
        setCreateError(json.error || 'Could not create the case study.')
        return
      }
      router.push(`/admin/case-studies/${json.id}`)
    } finally {
      setCreating(false)
    }
  }

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Sales"
          title="Case Studies"
          count={`${studies.length} stud${studies.length === 1 ? 'y' : 'ies'} · drafted by Claude from your inputs, approved by marketing`}
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
                New case study
              </button>
            </>
          }
        />
        <StatStrip>
          <Stat tone="slate" label="Drafts" value={counts.draft} />
          <Stat tone="amber" label="In review" value={counts.in_review} />
          <Stat tone="emerald" label="Approved" value={counts.approved} sub="Ready to send" />
        </StatStrip>
        <Toolbar>
          <ListSearch value={search} onChange={setSearch} placeholder="Search studies…" />
          <FilterDropdown
            icon={BookOpenCheck}
            allLabel="All statuses"
            value={status}
            onChange={setStatus}
            options={(['draft', 'in_review', 'approved'] as const).map((s) => ({ value: s, label: STATUS_LABELS[s] }))}
          />
        </Toolbar>
        <CardTable
          cols={COLS}
          minWidth={860}
          head={
            <>
              <span>Study</span>
              <span>Customer</span>
              <span>Units</span>
              <span>Status</span>
              <span className="justify-self-end">Updated</span>
            </>
          }
        >
          {filtered.length === 0 ? (
            <EmptyRow>
              {studies.length === 0
                ? 'No case studies yet. Start one fresh here, or from a customer page.'
                : 'Nothing matches that filter.'}
            </EmptyRow>
          ) : (
            filtered.slice(start, end).map((s) => {
              const units = s.case_study_units ?? []
              const models = [...new Set(units.map((u) => u.model_number).filter(Boolean))]
              return (
                <Row key={s.id} cols={COLS} href={`/admin/case-studies/${s.id}`}>
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink truncate">{s.title || 'Untitled case study'}</span>
                    <span className="block text-[11.5px] text-ink-muted truncate">
                      {s.customer_disclosure === 'anonymized' ? 'Anonymized' : 'Named'}
                      {s.industry ? ` · ${s.industry}` : ''}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 min-w-0">
                    {s.customers ? (
                      <>
                        <ToneAvatar name={s.customers.company_name} size={24} />
                        <span className="text-[12.5px] text-ink-secondary truncate">{s.customers.company_name}</span>
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-[12.5px] text-ink-faint">
                        <Building2 size={13} /> Not linked
                      </span>
                    )}
                  </span>
                  <span className="text-[12.5px] text-ink-secondary tabular-nums">
                    {units.length}
                    {models.length > 0 && (
                      <span className="text-ink-faint"> · {models.slice(0, 2).join(', ')}{models.length > 2 ? '…' : ''}</span>
                    )}
                  </span>
                  <span><StatusPill tone={STATUS_TONE[s.status]}>{STATUS_LABELS[s.status]}</StatusPill></span>
                  <span className="justify-self-end text-[12px] text-ink-muted tabular-nums">{fmtDate(s.updated_at)}</span>
                </Row>
              )
            })
          )}
        </CardTable>
        <Pagination
          page={page} perPage={perPage} total={filtered.length} totalPages={totalPages}
          onPage={setPage} onPerPage={setPerPage} unit="studies"
        />
      </ListCard>
    </ListCardPage>
  )
}
