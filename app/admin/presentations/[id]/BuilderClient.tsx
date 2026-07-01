'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import {
  ChevronRight, Play, Type as TypeIcon, Plus, X, Pencil, Presentation as PresentationIcon,
  Check, Loader2, GripVertical,
} from 'lucide-react'
import BlockThumb from '@/components/admin/presentations/BlockThumb'
import ContentPanel from '@/components/admin/presentations/ContentPanel'
import {
  type Presentation, type PresentationItem, type PresentationBlock,
  deckRuntimeSeconds, formatRuntime,
} from '@/lib/presentations'
import { setPresentationItems, setPresentationStatus, renamePresentation } from '@/app/admin/presentations/actions'

type DeckItem = { uid: string; block: PresentationBlock }
type TypeFilter = 'all' | 'clip' | 'slide'
type SaveState = 'idle' | 'saving' | 'saved'

const newUid = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `u${Date.now()}${Math.random()}`

export default function BuilderClient({
  presentation, initialItems, library,
}: {
  presentation: Presentation
  initialItems: PresentationItem[]
  library: PresentationBlock[]
}) {
  const router = useRouter()
  const [deck, setDeck] = useState<DeckItem[]>(
    // seed uids from the stable presentation_items row id so SSR and client match
    // (a random uid in the initializer would differ per render → hydration mismatch)
    initialItems.filter((i) => i.block).map((i) => ({ uid: i.id, block: i.block as PresentationBlock })),
  )
  const [title, setTitle] = useState(presentation.title)
  const [status, setStatus] = useState(presentation.status)
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all')
  const [search, setSearch] = useState('')
  const [panelOpen, setPanelOpen] = useState(false)
  const [editingBlock, setEditingBlock] = useState<PresentationBlock | null>(null)
  const [saveState, setSaveState] = useState<SaveState>('idle')

  const runtime = deckRuntimeSeconds(deck.map((d) => d.block))

  // ── Autosave (debounced) — persist the ordered block ids ─────────────────────
  const firstRun = useRef(true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return }
    setSaveState('saving')
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try {
        await setPresentationItems(presentation.id, deck.map((d) => d.block.id))
        setSaveState('saved')
      } catch { setSaveState('idle') }
    }, 700)
    return () => { if (timer.current) clearTimeout(timer.current) }
  }, [deck, presentation.id])

  const flushSave = useCallback(async () => {
    if (timer.current) clearTimeout(timer.current)
    await setPresentationItems(presentation.id, deck.map((d) => d.block.id))
  }, [deck, presentation.id])

  const filtered = library.filter((b) => {
    if (typeFilter !== 'all' && b.type !== typeFilter) return false
    if (search) {
      const hay = `${b.title} ${b.category || ''} ${b.tags.join(' ')}`.toLowerCase()
      if (!hay.includes(search.toLowerCase())) return false
    }
    return true
  })

  const addBlock = (block: PresentationBlock, at?: number) => {
    setDeck((d) => {
      const item = { uid: newUid(), block }
      if (at === undefined) return [...d, item]
      const next = [...d]; next.splice(at, 0, item); return next
    })
  }
  const removeAt = (uid: string) => setDeck((d) => d.filter((x) => x.uid !== uid))

  const onDragEnd = (r: DropResult) => {
    if (!r.destination) return
    const from = r.source, to = r.destination
    if (from.droppableId === 'timeline' && to.droppableId === 'timeline') {
      setDeck((d) => { const n = [...d]; const [m] = n.splice(from.index, 1); n.splice(to.index, 0, m); return n })
    } else if (from.droppableId === 'library' && to.droppableId === 'timeline') {
      const block = filtered[from.index]
      if (block) addBlock(block, to.index)
    }
  }

  const doPresent = async () => { await flushSave(); router.push(`/admin/presentations/${presentation.id}/present`) }
  const doSave = async () => { await flushSave(); await setPresentationStatus(presentation.id, 'saved'); setStatus('saved') }
  const commitTitle = async () => { const t = title.trim() || 'Untitled presentation'; setTitle(t); if (t !== presentation.title) await renamePresentation(presentation.id, t) }

  return (
    <div className="flex-1 overflow-y-auto bg-zinc-50 dark:bg-[#0a0a0b] text-zinc-700 dark:text-zinc-300 min-h-0">
      {/* ── Header ── */}
      <div className="sticky top-0 z-10 flex items-center gap-3 px-5 h-14 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-[#0a0a0b]/90 backdrop-blur">
        <Link href="/admin/presentations" className="text-[13px] text-zinc-400 dark:text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 flex-shrink-0">Presentations</Link>
        <ChevronRight size={13} className="text-zinc-300 dark:text-zinc-700 flex-shrink-0" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur() }}
          className="text-[13px] font-semibold text-zinc-900 dark:text-zinc-100 bg-transparent border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 focus:border-emerald-400 rounded-md px-1.5 py-0.5 focus:outline-none min-w-0 flex-1 max-w-[320px]"
        />
        <div className="flex-1" />
        <SaveIndicator state={saveState} />
        <button onClick={doSave} className="text-[13px] px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 hover:bg-white dark:hover:bg-zinc-800">
          {status === 'saved' ? 'Saved' : 'Save'}
        </button>
        <button onClick={doPresent} disabled={deck.length === 0} className="text-[13px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium inline-flex items-center gap-1.5 disabled:opacity-50">
          <Play size={14} /> Present
        </button>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="p-5 space-y-5">
          {/* ── Timeline ── */}
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-zinc-200/70 dark:border-zinc-800/80">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">Timeline</span>
              <span className="text-[12px] text-zinc-500 dark:text-zinc-400 tabular-nums">{deck.length} {deck.length === 1 ? 'block' : 'blocks'} · {formatRuntime(runtime)}</span>
            </div>
            <Droppable droppableId="timeline" direction="horizontal">
              {(provided, snapshot) => (
                <div
                  ref={provided.innerRef}
                  {...provided.droppableProps}
                  className={`flex gap-2.5 p-4 overflow-x-auto min-h-[132px] ${snapshot.isDraggingOver ? 'bg-emerald-50/40 dark:bg-emerald-500/[0.04]' : ''}`}
                >
                  {deck.length === 0 && !snapshot.isDraggingOver && (
                    <div className="flex-1 flex items-center justify-center text-[13px] text-zinc-400 dark:text-zinc-600 border border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg">
                      Drag clips and slides here, or click one below to add it
                    </div>
                  )}
                  {deck.map((item, i) => (
                    <Draggable key={item.uid} draggableId={item.uid} index={i}>
                      {(dp, ds) => (
                        <div
                          ref={dp.innerRef}
                          {...dp.draggableProps}
                          {...dp.dragHandleProps}
                          className={`group relative w-40 flex-shrink-0 rounded-lg border bg-white dark:bg-zinc-900 ${ds.isDragging ? 'border-emerald-400 shadow-lg' : 'border-zinc-200 dark:border-zinc-800'}`}
                        >
                          <span className="absolute top-1 left-1 z-10 w-5 h-5 rounded-full bg-emerald-600 text-white text-[10px] font-semibold flex items-center justify-center">{i + 1}</span>
                          <button onClick={() => removeAt(item.uid)} className="absolute top-1 right-1 z-10 w-5 h-5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center hover:bg-rose-500 transition-opacity"><X size={12} /></button>
                          <div className="p-1.5">
                            <BlockThumb block={item.block} size="thumb" />
                            <div className="mt-1.5 px-0.5 pb-0.5">
                              <div className="text-[11px] text-zinc-700 dark:text-zinc-200 truncate">{item.block.title}</div>
                              <div className="text-[10px] text-zinc-400 flex items-center gap-1">
                                {item.block.type === 'clip' ? <Play size={9} /> : <TypeIcon size={9} />}
                                {item.block.type === 'clip' ? 'Clip' : 'Slide'}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </section>

          {/* ── Library ── */}
          <section className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/40 shadow-sm dark:shadow-none">
            <div className="flex flex-wrap items-center gap-3 px-4 py-2.5 border-b border-zinc-200/70 dark:border-zinc-800/80">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-600">Library</span>
              <div className="inline-flex p-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800">
                {(['all', 'clip', 'slide'] as TypeFilter[]).map((f) => (
                  <button key={f} onClick={() => setTypeFilter(f)}
                    className={`text-[12px] px-2.5 py-1 rounded-full capitalize ${typeFilter === f ? 'bg-white dark:bg-zinc-700 text-zinc-900 dark:text-white shadow-sm font-medium' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {f === 'all' ? 'All' : f === 'clip' ? 'Clips' : 'Slides'}
                  </button>
                ))}
              </div>
              <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search"
                className="h-8 w-40 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[12px] focus:outline-none focus:ring-2 focus:ring-emerald-500/40" />
              <div className="flex-1" />
              <button onClick={() => { setEditingBlock(null); setPanelOpen(true) }}
                className="text-[12px] px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium inline-flex items-center gap-1.5">
                <Plus size={14} /> Add content
              </button>
            </div>

            <Droppable droppableId="library" isDropDisabled renderClone={(dp, ds, rubric) => {
              const b = filtered[rubric.source.index]
              return (
                <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps} className="w-40 rounded-lg border border-emerald-400 bg-white dark:bg-zinc-900 shadow-lg p-1.5">
                  <BlockThumb block={b} size="thumb" />
                  <div className="mt-1.5 text-[11px] truncate text-zinc-700 dark:text-zinc-200">{b.title}</div>
                </div>
              )
            }}>
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 p-4">
                  {filtered.length === 0 && (
                    <div className="col-span-full py-10 text-center text-[13px] text-zinc-400 dark:text-zinc-600">
                      Nothing here yet. Click <span className="font-medium">Add content</span> to build your library.
                    </div>
                  )}
                  {filtered.map((b, i) => (
                    <Draggable key={b.id} draggableId={`lib-${b.id}`} index={i}>
                      {(dp) => (
                        <div ref={dp.innerRef} {...dp.draggableProps} {...dp.dragHandleProps}
                          className="group relative rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900/60 overflow-hidden hover:border-emerald-300 dark:hover:border-emerald-500/40 transition-colors">
                          <button onClick={() => addBlock(b)} className="block w-full text-left" title="Add to timeline">
                            <BlockThumb block={b} size="thumb" rounded="rounded-none" />
                          </button>
                          <div className="px-2 py-1.5">
                            <div className="text-[12px] text-zinc-700 dark:text-zinc-200 truncate">{b.title}</div>
                            <div className="text-[11px] text-zinc-400 flex items-center gap-1">
                              {b.type === 'clip' ? <Play size={10} /> : <TypeIcon size={10} />}
                              {b.category || (b.type === 'clip' ? 'Clip' : 'Slide')}
                            </div>
                          </div>
                          <div className="absolute top-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => { setEditingBlock(b); setPanelOpen(true) }} className="w-6 h-6 rounded-md bg-white/90 dark:bg-zinc-800/90 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-100" title="Edit"><Pencil size={12} /></button>
                            <button onClick={() => addBlock(b)} className="w-6 h-6 rounded-md bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-500" title="Add"><Plus size={13} /></button>
                          </div>
                          <span className="absolute top-1 left-1 flex items-center gap-1 text-zinc-300 dark:text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity"><GripVertical size={13} /></span>
                        </div>
                      )}
                    </Draggable>
                  ))}
                  {provided.placeholder}
                </div>
              )}
            </Droppable>
          </section>

          <div className="flex items-center gap-2 text-[12px] text-zinc-400 dark:text-zinc-600 px-1">
            <PresentationIcon size={13} />
            Clips play from Loom; slides render live. Changes autosave.
          </div>
        </div>
      </DragDropContext>

      <ContentPanel
        open={panelOpen}
        editing={editingBlock}
        onClose={() => setPanelOpen(false)}
        onSaved={() => router.refresh()}
      />
    </div>
  )
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === 'saving') return <span className="text-[12px] text-zinc-400 inline-flex items-center gap-1"><Loader2 size={12} className="animate-spin" /> Saving…</span>
  if (state === 'saved') return <span className="text-[12px] text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1"><Check size={12} /> Saved</span>
  return <span className="text-[12px] text-transparent select-none">·</span>
}
