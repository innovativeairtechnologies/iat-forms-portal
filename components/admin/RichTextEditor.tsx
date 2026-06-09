'use client'

import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import TiptapLink from '@tiptap/extension-link'
import TiptapImage from '@tiptap/extension-image'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Strikethrough, Link, Image, List, ListOrdered, Undo, Redo } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  onSubmit: (html: string) => Promise<void>
  disabled?: boolean
}

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
          ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
          : 'text-gray-400 dark:text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200',
      )}
    >
      {children}
    </button>
  )
}

export default function RichTextEditor({ onSubmit, disabled }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage,
      Placeholder.configure({ placeholder: 'Add a note…' }),
    ],
    editorProps: {
      attributes: {
        class: 'note-editor-content focus:outline-none min-h-[80px] text-[13px] text-gray-700 dark:text-gray-200 leading-relaxed',
      },
    },
  })

  const handleSubmit = async () => {
    if (!editor || editor.isEmpty || disabled) return
    await onSubmit(editor.getHTML())
    editor.commands.clearContent()
  }

  const addLink = () => {
    const url = window.prompt('Enter URL:')
    if (!url) return
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run()
  }

  const addImage = () => {
    const url = window.prompt('Enter image URL:')
    if (!url) return
    editor?.chain().focus().setImage({ src: url }).run()
  }

  if (!editor) return null

  return (
    <div className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 px-2 py-1.5 bg-gray-50 dark:bg-gray-800 border-b border-gray-100 dark:border-gray-700 flex-wrap">
        <ToolbarBtn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()} title="Bold">
          <Bold size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()} title="Italic">
          <Italic size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()} title="Strikethrough">
          <Strikethrough size={13} />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1" />

        <ToolbarBtn active={editor.isActive('link')} onClick={addLink} title="Add link">
          <Link size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={false} onClick={addImage} title="Add image">
          <Image size={13} />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1" />

        <ToolbarBtn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()} title="Bullet list">
          <List size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()} title="Ordered list">
          <ListOrdered size={13} />
        </ToolbarBtn>

        <div className="w-px h-4 bg-gray-200 dark:bg-gray-600 mx-1" />

        <ToolbarBtn active={false} onClick={() => editor.chain().focus().undo().run()} title="Undo">
          <Undo size={13} />
        </ToolbarBtn>
        <ToolbarBtn active={false} onClick={() => editor.chain().focus().redo().run()} title="Redo">
          <Redo size={13} />
        </ToolbarBtn>
      </div>

      {/* Editor area */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900">
        <EditorContent editor={editor} />
      </div>

      {/* Submit */}
      <div className="flex justify-end px-4 pb-3 bg-white dark:bg-gray-900">
        <button
          onClick={handleSubmit}
          disabled={disabled || editor.isEmpty}
          className="text-[13px] font-semibold bg-[#089447] hover:bg-[#077a3c] text-white px-4 py-2 rounded-xl disabled:opacity-40 transition-all"
        >
          {disabled ? 'Saving…' : 'Add Note'}
        </button>
      </div>
    </div>
  )
}
