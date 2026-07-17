'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd'
import {
  GripVertical, Trash2, Copy, Plus, ChevronDown, ChevronRight, X, Check,
  ListTree, ChevronsDownUp, ChevronsUpDown, GitBranch, AlertTriangle, Asterisk,
} from 'lucide-react'
import {
  BuilderField, FieldType, FIELD_TYPES, FIELD_TYPE_META, OPTION_TYPES,
  CONTROLLER_TYPES, PLACEHOLDER_TYPES, parseWhenValues, joinWhenValues,
} from './form-builder-shared'

// ─────────────────────────────────────────────────────────────────────────────
// The canvas groups the flat field list into sections (split on `section_header`
// fields) and renders each field as a WYSIWYG preview so the builder reads like
// the live form. Everything stays a single ordered array under the hood — the
// save payload is unchanged.
// ─────────────────────────────────────────────────────────────────────────────

const INTRO_KEY = '__intro__'

type Section = { key: string; header: BuilderField | null; fields: BuilderField[] }

function buildSections(fields: BuilderField[]): Section[] {
  const sections: Section[] = []
  let current: Section = { key: INTRO_KEY, header: null, fields: [] }
  for (const f of fields) {
    if (f.field_type === 'section_header') {
      if (current.header || current.fields.length) sections.push(current)
      current = { key: f._id, header: f, fields: [] }
    } else {
      current.fields.push(f)
    }
  }
  sections.push(current)
  // Drop a leading empty intro section (nothing before the first real header),
  // but keep it if it's the only section so an empty form still has a home.
  return sections.filter((s) => s.header || s.fields.length || sections.length === 1)
}

// ── Live validation, mirroring the runtime traps the model is prone to ────────
export type Issue = { fieldId: string; label: string; kind: 'dup-label' | 'dangling' | 'stale-value'; message: string }

export function computeIssues(fields: BuilderField[]): Issue[] {
  const issues: Issue[] = []
  const labelCounts = new Map<string, number>()
  for (const f of fields) {
    if (f.field_type === 'section_header') continue
    const key = f.label.trim()
    labelCounts.set(key, (labelCounts.get(key) || 0) + 1)
  }
  const byLabel = new Map<string, BuilderField>()
  for (const f of fields) if (!byLabel.has(f.label)) byLabel.set(f.label, f)

  for (const f of fields) {
    if (f.field_type === 'section_header') continue
    if ((labelCounts.get(f.label.trim()) || 0) > 1) {
      issues.push({ fieldId: f._id, label: f.label, kind: 'dup-label', message: `Duplicate label "${f.label}" — answers collapse into one and lose data. Make it unique.` })
    }
    if (f.show_when_field) {
      const controller = byLabel.get(f.show_when_field)
      if (!controller) {
        issues.push({ fieldId: f._id, label: f.label, kind: 'dangling', message: `Condition points at "${f.show_when_field}", which no field has — this field will be permanently hidden.` })
      } else {
        const opts = controller.options || []
        const missing = parseWhenValues(f.show_when_value).filter((v) => !opts.includes(v))
        if (missing.length) {
          issues.push({ fieldId: f._id, label: f.label, kind: 'stale-value', message: `Waits on value ${missing.map((m) => `"${m}"`).join(', ')} that "${f.show_when_field}" no longer offers — this field will never show.` })
        }
      }
    }
  }
  return issues
}

interface Props {
  fields: BuilderField[]
  selectedFieldId: string | null
  onSelectField: (id: string | null) => void
  onUpdateField: (id: string, updates: Partial<BuilderField>) => void
  onRemoveField: (id: string) => void
  onDuplicateField: (id: string) => void
  /** Insert a new field of `type` immediately after `afterId` (null = prepend). */
  onInsertField: (type: FieldType, afterId: string | null) => void
  /** Replace the whole ordered field list (used by reorder). */
  onReorder: (next: BuilderField[]) => void
}

export default function FormCanvas({
  fields, selectedFieldId, onSelectField, onUpdateField, onRemoveField,
  onDuplicateField, onInsertField, onReorder,
}: Props) {
  const sections = useMemo(() => buildSections(fields), [fields])
  const issues = useMemo(() => computeIssues(fields), [fields])
  const issuesByField = useMemo(() => {
    const m = new Map<string, Issue[]>()
    for (const i of issues) { const a = m.get(i.fieldId) || []; a.push(i); m.set(i.fieldId, a) }
    return m
  }, [issues])

  // Fields that can drive visibility: choice fields with options. Used for logic pickers.
  const controllers = useMemo(
    () => fields.filter((f) => CONTROLLER_TYPES.has(f.field_type) && (f.options?.length ?? 0) > 0),
    [fields],
  )
  // How many fields depend on each controlling label (shown on the controller).
  const dependentCounts = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of fields) if (f.show_when_field) m.set(f.show_when_field, (m.get(f.show_when_field) || 0) + 1)
    return m
  }, [fields])

  // Collapse big forms by default so the section overview is the first thing you see.
  const [collapsed, setCollapsed] = useState<Set<string>>(() => {
    const nonHeader = fields.filter((f) => f.field_type !== 'section_header').length
    if (nonHeader <= 40) return new Set()
    return new Set(buildSections(fields).map((s) => s.key))
  })
  const toggleCollapse = (key: string) =>
    setCollapsed((prev) => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s })
  const expandAll = () => setCollapsed(new Set())
  const collapseAll = () => setCollapsed(new Set(sections.map((s) => s.key)))

  // Ensure a section is open (used when selecting/inserting/jumping into it).
  const ensureOpen = (key: string) => setCollapsed((prev) => {
    if (!prev.has(key)) return prev
    const s = new Set(prev); s.delete(key); return s
  })

  const jumpToSection = (key: string) => {
    ensureOpen(key)
    requestAnimationFrame(() => {
      document.getElementById(`sec-${key}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }

  const flatten = (secs: Section[]): BuilderField[] => {
    const out: BuilderField[] = []
    for (const s of secs) {
      if (s.header) out.push(s.header)
      out.push(...s.fields)
    }
    return out.map((f, i) => ({ ...f, sort_order: i }))
  }

  const onDragEnd = (result: DropResult) => {
    const { source, destination } = result
    if (!destination) return
    if (source.droppableId === destination.droppableId && source.index === destination.index) return

    const next = sections.map((s) => ({ ...s, fields: [...s.fields] }))
    const src = next.find((s) => s.key === source.droppableId)
    const dst = next.find((s) => s.key === destination.droppableId)
    if (!src || !dst) return
    const [moved] = src.fields.splice(source.index, 1)
    if (!moved) return
    dst.fields.splice(destination.index, 0, moved)
    onReorder(flatten(next))
  }

  // Move a whole section (header + its fields) up or down as a block.
  const moveSection = (key: string, dir: -1 | 1) => {
    const idx = sections.findIndex((s) => s.key === key)
    const target = idx + dir
    if (idx < 0 || target < 0 || target >= sections.length) return
    const reordered = [...sections]
    const [s] = reordered.splice(idx, 1)
    reordered.splice(target, 0, s)
    onReorder(flatten(reordered))
  }

  const selectInto = (id: string, sectionKey: string) => {
    ensureOpen(sectionKey)
    onSelectField(id === selectedFieldId ? null : id)
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Left: outline / section navigator */}
      <Outline
        sections={sections}
        collapsed={collapsed}
        issues={issues}
        onJump={jumpToSection}
        onToggle={toggleCollapse}
        onExpandAll={expandAll}
        onCollapseAll={collapseAll}
      />

      {/* Center: WYSIWYG canvas */}
      <div className="flex-1 overflow-y-auto bg-canvas min-h-0">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-4">
          <DragDropContext onDragEnd={onDragEnd}>
            {sections.map((section, si) => (
              <SectionCard
                key={section.key}
                section={section}
                index={si}
                total={sections.length}
                collapsed={collapsed.has(section.key)}
                selectedFieldId={selectedFieldId}
                controllers={controllers}
                dependentCounts={dependentCounts}
                issuesByField={issuesByField}
                onToggleCollapse={() => toggleCollapse(section.key)}
                onMoveUp={() => moveSection(section.key, -1)}
                onMoveDown={() => moveSection(section.key, 1)}
                onSelect={(id) => selectInto(id, section.key)}
                onUpdateField={onUpdateField}
                onRemoveField={onRemoveField}
                onDuplicateField={onDuplicateField}
                onInsertField={onInsertField}
              />
            ))}
          </DragDropContext>

          <AddSectionRow onAdd={() => {
            const last = fields[fields.length - 1]
            onInsertField('section_header', last ? last._id : null)
          }} />
        </div>
      </div>
    </div>
  )
}

// ── Outline / section navigator ───────────────────────────────────────────────
function Outline({
  sections, collapsed, issues, onJump, onToggle, onExpandAll, onCollapseAll,
}: {
  sections: Section[]
  collapsed: Set<string>
  issues: Issue[]
  onJump: (key: string) => void
  onToggle: (key: string) => void
  onExpandAll: () => void
  onCollapseAll: () => void
}) {
  const issueKeys = useMemo(() => {
    const set = new Set<string>()
    // Attribute each issue to the section it lives in.
    const fieldToSection = new Map<string, string>()
    for (const s of sections) for (const f of s.fields) fieldToSection.set(f._id, s.key)
    for (const i of issues) { const k = fieldToSection.get(i.fieldId); if (k) set.add(k) }
    return set
  }, [sections, issues])

  const total = sections.reduce((n, s) => n + s.fields.length, 0)

  return (
    <aside className="w-60 flex-shrink-0 bg-surface border-r border-hairline flex flex-col overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-hairline flex items-center justify-between">
        <div className="flex items-center gap-2 text-ink-muted">
          <ListTree size={14} />
          <span className="text-[11px] font-semibold uppercase tracking-[0.06em]">Sections</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={onCollapseAll} title="Collapse all" className="p-1 rounded text-ink-faint hover:text-ink hover:bg-surface-strong transition-colors">
            <ChevronsDownUp size={14} />
          </button>
          <button onClick={onExpandAll} title="Expand all" className="p-1 rounded text-ink-faint hover:text-ink hover:bg-surface-strong transition-colors">
            <ChevronsUpDown size={14} />
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
        {sections.map((s) => {
          const title = s.header ? (s.header.label || 'Untitled section') : 'Form start'
          return (
            <div
              key={s.key}
              className="group flex items-center gap-2 px-2.5 py-2 rounded-md hover:bg-surface-strong transition-colors"
            >
              <button
                onClick={() => onToggle(s.key)}
                className="text-ink-faint hover:text-ink flex-shrink-0"
                title={collapsed.has(s.key) ? 'Expand' : 'Collapse'}
              >
                {collapsed.has(s.key) ? <ChevronRight size={13} /> : <ChevronDown size={13} />}
              </button>
              <button onClick={() => onJump(s.key)} className="flex-1 min-w-0 flex items-center gap-2 text-left">
                <span className={`flex-1 min-w-0 truncate text-[13px] ${s.header ? 'text-ink-secondary' : 'text-ink-muted italic'} group-hover:text-ink`}>
                  {title}
                </span>
                {issueKeys.has(s.key) && (
                  <AlertTriangle size={12} className="text-amber-500 flex-shrink-0" />
                )}
                <span className="text-[11px] text-ink-faint tabular-nums flex-shrink-0">{s.fields.length}</span>
              </button>
            </div>
          )
        })}
      </nav>

      <div className="px-4 py-3 border-t border-hairline text-[11px] text-ink-muted flex items-center justify-between">
        <span className="tabular-nums">{total} field{total === 1 ? '' : 's'}</span>
        {issues.length > 0 && (
          <span className="flex items-center gap-1 text-amber-600 dark:text-amber-500">
            <AlertTriangle size={12} />
            <span className="tabular-nums">{issues.length} issue{issues.length === 1 ? '' : 's'}</span>
          </span>
        )}
      </div>
    </aside>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────
function SectionCard({
  section, index, total, collapsed, selectedFieldId, controllers, dependentCounts,
  issuesByField, onToggleCollapse, onMoveUp, onMoveDown, onSelect, onUpdateField,
  onRemoveField, onDuplicateField, onInsertField,
}: {
  section: Section
  index: number
  total: number
  collapsed: boolean
  selectedFieldId: string | null
  controllers: BuilderField[]
  dependentCounts: Map<string, number>
  issuesByField: Map<string, Issue[]>
  onToggleCollapse: () => void
  onMoveUp: () => void
  onMoveDown: () => void
  onSelect: (id: string) => void
  onUpdateField: (id: string, u: Partial<BuilderField>) => void
  onRemoveField: (id: string) => void
  onDuplicateField: (id: string) => void
  onInsertField: (type: FieldType, afterId: string | null) => void
}) {
  const { header } = section
  const isIntro = section.key === INTRO_KEY
  const lastId = section.fields.length ? section.fields[section.fields.length - 1]._id : (header?._id ?? null)

  return (
    <section id={`sec-${section.key}`} className="scroll-mt-4">
      {/* Section header bar */}
      <div className={`flex items-center gap-2 rounded-t-xl border border-hairline px-3 py-2.5 ${header ? 'bg-surface-soft' : 'bg-transparent border-dashed'}`}>
        <button onClick={onToggleCollapse} className="text-ink-faint hover:text-ink flex-shrink-0" title={collapsed ? 'Expand' : 'Collapse'}>
          {collapsed ? <ChevronRight size={15} /> : <ChevronDown size={15} />}
        </button>
        {header ? (
          <input
            value={header.label}
            onChange={(e) => onUpdateField(header._id, { label: e.target.value })}
            placeholder="Section title…"
            className="flex-1 min-w-0 bg-transparent text-[12px] font-semibold uppercase tracking-[0.08em] text-brand-ink outline-none placeholder:text-ink-faint placeholder:normal-case placeholder:tracking-normal"
          />
        ) : (
          <span className="flex-1 min-w-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-faint">Form start</span>
        )}
        <span className="text-[11px] text-ink-faint tabular-nums flex-shrink-0">{section.fields.length}</span>
        {header && (
          <div className="flex items-center gap-0.5 flex-shrink-0">
            <button onClick={onMoveUp} disabled={index === 0} className="p-1 rounded text-ink-faint hover:text-ink hover:bg-surface-strong disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Move section up">
              <ChevronDown size={13} className="rotate-180" />
            </button>
            <button onClick={onMoveDown} disabled={index === total - 1} className="p-1 rounded text-ink-faint hover:text-ink hover:bg-surface-strong disabled:opacity-30 disabled:hover:bg-transparent transition-colors" title="Move section down">
              <ChevronDown size={13} />
            </button>
            <button onClick={() => onRemoveField(header._id)} className="p-1 rounded text-ink-faint hover:text-rose-500 hover:bg-surface-strong transition-colors" title="Delete section (keeps its fields)">
              <Trash2 size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Optional section description (section_header reuses placeholder as blurb) */}
      {header && !collapsed && (
        <input
          value={header.placeholder || ''}
          onChange={(e) => onUpdateField(header._id, { placeholder: e.target.value || null })}
          placeholder="Section description (optional)…"
          className="w-full border-x border-hairline bg-surface px-3 py-2 text-[12px] text-ink-secondary outline-none placeholder:text-ink-faint focus:bg-surface-soft"
        />
      )}

      {!collapsed && (
        <Droppable droppableId={section.key}>
          {(provided, snap) => (
            <div
              ref={provided.innerRef}
              {...provided.droppableProps}
              className={`border-x border-b border-hairline rounded-b-xl bg-surface px-3 py-3 space-y-2 transition-colors ${snap.isDraggingOver ? 'bg-brand-soft' : ''}`}
            >
              {section.fields.length === 0 && (
                <p className="text-[12px] text-ink-faint text-center py-3">Empty section — add a field below.</p>
              )}
              {section.fields.map((field, fi) => (
                <Draggable key={field._id} draggableId={field._id} index={fi}>
                  {(prov, dsnap) => (
                    <div ref={prov.innerRef} {...prov.draggableProps}>
                      <FieldCard
                        field={field}
                        dragHandleProps={prov.dragHandleProps}
                        isDragging={dsnap.isDragging}
                        selected={selectedFieldId === field._id}
                        controllers={controllers}
                        dependentCount={dependentCounts.get(field.label) || 0}
                        fieldIssues={issuesByField.get(field._id) || []}
                        onSelect={() => onSelect(field._id)}
                        onUpdate={(u) => onUpdateField(field._id, u)}
                        onRemove={() => onRemoveField(field._id)}
                        onDuplicate={() => onDuplicateField(field._id)}
                      />
                    </div>
                  )}
                </Draggable>
              ))}
              {provided.placeholder}
              <AddFieldRow onPick={(type) => onInsertField(type, lastId)} />
            </div>
          )}
        </Droppable>
      )}
    </section>
  )
}

// ── One field: WYSIWYG preview + inline editor when selected ──────────────────
function FieldCard({
  field, dragHandleProps, isDragging, selected, controllers, dependentCount,
  fieldIssues, onSelect, onUpdate, onRemove, onDuplicate,
}: {
  field: BuilderField
  dragHandleProps: React.HTMLAttributes<HTMLDivElement> | null | undefined
  isDragging: boolean
  selected: boolean
  controllers: BuilderField[]
  dependentCount: number
  fieldIssues: Issue[]
  onSelect: () => void
  onUpdate: (u: Partial<BuilderField>) => void
  onRemove: () => void
  onDuplicate: () => void
}) {
  const meta = FIELD_TYPE_META[field.field_type]
  const Icon = meta.icon
  const hasIssue = fieldIssues.length > 0

  return (
    <div
      className={`group rounded-lg border bg-surface transition-all ${
        isDragging ? 'shadow-[0_8px_24px_rgba(31,30,27,0.12)]' : ''
      } ${
        selected
          ? 'border-brand ring-1 ring-brand'
          : hasIssue
            ? 'border-amber-300 dark:border-amber-500/40'
            : 'border-hairline hover:border-hairline-strong'
      }`}
    >
      {/* Header row: handle, preview, controls */}
      <div className="flex items-start gap-2 px-3 py-2.5">
        <div {...(dragHandleProps || {})} className="mt-0.5 text-ink-faint hover:text-ink-muted cursor-grab active:cursor-grabbing flex-shrink-0" title="Drag to reorder">
          <GripVertical size={15} />
        </div>

        <button onClick={onSelect} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
            <Icon size={12} className="text-ink-faint flex-shrink-0" />
            <span className="text-[13px] font-medium text-ink truncate">{field.label || <span className="text-ink-faint italic">Untitled</span>}</span>
            {field.is_required && <Asterisk size={11} className="text-brand flex-shrink-0" />}
            {field.show_when_field && (
              <span className="inline-flex items-center gap-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-500/10 dark:text-sky-400 px-1.5 py-0.5 text-[10px] font-medium">
                <GitBranch size={9} />
                {field.show_when_field} = {parseWhenValues(field.show_when_value).join(' / ') || '—'}
              </span>
            )}
            {dependentCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-strong text-ink-muted px-1.5 py-0.5 text-[10px] font-medium" title={`${dependentCount} field(s) depend on this`}>
                <GitBranch size={9} />drives {dependentCount}
              </span>
            )}
          </div>
          <FieldPreview field={field} />
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
          <button onClick={onDuplicate} className="p-1 rounded text-ink-faint hover:text-ink hover:bg-surface-strong transition-colors" title="Duplicate">
            <Copy size={13} />
          </button>
          <button onClick={onRemove} className="p-1 rounded text-ink-faint hover:text-rose-500 hover:bg-surface-strong transition-colors" title="Delete">
            <Trash2 size={13} />
          </button>
          <button onClick={onSelect} className={`p-1 rounded transition-colors ${selected ? 'text-brand' : 'text-ink-faint hover:text-ink hover:bg-surface-strong'}`} title={selected ? 'Close' : 'Edit'}>
            {selected ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          </button>
        </div>
      </div>

      {hasIssue && !selected && (
        <div className="px-3 pb-2 -mt-1 space-y-0.5">
          {fieldIssues.map((i, n) => (
            <p key={n} className="flex items-start gap-1 text-[11px] text-amber-600 dark:text-amber-500">
              <AlertTriangle size={11} className="mt-0.5 flex-shrink-0" />{i.message}
            </p>
          ))}
        </div>
      )}

      {selected && (
        <FieldEditor field={field} controllers={controllers} fieldIssues={fieldIssues} onUpdate={onUpdate} />
      )}
    </div>
  )
}

// ── Read-only WYSIWYG preview of a field's control ────────────────────────────
function FieldPreview({ field }: { field: BuilderField }) {
  const boxCls = 'rounded-lg border border-hairline bg-surface-soft text-[12px] text-ink-faint flex items-center px-3'
  switch (field.field_type) {
    case 'textarea':
      return <div className={`${boxCls} h-14 items-start pt-2`}>{field.placeholder || 'Long answer…'}</div>
    case 'select':
      return (
        <div className={`${boxCls} h-9 justify-between`}>
          <span>{field.placeholder || 'Choose one…'}</span>
          <ChevronDown size={13} />
        </div>
      )
    case 'radio':
    case 'checkbox':
      return (
        <div className="flex flex-wrap gap-1.5">
          {(field.options || []).slice(0, 8).map((o, i) => (
            <span key={i} className="inline-flex items-center gap-1.5 rounded-md border border-hairline bg-surface-soft px-2 py-1 text-[12px] text-ink-secondary">
              <span className={`w-3 h-3 border border-hairline-strong ${field.field_type === 'radio' ? 'rounded-full' : 'rounded-[3px]'}`} />
              {o}
            </span>
          ))}
          {(field.options?.length || 0) === 0 && <span className="text-[12px] text-ink-faint italic">No options yet</span>}
        </div>
      )
    case 'file':
      return <div className={`${boxCls} h-9 border-dashed justify-center`}>Upload a file…</div>
    case 'signature':
      return <div className="rounded-lg border border-dashed border-hairline-strong bg-surface-soft h-12 flex items-end justify-center pb-1 text-[11px] text-ink-faint">✎ Signature</div>
    case 'date':
      return <div className={`${boxCls} h-9 justify-between`}><span>mm / dd / yyyy</span></div>
    default:
      return <div className={`${boxCls} h-9`}>{field.placeholder || `${FIELD_TYPE_META[field.field_type].label}…`}</div>
  }
}

// ── Inline field editor (revealed when a field is selected) ───────────────────
function FieldEditor({
  field, controllers, fieldIssues, onUpdate,
}: {
  field: BuilderField
  controllers: BuilderField[]
  fieldIssues: Issue[]
  onUpdate: (u: Partial<BuilderField>) => void
}) {
  const hasOptions = OPTION_TYPES.has(field.field_type)
  const showsPlaceholder = PLACEHOLDER_TYPES.has(field.field_type) && field.field_type !== 'section_header'
  const inputCls = 'w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand placeholder:text-ink-faint'
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted mb-1'

  const updateOption = (i: number, val: string) => {
    const opts = [...(field.options || [])]; opts[i] = val; onUpdate({ options: opts })
  }
  const addOption = () => onUpdate({ options: [...(field.options || []), `Option ${(field.options?.length || 0) + 1}`] })
  const removeOption = (i: number) => {
    const opts = [...(field.options || [])]; opts.splice(i, 1); onUpdate({ options: opts })
  }

  return (
    <div className="border-t border-hairline bg-surface-soft px-3 py-3 space-y-3 rounded-b-lg">
      {fieldIssues.map((i, n) => (
        <p key={n} className="flex items-start gap-1.5 rounded-md bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400">
          <AlertTriangle size={12} className="mt-0.5 flex-shrink-0" />{i.message}
        </p>
      ))}

      <div className="grid grid-cols-2 gap-2.5">
        <div>
          <label className={labelCls}>Label</label>
          <input value={field.label} onChange={(e) => onUpdate({ label: e.target.value })} className={inputCls} />
        </div>
        {showsPlaceholder && (
          <div>
            <label className={labelCls}>Placeholder</label>
            <input value={field.placeholder || ''} onChange={(e) => onUpdate({ placeholder: e.target.value || null })} className={inputCls} />
          </div>
        )}
        {!showsPlaceholder && (
          <div className="flex items-end justify-between">
            <label className={labelCls}>Required</label>
            <Toggle on={field.is_required} onToggle={() => onUpdate({ is_required: !field.is_required })} />
          </div>
        )}
      </div>

      {showsPlaceholder && (
        <div className="flex items-center justify-between">
          <label className={labelCls + ' mb-0'}>Required</label>
          <Toggle on={field.is_required} onToggle={() => onUpdate({ is_required: !field.is_required })} />
        </div>
      )}

      {hasOptions && (
        <div>
          <label className={labelCls}>Options</label>
          <div className="space-y-1.5">
            {(field.options || []).map((opt, i) => (
              <div key={i} className="flex items-center gap-1.5">
                <input value={opt} onChange={(e) => updateOption(i, e.target.value)} className={inputCls} />
                <button onClick={() => removeOption(i)} className="text-ink-faint hover:text-rose-500 flex-shrink-0 p-1" title="Remove option">
                  <X size={13} />
                </button>
              </div>
            ))}
          </div>
          <button onClick={addOption} className="mt-1.5 flex items-center gap-1 text-[12px] font-medium text-brand-ink hover:underline">
            <Plus size={12} /> Add option
          </button>
        </div>
      )}

      <LogicEditor field={field} controllers={controllers} onUpdate={onUpdate} />
    </div>
  )
}

// ── Conditional-logic editor with multi-value ("any of") support ──────────────
function LogicEditor({
  field, controllers, onUpdate,
}: {
  field: BuilderField
  controllers: BuilderField[]
  onUpdate: (u: Partial<BuilderField>) => void
}) {
  const available = controllers.filter((c) => c._id !== field._id)
  const controller = available.find((c) => c.label === field.show_when_field)
    // fall back so a condition pointing at an out-of-scope/renamed field is still shown
    || (field.show_when_field ? controllers.find((c) => c.label === field.show_when_field) : undefined)
  const selectedValues = parseWhenValues(field.show_when_value)
  const inputCls = 'w-full rounded-md border border-hairline bg-surface px-2.5 py-1.5 text-[13px] text-ink outline-none focus:border-brand'
  const labelCls = 'block text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted mb-1'

  const setController = (label: string | null) => {
    if (!label) { onUpdate({ show_when_field: null, show_when_value: null }); return }
    const c = available.find((f) => f.label === label)
    onUpdate({ show_when_field: label, show_when_value: c?.options?.[0] ?? null })
  }

  const toggleValue = (val: string) => {
    const next = selectedValues.includes(val)
      ? selectedValues.filter((v) => v !== val)
      : [...selectedValues, val]
    onUpdate({ show_when_value: joinWhenValues(next) })
  }

  const opts = controller?.options || []

  return (
    <div className="rounded-md border border-hairline bg-surface px-2.5 py-2.5">
      <div className="flex items-center gap-1.5 mb-2">
        <GitBranch size={12} className="text-ink-muted" />
        <span className={labelCls + ' mb-0'}>Conditional logic</span>
      </div>

      {available.length === 0 && !field.show_when_field ? (
        <p className="text-[11px] text-ink-faint">Add a Dropdown or Single-Choice field (with options) to drive this field&apos;s visibility.</p>
      ) : (
        <div className="space-y-2">
          <select value={field.show_when_field || ''} onChange={(e) => setController(e.target.value || null)} className={inputCls}>
            <option value="">Always show this field</option>
            {available.map((c) => (
              <option key={c._id} value={c.label}>Show when “{c.label}” is…</option>
            ))}
            {field.show_when_field && !available.some((c) => c.label === field.show_when_field) && (
              <option value={field.show_when_field}>Show when “{field.show_when_field}” is… (missing)</option>
            )}
          </select>

          {field.show_when_field && (
            <>
              {opts.length > 0 ? (
                <div>
                  <p className="text-[10px] text-ink-muted mb-1">Show when the answer is any of:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {opts.map((o) => {
                      const on = selectedValues.includes(o)
                      return (
                        <button
                          key={o}
                          onClick={() => toggleValue(o)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium border transition-colors ${
                            on
                              ? 'bg-brand text-white border-brand'
                              : 'bg-surface text-ink-secondary border-hairline hover:border-hairline-strong'
                          }`}
                        >
                          {on && <Check size={11} />}{o}
                        </button>
                      )
                    })}
                  </div>
                  {/* Any selected values the controller no longer offers (stale). */}
                  {selectedValues.filter((v) => !opts.includes(v)).map((v) => (
                    <button key={v} onClick={() => toggleValue(v)} className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-1 text-[12px] font-medium border border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400">
                      <X size={11} />{v} (unavailable)
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-amber-600 dark:text-amber-500">“{field.show_when_field}” has no options to match against.</p>
              )}
              {selectedValues.length > 0 && opts.length > 0 && (
                <p className="text-[11px] text-ink-muted">
                  Shows when <span className="font-medium text-ink-secondary">{field.show_when_field}</span> is{' '}
                  <span className="font-medium text-ink-secondary">{selectedValues.join(' or ')}</span>.
                </p>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Small building blocks ─────────────────────────────────────────────────────
function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
  return (
    <button
      onClick={onToggle}
      className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${on ? 'bg-brand' : 'bg-surface-strong'}`}
      role="switch"
      aria-checked={on}
    >
      <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${on ? 'translate-x-4' : 'translate-x-0'}`} />
    </button>
  )
}

function AddFieldRow({ onPick }: { onPick: (type: FieldType) => void }) {
  return (
    <div className="pt-1">
      <AddFieldMenu onPick={onPick} trigger={
        <span className="flex items-center justify-center gap-1.5 w-full rounded-lg border border-dashed border-hairline-strong py-2 text-[12px] font-medium text-ink-muted hover:text-brand-ink hover:border-brand transition-colors">
          <Plus size={13} /> Add field
        </span>
      } />
    </div>
  )
}

function AddSectionRow({ onAdd }: { onAdd: () => void }) {
  return (
    <button
      onClick={onAdd}
      className="flex items-center justify-center gap-1.5 w-full rounded-xl border border-dashed border-hairline-strong py-2.5 text-[12px] font-medium text-ink-muted hover:text-brand-ink hover:border-brand transition-colors"
    >
      <Plus size={13} /> Add section
    </button>
  )
}

function AddFieldMenu({ onPick, trigger }: { onPick: (type: FieldType) => void; trigger: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button onClick={() => setOpen((o) => !o)} className="w-full">{trigger}</button>
      {open && (
        <div className="absolute z-20 mt-1 left-0 right-0 max-w-xs rounded-lg border border-hairline bg-surface shadow-[0_8px_24px_rgba(31,30,27,0.12)] p-1.5 grid grid-cols-2 gap-0.5">
          {FIELD_TYPES.filter((t) => t.type !== 'section_header').map((t) => (
            <button
              key={t.type}
              onClick={() => { onPick(t.type); setOpen(false) }}
              className="flex items-center gap-2 px-2.5 py-2 rounded-md text-left hover:bg-surface-strong transition-colors"
            >
              <t.icon size={14} className="text-ink-muted flex-shrink-0" />
              <span className="text-[12px] text-ink-secondary truncate">{t.label}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
