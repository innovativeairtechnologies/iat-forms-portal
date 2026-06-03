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
      className="w-full border-2 border-gray-100 focus:border-[#089447] rounded-xl bg-transparent text-[15px] text-[#0a0a0b] placeholder-gray-200 outline-none p-4 transition-colors resize-none leading-relaxed"
    />
  )
}
