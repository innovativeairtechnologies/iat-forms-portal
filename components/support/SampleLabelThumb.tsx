'use client'

import { useState } from 'react'
import { X } from 'lucide-react'

// Sample nameplate, pinned to the top-right of the serial/equipment step so
// customers (especially contractors & 3rd-party techs) can see exactly which
// label we're asking them to read from. Tap to enlarge.
export function SampleLabelThumb() {
  const [zoom, setZoom] = useState(false)
  return (
    <>
      <figure className="w-36 flex-shrink-0 text-center sm:w-44">
        <button
          type="button"
          onClick={() => setZoom(true)}
          className="block w-full overflow-hidden rounded-xl border border-gray-200 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-700"
          aria-label="Enlarge sample label"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/support/label-sample.jpg"
            alt="Example IAT nameplate showing the serial number, model, and voltage"
            className="aspect-[4/3] w-full object-cover transition-opacity hover:opacity-90"
          />
        </button>
        <figcaption className="mt-1.5 text-[11px] text-gray-400">Sample label — tap to enlarge</figcaption>
      </figure>

      {zoom && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            onClick={() => setZoom(false)}
            className="absolute right-4 top-4 text-white/80 hover:text-white"
            aria-label="Close"
          >
            <X size={24} />
          </button>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/support/label-sample.jpg"
            alt="Example IAT nameplate"
            className="max-h-[85vh] max-w-[90vw] rounded-lg shadow-2xl"
          />
        </div>
      )}
    </>
  )
}
