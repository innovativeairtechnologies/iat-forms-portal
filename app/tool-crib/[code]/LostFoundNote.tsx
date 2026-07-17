import { IAT_NAME, IAT_PHONE_DISPLAY, IAT_PHONE_TEL } from '@/lib/tool-crib'

/* Lost-and-found note at the bottom of the scanned-tool page. Whoever finds a
   tool and points their phone at its label lands here — this tells them who to
   call. Plain presentational component (no hooks) so both the client tool view
   and the server not-found view can render it. */
export default function LostFoundNote() {
  return (
    <p className="mt-6 text-center text-[12px] text-ink-faint leading-relaxed">
      If found, please contact {IAT_NAME}
      <br />
      <a href={`tel:${IAT_PHONE_TEL}`} className="text-brand font-semibold">
        {IAT_PHONE_DISPLAY}
      </a>
    </p>
  )
}
