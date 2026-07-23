'use client'

import { useState } from 'react'
import {
  DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext, rectSortingStrategy, useSortable, arrayMove, sortableKeyboardCoordinates,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, X, Plus, Check, RotateCcw, Pencil, LayoutGrid } from 'lucide-react'
import type { Span, LayoutItem, RenderedCard } from '@/components/dashboards/dept-cards'
import { saveDashboardLayout, resetDashboardLayout } from '@/app/admin/dashboard-layout-actions'

/* Client grid + editor for the per-user "build your own" department dashboard.
   Receives every card the role can access already server-rendered (node), plus
   the resolved layout (saved-or-default) and the code default. View mode just
   places the cards by span; Edit mode adds drag-reorder (dnd-kit), a size toggle
   (S/M/L → 1/2/3 columns, auto-reflowing), remove, an add-card picker, and
   Save / Reset / Cancel. Data never re-fetches on edit — only the arrangement
   changes — so there's no round-trip until Save. */

const SPAN_CLASS: Record<Span, string> = { 1: 'lg:col-span-1', 2: 'lg:col-span-2', 3: 'lg:col-span-3' }
const SIZE_LABEL: Record<Span, string> = { 1: 'S', 2: 'M', 3: 'L' }

export default function DashboardGrid({ cards, initialLayout, defaultLayout }: {
  cards: RenderedCard[]; initialLayout: LayoutItem[]; defaultLayout: LayoutItem[]
}) {
  const byId = new Map(cards.map((c) => [c.id, c]))
  const [layout, setLayout] = useState<LayoutItem[]>(initialLayout)
  const [baseline, setBaseline] = useState<LayoutItem[]>(initialLayout)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // Only cards that still exist AND the role can see (byId already = accessible set).
  const visible = layout.filter((it) => byId.has(it.id))
  const availableToAdd = cards.filter((c) => !visible.some((it) => it.id === c.id))

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e
    if (!over || active.id === over.id) return
    setLayout((prev) => {
      const oldI = prev.findIndex((it) => it.id === active.id)
      const newI = prev.findIndex((it) => it.id === over.id)
      return oldI < 0 || newI < 0 ? prev : arrayMove(prev, oldI, newI)
    })
  }

  const setSpan = (id: string, span: Span) => setLayout((p) => p.map((it) => (it.id === id ? { ...it, span } : it)))
  const remove = (id: string) => setLayout((p) => p.filter((it) => it.id !== id))
  const add = (id: string) => {
    const card = byId.get(id); if (!card) return
    setLayout((p) => [...p, { id, span: card.defaultSpan }]); setAddOpen(false)
  }

  async function onSave() {
    setSaving(true); setError(null)
    const res = await saveDashboardLayout(visible)
    setSaving(false)
    if (res.ok) { setBaseline(visible); setLayout(visible); setEditing(false); setAddOpen(false) }
    else setError(res.error || 'Could not save your dashboard.')
  }
  async function onReset() {
    setSaving(true); setError(null)
    await resetDashboardLayout()
    setSaving(false)
    setLayout(defaultLayout); setBaseline(defaultLayout); setEditing(false); setAddOpen(false)
  }
  function onCancel() { setLayout(baseline); setEditing(false); setAddOpen(false); setError(null) }

  return (
    <div className="space-y-3">
      {/* Toolbar */}
      <div className="flex items-center justify-end gap-2 min-h-8">
        {error && <span className="mr-auto text-[12px] text-rose-600 dark:text-rose-400">{error}</span>}
        {!editing ? (
          <button onClick={() => setEditing(true)}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft hover:text-ink transition-colors">
            <Pencil size={13} /> Edit dashboard
          </button>
        ) : (
          <>
            <div className="relative mr-auto">
              <button onClick={() => setAddOpen((o) => !o)} disabled={availableToAdd.length === 0}
                className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft hover:text-ink transition-colors disabled:opacity-50">
                <Plus size={13} /> Add card
              </button>
              {addOpen && availableToAdd.length > 0 && (
                <div className="absolute left-0 top-9 z-30 w-56 rounded-xl border border-hairline bg-surface p-1.5 shadow-[0_8px_24px_rgba(31,30,27,0.10)]">
                  {availableToAdd.map((c) => (
                    <button key={c.id} onClick={() => add(c.id)}
                      className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-[12px] text-ink-secondary hover:bg-surface-soft hover:text-ink transition-colors">
                      <Plus size={13} className="text-ink-faint flex-shrink-0" /> {c.title}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={onReset} disabled={saving}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-ink-muted hover:text-ink transition-colors disabled:opacity-50">
              <RotateCcw size={13} /> Reset
            </button>
            <button onClick={onCancel} disabled={saving}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-medium text-ink-secondary border border-hairline-strong bg-surface hover:bg-surface-soft transition-colors disabled:opacity-50">
              Cancel
            </button>
            <button onClick={onSave} disabled={saving}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold text-white transition-colors disabled:opacity-60"
              style={{ backgroundColor: 'var(--brand)' }}>
              <Check size={13} /> {saving ? 'Saving…' : 'Save'}
            </button>
          </>
        )}
      </div>

      {/* Grid */}
      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-hairline-strong bg-surface-soft px-6 py-12 text-center">
          <LayoutGrid size={20} className="mx-auto text-ink-faint" />
          <p className="mt-2 text-[13px] text-ink-secondary">Your dashboard is empty — add a card to get started.</p>
        </div>
      ) : editing ? (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
          <SortableContext items={visible.map((it) => it.id)} strategy={rectSortingStrategy}>
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
              {visible.map((it) => {
                const card = byId.get(it.id)!
                return (
                  <EditCell key={it.id} id={it.id} span={it.span} sizes={card.sizes}
                    onSize={(s) => setSpan(it.id, s)} onRemove={() => remove(it.id)}>
                    {card.node}
                  </EditCell>
                )
              })}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {visible.map((it) => {
            const card = byId.get(it.id)!
            return <div key={it.id} className={SPAN_CLASS[it.span]}>{card.node}</div>
          })}
        </div>
      )}
    </div>
  )
}

function EditCell({ id, span, sizes, onSize, onRemove, children }: {
  id: string; span: Span; sizes: Span[]; onSize: (s: Span) => void; onRemove: () => void; children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    outline: '1px dashed var(--hairline-strong)',
    outlineOffset: '-1px',
  }
  return (
    <div ref={setNodeRef} style={style}
      className={`relative rounded-xl ${SPAN_CLASS[span]} ${isDragging ? 'z-10 opacity-80' : ''}`}>
      <div className="absolute -top-3 right-2 z-20 flex items-center gap-0.5 rounded-lg border border-hairline bg-surface px-1 py-0.5 shadow-[0_1px_2px_rgba(31,30,27,0.06)]">
        {sizes.length > 1 && sizes.map((s) => (
          <button key={s} onClick={() => onSize(s)} title={`Size ${SIZE_LABEL[s]}`}
            className={`w-5 h-5 rounded text-[10px] font-semibold tabular-nums transition-colors ${s === span ? 'bg-brand-soft text-brand-ink' : 'text-ink-muted hover:text-ink'}`}>
            {SIZE_LABEL[s]}
          </button>
        ))}
        <button {...attributes} {...listeners} title="Drag to reorder"
          className="w-5 h-5 flex items-center justify-center text-ink-muted hover:text-ink cursor-grab active:cursor-grabbing touch-none">
          <GripVertical size={13} />
        </button>
        <button onClick={onRemove} title="Remove card"
          className="w-5 h-5 flex items-center justify-center text-ink-muted hover:text-rose-500 transition-colors">
          <X size={13} />
        </button>
      </div>
      <div className="pointer-events-none select-none">{children}</div>
    </div>
  )
}
