'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Plus, Play, Pencil, MoreHorizontal, Copy, Archive, ArrowUpFromLine, Presentation as PresentationIcon, Loader2,
} from 'lucide-react'
import { StatusPill, timeAgo } from '@/components/admin/list'
import {
  type DeckSummary, type PresentationStatus, STATUS_META, formatRuntime,
} from '@/lib/presentations'
import { createPresentation, duplicatePresentation, setPresentationStatus } from './actions'

type Tab = 'all' | PresentationStatus

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
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300 min-h-0">
      {/* header */}
      <div className="flex items-center justify-between gap-3 px-6 pt-6 pb-3">
        <div>
          <h1 className="text-[18px] font-semibold text-zinc-900 dark:text-zinc-100">Presentations</h1>
          <p className="text-[13px] text-zinc-400 dark:text-zinc-500">Build, save, and present training and client decks.</p>
        </div>
        <button onClick={newDeck} disabled={creating}
          className="text-[13px] px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
          {creating ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />} New presentation
        </button>
      </div>

      {/* tabs */}
      <div className="px-6 flex items-center gap-5 border-b border-zinc-200 dark:border-zinc-800">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-[13px] py-2.5 border-b-2 -mb-px transition-colors ${tab === t.key ? 'border-emerald-500 text-zinc-900 dark:text-zinc-100' : 'border-transparent text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'}`}>
            {t.label} <span className="text-zinc-400 dark:text-zinc-600">{counts[t.key]}</span>
          </button>
        ))}
      </div>

      {/* rows */}
      <div className="px-6 py-4">
        {shown.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-200 dark:border-zinc-800 py-16 text-center">
            <PresentationIcon size={22} className="mx-auto text-zinc-300 dark:text-zinc-600" />
            <p className="mt-3 text-[14px] text-zinc-600 dark:text-zinc-300">No presentations{tab !== 'all' ? ` that are ${TABS.find((t) => t.key === tab)?.label.toLowerCase()}` : ' yet'}.</p>
            <button onClick={newDeck} className="mt-3 text-[13px] px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium inline-flex items-center gap-1.5"><Plus size={14} /> New presentation</button>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 divide-y divide-zinc-100 dark:divide-zinc-800/60">
            {shown.map((d) => {
              const meta = STATUS_META[d.status]
              const isArchived = d.status === 'archived'
              return (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <div className={`w-14 h-9 rounded-md border border-zinc-200 dark:border-zinc-800 flex items-center justify-center flex-shrink-0 ${isArchived ? 'opacity-60' : ''}`}>
                    <PresentationIcon size={16} className="text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <Link href={`/admin/presentations/${d.id}`} className="flex-1 min-w-0 group">
                    <div className={`text-[14px] truncate group-hover:text-emerald-600 dark:group-hover:text-emerald-400 ${isArchived ? 'text-zinc-500 dark:text-zinc-400' : 'text-zinc-900 dark:text-zinc-100'}`}>{d.title}</div>
                    <div className="text-[12px] text-zinc-400 dark:text-zinc-500 tabular-nums">
                      {d.block_count} {d.block_count === 1 ? 'block' : 'blocks'} · {formatRuntime(d.runtime_seconds)} · edited {timeAgo(d.updated_at)}
                    </div>
                  </Link>
                  <StatusPill tone={meta.tone}>{meta.label}</StatusPill>

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

                  <div className="relative">
                    <button onClick={() => setMenuFor(menuFor === d.id ? null : d.id)} className="p-1.5 rounded-lg text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800"><MoreHorizontal size={16} /></button>
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
            })}
          </div>
        )}
      </div>
    </div>
  )
}
