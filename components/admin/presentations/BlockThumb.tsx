import { Play } from 'lucide-react'
import type { PresentationBlock } from '@/lib/presentations'
import { formatDuration } from '@/lib/presentations'
import SlideRenderer from './SlideRenderer'

/* A block's visual, in a 16:9 box: a clip's Loom thumbnail (with a duration pill)
   or a rendered slide. Reused in the library, the timeline, and the filmstrip. */

export default function BlockThumb({
  block, size = 'thumb', className = '', rounded = 'rounded-lg',
}: {
  block: PresentationBlock
  size?: 'thumb' | 'card' | 'stage'
  className?: string
  rounded?: string
}) {
  if (block.type === 'slide') {
    return (
      <div className={`relative aspect-video overflow-hidden ${rounded} ${className}`}>
        <SlideRenderer template={block.slide_template} data={block.slide_data} size={size} />
      </div>
    )
  }
  return (
    <div className={`relative aspect-video overflow-hidden bg-zinc-900 flex items-center justify-center ${rounded} ${className}`}>
      {block.thumbnail_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
      ) : (
        <Play size={18} className="text-zinc-500" />
      )}
      {block.duration_seconds ? (
        <span className="absolute bottom-1 right-1 text-[10px] px-1.5 py-0.5 rounded bg-black/60 text-white tabular-nums">
          {formatDuration(block.duration_seconds)}
        </span>
      ) : null}
    </div>
  )
}
