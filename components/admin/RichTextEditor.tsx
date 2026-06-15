'use client'

import { useRef, useState } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import {
  Bold, Italic, Strikethrough, Link, Image, List, ListOrdered, Undo, Redo,
  Paperclip, X, FileText, Mail, Loader2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TicketNoteAttachment } from '@/lib/supabase'

interface Props {
  onSubmit: (html: string, attachments: TicketNoteAttachment[]) => Promise<void>
  disabled?: boolean
  // Uploads one file and resolves with its stored metadata. When provided, the
  // editor accepts drag-and-drop + a paperclip picker (emails and files).
  onUpload?: (file: File) => Promise<TicketNoteAttachment>
}

function formatBytes(n: number): string {
  if (!n) return ''
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`
  return `${(n / (1024 * 1024)).toFixed(1)} MB`
}

const isEmailName = (name: string) => /\.(eml|msg)$/i.test(name)

function ToolbarBtn({
  active, onClick, title, children,
}: {
  active?: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      className={cn(
        'p-1.5 rounded-md transition-all',
        active
          ? 'bg-gray-100 dark:bg-zinc-700 text-gray-900 dark:text-white'
          : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-zinc-700 hover:text-gray-700 dark:hover:text-gray-200',
      )}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ onSubmit, disabled, onUpload }: Props) {
  const [hasContent, setHasContent] = useState(false)
  const [attachments, setAttachments] = useState<TicketNoteAttachment[]>([])
  const [uploading, setUploading] = useState(0)
  const [dragOver, setDragOver] = useState(false)
  const [uploadError, setUploadError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage,
      Placeholder.configure({ placeholder: 'Add a note…' }),
    ],
    onUpdate: ({ editor }) => {
      setHasContent(!editor.isEmpty)
    },
    editorProps: {
      attributes: {
        class: 'note-editor-content focus:outline-none min-h-[80px] text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed',
      },
    },
  })

  const handleFiles = async (files: FileList | File[]) => {
    if (!onUpload) return
    const list = Array.from(files)
    if (!list.length) return
    setUploadError('')
    for (const file of list) {
      setUploading(n => n + 1)
      try {
        const att = await onUpload(file)
        setAttachments(prev => [...prev, att])
      } catch (e) {
        setUploadError(e instanceof Error ? e.message : `Couldn't attach ${file.name}`)
      } finally {
        setUploading(n => n - 1)
      }
    }
  }

  const onDrop = (e: React.DragEvent) => {
    if (!onUpload) return
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files?.length) handleFiles(e.dataTransfer.files)
  }

  const removeAttachment = (path: string) => {
    setAttachments(prev => prev.filter(a => a.path !== path))
  }

  const handleSubmit = async () => {
    if (!editor || disabled || uploading > 0) return
    if (!hasContent && attachments.length === 0) return
    await onSubmit(editor.getHTML(), attachments)
    editor.commands.clearContent()
    setHasContent(false)
    setAttachments([])
    setUploadError('')
  }

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

  if (!editor) return null

  const canSubmit = !disabled && uploading === 0 && (hasContent || attachments.length > 0)

  return (
    <div
      className={cn(
        'border rounded-xl overflow-hidden transition-colors',
        dragOver ? 'border-[#089447] ring-2 ring-[#089447]/20' : 'border-gray-100 dark:border-zinc-700',
      )}
      onDragOver={onUpload ? (e => { e.preventDefault(); setDragOver(true) }) : undefined}
      onDragLeave={onUpload ? (e => { e.preventDefault(); setDragOver(false) }) : undefined}
      onDrop={onUpload ? onDrop : undefined}
    >
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 dark:bg-zinc-800 border-b border-gray-100 dark:border-zinc-700 flex-wrap">
        <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough size={13} />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-600 mx-1" />

        <ToolbarBtn active={editor.isActive('link')} onClick={addLink} title="Add link">
          <Link size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={false} onClick={addImage} title="Add image">
          <Image size={13} />
        </ToolbarBtn>
        {onUpload && (
          <ToolbarBtn active={false} onClick={() => fileInputRef.current?.click()} title="Attach files or emails (.eml/.msg)">
            <Paperclip size={13} />
          </ToolbarBtn>
        )}

        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-600 mx-1" />

        <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered list">
          <ListOrdered size={13} />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-200 dark:bg-zinc-600 mx-1" />

        <ToolbarBtn active={false} onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={false} onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo size={13} />
        </ToolbarBtn>
      </div>

      {/* Editor area */}
      <div className="relative px-4 py-3 bg-white dark:bg-zinc-900">
        <EditorContent editor={editor} />
        {dragOver && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#089447]/5 backdrop-blur-[1px] pointer-events-none">
            <span className="flex items-center gap-2 text-[12px] font-semibold text-[#089447]">
              <Paperclip size={13} /> Drop files or emails to attach
            </span>
          </div>
        )}
      </div>

      {/* Attachments */}
      {onUpload && (attachments.length > 0 || uploading > 0 || uploadError) && (
        <div className="px-4 pb-2 bg-white dark:bg-zinc-900 space-y-1.5">
          {attachments.map(att => (
            <div key={att.path} className="flex items-center gap-2 text-[12px] bg-gray-50 dark:bg-zinc-800 border border-gray-100 dark:border-zinc-700 rounded-lg px-2.5 py-1.5">
              {isEmailName(att.name)
                ? <Mail size={13} className="text-[#089447] flex-shrink-0" />
                : <FileText size={13} className="text-gray-400 flex-shrink-0" />}
              <span className="flex-1 min-w-0 truncate text-gray-700 dark:text-gray-200">{att.name}</span>
              {att.size > 0 && <span className="text-[11px] text-gray-400 flex-shrink-0">{formatBytes(att.size)}</span>}
              <button
                type="button"
                onClick={() => removeAttachment(att.path)}
                className="text-gray-300 hover:text-red-500 dark:text-gray-600 dark:hover:text-red-400 transition-colors flex-shrink-0"
                title="Remove"
              >
                <X size={13} />
              </button>
            </div>
          ))}
          {uploading > 0 && (
            <div className="flex items-center gap-2 text-[12px] text-gray-400 px-2.5 py-1">
              <Loader2 size={13} className="animate-spin" />
              Uploading {uploading} file{uploading === 1 ? '' : 's'}…
            </div>
          )}
          {uploadError && <p className="text-[12px] text-red-500 px-1">{uploadError}</p>}
        </div>
      )}

      {/* Hidden file input for the paperclip picker */}
      {onUpload && (
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => { if (e.target.files) handleFiles(e.target.files); e.target.value = '' }}
        />
      )}

      {/* Submit */}
      <div className="flex items-center justify-between gap-3 px-4 pb-3 bg-white dark:bg-zinc-900">
        {onUpload
          ? <span className="text-[11px] text-gray-300 dark:text-gray-600">Drag files or emails here, or use the 📎</span>
          : <span />}
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="text-[13px] font-semibold bg-[#089447] hover:bg-[#077a3c] text-white px-4 py-2 rounded-xl disabled:opacity-40 transition-all flex-shrink-0"
        >
          {disabled ? 'Saving…' : 'Add Note'}
        </button>
      </div>
    </div>
  )
}
