'use client'

import { useRef, useEffect } from 'react'
import type { FormField } from '@/lib/supabase'

interface Props {
  field: FormField
  value: string
  onChange: (v: unknown) => void
}

export default function DateField({ field, value, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <input
      ref={ref}
      type="date"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      className="border-2 border-gray-200 focus:border-[#0a7cff] rounded-[8px] bg-transparent text-base text-[#1a1a2e] outline-none px-4 py-3 transition-colors"
    />
  )
}
