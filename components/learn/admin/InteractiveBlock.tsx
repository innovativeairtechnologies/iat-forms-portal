'use client'

import { Node, mergeAttributes } from '@tiptap/core'
import { NodeViewWrapper, ReactNodeViewRenderer, type NodeViewProps } from '@tiptap/react'
import { MonitorPlay, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { INTERACTIVE_ATTR } from '@/lib/learn-interactive'

/* Lets a lesson body carry an interactive exercise.

   Same job, and the same hazard, as ImagePlaceholder next door: StarterKit has
   no node for a bare marker div, so without this extension ProseMirror parses
   it as unknown, drops it, and re-serializes nothing. Merely opening a lesson
   that contains an exercise and pressing Save would silently delete it. That is
   not hypothetical — it is exactly how 133 lessons lost their image
   placeholders before ImagePlaceholder existed.

   The course lessons are created by a seed migration and will be edited in this
   editor afterwards, so the round trip has to be lossless from day one.

   `params` is deliberately a bag rather than a fixed set of attributes. If a
   future exercise needs a new data-* option, an author editing an unrelated
   lesson must not silently strip it. */

export const INTERACTIVE_BLOCK_NAME = 'interactiveBlock'

type Params = Record<string, string>

function readParams(el: HTMLElement): Params {
  const out: Params = {}
  for (const attr of Array.from(el.attributes)) {
    if (attr.name === INTERACTIVE_ATTR) continue
    if (attr.name.startsWith('data-')) out[attr.name.slice(5)] = attr.value
  }
  return out
}

export const InteractiveBlock = Node.create({
  name: INTERACTIVE_BLOCK_NAME,
  group: 'block',
  atom: true,
  selectable: true,
  draggable: false,

  addAttributes() {
    return {
      name: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute(INTERACTIVE_ATTR) ?? '',
        renderHTML: attrs => ({ [INTERACTIVE_ATTR]: attrs.name as string }),
      },
      params: {
        default: {} as Params,
        parseHTML: (el: HTMLElement) => readParams(el),
        renderHTML: attrs => {
          const params = (attrs.params ?? {}) as Params
          return Object.fromEntries(Object.entries(params).map(([k, v]) => [`data-${k}`, v]))
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: `div[${INTERACTIVE_ATTR}]` }]
  },

  renderHTML({ HTMLAttributes }) {
    // Must serialize back to the same self-closing marker the reader splits on
    // (lib/learn-interactive.ts). An atom with no content spec closes itself.
    return ['div', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(InteractiveBlockEditorView)
  },
})

/* The editor shows a label, not a live widget. An author is writing prose
   around the exercise, not doing the exercise. */
function InteractiveBlockEditorView({ node, editor, selected, deleteNode }: NodeViewProps) {
  const name = (node.attrs.name as string) || 'unknown'
  const params = (node.attrs.params ?? {}) as Params
  const detail = Object.entries(params)
    .map(([k, v]) => `${k}: ${v}`)
    .join(' · ')

  return (
    <NodeViewWrapper
      contentEditable={false}
      className={cn(
        'my-4 flex items-center gap-3 rounded-xl border border-dashed border-hairline bg-surface-soft px-4 py-3',
        selected && 'ring-2 ring-brand ring-offset-2 ring-offset-surface',
      )}
    >
      <MonitorPlay size={15} className="shrink-0 text-ink-faint" />
      <span className="min-w-0 flex-1 text-[13px] text-ink-secondary">
        Interactive exercise — <span className="text-ink">{name}</span>
        {detail && <span className="text-ink-muted"> ({detail})</span>}
      </span>
      <button
        type="button"
        onClick={deleteNode}
        disabled={!editor.isEditable}
        title="Remove this exercise"
        className="shrink-0 rounded-lg p-1.5 text-ink-faint transition-colors hover:text-rose-600 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50 dark:hover:text-rose-400"
      >
        <Trash2 size={11} />
      </button>
    </NodeViewWrapper>
  )
}
