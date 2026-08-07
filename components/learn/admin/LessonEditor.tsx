'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapImage from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered,
  Quote, Link as LinkIcon, Image as ImageIcon, Minus, Undo, Redo,
  ArrowLeft, ExternalLink, Loader2, Check, MonitorPlay,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ImagePlaceholder } from './ImagePlaceholder'
import { InteractiveBlock, INTERACTIVE_BLOCK_NAME } from './InteractiveBlock'
import { SCENARIOS } from '@/lib/cpco'
import { INTERACTIVE_BLOCKS } from '@/lib/learn-blocks'
import {
  IMAGE_ACCEPT, IMAGE_HINT, imageFileError, imageFilesFrom, uploadLessonImage,
} from '@/lib/lesson-images'

type EditableLesson = {
  id: string
  title: string
  content: string | null
  estimated_minutes: number
  is_published: boolean
}

function Btn({
  active, onClick, title, children, disabled,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
  disabled?: boolean
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); if (!disabled) onClick() }}
      title={title}
      disabled={disabled}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-md transition-all disabled:opacity-40',
        active
          ? 'bg-brand-soft text-brand'
          : 'text-ink-muted hover:bg-surface-soft hover:text-ink-secondary',
      )}
    >
      {children}
    </button>
  )
}

export default function LessonEditor({
  lesson, moduleTitle, viewHref,
}: { lesson: EditableLesson; moduleTitle: string; viewHref: string | null }) {
  const router = useRouter()
  const [title, setTitle] = useState(lesson.title)
  const [minutes, setMinutes] = useState(lesson.estimated_minutes)
  const [published, setPublished] = useState(lesson.is_published)
  const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle')
  const [uploading, setUploading] = useState(0)
  const [imageError, setImageError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // editorProps are captured once, when the editor is constructed, so the paste
  // and drop handlers below would close over a null editor forever. Route them
  // through a ref that every render refreshes.
  const insertRef = useRef<(files: File[], at: number | null) => void>(() => {})

  const editor = useEditor({
    extensions: [
      // Link ships inside StarterKit v3 — adding @tiptap/extension-link on top
      // registered it twice ("Duplicate extension names found: ['link']") and
      // left which config won undefined.
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false } }),
      TiptapImage,
      ImagePlaceholder,
      // Without this, opening any lesson that contains an interactive exercise
      // and pressing Save deletes the exercise — see the note in the extension.
      InteractiveBlock,
      Placeholder.configure({ placeholder: 'Write the lesson content…' }),
    ],
    content: lesson.content || '',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'learn-prose focus:outline-none min-h-[420px] max-w-none' },
      // Paste a screenshot straight in. Anything that isn't an image file (rich
      // text, plain text, a copied image *element*) falls through to TipTap.
      handlePaste: (view, event) => {
        const files = imageFilesFrom(event.clipboardData)
        if (!files.length) return false
        event.preventDefault()
        insertRef.current(files, view.state.selection.to)
        return true
      },
      // Drop a file from the desktop. `moved` means content was dragged from
      // inside the document, which TipTap already handles correctly.
      handleDrop: (view, event, _slice, moved) => {
        if (moved) return false
        const files = imageFilesFrom(event.dataTransfer)
        if (!files.length) return false
        event.preventDefault()
        const at = view.posAtCoords({ left: event.clientX, top: event.clientY })?.pos
        insertRef.current(files, at ?? view.state.selection.to)
        return true
      },
    },
  })

  /** Upload each image and drop it into the document, in order. `at` is the
   *  drop position; null means "wherever the cursor is". */
  async function insertImages(files: File[], at: number | null) {
    if (!editor || !files.length) return
    setImageError('')
    let target = at
    for (const file of files) {
      const problem = imageFileError(file)
      if (problem) { setImageError(problem); continue }

      setUploading(n => n + 1)
      try {
        const url = await uploadLessonImage(file)
        // The document can have been edited while the bytes were in flight, so
        // clamp rather than trusting a stale position.
        const pos = Math.min(target ?? editor.state.selection.to, editor.state.doc.content.size)
        editor.chain().focus()
          .insertContentAt(pos, { type: 'image', attrs: { src: url, alt: '' } })
          .run()
        target = editor.state.selection.to // keep a multi-file drop in order
      } catch (e) {
        setImageError(e instanceof Error ? e.message : 'Could not upload that image.')
      } finally {
        setUploading(n => n - 1)
      }
    }
  }
  insertRef.current = (files, at) => { void insertImages(files, at) }

  const isHttpUrl = (u: string) => /^https?:\/\//i.test(u.trim())

  const addLink = () => {
    const url = window.prompt('Enter URL (http:// or https://):')
    if (!url) return
    if (!isHttpUrl(url)) { window.alert('Only http:// or https:// links are allowed.'); return }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }

  /* Same window.prompt idiom as the link button above, one prompt per step:
     which block, then each of its parameters. The lists come from the real
     catalogue and the real scenario registry, so an author can only ever insert
     something that renders. */
  const addExercise = () => {
    const menu = INTERACTIVE_BLOCKS.map((b, i) => `${i + 1}. ${b.label} — ${b.group}`).join('\n')
    const answer = window.prompt(`Insert an interactive block.\n\n${menu}\n\nEnter a number:`)
    if (answer === null) return

    const block = INTERACTIVE_BLOCKS[Number(answer.trim()) - 1]
    if (!block) {
      window.alert('That isn’t one of the listed blocks.')
      return
    }

    const params: Record<string, string> = {}
    for (const spec of block.params ?? []) {
      let value: string | null
      if (spec.options) {
        const list = spec.options.map((o, i) => `${i + 1}. ${o.label}`).join('\n')
        const pick = window.prompt(`${spec.label}\n\n${list}\n\nEnter a number:`)
        if (pick === null) return
        const option = spec.options[Number(pick.trim()) - 1]
        if (!option) {
          window.alert('That isn’t one of the listed options.')
          return
        }
        value = option.value
      } else if (block.name === 'cpco-sim' && spec.key === 'scenario') {
        // The one free-text param with a real registry behind it — offer the
        // scenarios by name rather than making an author recall an id.
        const list = SCENARIOS.map((s, i) => `${i + 1}. ${s.title}`).join('\n')
        const pick = window.prompt(`${spec.label}\n\n${list}\n\nEnter a number, or leave blank:`)
        if (pick === null) return
        if (!pick.trim()) continue
        const scenario = SCENARIOS[Number(pick.trim()) - 1]
        if (!scenario) {
          window.alert('That isn’t one of the listed scenarios.')
          return
        }
        value = scenario.id
      } else {
        value = window.prompt(spec.label)
        if (value === null) return
      }
      if (value) params[spec.key] = value
    }

    editor
      ?.chain()
      .focus()
      .insertContent({ type: INTERACTIVE_BLOCK_NAME, attrs: { name: block.name, params } })
      .run()
  }

  async function save() {
    if (!editor) return
    setStatus('saving')
    try {
      const res = await fetch(`/api/learn/lessons/${lesson.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || 'Untitled lesson',
          content: editor.getHTML(),
          estimated_minutes: Number(minutes) || 1,
          is_published: published,
        }),
      })
      if (!res.ok) throw new Error('save failed')
      setStatus('saved')
      router.refresh()
      setTimeout(() => setStatus('idle'), 1800)
    } catch {
      setStatus('idle')
      window.alert('Could not save. Please try again.')
    }
  }

  if (!editor) return null

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-5 flex items-center justify-between">
        <Link
          href="/admin/learn-content"
          className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:text-ink"
        >
          <ArrowLeft size={15} /> Back to admin
        </Link>
        {viewHref && (
          <Link
            href={viewHref}
            target="_blank"
            className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-ink-muted transition-colors hover:text-brand"
          >
            View live <ExternalLink size={13} />
          </Link>
        )}
      </div>

      <p className="mb-1 text-[12px] font-semibold uppercase tracking-wide text-ink-muted">{moduleTitle}</p>
      <input
        value={title}
        onChange={e => setTitle(e.target.value)}
        placeholder="Lesson title"
        className="mb-4 w-full border-0 bg-transparent text-[26px] font-[650] tracking-tight text-ink outline-none placeholder:text-ink-faint"
      />

      <div className="mb-4 flex flex-wrap items-center gap-4 rounded-xl border border-hairline bg-surface px-4 py-3">
        <label className="flex items-center gap-2 text-[13px] text-ink-secondary">
          <span className="font-medium">Est. minutes</span>
          <input
            type="number" min={1} value={minutes}
            onChange={e => setMinutes(Number(e.target.value))}
            className="w-16 rounded-lg border border-hairline px-2 py-1 text-[13px] outline-none focus:border-brand"
          />
        </label>
        <button
          type="button"
          onClick={() => setPublished(p => !p)}
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition-colors',
            published ? 'bg-brand-soft text-brand' : 'bg-surface-strong text-ink-secondary',
          )}
        >
          <span className={cn('h-2 w-2 rounded-full', published ? 'bg-brand' : 'bg-ink-faint')} />
          {published ? 'Published' : 'Draft'}
        </button>
        <div className="ml-auto">
          <button
            onClick={save}
            // Saving mid-upload would persist content without the image that is
            // still in flight, which reads as "it saved and my picture vanished".
            disabled={status === 'saving' || uploading > 0}
            title={uploading > 0 ? 'Waiting for the image upload to finish' : undefined}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {(status === 'saving' || uploading > 0) && <Loader2 size={14} className="animate-spin" />}
            {status === 'saved' && uploading === 0 && <Check size={14} />}
            {uploading > 0 ? 'Uploading…'
              : status === 'saving' ? 'Saving…'
              : status === 'saved' ? 'Saved' : 'Save lesson'}
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-hairline bg-surface">
        <div className="flex flex-wrap items-center gap-0.5 border-b border-hairline bg-surface-soft px-2 py-1.5">
          <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold"><Bold size={15} /></Btn>
          <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic"><Italic size={15} /></Btn>
          <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough"><Strikethrough size={15} /></Btn>
          <div className="mx-1 h-5 w-px bg-hairline" />
          <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} title="Heading 2"><Heading2 size={15} /></Btn>
          <Btn active={editor.isActive('heading', { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} title="Heading 3"><Heading3 size={15} /></Btn>
          <div className="mx-1 h-5 w-px bg-hairline" />
          <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list"><List size={15} /></Btn>
          <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Numbered list"><ListOrdered size={15} /></Btn>
          <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()} title="Quote"><Quote size={15} /></Btn>
          <div className="mx-1 h-5 w-px bg-hairline" />
          <Btn active={editor.isActive('link')} onClick={addLink} title="Add link"><LinkIcon size={15} /></Btn>
          <Btn
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading > 0}
            title={`Insert image — ${IMAGE_HINT}`}
          >
            <ImageIcon size={15} />
          </Btn>
          <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus size={15} /></Btn>
          <Btn onClick={addExercise} title="Insert an interactive exercise"><MonitorPlay size={15} /></Btn>
          <div className="mx-1 h-5 w-px bg-hairline" />
          <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo size={15} /></Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo size={15} /></Btn>

          {uploading > 0 && (
            <span className="ml-auto inline-flex items-center gap-1.5 pr-1 text-[11.5px] font-medium text-ink-muted">
              <Loader2 size={12} className="animate-spin" />
              Uploading {uploading} image{uploading === 1 ? '' : 's'}…
            </span>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={IMAGE_ACCEPT}
          multiple
          className="hidden"
          onChange={e => {
            const picked = Array.from(e.target.files ?? [])
            e.target.value = '' // re-picking the same file must refire
            if (picked.length) insertRef.current(picked, null)
          }}
        />

        <div className="px-6 py-5">
          <EditorContent editor={editor} />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hairline px-6 py-2.5">
          <p className="text-[11.5px] text-ink-faint">
            Drag an image in, paste a screenshot, or use the image button · {IMAGE_HINT}
          </p>
          {imageError && <p className="text-[11.5px] text-rose-500">{imageError}</p>}
        </div>
      </div>
    </div>
  )
}
