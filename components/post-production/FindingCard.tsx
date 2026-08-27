'use client'

import { useEffect, useRef } from 'react'
import { Camera, Loader2, Trash2, Video, X } from 'lucide-react'
import {
  CATEGORIES, CATEGORY_LABELS, CATEGORY_SHORT, SEVERITIES, SEVERITY_BLURB, SEVERITY_LABELS,
  clock, humanBytes,
  type Category, type Media, type PpFinding, type Severity,
} from '@/lib/post-production'
import VoiceNote from './VoiceNote'

/* One finding, mid-walk.
 *
 * Shared verbatim by the signed-in walk (/admin/engineering/post-production/walk)
 * and the no-login shop-floor scan page (/walk/<token>). They are the same job
 * done by different people, so they are the same screen — the only things that
 * differ are the two props threaded in from above: which route mints an upload
 * URL, and how a media thumbnail is read back.
 *
 * That second one matters. A signed-in walk reads its thumbnails through the
 * admin-gated media route; the scan page has no session and must read through
 * its token instead. Baking either in would have forced a copy of this file, and
 * a copy is how the two surfaces silently drift apart.
 */

export type Local = PpFinding & { _saving?: boolean; _error?: string }

export default function FindingCard({
  finding, number, transcriptionConfigured, uploadEndpoint, mediaSrcFor,
  onNote, onCategory, onSeverity, onPhoto, onVideo, onAudio, onRemoveMedia, onRemove,
}: {
  finding: Local
  number: number
  transcriptionConfigured: boolean
  uploadEndpoint: string
  mediaSrcFor: (path: string) => string
  onNote: (note: string, source: PpFinding['note_source']) => void
  onCategory: (c: Category) => void
  onSeverity: (s: Severity) => void
  onPhoto: () => void
  onVideo: () => void
  onAudio: (m: Media, previewUrl: string) => void
  onRemoveMedia: (path: string) => void
  onRemove: () => void
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  // Grow to fit. A dictated observation runs long, and a phone textarea that
  // scrolls internally hides the beginning of what somebody just said.
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = `${Math.min(ta.scrollHeight, 420)}px`
  }, [finding.note])

  /* 🔴 THE LIVE NOTE IS READ FROM A REF, NOT FROM THE PROP.
   *
   * appendDictated is handed to VoiceNote, which calls it from a
   * SpeechRecognition handler. On iOS Safari recognition ends on every pause for
   * breath and is restarted, so this runs many times per recording — and if it
   * read `finding.note` from the closure it would compute every append against
   * the note as it stood when recording STARTED.
   *
   * The symptom, reported from a real phone 2026-08-27: every pause wiped the
   * previous sentence AND anything typed by hand, leaving only the newest
   * phrase. Two things fix it together and both are required — the ref here, and
   * the callback ref in VoiceNote.
   *
   * Assigning back into the ref on the same line is not belt-and-braces either:
   * two final results can arrive before React re-renders, and without it the
   * second would overwrite the first. */
  const noteRef = useRef(finding.note)
  const sourceRef = useRef(finding.note_source)
  useEffect(() => { noteRef.current = finding.note }, [finding.note])
  useEffect(() => { sourceRef.current = finding.note_source }, [finding.note_source])

  /** Dictated text is APPENDED, never substituted for what is in the box.
   *  Somebody who typed half a sentence and then started talking must end up
   *  with both halves. */
  const appendDictated = (text: string) => {
    const t = text.trim()
    if (!t) return
    const current = noteRef.current
    const joined = current.trim() ? `${current.trimEnd()} ${t}` : t
    const source = sourceRef.current === 'typed' && current.trim() ? 'mixed' : 'dictated'
    noteRef.current = joined
    sourceRef.current = source
    onNote(joined, source)
  }

  return (
    <div className="rounded-xl border border-hairline bg-surface">
      <div className="flex items-center gap-2 px-4 h-11 border-b border-hairline-soft">
        <span className="text-[11px] font-semibold uppercase tracking-widest text-ink-muted">
          Finding {number}
        </span>
        <span className="flex-1" />
        {finding._saving && <Loader2 size={13} className="animate-spin text-ink-faint" />}
        {finding._error && <span className="text-[11px] text-rose-500">{finding._error}</span>}
        <button
          type="button"
          onClick={onRemove}
          aria-label="Remove this finding"
          className="w-8 h-8 -mr-1.5 rounded-lg inline-flex items-center justify-center text-ink-faint hover:bg-surface-strong hover:text-rose-500 transition-colors"
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="p-4 space-y-3">
        <textarea
          ref={taRef}
          value={finding.note}
          onChange={e => onNote(e.target.value, finding.note_source === 'dictated' ? 'mixed' : 'typed')}
          rows={2}
          placeholder="What would you have done differently?"
          className="w-full resize-none rounded-lg bg-surface border border-hairline px-3 py-2.5 text-[16px] leading-relaxed text-ink placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors"
        />

        <VoiceNote
          transcriptionConfigured={transcriptionConfigured}
          uploadEndpoint={uploadEndpoint}
          /* Harmless on the admin route, required by the token route. Passing it
             unconditionally keeps ONE call site instead of a prop that exists
             only to be forwarded. */
          uploadBody={{ finding_id: finding.id }}
          onTranscript={appendDictated}
          onDone={onAudio}
        />

        {finding.media.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {finding.media.map(m => (
              <MediaThumb key={m.path} media={m} src={mediaSrcFor(m.path)} onRemove={() => onRemoveMedia(m.path)} />
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPhoto}
            className="flex-1 h-11 rounded-lg border border-hairline bg-surface text-[12.5px] font-medium text-ink-muted hover:bg-surface-soft hover:text-ink transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Camera size={15} strokeWidth={1.75} /> Photo
          </button>
          <button
            type="button"
            onClick={onVideo}
            className="flex-1 h-11 rounded-lg border border-hairline bg-surface text-[12.5px] font-medium text-ink-muted hover:bg-surface-soft hover:text-ink transition-colors inline-flex items-center justify-center gap-1.5"
          >
            <Video size={15} strokeWidth={1.75} /> Video
          </button>
        </div>

        {/* Area. Horizontally scrollable so nine chips never wrap into a wall on
            a 375px screen, and "Other" is a real answer — nobody standing at a
            unit should have to shop for a category. */}
        <div className="-mx-4 px-4 overflow-x-auto">
          <div className="flex gap-1.5 w-max pb-0.5">
            {CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                onClick={() => onCategory(c)}
                title={CATEGORY_LABELS[c]}
                className={`h-9 px-3 rounded-lg text-[12px] font-medium whitespace-nowrap transition-colors ${
                  finding.category === c
                    ? 'bg-ink text-canvas'
                    : 'bg-surface-strong text-ink-muted hover:text-ink'
                }`}
              >
                {CATEGORY_SHORT[c]}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-1.5">
          {SEVERITIES.map(s => (
            <button
              key={s}
              type="button"
              onClick={() => onSeverity(s)}
              title={SEVERITY_BLURB[s]}
              className={`h-10 rounded-lg text-[12px] font-medium transition-colors ${
                finding.severity === s
                  ? 'bg-ink text-canvas'
                  : 'bg-surface-strong text-ink-muted hover:text-ink'
              }`}
            >
              {SEVERITY_LABELS[s]}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

export function MediaThumb({
  media, src, onRemove,
}: {
  media: Media; src: string; onRemove: () => void
}) {
  return (
    <div className="relative w-[76px] h-[76px] rounded-lg overflow-hidden border border-hairline bg-surface-soft">
      {media.kind === 'photo' && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="Finding" className="w-full h-full object-cover" />
      )}
      {media.kind === 'video' && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-ink-muted">
          <Video size={20} strokeWidth={1.75} />
          <span className="text-[10px] tabular-nums">{humanBytes(media.bytes) || 'Clip'}</span>
        </div>
      )}
      {media.kind === 'audio' && (
        <div className="w-full h-full flex flex-col items-center justify-center gap-1 text-ink-muted">
          <span className="w-6 h-6 rounded-full bg-surface-strong flex items-center justify-center text-[11px]">♪</span>
          <span className="text-[10px] tabular-nums">{clock(media.duration_ms)}</span>
        </div>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove attachment"
        className="absolute top-0.5 right-0.5 w-6 h-6 flex items-center justify-center rounded-full bg-ink/60 text-canvas"
      >
        <X size={12} />
      </button>
    </div>
  )
}
