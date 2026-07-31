'use client'

import {
  useCallback, useEffect, useMemo, useRef, useState,
  type ChangeEvent, type ReactNode,
} from 'react'
import {
  AlertTriangle, Download, FileJson, ImageIcon, ImagePlus, Layers, MousePointerClick,
  Plus, RotateCcw, Settings2, Trash2, Upload, X,
} from 'lucide-react'
import PageChrome from '../PageChrome'
import DiagramCanvas, { serializeSvg, svgToPngBlob, type Selection } from './DiagramCanvas'
import { resizeImage } from '@/lib/image-resize'
import {
  DEFAULT_TEMPLATE_ID, FILE_VERSION, STORAGE_KEY, TEMPLATES, TONES, TONE_KEYS, TONE_LABELS,
  buildScene, fileSlug, newId, nodeLabel, parseDiagramFile, templateById,
  type Callout, type DiagramNode, type Note, type Scene, type Tone,
} from '@/lib/diagrams'

/* Application Diagram Studio — build the airflow figures that go into proposals.
 *
 * Pure client-side, like the Sizing Studio: no reads, no writes, no server
 * actions. Work lives in localStorage and travels as a .json file, which is why
 * this page can ship without a table behind it. DB-backed saving is the obvious
 * next step (see docs/diagram-studio.md) and would slot in where the autosave
 * effect is.
 *
 * The local Field/Input/Select primitives follow DESIGN.md §6 and should graduate
 * into components/ui/ when the shared kit lands (DESIGN.md Phase 1) — same note
 * the Sizing Studio carries.
 */

type Tab = 'edit' | 'figure' | 'elements'

export default function DiagramStudio() {
  const [templateId, setTemplateId] = useState(DEFAULT_TEMPLATE_ID)
  const [scene, setScene] = useState<Scene>(() => buildScene(DEFAULT_TEMPLATE_ID))
  const [selected, setSelected] = useState<Selection>(null)
  const [tab, setTab] = useState<Tab>('figure')
  const [hydrated, setHydrated] = useState(false)
  const [fit, setFit] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pendingTemplate, setPendingTemplate] = useState<string | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const photoInput = useRef<HTMLInputElement | null>(null)
  const jsonInput = useRef<HTMLInputElement | null>(null)
  /** Whether the scene has been touched since it was loaded from a template. */
  const dirty = useRef(false)

  // ── persistence ────────────────────────────────────────────────────────────

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY)
      const file = raw ? parseDiagramFile(raw) : null
      if (file) {
        setTemplateId(file.templateId)
        setScene(file.scene)
        dirty.current = true
      }
    } catch {
      // A corrupt or unreadable entry just means we start from the template.
    }
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated) return
    const t = window.setTimeout(() => {
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: FILE_VERSION, templateId, scene }))
      } catch {
        // Quota — almost always an oversized photo. The figure is still on
        // screen and still exportable, so this is not worth interrupting for.
      }
    }, 500)
    return () => window.clearTimeout(t)
  }, [scene, templateId, hydrated])

  // ── scene mutation ─────────────────────────────────────────────────────────

  const mutate = useCallback((fn: (s: Scene) => Scene) => {
    dirty.current = true
    setScene(fn)
  }, [])

  const patchScene = useCallback((patch: Partial<Scene>) => mutate((s) => ({ ...s, ...patch })), [mutate])

  const patchCallout = useCallback((id: string, patch: Partial<Callout>) => {
    mutate((s) => ({ ...s, callouts: s.callouts.map((c) => (c.id === id ? { ...c, ...patch } : c)) }))
  }, [mutate])

  const patchNote = useCallback((id: string, patch: Partial<Note>) => {
    mutate((s) => ({ ...s, notes: s.notes.map((n) => (n.id === id ? { ...n, ...patch } : n)) }))
  }, [mutate])

  const patchNode = useCallback((id: string, patch: Partial<DiagramNode>) => {
    mutate((s) => ({
      ...s,
      nodes: s.nodes.map((n) => (n.id === id ? ({ ...n, ...patch } as DiagramNode) : n)),
    }))
  }, [mutate])

  const select = useCallback((s: Selection) => {
    setSelected(s)
    if (s) setTab('edit')
  }, [])

  const loadTemplate = useCallback((id: string) => {
    setTemplateId(id)
    setScene(buildScene(id))
    setSelected(null)
    setTab('figure')
    setPendingTemplate(null)
    setConfirmReset(false)
    dirty.current = false
  }, [])

  const requestTemplate = useCallback((id: string) => {
    if (id === templateId) return
    if (dirty.current) setPendingTemplate(id)
    else loadTemplate(id)
  }, [templateId, loadTemplate])

  // ── element add / remove ───────────────────────────────────────────────────

  const addCallout = useCallback(() => {
    const c: Callout = {
      id: newId('c'), title: 'New callout', tone: 'supply',
      x: 820, y: 200, w: 196,
      rows: [{ value: '00.0', unit: '°F DB' }],
      anchor: null,
    }
    mutate((s) => ({ ...s, callouts: [...s.callouts, c] }))
    select({ type: 'callout', id: c.id })
  }, [mutate, select])

  const duplicateCallout = useCallback((id: string) => {
    mutate((s) => {
      const src = s.callouts.find((c) => c.id === id)
      if (!src) return s
      const copy: Callout = {
        ...src,
        id: newId('c'),
        x: Math.min(src.x + 40, 1800),
        y: Math.min(src.y + 40, 1000),
        rows: src.rows.map((r) => ({ ...r })),
        anchor: null,
      }
      return { ...s, callouts: [...s.callouts, copy] }
    })
  }, [mutate])

  const removeCallout = useCallback((id: string) => {
    mutate((s) => ({ ...s, callouts: s.callouts.filter((c) => c.id !== id) }))
    setSelected(null)
  }, [mutate])

  const addNote = useCallback(() => {
    const n: Note = {
      id: newId('n'), x: 1000, y: 250, text: 'New label',
      tone: 'slate', size: 17, weight: 600, align: 'middle', caps: true, ellipse: false,
    }
    mutate((s) => ({ ...s, notes: [...s.notes, n] }))
    select({ type: 'note', id: n.id })
  }, [mutate, select])

  const removeNote = useCallback((id: string) => {
    mutate((s) => ({ ...s, notes: s.notes.filter((n) => n.id !== id) }))
    setSelected(null)
  }, [mutate])

  // ── photo ──────────────────────────────────────────────────────────────────

  const roomNode = useMemo(
    () => scene.nodes.find((n): n is Extract<DiagramNode, { kind: 'room' }> => n.kind === 'room'),
    [scene.nodes],
  )

  const onPhotoPick = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !roomNode) return
    setError(null)
    setBusy('photo')
    try {
      // Downscaled before it ever reaches the scene: the data URL is embedded in
      // the SVG, autosaved to localStorage AND base64'd again for the PNG export,
      // so a 12MB phone original would blow the storage quota three ways.
      const { dataUrl } = await resizeImage(file, { maxDim: 1400, quality: 0.85 })
      patchNode(roomNode.id, { photo: dataUrl })
    } catch {
      setError('That image could not be read. HEIC photos need converting to JPEG or PNG first.')
    } finally {
      setBusy(null)
    }
  }, [roomNode, patchNode])

  // ── export / import ────────────────────────────────────────────────────────

  const download = useCallback((blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  }, [])

  const exportPng = useCallback(async () => {
    if (!svgRef.current) return
    setError(null)
    setBusy('png')
    try {
      const blob = await svgToPngBlob(svgRef.current, 2)
      download(blob, `${fileSlug(scene)}.png`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The PNG export failed.')
    } finally {
      setBusy(null)
    }
  }, [scene, download])

  const exportSvg = useCallback(() => {
    if (!svgRef.current) return
    const blob = new Blob([serializeSvg(svgRef.current)], { type: 'image/svg+xml;charset=utf-8' })
    download(blob, `${fileSlug(scene)}.svg`)
  }, [scene, download])

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify({ version: FILE_VERSION, templateId, scene }, null, 2)], {
      type: 'application/json',
    })
    download(blob, `${fileSlug(scene)}.json`)
  }, [scene, templateId, download])

  const onJsonPick = useCallback(async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setError(null)
    const parsed = parseDiagramFile(await file.text())
    if (!parsed) {
      setError('That file is not a diagram export. Open a .json saved from this page.')
      return
    }
    setTemplateId(parsed.templateId)
    setScene(parsed.scene)
    setSelected(null)
    setTab('figure')
    dirty.current = true
  }, [])

  // ── render ─────────────────────────────────────────────────────────────────

  const template = templateById(templateId)

  return (
    <>
      <PageChrome record="Application Diagrams">
        <button type="button" onClick={() => setConfirmReset(true)} className={btnSecondary}>
          <RotateCcw size={15} strokeWidth={1.75} />
          Reset
        </button>
        <button type="button" onClick={exportPng} disabled={busy === 'png'} className={btnPrimary}>
          <Download size={15} strokeWidth={1.75} />
          {busy === 'png' ? 'Rendering…' : 'Download PNG'}
        </button>
      </PageChrome>

      <div className="flex-1 overflow-y-auto bg-canvas">
        <div className="mx-auto max-w-[1720px] px-6 py-6">
          <header className="mb-6 animate-fade-up">
            <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">Sales</p>
            <h1 className="mt-1 text-[24px] font-semibold tracking-[-0.02em] text-ink">Application Diagrams</h1>
            <p className="mt-1 max-w-[68ch] text-[13px] text-ink-secondary">
              Build the airflow figure for a proposal. Pick the application, edit every condition on
              the drawing, drop in a photo of the space, and export a PNG to drop straight into the
              submittal.
            </p>
          </header>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
            <div className="min-w-0 space-y-4">
              {/* Application picker — the control that changes the whole layout */}
              <div className="rounded-xl border border-hairline bg-surface p-4">
                <div className="flex flex-wrap items-end gap-4">
                  <div className="min-w-[280px] flex-1">
                    <label htmlFor="dgm-app" className={labelCx}>Application</label>
                    <select
                      id="dgm-app"
                      value={templateId}
                      onChange={(e) => requestTemplate(e.target.value)}
                      className={`${inputCx} pr-8`}
                    >
                      {TEMPLATES.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <p className="min-w-[220px] flex-[2] pb-2 text-[12px] text-ink-muted">{template.blurb}</p>
                  <div className="flex items-center gap-2 pb-0.5">
                    <button type="button" onClick={() => setFit((v) => !v)} className={btnGhost}>
                      {fit ? 'Actual size' : 'Fit width'}
                    </button>
                    <button type="button" onClick={exportSvg} className={btnGhost}>
                      <ImageIcon size={15} strokeWidth={1.75} />
                      SVG
                    </button>
                    <button type="button" onClick={exportJson} className={btnGhost}>
                      <FileJson size={15} strokeWidth={1.75} />
                      Save file
                    </button>
                    <button type="button" onClick={() => jsonInput.current?.click()} className={btnGhost}>
                      <Upload size={15} strokeWidth={1.75} />
                      Open
                    </button>
                  </div>
                </div>

                {pendingTemplate && (
                  <InlineConfirm
                    tone="amber"
                    message={`Switch to “${templateById(pendingTemplate).name}”? This replaces the figure you have been editing.`}
                    confirmLabel="Switch application"
                    onConfirm={() => loadTemplate(pendingTemplate)}
                    onCancel={() => setPendingTemplate(null)}
                  />
                )}
                {confirmReset && (
                  <InlineConfirm
                    tone="rose"
                    message={`Reset every value back to the “${template.name}” defaults? Your edits and photo are discarded.`}
                    confirmLabel="Reset figure"
                    onConfirm={() => loadTemplate(templateId)}
                    onCancel={() => setConfirmReset(false)}
                  />
                )}
                {error && (
                  <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-[12px] text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400">
                    <AlertTriangle size={15} strokeWidth={1.75} className="mt-px flex-shrink-0" />
                    <span className="flex-1">{error}</span>
                    <button type="button" onClick={() => setError(null)} aria-label="Dismiss">
                      <X size={14} strokeWidth={2} />
                    </button>
                  </div>
                )}
              </div>

              {/* Artboard */}
              <div className="overflow-x-auto rounded-xl border border-hairline bg-surface p-4">
                <div style={fit ? undefined : { width: 2000 }}>
                  <DiagramCanvas
                    scene={scene}
                    selected={selected}
                    onSelect={select}
                    onMoveCallout={(id, x, y) => patchCallout(id, { x, y })}
                    onMoveAnchor={(id, anchor) => patchCallout(id, { anchor })}
                    onMoveNote={(id, x, y) => patchNote(id, { x, y })}
                    svgRef={svgRef}
                  />
                </div>
              </div>

              <p className="flex items-center gap-1.5 text-[12px] text-ink-muted">
                <MousePointerClick size={14} strokeWidth={1.75} />
                Click any card, label or piece of equipment to edit it — drag cards and labels to
                move them. The exported PNG never shows the selection outline.
              </p>
            </div>

            {/* Inspector */}
            <div className="xl:sticky xl:top-6 xl:self-start">
              <div className="rounded-xl border border-hairline bg-surface">
                <div className="flex gap-1 border-b border-hairline px-3">
                  <TabButton active={tab === 'edit'} onClick={() => setTab('edit')} icon={<MousePointerClick size={14} strokeWidth={1.75} />}>Selection</TabButton>
                  <TabButton active={tab === 'figure'} onClick={() => setTab('figure')} icon={<Settings2 size={14} strokeWidth={1.75} />}>Figure</TabButton>
                  <TabButton active={tab === 'elements'} onClick={() => setTab('elements')} icon={<Layers size={14} strokeWidth={1.75} />}>Elements</TabButton>
                </div>

                <div className="max-h-[calc(100vh-190px)] overflow-y-auto px-5 py-4">
                  {tab === 'edit' && (
                    <SelectionPanel
                      scene={scene}
                      selected={selected}
                      patchCallout={patchCallout}
                      patchNote={patchNote}
                      patchNode={patchNode}
                      removeCallout={removeCallout}
                      removeNote={removeNote}
                      duplicateCallout={duplicateCallout}
                      onPickPhoto={() => photoInput.current?.click()}
                      photoBusy={busy === 'photo'}
                    />
                  )}
                  {tab === 'figure' && (
                    <FigurePanel
                      scene={scene}
                      patchScene={patchScene}
                      room={roomNode}
                      patchNode={patchNode}
                      onPickPhoto={() => photoInput.current?.click()}
                      photoBusy={busy === 'photo'}
                    />
                  )}
                  {tab === 'elements' && (
                    <ElementsPanel
                      scene={scene}
                      selected={selected}
                      onSelect={select}
                      addCallout={addCallout}
                      addNote={addNote}
                    />
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={onPhotoPick} />
      <input ref={jsonInput} type="file" accept="application/json,.json" className="hidden" onChange={onJsonPick} />
    </>
  )
}

// ─── Inspector: contextual selection ─────────────────────────────────────────

function SelectionPanel({
  scene, selected, patchCallout, patchNote, patchNode, removeCallout, removeNote,
  duplicateCallout, onPickPhoto, photoBusy,
}: {
  scene: Scene
  selected: Selection
  patchCallout: (id: string, p: Partial<Callout>) => void
  patchNote: (id: string, p: Partial<Note>) => void
  patchNode: (id: string, p: Partial<DiagramNode>) => void
  removeCallout: (id: string) => void
  removeNote: (id: string) => void
  duplicateCallout: (id: string) => void
  onPickPhoto: () => void
  photoBusy: boolean
}) {
  if (!selected) {
    return (
      <EmptyState
        icon={<MousePointerClick size={18} strokeWidth={1.75} />}
        title="Nothing selected"
        body="Click a value card, a label or a piece of equipment on the drawing and its settings appear here."
      />
    )
  }

  if (selected.type === 'callout') {
    const c = scene.callouts.find((x) => x.id === selected.id)
    if (!c) return <EmptyState icon={<MousePointerClick size={18} strokeWidth={1.75} />} title="Nothing selected" body="That card was removed." />
    const setRow = (i: number, patch: Partial<{ value: string; unit: string }>) =>
      patchCallout(c.id, { rows: c.rows.map((r, j) => (j === i ? { ...r, ...patch } : r)) })

    return (
      <div className="space-y-4">
        <PanelHead label="Value card" />
        <Field label="Title">
          <input className={inputCx} value={c.title} onChange={(e) => patchCallout(c.id, { title: e.target.value })} />
        </Field>
        <ToneField value={c.tone} onChange={(tone) => patchCallout(c.id, { tone })} />

        <div>
          <p className={labelCx}>Rows</p>
          <div className="space-y-2">
            {c.rows.map((r, i) => (
              // Widths live on the wrappers, not the inputs: inputCx carries
              // w-full, which as a flex item resolves to a 100% basis and lets
              // the unit box squeeze the value box down to nothing.
              <div key={i} className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <input
                    className={`${inputCx} tabular-nums`}
                    value={r.value}
                    aria-label={`Row ${i + 1} value`}
                    onChange={(e) => setRow(i, { value: e.target.value })}
                  />
                </div>
                <div className="w-24 flex-shrink-0">
                  <input
                    className={inputCx}
                    value={r.unit}
                    aria-label={`Row ${i + 1} unit`}
                    onChange={(e) => setRow(i, { unit: e.target.value })}
                  />
                </div>
                <button
                  type="button"
                  aria-label={`Remove row ${i + 1}`}
                  onClick={() => patchCallout(c.id, { rows: c.rows.filter((_, j) => j !== i) })}
                  className={iconBtn}
                >
                  <Trash2 size={14} strokeWidth={1.75} />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => patchCallout(c.id, { rows: [...c.rows, { value: '0', unit: 'CFM' }] })}
            className={`${btnGhost} mt-2`}
          >
            <Plus size={14} strokeWidth={2} />
            Add row
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Card width">
            <input
              type="number" min={120} max={520} step={4}
              className={`${inputCx} tabular-nums`}
              value={c.w}
              onChange={(e) => patchCallout(c.id, { w: clamp(Number(e.target.value) || 196, 120, 520) })}
            />
          </Field>
          <Field label="Leader line">
            <button
              type="button"
              onClick={() => patchCallout(c.id, { anchor: c.anchor ? null : [c.x + c.w + 90, c.y + 60] })}
              className={`${inputCx} text-left`}
            >
              {c.anchor ? 'On — drag the dot' : 'Off'}
            </button>
          </Field>
        </div>

        <div className="flex items-center gap-2 border-t border-hairline pt-4">
          <button type="button" onClick={() => duplicateCallout(c.id)} className={btnSecondary}>Duplicate</button>
          <button type="button" onClick={() => removeCallout(c.id)} className={btnDanger}>
            <Trash2 size={15} strokeWidth={1.75} />
            Delete card
          </button>
        </div>
      </div>
    )
  }

  if (selected.type === 'note') {
    const n = scene.notes.find((x) => x.id === selected.id)
    if (!n) return <EmptyState icon={<MousePointerClick size={18} strokeWidth={1.75} />} title="Nothing selected" body="That label was removed." />
    return (
      <div className="space-y-4">
        <PanelHead label="Label" />
        <Field label="Text" hint="Enter starts a new line.">
          <textarea
            rows={2}
            className={`${inputCx} h-auto py-2 leading-relaxed`}
            value={n.text}
            onChange={(e) => patchNote(n.id, { text: e.target.value })}
          />
        </Field>
        <ToneField value={n.tone} onChange={(tone) => patchNote(n.id, { tone })} />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Size">
            <input
              type="number" min={10} max={40}
              className={`${inputCx} tabular-nums`}
              value={n.size}
              onChange={(e) => patchNote(n.id, { size: clamp(Number(e.target.value) || 17, 10, 40) })}
            />
          </Field>
          <Field label="Align">
            <select className={inputCx} value={n.align} onChange={(e) => patchNote(n.id, { align: e.target.value as Note['align'] })}>
              <option value="start">Left</option>
              <option value="middle">Centre</option>
              <option value="end">Right</option>
            </select>
          </Field>
        </div>
        <Checkbox checked={n.caps} onChange={(caps) => patchNote(n.id, { caps })} label="Small caps" />
        <Checkbox checked={n.ellipse} onChange={(ellipse) => patchNote(n.id, { ellipse })} label="Circle it (callout annotation)" />
        <div className="border-t border-hairline pt-4">
          <button type="button" onClick={() => removeNote(n.id)} className={btnDanger}>
            <Trash2 size={15} strokeWidth={1.75} />
            Delete label
          </button>
        </div>
      </div>
    )
  }

  const node = scene.nodes.find((x) => x.id === selected.id)
  if (!node) return <EmptyState icon={<MousePointerClick size={18} strokeWidth={1.75} />} title="Nothing selected" body="That block is not on this figure." />

  return (
    <div className="space-y-4">
      <PanelHead label={nodeLabel(node)} />

      {node.kind === 'desiccant' && (
        <>
          <Field label="Upper chamber">
            <input className={inputCx} value={node.topLabel} onChange={(e) => patchNode(node.id, { topLabel: e.target.value } as Partial<DiagramNode>)} />
          </Field>
          <Field label="Lower chamber">
            <input className={inputCx} value={node.bottomLabel} onChange={(e) => patchNode(node.id, { bottomLabel: e.target.value } as Partial<DiagramNode>)} />
          </Field>
          <Checkbox checked={node.rotor} onChange={(rotor) => patchNode(node.id, { rotor } as Partial<DiagramNode>)} label="Show desiccant rotor" />
          <Checkbox checked={node.precool} onChange={(precool) => patchNode(node.id, { precool } as Partial<DiagramNode>)} label="Show precooling coil" />
        </>
      )}

      {node.kind === 'ahu' && (
        <>
          <div>
            <p className={labelCx}>Sections</p>
            <div className="space-y-2">
              {node.sections.map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <input
                      className={inputCx}
                      aria-label={`Section ${i + 1} label`}
                      value={s.label}
                      onChange={(e) => patchNode(node.id, {
                        sections: node.sections.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                      } as Partial<DiagramNode>)}
                    />
                  </div>
                  <div className="w-28 flex-shrink-0">
                    <select
                      className={inputCx}
                      aria-label={`Section ${i + 1} symbol`}
                      value={s.icon}
                      onChange={(e) => patchNode(node.id, {
                        sections: node.sections.map((x, j) => (j === i ? { ...x, icon: e.target.value as 'none' | 'fan' | 'coil' } : x)),
                      } as Partial<DiagramNode>)}
                    >
                      <option value="none">Filter</option>
                      <option value="fan">Fan</option>
                      <option value="coil">Coil</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <Checkbox checked={node.inlet} onChange={(inlet) => patchNode(node.id, { inlet } as Partial<DiagramNode>)} label="Show mixing plenum" />
          <Checkbox checked={node.underCoil} onChange={(underCoil) => patchNode(node.id, { underCoil } as Partial<DiagramNode>)} label="Show coil below the shell" />
        </>
      )}

      {node.kind === 'box' && (
        <>
          <Field label="Title">
            <input className={inputCx} value={node.title} onChange={(e) => patchNode(node.id, { title: e.target.value } as Partial<DiagramNode>)} />
          </Field>
          <Field label="Subtitle">
            <input className={inputCx} value={node.subtitle} onChange={(e) => patchNode(node.id, { subtitle: e.target.value } as Partial<DiagramNode>)} />
          </Field>
          <ToneField value={node.tone} onChange={(tone) => patchNode(node.id, { tone } as Partial<DiagramNode>)} />
        </>
      )}

      {node.kind === 'room' && (
        <RoomFields node={node} patchNode={patchNode} onPickPhoto={onPickPhoto} photoBusy={photoBusy} />
      )}
    </div>
  )
}

function RoomFields({
  node, patchNode, onPickPhoto, photoBusy,
}: {
  node: Extract<DiagramNode, { kind: 'room' }>
  patchNode: (id: string, p: Partial<DiagramNode>) => void
  onPickPhoto: () => void
  photoBusy: boolean
}) {
  return (
    <>
      <Field label="Caption" hint="Printed under the photo in small caps.">
        <input className={inputCx} value={node.caption} onChange={(e) => patchNode(node.id, { caption: e.target.value } as Partial<DiagramNode>)} />
      </Field>
      <div>
        <p className={labelCx}>Photo of the space</p>
        {node.photo ? (
          // Scene photos are user-supplied data URLs, so next/image would have
          // nothing to optimise and would need an unoptimized escape hatch anyway.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={node.photo} alt="" className="mb-2 h-32 w-full rounded-lg border border-hairline object-cover" />
        ) : (
          <div className="mb-2 flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-hairline-strong bg-surface-soft text-[12px] text-ink-muted">
            No photo yet
          </div>
        )}
        <div className="flex items-center gap-2">
          <button type="button" onClick={onPickPhoto} disabled={photoBusy} className={btnSecondary}>
            <ImagePlus size={15} strokeWidth={1.75} />
            {photoBusy ? 'Reading…' : node.photo ? 'Replace' : 'Upload photo'}
          </button>
          {node.photo && (
            <button type="button" onClick={() => patchNode(node.id, { photo: null } as Partial<DiagramNode>)} className={btnGhost}>
              Remove
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[12px] text-ink-muted">
          Resized to 1400px on upload. JPEG or PNG — HEIC needs converting first.
        </p>
      </div>
    </>
  )
}

// ─── Inspector: figure-level settings ────────────────────────────────────────

function FigurePanel({
  scene, patchScene, room, patchNode, onPickPhoto, photoBusy,
}: {
  scene: Scene
  patchScene: (p: Partial<Scene>) => void
  room: Extract<DiagramNode, { kind: 'room' }> | undefined
  patchNode: (id: string, p: Partial<DiagramNode>) => void
  onPickPhoto: () => void
  photoBusy: boolean
}) {
  return (
    <div className="space-y-4">
      <PanelHead label="Header" />
      <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
        <Field label="Figure no.">
          <input className={inputCx} value={scene.figure} onChange={(e) => patchScene({ figure: e.target.value })} />
        </Field>
        <Field label="Right-hand eyebrow">
          <input className={inputCx} value={scene.eyebrow} onChange={(e) => patchScene({ eyebrow: e.target.value })} />
        </Field>
      </div>
      <Field label="Title">
        <input className={inputCx} value={scene.title} onChange={(e) => patchScene({ title: e.target.value })} />
      </Field>

      <div className="border-t border-hairline pt-4">
        <PanelHead label="Photo" />
        {room ? (
          <div className="mt-3">
            <RoomFields node={room} patchNode={patchNode} onPickPhoto={onPickPhoto} photoBusy={photoBusy} />
          </div>
        ) : (
          <p className="mt-2 text-[12px] text-ink-muted">This application has no photo block.</p>
        )}
      </div>

      <div className="border-t border-hairline pt-4">
        <PanelHead label="Footer" />
        <div className="mt-3 space-y-4">
          <Field label="Abbreviation key" hint="Right-hand footer line.">
            <textarea
              rows={2}
              className={`${inputCx} h-auto py-2 leading-relaxed`}
              value={scene.footnote}
              onChange={(e) => patchScene({ footnote: e.target.value })}
            />
          </Field>
          <div>
            <p className={labelCx}>Airflow key</p>
            <div className="space-y-2">
              {scene.legend.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="h-4 w-7 flex-shrink-0 rounded" style={{ background: TONES[item.tone].fill }} />
                  <div className="min-w-0 flex-1">
                    <input
                      className={inputCx}
                      aria-label={`Key ${i + 1} label`}
                      value={item.label}
                      onChange={(e) => patchScene({
                        legend: scene.legend.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
                      })}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove key ${i + 1}`}
                    onClick={() => patchScene({ legend: scene.legend.filter((_, j) => j !== i) })}
                    className={iconBtn}
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                </div>
              ))}
            </div>
          </div>
          <Checkbox checked={scene.showGrid} onChange={(showGrid) => patchScene({ showGrid })} label="Background grid" />
        </div>
      </div>
    </div>
  )
}

// ─── Inspector: element list ─────────────────────────────────────────────────

function ElementsPanel({
  scene, selected, onSelect, addCallout, addNote,
}: {
  scene: Scene
  selected: Selection
  onSelect: (s: Selection) => void
  addCallout: () => void
  addNote: () => void
}) {
  const rowCx = (active: boolean) =>
    `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition-colors ${
      active ? 'bg-brand-soft text-ink' : 'text-ink-secondary hover:bg-surface-soft hover:text-ink'
    }`

  return (
    <div className="space-y-5">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <PanelHead label={`Value cards · ${scene.callouts.length}`} />
          <button type="button" onClick={addCallout} className={btnGhost}>
            <Plus size={14} strokeWidth={2} />
            Add
          </button>
        </div>
        <div className="space-y-0.5">
          {scene.callouts.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onSelect({ type: 'callout', id: c.id })}
              className={rowCx(selected?.type === 'callout' && selected.id === c.id)}
            >
              <span className="h-3.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: TONES[c.tone].fill }} />
              <span className="flex-1 truncate">{c.title || 'Untitled'}</span>
              <span className="flex-shrink-0 text-[12px] tabular-nums text-ink-muted">{c.rows.length}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <PanelHead label={`Labels · ${scene.notes.length}`} />
          <button type="button" onClick={addNote} className={btnGhost}>
            <Plus size={14} strokeWidth={2} />
            Add
          </button>
        </div>
        <div className="space-y-0.5">
          {scene.notes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect({ type: 'note', id: n.id })}
              className={rowCx(selected?.type === 'note' && selected.id === n.id)}
            >
              <span className="h-3.5 w-1.5 flex-shrink-0 rounded-full" style={{ background: TONES[n.tone].fill }} />
              <span className="flex-1 truncate">{n.text.replace(/\n/g, ' · ')}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <PanelHead label={`Equipment · ${scene.nodes.length}`} />
        <p className="mb-2 mt-1 text-[12px] text-ink-muted">
          Equipment placement and the airflow arrows come from the application template — pick a
          different application to change them.
        </p>
        <div className="space-y-0.5">
          {scene.nodes.map((n) => (
            <button
              key={n.id}
              type="button"
              onClick={() => onSelect({ type: 'node', id: n.id })}
              className={rowCx(selected?.type === 'node' && selected.id === n.id)}
            >
              <span className="flex-1 truncate">{nodeLabel(n)}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Local primitives (DESIGN.md §6) ─────────────────────────────────────────

const inputCx =
  'h-9 w-full rounded-lg border border-hairline bg-surface px-2.5 text-[13px] text-ink transition-colors placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

const labelCx = 'mb-1.5 block text-[12px] font-medium text-ink-secondary'

const btnBase =
  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60'

const btnPrimary = `${btnBase} bg-brand px-3.5 text-white hover:bg-brand-hover active:scale-[0.98]`
const btnSecondary = `${btnBase} border border-hairline-strong bg-surface text-ink-secondary hover:bg-surface-soft hover:text-ink`
const btnGhost = `${btnBase} h-8 px-2.5 text-ink-muted hover:bg-surface-strong hover:text-ink`
const btnDanger = `${btnBase} border border-hairline-strong bg-surface text-rose-600 hover:bg-surface-soft dark:text-rose-400`
const iconBtn =
  'flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg text-ink-muted transition-colors hover:bg-surface-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand'

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <label className={labelCx}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-[12px] text-ink-muted">{hint}</p>}
    </div>
  )
}

function PanelHead({ label }: { label: string }) {
  return <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-ink-muted">{label}</p>
}

function ToneField({ value, onChange }: { value: Tone; onChange: (t: Tone) => void }) {
  return (
    <Field label="Colour">
      <div className="flex items-center gap-2">
        <span className="h-9 w-9 flex-shrink-0 rounded-lg border border-hairline" style={{ background: TONES[value].fill }} />
        <select className={inputCx} value={value} onChange={(e) => onChange(e.target.value as Tone)}>
          {TONE_KEYS.map((t) => (
            <option key={t} value={t}>{TONE_LABELS[t]}</option>
          ))}
        </select>
      </div>
    </Field>
  )
}

function Checkbox({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[13px] text-ink-secondary">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        // accentColor inline rather than Tailwind's accent-*: the semantic
        // tokens are bare var() strings, so only a real CSS value reaches here.
        style={{ accentColor: 'var(--brand)' }}
        className="h-4 w-4 rounded border-hairline-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      />
      {label}
    </label>
  )
}

function TabButton({ active, onClick, icon, children }: { active: boolean; onClick: () => void; icon: ReactNode; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`-mb-px flex items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-[13px] font-medium transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
        active ? 'border-brand text-ink' : 'border-transparent text-ink-muted hover:text-ink-secondary'
      }`}
    >
      {icon}
      {children}
    </button>
  )
}

function EmptyState({ icon, title, body }: { icon: ReactNode; title: string; body: string }) {
  return (
    <div className="py-6 text-center">
      <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-surface-strong text-ink-muted">
        {icon}
      </div>
      <p className="mt-3 text-[16px] font-semibold tracking-[-0.011em] text-ink">{title}</p>
      <p className="mx-auto mt-1 max-w-[38ch] text-[12px] text-ink-muted">{body}</p>
    </div>
  )
}

function InlineConfirm({
  tone, message, confirmLabel, onConfirm, onCancel,
}: {
  tone: 'amber' | 'rose'
  message: string
  confirmLabel: string
  onConfirm: () => void
  onCancel: () => void
}) {
  const cx = tone === 'amber'
    ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-400'
    : 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-400'
  return (
    <div className={`mt-3 flex flex-wrap items-center gap-3 rounded-lg border px-3 py-2.5 text-[12px] ${cx}`}>
      <AlertTriangle size={15} strokeWidth={1.75} className="flex-shrink-0" />
      <span className="flex-1">{message}</span>
      <div className="flex items-center gap-2">
        <button type="button" onClick={onCancel} className={`${btnBase} h-8 bg-surface px-2.5 text-ink-secondary hover:text-ink`}>
          Keep editing
        </button>
        <button type="button" onClick={onConfirm} className={`${btnBase} h-8 bg-ink px-2.5 text-canvas`}>
          {confirmLabel}
        </button>
      </div>
    </div>
  )
}
