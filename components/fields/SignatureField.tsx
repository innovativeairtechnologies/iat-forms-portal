'use client'

import { useRef, useState } from 'react'
import type { FormField } from '@/lib/supabase'
import { Pen, Trash2 } from 'lucide-react'
import dynamic from 'next/dynamic'
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ReactSignatureCanvas = dynamic(() => import('react-signature-canvas'), { ssr: false }) as any

interface SigCanvas {
  toDataURL: (type?: string) => string
  clear: () => void
  isEmpty: () => boolean
}

interface Props {
  field: FormField
  value: string
  onChange: (v: unknown) => void
}

export default function SignatureField({ field: _field, value, onChange }: Props) {
  const sigRef = useRef<SigCanvas | null>(null)
  // Initialise from value so "Signature captured" persists when navigating back
  const [signed, setSigned] = useState(!!value)

  const handleEnd = () => {
    // requestAnimationFrame ensures the canvas has committed the stroke
    // before we read isEmpty() / toDataURL() — fixes a race with dynamic import.
    requestAnimationFrame(() => {
      const canvas = sigRef.current
      if (!canvas || canvas.isEmpty()) return
      onChange(canvas.toDataURL('image/png'))
      setSigned(true)
    })
  }

  const handleClear = () => {
    sigRef.current?.clear()
    onChange('')
    setSigned(false)
  }

  return (
    <div>
      <div className="border-2 border-gray-200 rounded-[8px] overflow-hidden bg-white">
        <ReactSignatureCanvas
          ref={sigRef}
          onEnd={handleEnd}
          canvasProps={{
            className: 'w-full touch-none',
            style: { width: '100%', height: '160px', display: 'block' },
          }}
          penColor="#1a1a2e"
        />
      </div>
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-1.5 text-xs text-gray-400">
          <Pen size={12} />
          <span>Draw your signature above</span>
        </div>
        {signed && (
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center gap-1 text-xs text-red-500 hover:text-red-700 transition-colors"
          >
            <Trash2 size={12} />
            Clear
          </button>
        )}
      </div>
      {value && (
        <p className="mt-1 text-xs text-green-600">Signature captured</p>
      )}
    </div>
  )
}
