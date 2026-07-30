'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Strikethrough, Heading2, Heading3, List, ListOrdered,
  Quote, Link as LinkIcon, Image as ImageIcon, Minus, Undo, Redo,
  ArrowLeft, ExternalLink, Loader2, Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

type EditableLesson = {
  id: string
  title: string
  content: string | null
  estimated_minutes: number
  is_published: boolean
}

function Btn({
  active, onClick, title, children,
}: { active?: boolean; onClick: () => void; title: string; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={cn(
        'grid h-8 w-8 place-items-center rounded-md transition-all',
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

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] } }),
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage,
      Placeholder.configure({ placeholder: 'Write the lesson content…' }),
    ],
    content: lesson.content || '',
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'learn-prose focus:outline-none min-h-[420px] max-w-none' },
    },
  })

  const isHttpUrl = (u: string) => /^https?:\/\//i.test(u.trim())

  const addLink = () => {
    const url = window.prompt('Enter URL (http:// or https://):')
    if (!url) return
    if (!isHttpUrl(url)) { window.alert('Only http:// or https:// links are allowed.'); return }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
  }
  const addImage = () => {
    const url = window.prompt('Enter image URL (http:// or https://):')
    if (!url) return
    if (!isHttpUrl(url)) { window.alert('Only http:// or https:// image URLs are allowed.'); return }
    editor?.chain().focus().setImage({ src: url.trim() }).run()
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
            disabled={status === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-4 py-2 text-[13px] font-semibold text-white transition-colors hover:bg-brand-hover disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
          >
            {status === 'saving' && <Loader2 size={14} className="animate-spin" />}
            {status === 'saved' && <Check size={14} />}
            {status === 'saving' ? 'Saving…' : status === 'saved' ? 'Saved' : 'Save lesson'}
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
          <Btn onClick={addImage} title="Add image"><ImageIcon size={15} /></Btn>
          <Btn onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Divider"><Minus size={15} /></Btn>
          <div className="mx-1 h-5 w-px bg-hairline" />
          <Btn onClick={() => editor.chain().focus().undo().run()} title="Undo"><Undo size={15} /></Btn>
          <Btn onClick={() => editor.chain().focus().redo().run()} title="Redo"><Redo size={15} /></Btn>
        </div>
        <div className="px-6 py-5">
          <EditorContent editor={editor} />
        </div>
      </div>
    </div>
  )
}
