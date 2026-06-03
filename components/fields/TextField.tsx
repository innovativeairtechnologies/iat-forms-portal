'use client'

import { useRef, useEffect } from 'react'
import type { FormField } from '@/lib/supabase'

interface Props {
  field: FormField
  value: string
  onChange: (v: unknown) => void
  type?: string
}

export default function TextField({ field, value, onChange, type = 'text' }: Props) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { ref.current?.focus() }, [])

  return (
    <input
      ref={ref}
      type={type}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      placeholder={field.placeholder || (type === 'email' ? 'name@company.com' : 'Type your answer…')}
      className="w-full border-0 border-b-2 border-gray-100 focus:border-[#089447] bg-transparent text-[22px] font-medium text-[#0a0a0b] placeholder-gray-200 outline-none py-2 transition-colors tracking-tight"
    />
  )
}
