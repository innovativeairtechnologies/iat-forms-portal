'use client'

import { useEffect, useState } from 'react'
import { MicOff } from 'lucide-react'

/* Warn BEFORE somebody films a silent walkaround.
 *
 * A blocked microphone does not only break the voice note — on a phone it also
 * makes the camera record video with **no audio track at all**. Confirmed
 * 2026-09-01: three clips uploaded from an iPhone carried a `vide` handler and
 * avc1 video, and no `soun` handler and no audio codec whatsoever. The person
 * filming has no way to tell; the walk looks fine, and the silence is only
 * discovered when an engineer opens it days later. That is a wasted trip to the
 * shop floor and a finding nobody can act on.
 *
 * So this asks the browser up front and says so once, at the top, where the
 * capture buttons are.
 *
 * ⚠️ It stays quiet unless the answer is a definite "denied". `permissions.query`
 * for the microphone is not supported everywhere (older Safari throws), and
 * "prompt" is the normal state before the first recording — warning on either
 * would put a scary banner in front of everyone whose setup is fine. Silence on
 * uncertainty is deliberate: this must never cry wolf, or people stop reading it.
 * It deliberately does NOT call getUserMedia, which would raise a permission
 * prompt nobody asked for just by opening the page. */
export default function MicBlockedBanner() {
  const [denied, setDenied] = useState(false)

  useEffect(() => {
    let cancelled = false
    const perms = navigator.permissions
    if (!perms?.query) return

    // 'microphone' is valid at runtime but missing from the DOM PermissionName union.
    const query = { name: 'microphone' } as unknown as PermissionDescriptor

    perms.query(query).then(
      status => {
        if (cancelled) return
        setDenied(status.state === 'denied')
        // Clears the moment they fix it in Settings, without a reload.
        status.onchange = () => { if (!cancelled) setDenied(status.state === 'denied') }
      },
      () => { /* unsupported — say nothing rather than guess */ },
    )
    return () => { cancelled = true }
  }, [])

  if (!denied) return null

  return (
    <div className="mx-auto w-full max-w-[720px] px-4 pt-3">
      <div className="rounded-lg border border-amber-200 dark:border-amber-500/30 bg-amber-50/70 dark:bg-amber-500/10 px-3 py-2.5">
        <p className="flex items-start gap-2 text-[12.5px] text-amber-800 dark:text-amber-200 leading-snug">
          <MicOff size={15} className="mt-0.5 flex-shrink-0" />
          <span>
            <strong className="font-semibold">The microphone is blocked for this site.</strong>{' '}
            Voice notes will not record, and <strong className="font-semibold">video will film
            without sound</strong>. On an iPhone: tap <strong className="font-semibold">aA</strong> in
            the address bar › Website Settings › Microphone › Allow, and check Settings › Safari ›
            Microphone. Photos and typed notes work either way.
          </span>
        </p>
      </div>
    </div>
  )
}
