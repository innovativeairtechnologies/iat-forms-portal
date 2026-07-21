'use client'

import { useMemo, useState } from 'react'
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd'
import { Search, Star, X } from 'lucide-react'
import type { Deal } from '@/lib/supabase'
import { computeWeighted, STAGES, CLOSED_REASONS, type DealStage } from '@/lib/deals'
import { filterPillCx } from '@/components/admin/list'
import { inp } from './form'

/* ────────────────────────────────────────────────────────────────────────────
   Board — the kanban lens on the pipeline (migration 061 stages). Drag a card
   between columns to move the deal; the parent's setStage runs the same
   optimistic machinery as every inline edit, so a failed drag snaps the card
   back. Dropping onto Won/Lost holds the move behind a closed-reason prompt —
   the stage doesn't change until the reason is confirmed (or skipped).

   Columns render the biggest deals first and cap the visible stack — with
   400+ open deals a full render would drown the DOM; "Show all" expands a
   column on demand. Search + group pills mirror the Table view's toolbar.
   ──────────────────────────────────────────────────────────────────────────── */

const SHOW_CAP = 40

const fmtShort = (n: number) =>
  n >= 1_000_000 ? `$${(n / 1_000_000).toFixed(1)}M` : n >= 1_000 ? `$${Math.round(n / 1_000)}K` : `$${Math.round(n)}`

type Row = Deal & { weighted: number }

export default function BoardView({
  deals,
  onStage,
  onView,
  onToggleFocus,
}: {
  deals: Deal[]
  onStage: (id: string, stage: DealStage, closedReason?: string) => void
  onView: (id: string, orderedIds: string[]) => void
  onToggleFocus: (id: string, next: boolean) => void
}) {
  const [search, setSearch] = useState('')
  const [repFilter, setRepFilter] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Partial<Record<DealStage, boolean>>>({})
  const [lostOpen, setLostOpen] = useState(false)
  // A drop onto won/lost parks here until the reason prompt resolves.
  const [pendingClose, setPendingClose] = useState<{ id: string; to: 'won' | 'lost' } | null>(null)

  const rows: Row[] = useMemo(() => deals.map((d) => ({ ...d, weighted: computeWeighted(d) })), [deals])
  const repOptions = useMemo(() => [...new Set(rows.map((r) => r.group_name))].sort(), [rows])

  const q = search.trim().toLowerCase()
  const filtered = useMemo(() => {
    let out = rows
    if (repFilter) out = out.filter((d) => d.group_name === repFilter)
    if (q) {
      out = out.filter((d) =>
        d.customer.toLowerCase().includes(q) ||
        (d.job_name || '').toLowerCase().includes(q) ||
        (d.assigned_to || '').toLowerCase().includes(q) ||
        (d.rep || '').toLowerCase().includes(q),
      )
    }
    return out
  }, [rows, repFilter, q])

  // Per-stage stacks, biggest weighted value first.
  const columns = useMemo(() => {
    const map = new Map<DealStage, Row[]>(STAGES.map((s) => [s.key, []]))
    for (const d of filtered) (map.get(d.stage) ?? map.get('lead'))!.push(d)
    for (const list of map.values()) list.sort((a, b) => b.weighted - a.weighted)
    return map
  }, [filtered])

  // On-screen order (column by column, capped) — the detail modal's prev/next.
  const visibleIds = useMemo(
    () =>
      STAGES.flatMap(({ key }) => {
        const list = columns.get(key) ?? []
        return (expanded[key] ? list : list.slice(0, SHOW_CAP)).map((d) => d.id)
      }),
    [columns, expanded],
  )

  const pendingDeal = pendingClose ? deals.find((d) => d.id === pendingClose.id) ?? null : null

  const onDragEnd = (result: DropResult) => {
    const { draggableId, destination, source } = result
    if (!destination || destination.droppableId === source.droppableId) return
    const to = destination.droppableId as DealStage
    if (to === 'won' || to === 'lost') {
      setPendingClose({ id: draggableId, to }) // card snaps back until confirmed
      return
    }
    onStage(draggableId, to)
  }

  return (
    <div>
      {/* Toolbar — mirrors the Table view */}
      <div className="flex items-center gap-2.5 mb-4 flex-wrap">
        <div className="relative">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400 dark:text-zinc-500 pointer-events-none" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search deals…"
            className={`${inp} pl-8 w-[200px]`}
          />
        </div>
        <div className="flex items-center gap-1 flex-wrap">
          <button onClick={() => setRepFilter(null)} className={filterPillCx(repFilter === null)}>All</button>
          {repOptions.map((g) => (
            <button key={g} onClick={() => setRepFilter(repFilter === g ? null : g)} className={filterPillCx(repFilter === g)}>
              {g}
            </button>
          ))}
        </div>
      </div>

      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-3 items-start overflow-x-auto pb-4">
          {STAGES.map((stage) => {
            const list = columns.get(stage.key) ?? []
            const weighted = list.reduce((a, d) => a + d.weighted, 0)
            const isLostRail = stage.key === 'lost' && !lostOpen

            if (isLostRail) {
              return (
                <Droppable key={stage.key} droppableId={stage.key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`flex-shrink-0 w-[52px] self-stretch min-h-[320px] rounded-xl border transition-colors duration-150 flex flex-col items-center pt-3 ${
                        snapshot.isDraggingOver
                          ? 'border-rose-300 dark:border-rose-500/40 bg-rose-50/60 dark:bg-rose-500/10'
                          : 'border-hairline bg-surface-soft hover:bg-surface-strong/60'
                      }`}
                    >
                      <button
                        onClick={() => setLostOpen(true)}
                        title="Show lost deals"
                        className="flex flex-col items-center gap-2 text-ink-faint hover:text-ink-secondary transition-colors"
                      >
                        <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ writingMode: 'vertical-rl' }}>
                          Lost · {list.length}
                        </span>
                      </button>
                      <div className="sr-only">{provided.placeholder}</div>
                    </div>
                  )}
                </Droppable>
              )
            }

            const capped = expanded[stage.key] ? list : list.slice(0, SHOW_CAP)
            return (
              <div key={stage.key} className="flex-shrink-0 w-[264px] flex flex-col">
                {/* Column head */}
                <div className="flex items-baseline justify-between px-1.5 pb-2">
                  <div className="flex items-baseline gap-1.5 min-w-0">
                    <span className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{stage.label}</span>
                    <span className="text-[11px] text-ink-faint tabular-nums">{list.length}</span>
                    {stage.key === 'lost' && (
                      <button onClick={() => setLostOpen(false)} title="Collapse" className="text-ink-faint hover:text-ink-secondary transition-colors">
                        <X size={11} />
                      </button>
                    )}
                  </div>
                  <span className="text-[11px] text-ink-faint tabular-nums">{weighted > 0 ? fmtShort(weighted) : ''}</span>
                </div>

                <Droppable droppableId={stage.key}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`rounded-xl border p-1.5 space-y-1.5 min-h-[320px] max-h-[calc(100vh-320px)] overflow-y-auto transition-colors duration-150 ${
                        snapshot.isDraggingOver
                          ? 'border-hairline-strong bg-surface-strong/60'
                          : 'border-hairline bg-surface-soft'
                      }`}
                    >
                      {capped.map((d, i) => (
                        <Draggable key={d.id} draggableId={d.id} index={i}>
                          {(drag, dragState) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                              onClick={() => onView(d.id, visibleIds)}
                              className={`group rounded-lg border bg-surface px-3 py-2.5 cursor-grab active:cursor-grabbing transition-shadow duration-150 ${
                                dragState.isDragging
                                  ? 'border-hairline-strong shadow-lg rotate-[0.4deg]'
                                  : 'border-hairline hover:border-hairline-strong'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-2">
                                <p className="text-[12.5px] font-semibold text-ink leading-snug break-words min-w-0">{d.customer}</p>
                                <button
                                  onClick={(e) => { e.stopPropagation(); onToggleFocus(d.id, !(d.focused === true)) }}
                                  title={d.focused ? 'Remove from Focused' : 'Add to Focused'}
                                  className="flex-shrink-0 mt-0.5"
                                >
                                  <Star
                                    size={12}
                                    className={d.focused
                                      ? 'fill-amber-400 text-amber-400'
                                      : 'text-transparent group-hover:text-ink-faint hover:!text-amber-400 transition-colors'}
                                  />
                                </button>
                              </div>
                              {(d.job_name || d.unit_model) && (
                                <p className="mt-0.5 text-[11px] text-ink-muted leading-snug truncate">{d.job_name || d.unit_model}</p>
                              )}
                              <div className="mt-1.5 flex items-center justify-between gap-2">
                                <span className="text-[12px] font-medium text-ink tabular-nums">{fmtShort(d.total_cost)}</span>
                                <span className="flex items-center gap-1.5">
                                  <span className="text-[10.5px] text-ink-faint tabular-nums">{d.confidence}%</span>
                                  <span className="text-[9.5px] font-semibold uppercase tracking-wider px-1.5 py-[2px] rounded bg-surface-strong text-ink-muted">
                                    {d.group_name}
                                  </span>
                                </span>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                      {list.length === 0 && !snapshot.isDraggingOver && (
                        <p className="px-2 py-6 text-center text-[11px] text-ink-faint">Drop deals here</p>
                      )}
                      {list.length > SHOW_CAP && !expanded[stage.key] && (
                        <button
                          onClick={() => setExpanded((e) => ({ ...e, [stage.key]: true }))}
                          className="w-full py-2 text-[11px] font-medium text-ink-muted hover:text-ink-secondary transition-colors"
                        >
                          Show all {list.length} — {list.length - SHOW_CAP} hidden
                        </button>
                      )}
                    </div>
                  )}
                </Droppable>
              </div>
            )
          })}
        </div>
      </DragDropContext>

      {/* Closed-reason prompt — the drag isn't committed until this resolves. */}
      {pendingClose && pendingDeal && (
        <CloseReasonDialog
          deal={pendingDeal}
          to={pendingClose.to}
          onCancel={() => setPendingClose(null)}
          onConfirm={(reason) => {
            onStage(pendingClose.id, pendingClose.to, reason || undefined)
            setPendingClose(null)
          }}
        />
      )}
    </div>
  )
}

function CloseReasonDialog({
  deal, to, onCancel, onConfirm,
}: {
  deal: Deal
  to: 'won' | 'lost'
  onCancel: () => void
  onConfirm: (reason: string) => void
}) {
  const [picked, setPicked] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const won = to === 'won'
  const reason = note.trim() ? (picked && picked !== 'Other' ? `${picked} — ${note.trim()}` : note.trim()) : (picked ?? '')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4" onMouseDown={onCancel}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl border border-hairline bg-surface p-5 animate-fade-up"
        style={{ boxShadow: '0 8px 24px rgba(31,30,27,.10), 0 2px 6px rgba(31,30,27,.05)' }}
      >
        <h3 className="text-[15px] font-semibold text-ink">
          Mark <span className={won ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}>{won ? 'Won' : 'Lost'}</span> — {deal.customer}
        </h3>
        <p className="mt-1 text-[12px] text-ink-muted">
          {won ? 'Nice. What sealed it? (optional)' : 'What happened? A reason makes the loss reporting honest.'}
        </p>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {CLOSED_REASONS.map((r) => (
            <button
              key={r}
              onClick={() => setPicked(picked === r ? null : r)}
              className={`h-7 px-2.5 rounded-lg text-[11.5px] font-medium border transition-colors ${
                picked === r
                  ? 'border-brand bg-brand-soft text-ink'
                  : 'border-hairline text-ink-secondary hover:bg-surface-soft'
              }`}
            >
              {r}
            </button>
          ))}
        </div>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onConfirm(reason) } }}
          placeholder="Add detail… (optional)"
          className={`${inp} mt-3`}
        />

        <div className="mt-4 flex justify-end gap-2">
          <button onClick={onCancel} className="h-9 px-3.5 rounded-lg text-[13px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(reason)}
            className={`h-9 px-3.5 rounded-lg text-[13px] font-medium text-white transition-colors ${won ? '' : 'bg-rose-600 hover:bg-rose-500'}`}
            style={won ? { backgroundColor: 'var(--brand)' } : undefined}
          >
            {won ? (reason ? 'Mark Won' : 'Mark Won (no reason)') : 'Mark Lost'}
          </button>
        </div>
      </div>
    </div>
  )
}
