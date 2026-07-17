'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  GripVertical, Plus, Trash2, Save, ChevronRight, X, Check, Pencil,
  Bell, Eye, BarChart3, FileDown, LayoutGrid, List, SlidersHorizontal, ChevronDown,
} from 'lucide-react'
import type { Form, FormField, NotificationRule, Category } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import FormCanvas from './FormCanvas'
import {
  BuilderField, BuilderRule, FieldType, FIELD_TYPES, OPTION_TYPES,
  CONTROLLER_TYPES, PLACEHOLDER_TYPES, makeField, uid,
} from './form-builder-shared'

const inputCls = 'w-full border border-hairline rounded-md px-3 py-2 text-sm text-ink bg-surface outline-none focus:border-brand placeholder:text-ink-faint'
const overlineCls = 'block text-[11px] font-semibold text-ink-muted uppercase tracking-[0.06em] mb-1.5'

interface Props {
  categories: Category[]
  initialForm?: Form & { form_fields: FormField[]; notification_rules: NotificationRule[] }
}

export default function FormBuilder({ categories, initialForm }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)
  const [viewMode, setViewMode] = useState<'canvas' | 'list'>('canvas')
  const [showSettings, setShowSettings] = useState(false)

  const [title, setTitle] = useState(initialForm?.title || '')
  const [description, setDescription] = useState(initialForm?.description || '')
  const [categoryId, setCategoryId] = useState(initialForm?.category_id || '')
  const [slug, setSlug] = useState(initialForm?.slug || '')
  const [successMessage, setSuccessMessage] = useState(initialForm?.success_message || 'Your submission has been received.')

  const [fields, setFields] = useState<BuilderField[]>(
    (initialForm?.form_fields || [])
      .sort((a, b) => a.sort_order - b.sort_order)
      .map((f) => ({ ...f, _id: uid() }))
  )

  const [rules, setRules] = useState<BuilderRule[]>(
    (initialForm?.notification_rules || []).map((r) => ({ ...r, _id: uid() }))
  )
  const [editingRuleIds, setEditingRuleIds] = useState<Set<string>>(new Set())

  const selectedField = fields.find((f) => f._id === selectedFieldId) || null

  // Keep the list-mode "Field Settings" panel pinned near the top of the viewport
  // as you scroll a long form. Only relevant while the list view + a field are active.
  const builderRef = useRef<HTMLDivElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const [settingsTop, setSettingsTop] = useState(0)

  useEffect(() => {
    if (viewMode !== 'list' || !selectedFieldId) { setSettingsTop(0); return }
    const root = builderRef.current
    if (!root) return
    const align = () => {
      const rootTop = root.getBoundingClientRect().top
      const panelH = settingsRef.current?.offsetHeight ?? 0
      const maxTop = Math.max(0, root.clientHeight - panelH - 16)
      setSettingsTop(Math.max(0, Math.min(-rootTop, maxTop)))
    }
    let ticking = false
    const onScroll = () => {
      if (ticking) return
      ticking = true
      requestAnimationFrame(() => { ticking = false; align() })
    }
    align()
    const raf = requestAnimationFrame(align)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [selectedFieldId, viewMode])

  // ── Field operations (shared by both views) ────────────────────────────────
  const addField = (type: FieldType) => {
    const nf = makeField(type, fields.length)
    setFields((prev) => [...prev, nf])
    setSelectedFieldId(nf._id)
  }

  // Insert a new field immediately after `afterId` (null = prepend). Used by the
  // canvas's inline "Add field" / "Add section" affordances.
  const insertField = (type: FieldType, afterId: string | null) => {
    const nf = makeField(type, 0)
    setFields((prev) => {
      const idx = afterId ? prev.findIndex((f) => f._id === afterId) : -1
      const next = [...prev]
      next.splice(idx + 1, 0, nf)
      return next.map((f, i) => ({ ...f, sort_order: i }))
    })
    setSelectedFieldId(type === 'section_header' ? null : nf._id)
  }

  const duplicateField = (id: string) => {
    const src = fields.find((f) => f._id === id)
    if (!src) return
    const clone: BuilderField = {
      ...src,
      _id: uid(),
      // Duplicated labels silently share answers, so nudge the copy's label to be unique.
      label: src.field_type === 'section_header' ? src.label : `${src.label} (copy)`,
      options: src.options ? [...src.options] : null,
    }
    setFields((prev) => {
      const idx = prev.findIndex((f) => f._id === id)
      const next = [...prev]
      next.splice(idx + 1, 0, clone)
      return next.map((f, i) => ({ ...f, sort_order: i }))
    })
    setSelectedFieldId(clone.field_type === 'section_header' ? null : clone._id)
  }

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f._id !== id).map((f, i) => ({ ...f, sort_order: i })))
    if (selectedFieldId === id) setSelectedFieldId(null)
  }

  const updateField = useCallback((id: string, updates: Partial<BuilderField>) => {
    setFields((prev) => prev.map((f) => f._id === id ? { ...f, ...updates } : f))
  }, [])

  const reorderFields = useCallback((next: BuilderField[]) => setFields(next), [])

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const reordered = Array.from(fields)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    setFields(reordered.map((f, i) => ({ ...f, sort_order: i })))
  }

  // ── Notification rules ─────────────────────────────────────────────────────
  const addRule = () => {
    const id = uid()
    setRules((prev) => [...prev, { _id: id, recipient_email: '', recipient_name: null, send_on_submit: true, email_subject: null }])
    setEditingRuleIds((prev) => { const s = new Set(prev); s.add(id); return s })
  }
  const updateRule = (id: string, updates: Partial<BuilderRule>) =>
    setRules((prev) => prev.map((r) => r._id === id ? { ...r, ...updates } : r))
  const confirmRule = (id: string) =>
    setEditingRuleIds((prev) => { const s = new Set(prev); s.delete(id); return s })
  const editRule = (id: string) =>
    setEditingRuleIds((prev) => { const s = new Set(prev); s.add(id); return s })
  const removeRule = (id: string) => {
    setRules((prev) => prev.filter((r) => r._id !== id))
    setEditingRuleIds((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  const handleTitleChange = (val: string) => {
    setTitle(val)
    if (!initialForm) setSlug(slugify(val))
  }

  const save = async () => {
    if (!title.trim()) { setSaveError('Form title is required.'); return }
    if (!slug.trim()) { setSaveError('Slug is required.'); return }
    setSaving(true)
    setSaveError(null)

    const payload = {
      title: title.trim(),
      description: description.trim() || null,
      category_id: categoryId || null,
      slug: slug.trim(),
      success_message: successMessage.trim(),
      fields: fields.map((f, i) => ({
        label: f.label, field_type: f.field_type, placeholder: f.placeholder,
        options: f.options, is_required: f.is_required, sort_order: i,
        show_when_field: f.show_when_field ?? null, show_when_value: f.show_when_value ?? null,
      })),
      notification_rules: rules
        .filter((r) => r.recipient_email.trim())
        .map((r) => ({
          recipient_email: r.recipient_email.trim(),
          recipient_name: r.recipient_name,
          email_subject: r.email_subject,
        })),
    }

    try {
      const method = initialForm ? 'PUT' : 'POST'
      const url = initialForm ? `/api/forms/${initialForm.id}` : '/api/forms'
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Save failed')
      }
      router.push('/admin/forms')
      router.refresh()
    } catch (e) {
      setSaveError((e as Error).message)
      setSaving(false)
    }
  }

  // ── Reusable panels (used in both views) ───────────────────────────────────
  const metaCard = (
    <div className="bg-surface border border-hairline rounded-xl p-5 space-y-4">
      <div>
        <label className={overlineCls}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional form description…"
          rows={2}
          className={`${inputCls} resize-none`}
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={overlineCls}>Category</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className={inputCls}>
            <option value="">No category</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={overlineCls}>Success Message</label>
          <input value={successMessage} onChange={(e) => setSuccessMessage(e.target.value)} className={inputCls} />
        </div>
      </div>
    </div>
  )

  const notificationsCard = (
    <div className="bg-surface border border-hairline rounded-xl p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell size={15} className="text-ink-muted" />
          <h3 className="text-sm font-semibold text-ink">Email Notifications</h3>
        </div>
        <button onClick={addRule} className="flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline">
          <Plus size={12} /> Add recipient
        </button>
      </div>
      {rules.length === 0 && <p className="text-sm text-ink-muted">No notification recipients. Add one above.</p>}
      <div className="space-y-2">
        {rules.map((rule) => {
          const isEditing = editingRuleIds.has(rule._id) || !rule.recipient_email
          if (!isEditing) {
            return (
              <div key={rule._id} className="flex items-center gap-2.5 bg-brand-soft border border-hairline rounded-lg px-3 py-2.5">
                <Check size={13} className="text-brand flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-ink-secondary truncate">{rule.recipient_email}</p>
                  {rule.email_subject && <p className="text-[11px] text-ink-muted truncate">Subject: {rule.email_subject}</p>}
                </div>
                <button onClick={() => editRule(rule._id)} title="Edit" className="text-ink-faint hover:text-ink transition-colors flex-shrink-0">
                  <Pencil size={12} />
                </button>
                <button onClick={() => removeRule(rule._id)} title="Remove" className="text-ink-faint hover:text-rose-500 transition-colors flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            )
          }
          return (
            <div key={rule._id} className="flex items-center gap-2.5">
              <input
                value={rule.recipient_email}
                onChange={(e) => updateRule(rule._id, { recipient_email: e.target.value })}
                placeholder="email@company.com" type="email" className={inputCls}
                autoFocus={!rule.recipient_email}
              />
              <input
                value={rule.email_subject || ''}
                onChange={(e) => updateRule(rule._id, { email_subject: e.target.value || null })}
                placeholder="Custom subject (optional)" className={inputCls}
              />
              <button
                onClick={() => rule.recipient_email.trim() ? confirmRule(rule._id) : removeRule(rule._id)}
                title={rule.recipient_email.trim() ? 'Confirm' : 'Remove'}
                className={`flex-shrink-0 transition-colors ${rule.recipient_email.trim() ? 'text-brand hover:text-brand-hover' : 'text-ink-faint hover:text-rose-500'}`}
              >
                {rule.recipient_email.trim() ? <Check size={15} /> : <X size={15} />}
              </button>
            </div>
          )
        })}
      </div>
    </div>
  )

  return (
    <div ref={builderRef} className="flex flex-col h-full bg-canvas">
      {/* Top toolbar (shared) */}
      <div className="bg-surface border-b border-hairline px-5 py-3 flex items-center gap-3 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <input
            value={title}
            onChange={(e) => handleTitleChange(e.target.value)}
            placeholder="Form title…"
            className="text-base font-semibold text-ink outline-none placeholder:text-ink-faint w-full bg-transparent"
          />
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs text-ink-muted">Slug:</span>
            <input
              value={slug}
              onChange={(e) => setSlug(slugify(e.target.value))}
              className="text-xs text-ink-muted font-mono outline-none bg-transparent border-b border-transparent focus:border-hairline-strong"
            />
          </div>
        </div>

        {/* View toggle */}
        <div className="flex items-center rounded-lg border border-hairline bg-surface-soft p-0.5 flex-shrink-0">
          <button
            onClick={() => setViewMode('canvas')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'canvas' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
            title="Form view — grouped, WYSIWYG"
          >
            <LayoutGrid size={13} /> Form view
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors ${viewMode === 'list' ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink'}`}
            title="List view — classic flat list"
          >
            <List size={13} /> List
          </button>
        </div>

        {viewMode === 'canvas' && (
          <button
            onClick={() => setShowSettings((s) => !s)}
            className={`flex items-center gap-1.5 text-xs transition-colors flex-shrink-0 ${showSettings ? 'text-brand-ink' : 'text-ink-muted hover:text-ink'}`}
            title="Form details & notifications"
          >
            <SlidersHorizontal size={14} /> Details
            <ChevronDown size={12} className={`transition-transform ${showSettings ? 'rotate-180' : ''}`} />
          </button>
        )}

        <a href={slug ? `/forms/${slug}` : '#'} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-brand-ink transition-colors flex-shrink-0">
          <Eye size={14} /> Preview
        </a>
        {initialForm && (
          <a href={`/admin/forms/${initialForm.id}/tally`} className="flex items-center gap-1.5 text-xs text-ink-muted hover:text-brand-ink transition-colors flex-shrink-0">
            <BarChart3 size={14} /> Tally
          </a>
        )}
        {initialForm && (
          <a
            href={initialForm.slug === 'perf-new' ? '/print/annual-review' : `/print/forms/${initialForm.id}`}
            target="_blank" rel="noopener noreferrer"
            title="Open a printable blank form and save it as a PDF"
            className="flex items-center gap-1.5 rounded-lg border border-hairline-strong px-3 py-2 text-xs font-medium text-ink-secondary hover:border-brand hover:text-brand-ink transition-colors flex-shrink-0"
          >
            <FileDown size={14} /> Download PDF
          </a>
        )}
        <button
          onClick={save}
          disabled={saving}
          className="flex items-center gap-2 bg-brand hover:bg-brand-hover text-white text-sm font-semibold px-4 py-2 rounded-lg transition-colors disabled:opacity-60 flex-shrink-0"
        >
          <Save size={15} /> {saving ? 'Saving…' : 'Save Form'}
        </button>
      </div>

      {saveError && (
        <div className="bg-rose-50 dark:bg-rose-500/10 border-b border-rose-200 dark:border-rose-500/20 px-5 py-2 text-sm text-rose-600 dark:text-rose-400 flex-shrink-0">
          {saveError}
        </div>
      )}

      {/* Collapsible form-settings panel (canvas view) */}
      {viewMode === 'canvas' && showSettings && (
        <div className="border-b border-hairline bg-canvas px-6 py-4 flex-shrink-0 max-h-[45vh] overflow-y-auto">
          <div className="max-w-3xl mx-auto space-y-3">
            {metaCard}
            {notificationsCard}
          </div>
        </div>
      )}

      {/* Body */}
      {viewMode === 'canvas' ? (
        <div className="flex-1 min-h-0">
          <FormCanvas
            fields={fields}
            selectedFieldId={selectedFieldId}
            onSelectField={setSelectedFieldId}
            onUpdateField={updateField}
            onRemoveField={removeField}
            onDuplicateField={duplicateField}
            onInsertField={insertField}
            onReorder={reorderFields}
          />
        </div>
      ) : (
        <div className="flex-1 flex min-h-0 overflow-hidden">
          {/* Left: field palette */}
          <aside className="w-52 bg-surface border-r border-hairline flex flex-col overflow-y-auto flex-shrink-0">
            <div className="px-4 pt-4 pb-3 border-b border-hairline">
              <p className={overlineCls + ' mb-0'}>Add Field</p>
            </div>
            <div className="p-3 space-y-0.5">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.type}
                  onClick={() => addField(ft.type)}
                  className="w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm text-ink-secondary hover:bg-brand-soft hover:text-brand-ink transition-colors text-left"
                >
                  <ft.icon size={14} className="flex-shrink-0" /> {ft.label}
                </button>
              ))}
            </div>
          </aside>

          {/* Center: canvas */}
          <div className="flex-1 overflow-y-auto p-6 space-y-3">
            {metaCard}

            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="fields">
                {(provided) => (
                  <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                    {fields.length === 0 && (
                      <div className="border-2 border-dashed border-hairline rounded-xl py-12 text-center text-sm text-ink-faint">
                        Add a field from the left panel to get started
                      </div>
                    )}
                    {fields.map((field, index) => (
                      <Draggable key={field._id} draggableId={field._id} index={index}>
                        {(prov, snapshot) => (
                          <div
                            ref={prov.innerRef}
                            {...prov.draggableProps}
                            onClick={() => setSelectedFieldId(field._id === selectedFieldId ? null : field._id)}
                            className={`bg-surface border rounded-xl px-4 py-3 cursor-pointer transition-all flex items-center gap-3 ${
                              snapshot.isDragging ? 'shadow-[0_8px_24px_rgba(31,30,27,0.12)]' : ''
                            } ${
                              selectedFieldId === field._id
                                ? 'border-brand ring-1 ring-brand'
                                : 'border-hairline hover:border-hairline-strong'
                            }`}
                          >
                            <div {...prov.dragHandleProps} className="text-ink-faint hover:text-ink-muted flex-shrink-0">
                              <GripVertical size={16} />
                            </div>
                            <div className="flex-1 min-w-0">
                              {field.field_type === 'section_header' ? (
                                <div className="flex items-center gap-2">
                                  <div className="h-px flex-1 bg-brand/30" />
                                  <p className="text-xs font-semibold text-brand-ink uppercase tracking-widest truncate">{field.label}</p>
                                  <div className="h-px flex-1 bg-brand/30" />
                                </div>
                              ) : (
                                <>
                                  <p className="text-sm font-medium text-ink truncate">{field.label}</p>
                                  <p className="text-xs text-ink-muted capitalize">{field.field_type}{field.is_required ? ' · Required' : ''}{field.show_when_field ? ' · Conditional' : ''}</p>
                                </>
                              )}
                            </div>
                            <ChevronRight size={14} className={`text-ink-faint transition-transform flex-shrink-0 ${selectedFieldId === field._id ? 'rotate-90' : ''}`} />
                            <button onClick={(e) => { e.stopPropagation(); removeField(field._id) }} className="text-ink-faint hover:text-rose-500 transition-colors flex-shrink-0">
                              <Trash2 size={14} />
                            </button>
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {notificationsCard}
          </div>

          {/* Right: field settings panel */}
          {selectedField && (
            <aside className="w-72 bg-surface border-l border-hairline overflow-y-auto flex-shrink-0">
              <div ref={settingsRef} style={{ marginTop: settingsTop }}>
                <div className="px-5 pt-4 pb-3 border-b border-hairline flex items-center justify-between">
                  <p className={overlineCls + ' mb-0'}>Field Settings</p>
                  <button onClick={() => setSelectedFieldId(null)} className="text-ink-muted hover:text-ink">
                    <X size={15} />
                  </button>
                </div>
                <FieldSettings field={selectedField} allFields={fields} onUpdate={(u) => updateField(selectedField._id, u)} />
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  )
}

// ── List-view field settings panel (classic) ──────────────────────────────────
function FieldSettings({ field, allFields, onUpdate }: { field: BuilderField; allFields: BuilderField[]; onUpdate: (u: Partial<BuilderField>) => void }) {
  const hasOptions = OPTION_TYPES.has(field.field_type)
  const controllers = allFields.filter(
    (f) => f._id !== field._id && CONTROLLER_TYPES.has(f.field_type) && (f.options?.length ?? 0) > 0,
  )
  const controllerOptions = allFields.find((f) => f.label === field.show_when_field)?.options || []
  const showsPlaceholder = PLACEHOLDER_TYPES.has(field.field_type)

  const inputCls = 'w-full border border-hairline rounded-md px-3 py-2 text-sm text-ink bg-surface outline-none focus:border-brand placeholder:text-ink-faint'
  const lbl = 'block text-[11px] font-semibold text-ink-muted uppercase tracking-[0.06em] mb-1.5'

  const updateOption = (i: number, val: string) => {
    const opts = [...(field.options || [])]; opts[i] = val; onUpdate({ options: opts })
  }
  const addOption = () => onUpdate({ options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })
  const removeOption = (i: number) => {
    const opts = [...(field.options || [])]; opts.splice(i, 1); onUpdate({ options: opts })
  }

  return (
    <div className="p-5 space-y-5">
      <div>
        <label className={lbl}>Label</label>
        <input value={field.label} onChange={(e) => onUpdate({ label: e.target.value })} className={inputCls} />
      </div>

      {showsPlaceholder && (
        <div>
          <label className={lbl}>{field.field_type === 'section_header' ? 'Description' : 'Placeholder'}</label>
          <input value={field.placeholder || ''} onChange={(e) => onUpdate({ placeholder: e.target.value || null })} className={inputCls} />
        </div>
      )}

      {field.field_type !== 'section_header' && (
        <div className="flex items-center justify-between">
          <label className={lbl + ' mb-0'}>Required</label>
          <button
            onClick={() => onUpdate({ is_required: !field.is_required })}
            className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${field.is_required ? 'bg-brand' : 'bg-surface-strong'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${field.is_required ? 'translate-x-4' : 'translate-x-0'}`} />
          </button>
        </div>
      )}

      {hasOptions && (
        <div>
          <label className={lbl}>Options</label>
          <div className="space-y-1.5">
            {(field.options || []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input value={opt} onChange={(e) => updateOption(i, e.target.value)} className={inputCls} />
                <button onClick={() => removeOption(i)} className="text-ink-faint hover:text-rose-500 transition-colors flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addOption} className="mt-2 flex items-center gap-1 text-xs font-medium text-brand-ink hover:underline">
            <Plus size={12} /> Add option
          </button>
        </div>
      )}

      {field.field_type !== 'section_header' && (
        <div>
          <label className={lbl}>Show only when…</label>
          <select
            value={field.show_when_field || ''}
            onChange={(e) => {
              const sf = e.target.value || null
              const firstOpt = sf ? (allFields.find((f) => f.label === sf)?.options?.[0] ?? null) : null
              onUpdate({ show_when_field: sf, show_when_value: firstOpt })
            }}
            className={inputCls}
          >
            <option value="">Always show</option>
            {controllers.map((c) => <option key={c._id} value={c.label}>{c.label}</option>)}
          </select>
          {field.show_when_field && (
            <select value={field.show_when_value || ''} onChange={(e) => onUpdate({ show_when_value: e.target.value })} className={`${inputCls} mt-2`}>
              {controllerOptions.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
          )}
          {controllers.length === 0 && (
            <p className="mt-1.5 text-[11px] text-ink-muted">Add a Dropdown or Single-Choice field to drive visibility.</p>
          )}
        </div>
      )}
    </div>
  )
}
