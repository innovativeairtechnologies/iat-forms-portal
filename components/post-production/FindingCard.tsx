'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, CircleAlert, Loader2, MicOff, RotateCcw, Trash2, Video, X } from 'lucide-react'
import {
  CATEGORIES, CATEGORY_LABELS, CATEGORY_SHORT, SEVERITIES, SEVERITY_BLURB, SEVERITY_LABELS,
  clock, humanBytes,
  type Category, type Media, type MediaKind, type PpFinding, type Severity,
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

/** An upload in flight, or one that failed and can be retried.
 *
 *  🔴 `retry` exists because the alternative is asking somebody to film it
 *  again. A 2-minute clip that dies at 90% on shop wifi has cost two minutes of
 *  filming and two of waiting; making them re-shoot is how a tool stops being
 *  used. The file is held in memory by the page so retry re-sends the SAME
 *  bytes. */
export type UploadState = {
  kind: MediaKind
  /** 0–1 while running. */
  pct: number
  error?: string
  retry?: () => void
  cancel?: () => void
  /** Set when re-sending the same bytes cannot work (too big, wrong type). The
   *  strip then offers a fresh pick instead of a retry — see UploadStrip. */
  permanent?: boolean
  /** A non-fatal problem with a file that uploaded FINE — today, a video with no
   *  audio track. Unlike an error this persists after success, because the whole
   *  point is that nothing else about the clip looks wrong. */
  warning?: string
}

export default function FindingCard({
  finding, number, transcriptionConfigured, uploadEndpoint, mediaSrcFor, upload,
  onNote, onCategory, onSeverity, onPhoto, onVideo, onAudio, onRemoveMedia, onRestoreMedia, onRemove,
}: {
  finding: Local
  number: number
  transcriptionConfigured: boolean
  uploadEndpoint: string
  mediaSrcFor: (path: string) => string
  /** Set while an attachment for THIS finding is uploading or has failed. */
  upload?: UploadState
  onNote: (note: string, source: PpFinding['note_source']) => void
  onCategory: (c: Category) => void
  onSeverity: (s: Severity) => void
  onPhoto: () => void
  onVideo: () => void
  onAudio: (m: Media, previewUrl: string) => void
  onRemoveMedia: (path: string) => void
  /** Put back what onRemoveMedia just took off. Symmetric on purpose — see the
   *  undo strip below. */
  onRestoreMedia: (m: Media) => void
  onRemove: () => void
}) {
  const taRef = useRef<HTMLTextAreaElement | null>(null)

  /* Removal is one tap on a small target held at arm's length next to a running
     unit, and what it removes may be a two-minute clip that cost a walk to film.
     The bytes survive in storage — removal only detaches — but nothing in the UI
     could reach them again, so a mis-tap meant re-filming. This keeps the last
     removal on hand until the next one. */
  const [undoable, setUndoable] = useState<Media | null>(null)

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
          className="w-full resize-none rounded-lg bg-surface border border-hairline px-3 py-2.5 text-[16px] leading-relaxed text-ink placeholder:text-ink-faint hover:border-hairline-strong focus:border-brand focus:outline-none focus:ring-2 focus:ring-focus transition-colors"
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
              <MediaThumb
                key={m.path}
                media={m}
                src={mediaSrcFor(m.path)}
                onRemove={() => { setUndoable(m); onRemoveMedia(m.path) }}
              />
            ))}
          </div>
        )}

        {undoable && (
          <div className="flex items-center gap-2 rounded-lg border border-hairline bg-surface-soft px-3 py-2">
            <span className="text-[12.5px] text-ink-secondary">
              {undoable.kind === 'video' ? 'Clip' : undoable.kind === 'photo' ? 'Photo' : 'Recording'} removed.
            </span>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => { onRestoreMedia(undoable); setUndoable(null) }}
              className="inline-flex items-center gap-1.5 h-8 px-2.5 rounded-lg bg-surface border border-hairline-strong text-[12.5px] font-medium text-ink-secondary hover:text-ink transition-colors"
            >
              <RotateCcw size={13} /> Undo
            </button>
            <button
              type="button"
              onClick={() => setUndoable(null)}
              aria-label="Dismiss"
              className="w-8 h-8 rounded-lg inline-flex items-center justify-center text-ink-faint hover:text-ink transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        )}

        <UploadStrip
          upload={upload}
          onPickAgain={upload?.kind === 'video' ? onVideo : onPhoto}
        />

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

/* Progress, and a way back from a failure.
 *
 * A 135MB clip is roughly two minutes of 1080p, and on shop wifi that is a long
 * silence. Without this the screen looks frozen, and the natural response —
 * reload, or press the button again — is the one that loses the walk.
 *
 * ⚠️ The bar is driven by real XHR upload progress, not a timer. A fake bar that
 * reaches 90% and sits there is worse than no bar: it teaches people the number
 * is a lie, and then they ignore it when it matters. */
function UploadStrip({ upload, onPickAgain }: { upload?: UploadState; onPickAgain?: () => void }) {
  if (!upload) return null
  const noun = upload.kind === 'video' ? 'clip' : upload.kind === 'photo' ? 'photo' : 'recording'

  if (upload.error) {
    /* ⚠️ NEVER offer a retry for a permanent failure.
     *
     * The first cut offered "Try that clip again" for everything, including a
     * 184MB video. Tapping it re-ran the same size check, failed in under a
     * millisecond, and re-rendered a byte-identical message — so the button was
     * reported as broken. It was not; it was working perfectly and doing
     * something useless. A file that is too big is too big on the second press
     * too. The only move that helps is picking a different one. */
    return (
      <div className="rounded-lg border border-rose-200 dark:border-rose-500/30 bg-rose-50/60 dark:bg-rose-500/10 px-3 py-2.5">
        <p className="flex items-start gap-2 text-[12.5px] text-rose-700 dark:text-rose-300 leading-snug">
          <CircleAlert size={15} className="mt-0.5 flex-shrink-0" />
          <span>{upload.error}</span>
        </p>
        {upload.permanent ? (
          onPickAgain && upload.kind !== 'audio' && (
            <button
              type="button"
              onClick={onPickAgain}
              className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-surface border border-hairline-strong text-[13px] font-medium text-ink-secondary hover:text-ink transition-colors"
            >
              {upload.kind === 'video' ? <Video size={14} /> : <Camera size={14} />}
              Choose a different {noun}
            </button>
          )
        ) : upload.retry ? (
          <button
            type="button"
            onClick={upload.retry}
            className="mt-2 inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-surface border border-hairline-strong text-[13px] font-medium text-ink-secondary hover:text-ink transition-colors"
          >
            <RotateCcw size={14} /> Try that {noun} again
          </button>
        ) : null}
      </div>
    )
  }

  /* A clip that uploaded perfectly and has no sound in it. Deliberately NOT an
     error — the file is fine and worth keeping — but it must be said now, at the
     unit, while re-filming is still possible. */
  if (upload.warning) {
    return (
      <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 px-3 py-2.5">
        <p className="flex items-start gap-2 text-[12.5px] text-amber-800 dark:text-amber-200 leading-snug">
          <MicOff size={15} className="mt-0.5 flex-shrink-0" />
          <span>{upload.warning}</span>
        </p>
      </div>
    )
  }

  const pct = Math.round(upload.pct * 100)
  return (
    <div className="rounded-lg border border-hairline bg-surface-soft px-3 py-2.5">
      <p className="flex items-center gap-2 text-[12.5px] text-ink-secondary">
        <Loader2 size={14} className="animate-spin flex-shrink-0" />
        <span>Sending the {noun}…</span>
        <span className="flex-1" />
        <span className="tabular-nums font-medium text-ink">{pct}%</span>
      </p>
      <div className="mt-2 h-1.5 rounded-full bg-surface-strong overflow-hidden">
        <div
          className="h-full rounded-full bg-brand transition-[width] duration-200 ease-out"
          style={{ width: `${Math.max(2, pct)}%` }}
        />
      </div>
      {/* Said once, plainly. Leaving mid-upload is the thing that loses it. */}
      <p className="mt-1.5 text-[11px] text-ink-faint">Keep this page open until it finishes.</p>
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
      {/* 🔴 THIS BUTTON WAS INVISIBLE, NOT MISSING.
           It read `bg-ink/60`, and every colour token is an opaque var(), so
           Tailwind generated NO RULE — a light X floating with no backing, and on
           the video tile (already a light surface) completely unseeable. It was
           reported as "there is no way to delete a clip". Verified against the
           compiled CSS: bg-ink/60 appears in zero files.

           Solid `bg-ink` needs no alpha, so it cannot fail the same way. The
           light ring keeps it legible against a dark photo, and 28px is a real
           thumb target rather than a 24px corner pip. */}
      <button
        type="button"
        onClick={onRemove}
        aria-label="Remove this attachment"
        className="absolute top-1 right-1 w-7 h-7 flex items-center justify-center rounded-full bg-ink text-canvas ring-1 ring-canvas active:scale-95 transition-transform"
      >
        <X size={14} strokeWidth={2.5} />
      </button>
    </div>
  )
}
