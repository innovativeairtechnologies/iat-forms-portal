'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronLeft, ChevronRight, X, Maximize, Minimize, Play, Type as TypeIcon } from 'lucide-react'
import SlideRenderer from '@/components/admin/presentations/SlideRenderer'
import { loomEmbedUrl, type PresentationBlock } from '@/lib/presentations'

export default function PresentClient({
  presentationId, title, blocks,
}: {
  presentationId: string
  title: string
  blocks: PresentationBlock[]
}) {
  const router = useRouter()
  const [i, setI] = useState(0)
  const [fs, setFs] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  const total = blocks.length
  const cur = blocks[i]
  const back = () => router.push(`/admin/presentations/${presentationId}`)
  const next = useCallback(() => setI((n) => Math.min(n + 1, total - 1)), [total])
  const prev = useCallback(() => setI((n) => Math.max(n - 1, 0)), [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); prev() }
      else if (e.key === 'Escape' && !document.fullscreenElement) back()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [next, prev])

  const toggleFs = async () => {
    try {
      if (!document.fullscreenElement) { await rootRef.current?.requestFullscreen(); setFs(true) }
      else { await document.exitFullscreen(); setFs(false) }
    } catch { /* ignore */ }
  }
  useEffect(() => {
    const h = () => setFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', h)
    return () => document.removeEventListener('fullscreenchange', h)
  }, [])

  if (total === 0) {
    return (
      <div className="fixed inset-0 z-[60] bg-black text-white flex flex-col items-center justify-center gap-4">
        <p className="text-zinc-400 text-sm">This presentation has no blocks yet.</p>
        <button onClick={back} className="text-sm px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20">Back to builder</button>
      </div>
    )
  }

  return (
    <div ref={rootRef} className="fixed inset-0 z-[60] bg-[#0b0b0c] text-white flex flex-col">
      {/* top bar */}
      <div className="flex items-center justify-between px-4 h-12 flex-shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-2 h-2 rounded-full bg-rose-500 flex-shrink-0" />
          <span className="text-[13px] text-zinc-200 truncate">Presenting</span>
          <span className="text-[13px] text-zinc-500 truncate">· {title}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={toggleFs} className="p-2 text-zinc-400 hover:text-white rounded-lg hover:bg-white/5" title="Fullscreen">
            {fs ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <button onClick={back} className="text-[13px] inline-flex items-center gap-1 px-3 py-1.5 text-zinc-300 hover:text-white rounded-lg hover:bg-white/5"><X size={15} /> Exit</button>
        </div>
      </div>

      {/* stage */}
      <div className="flex-1 min-h-0 flex items-center justify-center px-6">
        <div className="relative w-full max-w-[1100px] aspect-video rounded-xl overflow-hidden bg-black shadow-2xl">
          {cur.type === 'clip' ? (
            loomEmbedUrl(cur.loom_url) ? (
              <iframe
                key={cur.id + i}
                src={`${loomEmbedUrl(cur.loom_url)}?autoplay=1&hideEmbedTopBar=true&hide_owner=true&hide_title=true`}
                className="absolute inset-0 w-full h-full"
                allow="autoplay; fullscreen; picture-in-picture"
                allowFullScreen
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-zinc-500 text-sm">This clip has an invalid Loom link.</div>
            )
          ) : (
            <SlideRenderer template={cur.slide_template} data={cur.slide_data} size="stage" />
          )}
        </div>
      </div>

      {/* progress segments */}
      <div className="px-6 pt-3">
        <div className="mx-auto max-w-[1100px] flex gap-1">
          {blocks.map((b, idx) => (
            <button key={b.id + idx} onClick={() => setI(idx)}
              className={`h-1 flex-1 rounded-full transition-colors ${idx < i ? 'bg-emerald-500' : idx === i ? 'bg-emerald-400' : 'bg-white/15 hover:bg-white/30'}`} />
          ))}
        </div>
      </div>

      {/* controls */}
      <div className="px-6 py-3 mx-auto max-w-[1100px] w-full flex items-center gap-4">
        <button onClick={prev} disabled={i === 0} className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 disabled:opacity-30"><ChevronLeft size={22} /></button>
        <button onClick={next} disabled={i === total - 1} className="p-2 rounded-lg text-zinc-300 hover:text-white hover:bg-white/5 disabled:opacity-30"><ChevronRight size={22} /></button>
        <span className="text-[12px] text-zinc-400 tabular-nums">{i + 1} of {total}</span>
        <span className="text-[12px] text-zinc-500 truncate flex items-center gap-1.5">
          {cur.type === 'clip' ? <Play size={12} /> : <TypeIcon size={12} />}{cur.title}
        </span>
        <div className="flex-1" />
      </div>

      {/* filmstrip */}
      <div className="px-6 pb-4 flex-shrink-0">
        <div className="mx-auto max-w-[1100px] flex gap-2 overflow-x-auto">
          {blocks.map((b, idx) => (
            <button key={b.id + idx} onClick={() => setI(idx)}
              className={`w-24 flex-shrink-0 rounded-md overflow-hidden border transition-colors ${idx === i ? 'border-emerald-400' : 'border-white/10 hover:border-white/30'}`}>
              <div className="relative aspect-video">
                {b.type === 'clip' ? (
                  b.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={b.thumbnail_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
                  ) : (
                    <div className="absolute inset-0 bg-zinc-800 flex items-center justify-center"><Play size={12} className="text-zinc-500" /></div>
                  )
                ) : (
                  <SlideRenderer template={b.slide_template} data={b.slide_data} size="thumb" />
                )}
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
