'use client'

import { useRef, useEffect } from 'react'
import type { FormField } from '@/lib/supabase'

interface Props {
  field: FormField
  value: string
  onChange: (v: unknown) => void
}

export default function TextareaField({ field, value, onChange }: Props) {
  const ref = useRef<HTMLTextAreaElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <textarea
      ref={ref}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || 'Type your answer…'}
      rows={5}
      className="w-full border-2 border-gray-200 focus:border-[#0a7cff] rounded-[8px] bg-transparent text-base text-[#1a1a2e] placeholder-gray-300 outline-none p-3 transition-colors resize-none"
    />
  )
}
