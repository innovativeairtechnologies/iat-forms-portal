'use client'

import { useRef, useEffect } from 'react'
import type { FormField } from '@/lib/supabase'

interface Props {
  field: FormField
  value: string
  onChange: (v: unknown) => void
}

export default function NumberField({ field, value, onChange }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <input
      ref={ref}
      type="number"
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || '0'}
      className="w-full border-0 border-b-2 border-gray-200 focus:border-[#089447] bg-transparent text-xl text-[#1a1a2e] placeholder-gray-300 outline-none py-2 transition-colors"
    />
  )
}
