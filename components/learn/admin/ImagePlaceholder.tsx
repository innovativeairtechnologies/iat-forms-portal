'use client'

import { useRef, useState } from 'react'
import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { IMAGE_ACCEPT, imageFileError, placeholderAlt, uploadLessonImage } from '@/lib/lesson-images'

/* The Trainual import left `<figure class="img-missing">` markers in 133 of the
   357 lessons, each with a figcaption describing the image that couldn't be
   carried over ("…— re-upload via admin editor").

   StarterKit has no `figure` node, so without this extension ProseMirror parses
   the marker as unknown, drops the wrapper, and re-serializes the caption as a
   bare <p> — verified, not assumed. That means merely opening one of those
   lessons and pressing Save silently downgraded the placeholder to raw body
   text. Since the whole point of lesson image upload is to go and open exactly
   those lessons, the node has to round-trip losslessly.

   So: parse the marker into a real atom node, render it back byte-identically,
   and give it a node view that turns it into the upload target itself. */

export const IMAGE_PLACEHOLDER_NAME = 'imagePlaceholder'

export const ImagePlaceholder = Node.create({
  name: IMAGE_PLACEHOLDER_NAME,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      caption: {
        default: '',
        parseHTML: (el: HTMLElement) => el.querySelector('figcaption')?.textContent?.trim() ?? '',
        // Rendered as the figcaption's text below, never as an attribute.
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'figure.img-missing' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    // Must match the imported markup exactly so untouched lessons re-save byte
    // for byte and the `.learn-prose figure.img-missing` styling still applies.
    return [
      'figure',
      mergeAttributes(HTMLAttributes, { class: 'img-missing' }),
      ['figcaption', {}, node.attrs.caption as string],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(PlaceholderView)
  },
})

function PlaceholderView({ node, editor, getPos, selected, deleteNode }: NodeViewProps) {
  const caption = (node.attrs.caption as string) || ''
  const inputRef = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // The stored caption is kept verbatim for serialization; only the display
  // copy drops the camera emoji and the "re-upload via admin editor" nudge,
  // which the button next to it now says better.
  const description = placeholderAlt(caption)

  const pick = (files: FileList | null) => {
    const file = files?.[0]
    if (inputRef.current) inputRef.current.value = '' // re-picking the same file must refire
    if (!file) return

    const problem = imageFileError(file)
    if (problem) { setError(problem); return }

    setError('')
    setBusy(true)
    void (async () => {
      try {
        const url = await uploadLessonImage(file)
        const pos = getPos()
        if (typeof pos !== 'number') throw new Error('Could not find this placeholder to replace.')
        // Swap the placeholder for the image, inheriting the Trainual
        // description as alt text.
        editor
          .chain()
          .focus()
          .insertContentAt(
            { from: pos, to: pos + node.nodeSize },
            { type: 'image', attrs: { src: url, alt: description } },
          )
          .run()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Could not upload that image.')
        setBusy(false)
      }
      // On success the node is gone, so there is nothing left to un-busy.
    })()
  }

  return (
    <NodeViewWrapper
      as="figure"
      contentEditable={false}
      className={cn('img-missing', selected && 'ring-2 ring-brand ring-offset-2 ring-offset-surface')}
    >
      <ImagePlus size={15} className="shrink-0 text-ink-faint" />
      <figcaption className="min-w-0 flex-1">
        {description || 'Image missing from the Trainual import'}
        {error && <span className="mt-0.5 block not-italic text-rose-500">{error}</span>}
      </figcaption>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy || !editor.isEditable}
        className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-hairline bg-surface px-2.5 py-1.5 text-[11.5px] font-medium not-italic text-ink-secondary transition-colors hover:border-hairline-strong hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
      >
        {busy ? <Loader2 size={11} className="animate-spin" /> : <ImagePlus size={11} />}
        {busy ? 'Uploading…' : 'Add image'}
      </button>

      {/* Some markers stood in for things that were never a still image (one is
          an embedded YouTube video), so clearing is as valid as replacing. */}
      <button
        type="button"
        onClick={deleteNode}
        disabled={busy || !editor.isEditable}
        title="Remove this placeholder"
        className="shrink-0 rounded-lg p-1.5 text-ink-faint transition-colors hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 dark:hover:text-rose-400"
      >
        <Trash2 size={11} />
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        onChange={e => pick(e.target.files)}
      />
    </NodeViewWrapper>
  )
}
