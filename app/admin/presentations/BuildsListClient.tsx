'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Play, Pencil, MoreHorizontal, Copy, Archive, ArrowUpFromLine,
  Presentation as PresentationIcon, Loader2, Layers,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { StatusPill, timeAgo } from '@/components/admin/list'
import {
  ListCardPage, ListCard, CardHead, StatStrip, Stat, Toolbar,
  CardTable, Row, EmptyRow, Pagination, usePagedList, ListSearch, FilterDropdown,
} from '@/components/admin/list-card'
import {
  type DeckSummary, type PresentationStatus, STATUS_META, formatRuntime,
} from '@/lib/presentations'
import { createPresentation, duplicatePresentation, setPresentationStatus } from './actions'

type Tab = 'all' | PresentationStatus

// Deck · Status on mobile (rows read as a plain feed); the Present button and
// kebab return at sm+, where the min-width kicks in and the table can scroll.
const COLS = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[minmax(0,1fr)_116px_128px_44px]'

// Status filter options — same labels as the old tabs, minus the synthetic "All".
const STATUS_OPTIONS = (Object.keys(STATUS_META) as PresentationStatus[])
  .map((k) => ({ value: k, label: STATUS_META[k].label }))

// The one open row menu — portaled to <body> with fixed coords so the table's
// overflow-y-hidden (baked into CardTable) can't clip it near the last rows.
type MenuState = { deck: DeckSummary; top: number; left: number }

export default function BuildsListClient({ decks }: { decks: DeckSummary[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('all')
  const [query, setQuery] = useState('')
  const [menu, setMenu] = useState<MenuState | null>(null)
  const [creating, setCreating] = useState(false)

  const counts = {
    all: decks.length,
    in_progress: decks.filter((d) => d.status === 'in_progress').length,
    saved: decks.filter((d) => d.status === 'saved').length,
    archived: decks.filter((d) => d.status === 'archived').length,
  }

  // tab + title search → the working view (server order — updated_at desc — kept).
  const q = query.trim().toLowerCase()
  const view = useMemo(
    () => decks.filter((d) => (tab === 'all' || d.status === tab) && (!q || d.title.toLowerCase().includes(q))),
    [decks, tab, q],
  )

  const paged = usePagedList(view.length, { initialPerPage: 10, resetKey: `${tab}|${q}` })
  const pageRows = view.slice(paged.start, paged.end)

  // Close the portaled row menu on scroll / resize / Escape (the backdrop below
  // handles outside clicks).
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') close() }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [menu])

  const newDeck = async () => {
    setCreating(true)
    try { const { id } = await createPresentation(); router.push(`/admin/presentations/${id}`) }
    finally { setCreating(false) }
  }
  const duplicate = async (id: string) => { setMenu(null); const { id: nid } = await duplicatePresentation(id); router.push(`/admin/presentations/${nid}`) }
  const archive = async (id: string, to: PresentationStatus) => { setMenu(null); await setPresentationStatus(id, to); router.refresh() }

  return (
    <ListCardPage>
      <ListCard>
        <CardHead
          overline="Content"
          title="Presentations"
          count={`${decks.length} ${decks.length === 1 ? 'deck' : 'decks'}`}
          actions={
            <button
              onClick={newDeck}
              disabled={creating}
              className="inline-flex items-center gap-2 h-9 px-4 rounded-lg bg-brand hover:bg-brand-hover text-white text-[13px] font-medium disabled:opacity-60 transition-colors"
            >
              {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
              New presentation
            </button>
          }
        />

        {/* Status breakdown (what the old tab counts showed, at a glance) */}
        <StatStrip>
          <Stat tone="sky"     label="Total decks" value={counts.all} />
          <Stat tone="amber"   label="In progress" value={counts.in_progress} />
          <Stat tone="emerald" label="Saved"       value={counts.saved} />
          <Stat tone="slate"   label="Archived"    value={counts.archived} />
        </StatStrip>

        {/* Filters */}
        <Toolbar>
          <ListSearch value={query} onChange={setQuery} placeholder="Search presentations…" />
          <FilterDropdown
            icon={Layers}
            allLabel="All statuses"
            value={tab === 'all' ? '__all' : tab}
            options={STATUS_OPTIONS}
            onChange={(v) => setTab(v === '__all' ? 'all' : (v as PresentationStatus))}
          />
          <div className="flex-1" />
          {(q || tab !== 'all') && (
            <span className="text-[12px] text-ink-muted tabular-nums">{view.length} match{view.length === 1 ? '' : 'es'}</span>
          )}
        </Toolbar>

        {/* Table */}
        <CardTable
          cols={COLS}
          minWidth={640}
          head={
            <>
              <span>Deck</span>
              <span>Status</span>
              <span className="hidden sm:block" />
              <span className="hidden sm:block" />
            </>
          }
        >
          {pageRows.length === 0 ? (
            <EmptyRow>
              <PresentationIcon size={26} className="mx-auto mb-3 text-ink-faint" />
              No presentations{tab !== 'all' ? ` that are ${STATUS_META[tab].label.toLowerCase()}` : q ? ' match your search' : ' yet'}.
            </EmptyRow>
          ) : (
            pageRows.map((d) => {
              const meta = STATUS_META[d.status]
              const isArchived = d.status === 'archived'
              const dim = isArchived ? 'opacity-60' : ''
              return (
                <Row key={d.id} cols={COLS}>
                  {/* Identity — the deck title links into the editor */}
                  <Link href={`/admin/presentations/${d.id}`} className={cn('flex items-center gap-2.5 min-w-0', dim)}>
                    <span className="w-7 h-7 rounded-lg bg-surface-strong flex items-center justify-center flex-shrink-0 text-ink-muted">
                      <PresentationIcon size={13} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium text-ink truncate group-hover:text-brand-ink transition-colors">{d.title}</span>
                      <span className="block text-[11.5px] text-ink-muted truncate">
                        {d.block_count} {d.block_count === 1 ? 'block' : 'blocks'} · {formatRuntime(d.runtime_seconds)} · edited {timeAgo(d.updated_at)}
                      </span>
                    </span>
                  </Link>

                  {/* Status */}
                  <div className={dim}>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </div>

                  {/* Present / Resume / Restore */}
                  <div className={cn('hidden sm:block', dim)}>
                    {isArchived ? (
                      <button
                        onClick={() => archive(d.id, 'saved')}
                        className="text-[12px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-hairline text-ink-secondary hover:bg-surface-soft transition-colors"
                      >
                        <ArrowUpFromLine size={13} /> Restore
                      </button>
                    ) : (
                      <Link
                        href={`/admin/presentations/${d.id}${d.status === 'in_progress' ? '' : '/present'}`}
                        className="text-[12px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-hairline text-ink-secondary hover:bg-surface-soft transition-colors"
                      >
                        {d.status === 'in_progress' ? <><Pencil size={13} /> Resume</> : <><Play size={13} /> Present</>}
                      </Link>
                    )}
                  </div>

                  {/* Kebab (opens the portaled menu below) */}
                  <div className={cn('hidden sm:flex justify-center', dim)}>
                    <button
                      onClick={(e) => {
                        const r = e.currentTarget.getBoundingClientRect()
                        setMenu((m) => (m?.deck.id === d.id ? null : { deck: d, top: r.bottom + 4, left: r.right }))
                      }}
                      className={cn(
                        'p-1.5 rounded-md text-ink-muted hover:text-ink-secondary hover:bg-surface-soft transition-colors',
                        menu?.deck.id === d.id && 'bg-surface-soft text-ink-secondary',
                      )}
                      aria-label="Deck actions"
                    >
                      <MoreHorizontal size={16} />
                    </button>
                  </div>
                </Row>
              )
            })
          )}
        </CardTable>

        <Pagination
          page={paged.page}
          perPage={paged.perPage}
          total={view.length}
          totalPages={paged.totalPages}
          onPage={paged.setPage}
          onPerPage={paged.setPerPage}
          unit="decks"
        />
      </ListCard>

      {/* Row-action menu — portaled + fixed so the table's overflow-y-hidden can't clip it. */}
      {menu && createPortal(
        <>
          <button className="fixed inset-0 z-40 cursor-default" onClick={() => setMenu(null)} aria-label="Close menu" />
          <div
            style={{ position: 'fixed', top: menu.top, left: menu.left, transform: 'translateX(-100%)' }}
            className="z-50 w-40 rounded-lg border border-hairline bg-surface shadow-xl dark:shadow-none dark:ring-1 dark:ring-white/10 py-1 text-[13px]"
          >
            <Link
              href={`/admin/presentations/${menu.deck.id}`}
              onClick={() => setMenu(null)}
              className="flex items-center gap-2 px-3 py-1.5 text-ink-secondary hover:bg-surface-soft"
            >
              <Pencil size={13} /> Edit
            </Link>
            <button onClick={() => duplicate(menu.deck.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-ink-secondary hover:bg-surface-soft">
              <Copy size={13} /> Duplicate
            </button>
            {menu.deck.status === 'archived' ? (
              <button onClick={() => archive(menu.deck.id, 'saved')} className="w-full flex items-center gap-2 px-3 py-1.5 text-ink-secondary hover:bg-surface-soft">
                <ArrowUpFromLine size={13} /> Restore
              </button>
            ) : (
              <button onClick={() => archive(menu.deck.id, 'archived')} className="w-full flex items-center gap-2 px-3 py-1.5 text-ink-secondary hover:bg-surface-soft">
                <Archive size={13} /> Archive
              </button>
            )}
          </div>
        </>,
        document.body,
      )}
    </ListCardPage>
  )
}
