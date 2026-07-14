'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Play, Pencil, MoreHorizontal, Copy, Archive, ArrowUpFromLine, Presentation as PresentationIcon, Loader2,
} from 'lucide-react'
import {
  HEADER_BOX, BODY_BOX, rowCx, StatusPill, timeAgo, Th, TableScroll,
  ListPageHeader, IdentityCell, tabCx, tabCountCx,
} from '@/components/admin/list'
import {
  type DeckSummary, type PresentationStatus, STATUS_META, formatRuntime,
} from '@/lib/presentations'
import { createPresentation, duplicatePresentation, setPresentationStatus } from './actions'

type Tab = 'all' | PresentationStatus

// Mobile keeps deck-identity + status; the Present button and kebab return at
// sm+ (the deck title already links into the editor).
const COLS = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[1fr_100px_128px_40px]'

export default function BuildsListClient({ decks }: { decks: DeckSummary[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('all')
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const counts = {
    all: decks.length,
    in_progress: decks.filter((d) => d.status === 'in_progress').length,
    saved: decks.filter((d) => d.status === 'saved').length,
    archived: decks.filter((d) => d.status === 'archived').length,
  }
  const shown = decks.filter((d) => tab === 'all' || d.status === tab)

  const newDeck = async () => {
    setCreating(true)
    try { const { id } = await createPresentation(); router.push(`/admin/presentations/${id}`) }
    finally { setCreating(false) }
  }
  const duplicate = async (id: string) => { setMenuFor(null); const { id: nid } = await duplicatePresentation(id); router.push(`/admin/presentations/${nid}`) }
  const archive = async (id: string, to: PresentationStatus) => { setMenuFor(null); await setPresentationStatus(id, to); router.refresh() }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'all', label: 'All' }, { key: 'in_progress', label: 'In progress' },
    { key: 'saved', label: 'Saved' }, { key: 'archived', label: 'Archived' },
  ]

  return (
    <div className="flex-1 overflow-auto bg-zinc-50 dark:bg-[#0a0a0b]">
      {/* Page header */}
      <ListPageHeader
        overline="Content"
        title="Presentations"
        count={`${decks.length} ${decks.length === 1 ? 'deck' : 'decks'}`}
        actions={
          <button
            onClick={newDeck}
            disabled={creating}
            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-[13px] font-semibold px-4 py-2.5 rounded-xl transition-all shadow-sm disabled:opacity-60"
          >
            {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            New presentation
          </button>
        }
      >
        {/* Status tabs */}
        <div className="flex items-center gap-1 overflow-x-auto scrollbar-hide">
          {TABS.map((t) => {
            const active = tab === t.key
            return (
              <button key={t.key} onClick={() => setTab(t.key)} className={tabCx(active)}>
                {t.label}
                <span className={tabCountCx(active)}>{counts[t.key]}</span>
              </button>
            )
          })}
        </div>
      </ListPageHeader>

      <div className="p-4 sm:p-8">
        {/* Floating header — hidden on mobile, where the rows read as a plain feed */}
        <TableScroll minWidth={620}>
        <div className={`hidden sm:grid ${COLS} ${HEADER_BOX}`}>
          <Th>Deck</Th>
          <Th>Status</Th>
          <Th />
          <Th />
        </div>

        {/* Body */}
        <div className={BODY_BOX}>
          {shown.length === 0 ? (
            <div className="py-16 text-center">
              <PresentationIcon size={28} className="text-zinc-200 dark:text-zinc-700 mx-auto mb-3" />
              <p className="text-[13px] text-zinc-400 dark:text-zinc-500">
                No presentations{tab !== 'all' ? ` that are ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}` : ' yet'}.
              </p>
            </div>
          ) : (
            shown.map((d, i) => {
              const meta = STATUS_META[d.status]
              const isArchived = d.status === 'archived'
              return (
                <div key={d.id} className={`${rowCx(COLS, { i })} group ${isArchived ? 'opacity-60' : ''}`}>
                  {/* Identity — deck title over block/runtime summary */}
                  <Link href={`/admin/presentations/${d.id}`} className="min-w-0">
                    <IdentityCell
                      icon={<PresentationIcon size={13} />}
                      title={d.title}
                      subtitle={`${d.block_count} ${d.block_count === 1 ? 'block' : 'blocks'} · ${formatRuntime(d.runtime_seconds)} · edited ${timeAgo(d.updated_at)}`}
                    />
                  </Link>
                  {/* Status */}
                  <div>
                    <StatusPill tone={meta.tone}>{meta.label}</StatusPill>
                  </div>
                  {/* Present / Resume / Restore */}
                  <div className="hidden sm:block">
                    {isArchived ? (
                      <button onClick={() => archive(d.id, 'saved')} className="text-[12px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        <ArrowUpFromLine size={13} /> Restore
                      </button>
                    ) : (
                      <Link href={`/admin/presentations/${d.id}${d.status === 'in_progress' ? '' : '/present'}`}
                        className="text-[12px] inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800">
                        {d.status === 'in_progress' ? <><Pencil size={13} /> Resume</> : <><Play size={13} /> Present</>}
                      </Link>
                    )}
                  </div>
                  {/* Kebab */}
                  <div className="hidden sm:flex justify-center relative">
                    <button onClick={() => setMenuFor(menuFor === d.id ? null : d.id)} className="p-1.5 rounded-md text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"><MoreHorizontal size={16} /></button>
                    {menuFor === d.id && (
                      <>
                        <button className="fixed inset-0 z-10 cursor-default" onClick={() => setMenuFor(null)} aria-label="Close menu" />
                        <div className="absolute right-0 top-full mt-1 z-20 w-40 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg py-1 text-[13px]">
                          <Link href={`/admin/presentations/${d.id}`} className="flex items-center gap-2 px-3 py-1.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"><Pencil size={13} /> Edit</Link>
                          <button onClick={() => duplicate(d.id)} className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"><Copy size={13} /> Duplicate</button>
                          {isArchived ? (
                            <button onClick={() => archive(d.id, 'saved')} className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:hover:bg-zinc-800"><ArrowUpFromLine size={13} /> Restore</button>
                          ) : (
                            <button onClick={() => archive(d.id, 'archived')} className="w-full flex items-center gap-2 px-3 py-1.5 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800"><Archive size={13} /> Archive</button>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </div>
        </TableScroll>
      </div>
    </div>
  )
}
