'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  GripVertical, Plus, Trash2, Save, ChevronRight, X, Check, Pencil,
  Type, AlignLeft, Hash, Mail, ListOrdered, CheckSquare,
  Calendar, Upload, Pen, ToggleLeft, Bell, Eye
} from 'lucide-react'
import type { Form, FormField, NotificationRule, Category } from '@/lib/supabase'
import { slugify } from '@/lib/utils'
import type { LucideIcon } from 'lucide-react'

type BuilderField = Omit<FormField, 'id' | 'form_id' | 'created_at'> & { _id: string }
type BuilderRule = Omit<NotificationRule, 'id' | 'form_id' | 'created_at'> & { _id: string }

const FIELD_TYPES: { type: FormField['field_type']; label: string; icon: LucideIcon }[] = [
  { type: 'text',      label: 'Short Text',   icon: Type },
  { type: 'email',     label: 'Email',         icon: Mail },
  { type: 'number',    label: 'Number',        icon: Hash },
  { type: 'textarea',  label: 'Long Text',     icon: AlignLeft },
  { type: 'select',    label: 'Dropdown',      icon: ListOrdered },
  { type: 'radio',     label: 'Single Choice', icon: ToggleLeft },
  { type: 'checkbox',  label: 'Multi Choice',  icon: CheckSquare },
  { type: 'date',      label: 'Date',          icon: Calendar },
  { type: 'file',      label: 'File Upload',   icon: Upload },
  { type: 'signature', label: 'Signature',     icon: Pen },
]

const inputCls = 'w-full border border-gray-200 dark:border-gray-700 rounded-[6px] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 outline-none focus:border-[#089447] dark:focus:border-[#089447] placeholder:text-gray-400 dark:placeholder:text-gray-600'

let idCounter = 0
const uid = () => `field-${++idCounter}`

interface Props {
  categories: Category[]
  initialForm?: Form & { form_fields: FormField[]; notification_rules: NotificationRule[] }
}

export default function FormBuilder({ categories, initialForm }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null)

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
  // Track which rule rows are in "edit" mode — new rules start editing, saved ones start as chips
  const [editingRuleIds, setEditingRuleIds] = useState<Set<string>>(new Set())

  const selectedField = fields.find((f) => f._id === selectedFieldId) || null

  const addField = (type: FormField['field_type']) => {
    const newField: BuilderField = {
      _id: uid(),
      label: FIELD_TYPES.find((t) => t.type === type)?.label || 'New Field',
      field_type: type,
      placeholder: null,
      options: ['select', 'radio', 'checkbox'].includes(type) ? ['Option 1', 'Option 2'] : null,
      is_required: false,
      sort_order: fields.length,
    }
    setFields((prev) => [...prev, newField])
    setSelectedFieldId(newField._id)
  }

  const removeField = (id: string) => {
    setFields((prev) => prev.filter((f) => f._id !== id))
    if (selectedFieldId === id) setSelectedFieldId(null)
  }

  const updateField = useCallback((id: string, updates: Partial<BuilderField>) => {
    setFields((prev) => prev.map((f) => f._id === id ? { ...f, ...updates } : f))
  }, [])

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return
    const reordered = Array.from(fields)
    const [moved] = reordered.splice(result.source.index, 1)
    reordered.splice(result.destination.index, 0, moved)
    setFields(reordered.map((f, i) => ({ ...f, sort_order: i })))
  }

  const addRule = () => {
    const id = uid()
    setRules((prev) => [...prev, { _id: id, recipient_email: '', recipient_name: null, send_on_submit: true, email_subject: null }])
    setEditingRuleIds((prev) => { const s = new Set(prev); s.add(id); return s })
  }

  const updateRule = (id: string, updates: Partial<BuilderRule>) => {
    setRules((prev) => prev.map((r) => r._id === id ? { ...r, ...updates } : r))
  }

  const confirmRule = (id: string) => {
    setEditingRuleIds((prev) => { const s = new Set(prev); s.delete(id); return s })
  }

  const editRule = (id: string) => {
    setEditingRuleIds((prev) => { const s = new Set(prev); s.add(id); return s })
  }

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

  return (
    <div className="flex h-full">

      {/* Left: Field palette */}
      <aside className="w-52 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 flex flex-col overflow-y-auto flex-shrink-0">
        <div className="px-4 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800">
          <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Add Field</p>
        </div>
        <div className="p-3 space-y-0.5">
          {FIELD_TYPES.map((ft) => (
            <button
              key={ft.type}
              onClick={() => addField(ft.type)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-[6px] text-sm text-gray-600 dark:text-gray-400 hover:bg-[#f0faf4] dark:hover:bg-[#089447]/10 hover:text-[#089447] transition-colors text-left"
            >
              <ft.icon size={14} className="flex-shrink-0" />
              {ft.label}
            </button>
          ))}
        </div>
      </aside>

      {/* Center: Canvas */}
      <div className="flex-1 flex flex-col overflow-hidden">

        {/* Toolbar */}
        <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-5 py-3 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <input
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              placeholder="Form title…"
              className="text-base font-bold text-gray-900 dark:text-white outline-none placeholder:text-gray-300 dark:placeholder:text-gray-600 w-full bg-transparent"
            />
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-gray-400 dark:text-gray-500">Slug:</span>
              <input
                value={slug}
                onChange={(e) => setSlug(slugify(e.target.value))}
                className="text-xs text-gray-500 dark:text-gray-400 font-mono outline-none bg-transparent border-b border-transparent focus:border-gray-300 dark:focus:border-gray-600"
              />
            </div>
          </div>
          <a
            href={slug ? `/forms/${slug}` : '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 hover:text-[#089447] transition-colors flex-shrink-0"
          >
            <Eye size={14} />
            Preview
          </a>
          <button
            onClick={save}
            disabled={saving}
            className="flex items-center gap-2 bg-[#089447] hover:bg-[#077a3c] text-white text-sm font-semibold px-4 py-2 rounded-[8px] transition-colors disabled:opacity-60 flex-shrink-0"
          >
            <Save size={15} />
            {saving ? 'Saving…' : 'Save Form'}
          </button>
        </div>

        {saveError && (
          <div className="bg-red-50 dark:bg-red-950/40 border-b border-red-200 dark:border-red-900/50 px-5 py-2 text-sm text-red-600 dark:text-red-400">
            {saveError}
          </div>
        )}

        {/* Scrollable canvas */}
        <div className="flex-1 overflow-y-auto p-6 space-y-3">

          {/* Form meta */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5 space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Description</label>
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
                <label className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Category</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={inputCls}
                >
                  <option value="">No category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Success Message</label>
                <input
                  value={successMessage}
                  onChange={(e) => setSuccessMessage(e.target.value)}
                  className={inputCls}
                />
              </div>
            </div>
          </div>

          {/* Fields */}
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="fields">
              {(provided) => (
                <div ref={provided.innerRef} {...provided.droppableProps} className="space-y-2">
                  {fields.length === 0 && (
                    <div className="border-2 border-dashed border-gray-200 dark:border-gray-700 rounded-xl py-12 text-center text-sm text-gray-400 dark:text-gray-600">
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
                          className={`bg-white dark:bg-gray-900 border rounded-xl px-4 py-3 cursor-pointer transition-all flex items-center gap-3 ${
                            snapshot.isDragging ? 'shadow-lg' : ''
                          } ${
                            selectedFieldId === field._id
                              ? 'border-[#089447] shadow-[0_0_0_2px_rgba(8,148,71,0.1)]'
                              : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'
                          }`}
                        >
                          <div {...prov.dragHandleProps} className="text-gray-300 dark:text-gray-600 hover:text-gray-500 dark:hover:text-gray-400 flex-shrink-0">
                            <GripVertical size={16} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">{field.label}</p>
                            <p className="text-xs text-gray-400 capitalize">{field.field_type}{field.is_required ? ' · Required' : ''}</p>
                          </div>
                          <ChevronRight size={14} className={`text-gray-300 dark:text-gray-600 transition-transform flex-shrink-0 ${selectedFieldId === field._id ? 'rotate-90' : ''}`} />
                          <button
                            onClick={(e) => { e.stopPropagation(); removeField(field._id) }}
                            className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors flex-shrink-0"
                          >
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

          {/* Email notifications */}
          <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-xl p-5">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell size={15} className="text-gray-400 dark:text-gray-500" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Email Notifications</h3>
              </div>
              <button onClick={addRule} className="flex items-center gap-1 text-xs font-medium text-[#089447] hover:underline">
                <Plus size={12} />
                Add recipient
              </button>
            </div>
            {rules.length === 0 && (
              <p className="text-sm text-gray-400 dark:text-gray-500">No notification recipients. Add one above.</p>
            )}
            <div className="space-y-2">
              {rules.map((rule) => {
                const isEditing = editingRuleIds.has(rule._id) || !rule.recipient_email

                if (!isEditing) {
                  return (
                    <div key={rule._id} className="flex items-center gap-2.5 bg-[#f0faf4] dark:bg-[#089447]/10 border border-[#089447]/25 rounded-lg px-3 py-2.5">
                      <Check size={13} className="text-[#089447] flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-semibold text-gray-800 dark:text-gray-200 truncate">{rule.recipient_email}</p>
                        {rule.email_subject && (
                          <p className="text-[11px] text-gray-400 truncate">Subject: {rule.email_subject}</p>
                        )}
                      </div>
                      <button
                        onClick={() => editRule(rule._id)}
                        title="Edit"
                        className="text-gray-300 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-300 transition-colors flex-shrink-0"
                      >
                        <Pencil size={12} />
                      </button>
                      <button
                        onClick={() => removeRule(rule._id)}
                        title="Remove"
                        className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors flex-shrink-0"
                      >
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
                      placeholder="email@company.com"
                      type="email"
                      className={inputCls}
                      autoFocus={!rule.recipient_email}
                    />
                    <input
                      value={rule.email_subject || ''}
                      onChange={(e) => updateRule(rule._id, { email_subject: e.target.value || null })}
                      placeholder="Custom subject (optional)"
                      className={inputCls}
                    />
                    <button
                      onClick={() => rule.recipient_email.trim() ? confirmRule(rule._id) : removeRule(rule._id)}
                      title={rule.recipient_email.trim() ? 'Confirm' : 'Remove'}
                      className={`flex-shrink-0 transition-colors ${rule.recipient_email.trim() ? 'text-[#089447] hover:text-[#077a3c]' : 'text-gray-300 dark:text-gray-600 hover:text-red-500'}`}
                    >
                      {rule.recipient_email.trim() ? <Check size={15} /> : <X size={15} />}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>

        </div>
      </div>

      {/* Right: Field settings panel */}
      {selectedField && (
        <aside className="w-72 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-800 overflow-y-auto flex-shrink-0">
          <div className="px-5 pt-4 pb-3 border-b border-gray-100 dark:border-gray-800 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Field Settings</p>
            <button onClick={() => setSelectedFieldId(null)} className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300">
              <X size={15} />
            </button>
          </div>
          <FieldSettings field={selectedField} onUpdate={(u) => updateField(selectedField._id, u)} />
        </aside>
      )}
    </div>
  )
}

function FieldSettings({ field, onUpdate }: { field: BuilderField; onUpdate: (u: Partial<BuilderField>) => void }) {
  const hasOptions = ['select', 'radio', 'checkbox'].includes(field.field_type)

  const inputCls = 'w-full border border-gray-200 dark:border-gray-700 rounded-[6px] px-3 py-2 text-sm text-gray-900 dark:text-gray-100 bg-white dark:bg-gray-800 outline-none focus:border-[#089447] placeholder:text-gray-400 dark:placeholder:text-gray-600'

  const updateOption = (i: number, val: string) => {
    const opts = [...(field.options || [])]
    opts[i] = val
    onUpdate({ options: opts })
  }

  const addOption = () => onUpdate({ options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })
  const removeOption = (i: number) => {
    const opts = [...(field.options || [])]
    opts.splice(i, 1)
    onUpdate({ options: opts })
  }

  return (
    <div className="p-5 space-y-5">
      <div>
        <label className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Label</label>
        <input
          value={field.label}
          onChange={(e) => onUpdate({ label: e.target.value })}
          className={inputCls}
        />
      </div>

      {!['signature', 'file', 'date', 'radio', 'checkbox', 'select'].includes(field.field_type) && (
        <div>
          <label className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-1.5">Placeholder</label>
          <input
            value={field.placeholder || ''}
            onChange={(e) => onUpdate({ placeholder: e.target.value || null })}
            className={inputCls}
          />
        </div>
      )}

      <div className="flex items-center justify-between">
        <label className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">Required</label>
        <button
          onClick={() => onUpdate({ is_required: !field.is_required })}
          className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${field.is_required ? 'bg-[#089447]' : 'bg-gray-200 dark:bg-gray-700'}`}
        >
          <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${field.is_required ? 'translate-x-4' : 'translate-x-0'}`} />
        </button>
      </div>

      {hasOptions && (
        <div>
          <label className="block text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">Options</label>
          <div className="space-y-1.5">
            {(field.options || []).map((opt, i) => (
              <div key={i} className="flex items-center gap-2">
                <input
                  value={opt}
                  onChange={(e) => updateOption(i, e.target.value)}
                  className={inputCls}
                />
                <button onClick={() => removeOption(i)} className="text-gray-300 dark:text-gray-600 hover:text-red-500 transition-colors flex-shrink-0">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={addOption}
            className="mt-2 flex items-center gap-1 text-xs font-medium text-[#089447] hover:underline"
          >
            <Plus size={12} /> Add option
          </button>
        </div>
      )}
    </div>
  )
}
