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
      className="w-full border-0 border-b-2 border-gray-200 focus:border-[#0a7cff] bg-transparent text-xl text-[#1a1a2e] placeholder-gray-300 outline-none py-2 transition-colors"
    />
  )
}
