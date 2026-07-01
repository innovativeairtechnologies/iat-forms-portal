'use client'

import { useEffect, useState } from 'react'
import { X, Play, Type as TypeIcon, Upload, Loader2, Plus } from 'lucide-react'
import { createSupabaseBrowser } from '@/lib/supabase-browser'
import SlideRenderer from './SlideRenderer'
import {
  CATEGORIES, SLIDE_TEMPLATES, SLIDE_BACKGROUNDS, DEFAULT_BACKGROUND,
  type PresentationBlock, type SlideTemplate, type SlideData, type Visibility, type BlockInput,
} from '@/lib/presentations'
import { createBlock, updateBlock, fetchLoomMeta } from '@/app/admin/presentations/actions'

type Mode = 'clip' | 'slide'

export default function ContentPanel({
  open, onClose, onSaved, editing,
}: {
  open: boolean
  onClose: () => void
  onSaved: () => void
  editing?: PresentationBlock | null
}) {
  const [mode, setMode] = useState<Mode>('clip')
  const [title, setTitle] = useState('')
  const [category, setCategory] = useState<string>('')
  const [tags, setTags] = useState<string[]>([])
  const [tagInput, setTagInput] = useState('')
  const [visibility, setVisibility] = useState<Visibility>('internal')

  // clip
  const [loomUrl, setLoomUrl] = useState('')
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const [duration, setDuration] = useState<number | null>(null)
  const [loomBusy, setLoomBusy] = useState(false)

  // slide
  const [template, setTemplate] = useState<SlideTemplate>('welcome')
  const [slide, setSlide] = useState<SlideData>({ background: DEFAULT_BACKGROUND })
  const [logoBusy, setLogoBusy] = useState(false)

  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // hydrate on open / when editing changes
  useEffect(() => {
    if (!open) return
    setError(null)
    if (editing) {
      setMode(editing.type)
      setTitle(editing.title)
      setCategory(editing.category || '')
      setTags(editing.tags || [])
      setVisibility(editing.visibility)
      setLoomUrl(editing.loom_url || '')
      setThumbnailUrl(editing.thumbnail_url)
      setDuration(editing.duration_seconds)
      setTemplate(editing.slide_template || 'welcome')
      setSlide(editing.slide_data && Object.keys(editing.slide_data).length ? editing.slide_data : { background: DEFAULT_BACKGROUND })
    } else {
      setMode('clip'); setTitle(''); setCategory(''); setTags([]); setTagInput(''); setVisibility('internal')
      setLoomUrl(''); setThumbnailUrl(null); setDuration(null)
      setTemplate('welcome'); setSlide({ background: DEFAULT_BACKGROUND })
    }
  }, [open, editing])

  if (!open) return null

  const addTag = (raw: string) => {
    const t = raw.trim()
    if (t && !tags.includes(t)) setTags([...tags, t].slice(0, 12))
    setTagInput('')
  }

  const onLoomBlur = async () => {
    if (!loomUrl.trim()) return
    setLoomBusy(true)
    try {
      const meta = await fetchLoomMeta(loomUrl)
      if (meta) {
        if (meta.thumbnail_url) setThumbnailUrl(meta.thumbnail_url)
        if (meta.duration_seconds) setDuration(meta.duration_seconds)
        if (!title.trim() && meta.title) setTitle(meta.title)
      }
    } finally {
      setLoomBusy(false)
    }
  }

  const onLogoPick = async (file: File) => {
    setLogoBusy(true)
    setError(null)
    try {
      const sb = createSupabaseBrowser()
      const ext = (file.name.split('.').pop() || 'png').toLowerCase()
      const path = `logos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
      const { error: upErr } = await sb.storage.from('presentation-assets').upload(path, file, { upsert: false })
      if (upErr) throw new Error(upErr.message)
      const { data: pub } = sb.storage.from('presentation-assets').getPublicUrl(path)
      setSlide((s) => ({ ...s, logo_url: pub.publicUrl }))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not upload the logo.')
    } finally {
      setLogoBusy(false)
    }
  }

  const save = async () => {
    setError(null)
    if (!title.trim()) { setError('Give it a title.'); return }
    if (mode === 'clip' && !loomUrl.trim()) { setError('Paste a Loom link.'); return }
    setBusy(true)
    try {
      const input: BlockInput = mode === 'clip'
        ? { type: 'clip', title, category: category || null, tags, visibility, loom_url: loomUrl, thumbnail_url: thumbnailUrl, duration_seconds: duration }
        : { type: 'slide', title, category: category || null, tags, visibility, slide_template: template, slide_data: slide }
      if (editing) await updateBlock(editing.id, input)
      else await createBlock(input)
      onSaved()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.')
    } finally {
      setBusy(false)
    }
  }

  const seg = (active: boolean) =>
    `flex items-center gap-1.5 text-[12px] px-3 py-1.5 rounded-full transition-colors ${
      active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 font-medium' : 'text-zinc-500 dark:text-zinc-400'
    }`
  const fieldCls = 'w-full h-9 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-[13px] text-zinc-800 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/40'
  const labelCls = 'text-[12px] text-zinc-500 dark:text-zinc-400 mb-1 block'

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/45 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-[640px] max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <div className="text-[15px] font-semibold text-zinc-900 dark:text-zinc-100">{editing ? 'Edit content' : 'Add content'}</div>
            <div className="text-[12px] text-zinc-400 dark:text-zinc-500">{editing ? 'Update this library block' : 'Save to library'}</div>
          </div>
          <button onClick={onClose} className="p-1 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"><X size={18} /></button>
        </div>

        <div className="px-5 pt-4">
          {/* type toggle (locked when editing — a clip can't become a slide) */}
          <div className="inline-flex p-1 rounded-full bg-zinc-100 dark:bg-zinc-800">
            <button className={seg(mode === 'clip')} disabled={!!editing} onClick={() => setMode('clip')}><Play size={13} /> Video clip</button>
            <button className={seg(mode === 'slide')} disabled={!!editing} onClick={() => setMode('slide')}><TypeIcon size={13} /> Slide</button>
          </div>
        </div>

        {/* body */}
        {mode === 'clip' ? (
          <div className="grid grid-cols-[180px_1fr] gap-4 px-5 py-4">
            <div>
              <div className="relative aspect-video rounded-lg overflow-hidden bg-zinc-900 flex items-center justify-center">
                {thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={thumbnailUrl} alt="" className="absolute inset-0 w-full h-full object-cover" />
                ) : (
                  <Play size={24} className="text-zinc-500" />
                )}
                {loomBusy && <div className="absolute inset-0 flex items-center justify-center bg-black/40"><Loader2 size={18} className="animate-spin text-white" /></div>}
              </div>
              <div className="text-[11px] text-zinc-400 mt-2">
                {duration ? `Loom · ${Math.floor(duration / 60)}:${String(Math.round(duration % 60)).padStart(2, '0')}` : 'Paste a Loom link →'}
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className={labelCls}>Loom link</label>
                <input className={fieldCls} value={loomUrl} onChange={(e) => setLoomUrl(e.target.value)} onBlur={onLoomBlur} placeholder="https://www.loom.com/share/…" />
              </div>
              <div>
                <label className={labelCls}>Title</label>
                <input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Reading a psychro chart" />
              </div>
              <SharedFields {...{ category, setCategory, visibility, setVisibility, tags, setTags, tagInput, setTagInput, addTag, fieldCls, labelCls }} />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[150px_1fr] gap-4 px-5 py-4">
            <div className="space-y-1">
              <div className="text-[11px] uppercase tracking-wider text-zinc-400 mb-1">Template</div>
              {SLIDE_TEMPLATES.map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTemplate(t.key)}
                  className={`w-full text-left text-[13px] px-2.5 py-1.5 rounded-lg transition-colors ${
                    template === t.key ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 font-medium' : 'text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800/60'
                  }`}
                >{t.label}</button>
              ))}
            </div>

            <div className="space-y-3">
              <div className="relative aspect-video rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800">
                <SlideRenderer template={template} data={slide} size="stage" />
              </div>
              <div>
                <label className={labelCls}>Title <span className="text-zinc-400">(library name)</span></label>
                <input className={fieldCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Welcome slide" />
              </div>
              <div>
                <label className={labelCls}>Heading</label>
                <input className={fieldCls} value={slide.heading || ''} onChange={(e) => setSlide({ ...slide, heading: e.target.value })} placeholder={template === 'contact' ? 'Get in touch' : 'Welcome'} />
              </div>
              {template === 'quote' ? (
                <>
                  <div>
                    <label className={labelCls}>Quote</label>
                    <textarea className={`${fieldCls} h-auto py-2`} rows={2} value={slide.body || ''} onChange={(e) => setSlide({ ...slide, body: e.target.value })} placeholder="Dry air is our business." />
                  </div>
                  <div>
                    <label className={labelCls}>Attribution</label>
                    <input className={fieldCls} value={slide.attribution || ''} onChange={(e) => setSlide({ ...slide, attribution: e.target.value })} placeholder="Jerry, founder" />
                  </div>
                </>
              ) : (
                <div>
                  <label className={labelCls}>{template === 'blank' ? 'Body' : 'Subtext'}</label>
                  <textarea className={`${fieldCls} h-auto py-2`} rows={2} value={(template === 'blank' ? slide.body : slide.subtext) || ''} onChange={(e) => setSlide({ ...slide, [template === 'blank' ? 'body' : 'subtext']: e.target.value })} placeholder={template === 'contact' ? 'sales@dehumidifiers.com\n(800) 555-0100' : 'Acme Foods · Dehumidification 101'} />
                </div>
              )}

              <div className="flex items-center gap-5">
                <div>
                  <label className={labelCls}>Background</label>
                  <div className="flex gap-1.5">
                    {Object.entries(SLIDE_BACKGROUNDS).map(([key, v]) => (
                      <button key={key} title={v.label} onClick={() => setSlide({ ...slide, background: key })}
                        className={`w-6 h-6 rounded-md border ${slide.background === key ? 'ring-2 ring-emerald-500 border-transparent' : 'border-zinc-300 dark:border-zinc-600'}`}
                        style={{ background: v.bg }} />
                    ))}
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Logo</label>
                  <label className="inline-flex items-center gap-1.5 text-[12px] h-7 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
                    {logoBusy ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
                    {slide.logo_url ? 'Replace' : 'Upload'}
                    <input type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) onLogoPick(f) }} />
                  </label>
                  {slide.logo_url && <button onClick={() => setSlide({ ...slide, logo_url: null })} className="ml-2 text-[11px] text-zinc-400 hover:text-rose-500">remove</button>}
                </div>
              </div>

              <SharedFields {...{ category, setCategory, visibility, setVisibility, tags, setTags, tagInput, setTagInput, addTag, fieldCls, labelCls }} />
            </div>
          </div>
        )}

        {error && <div className="mx-5 mb-2 text-[12px] text-rose-500">{error}</div>}

        {/* footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3.5 border-t border-zinc-200 dark:border-zinc-800">
          <button onClick={onClose} className="text-[13px] px-3 py-1.5 rounded-lg text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800">Cancel</button>
          <button onClick={save} disabled={busy} className="text-[13px] px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium inline-flex items-center gap-1.5 disabled:opacity-60">
            {busy && <Loader2 size={14} className="animate-spin" />}
            {editing ? 'Save changes' : 'Save to library'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Shared category / visibility / tags block ──────────────────────────────────
function SharedFields({
  category, setCategory, visibility, setVisibility, tags, setTags, tagInput, setTagInput, addTag, fieldCls, labelCls,
}: {
  category: string; setCategory: (v: string) => void
  visibility: Visibility; setVisibility: (v: Visibility) => void
  tags: string[]; setTags: (v: string[]) => void
  tagInput: string; setTagInput: (v: string) => void
  addTag: (raw: string) => void
  fieldCls: string; labelCls: string
}) {
  return (
    <>
      <div className="flex gap-3">
        <div className="flex-1">
          <label className={labelCls}>Category</label>
          <select className={fieldCls} value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Uncategorized</option>
            {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex-1">
          <label className={labelCls}>Visibility</label>
          <div className="inline-flex p-1 rounded-full bg-zinc-100 dark:bg-zinc-800 h-9 items-center">
            {(['internal', 'client_safe'] as Visibility[]).map((v) => (
              <button key={v} onClick={() => setVisibility(v)}
                className={`text-[12px] px-2.5 py-1 rounded-full ${visibility === v ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400 font-medium' : 'text-zinc-500 dark:text-zinc-400'}`}>
                {v === 'internal' ? 'Internal' : 'Client-safe'}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div>
        <label className={labelCls}>Tags</label>
        <div className="flex flex-wrap items-center gap-1.5">
          {tags.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-[12px] px-2 py-0.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300">
              {t}<button onClick={() => setTags(tags.filter((x) => x !== t))} className="text-zinc-400 hover:text-rose-500">×</button>
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <input
              className="w-24 h-7 px-2 rounded-full border border-dashed border-zinc-300 dark:border-zinc-600 bg-transparent text-[12px] focus:outline-none focus:ring-1 focus:ring-emerald-500/40"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag(tagInput) } }}
              placeholder="add"
            />
            {tagInput && <button onClick={() => addTag(tagInput)} className="text-emerald-600"><Plus size={13} /></button>}
          </span>
        </div>
      </div>
    </>
  )
}
