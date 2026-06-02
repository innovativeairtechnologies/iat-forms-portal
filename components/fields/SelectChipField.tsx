'use client'

import type { FormField } from '@/lib/supabase'
import { Check } from 'lucide-react'

interface Props {
  field: FormField
  value: string | string[]
  onChange: (v: unknown) => void
  multi: boolean
}

export default function SelectChipField({ field, value, onChange, multi }: Props) {
  const options = field.options || []

  const isSelected = (opt: string) => {
    if (multi) return Array.isArray(value) && value.includes(opt)
    return value === opt
  }

  const toggle = (opt: string) => {
    if (multi) {
      const current = Array.isArray(value) ? value : []
      if (current.includes(opt)) {
        onChange(current.filter((v) => v !== opt))
      } else {
        onChange([...current, opt])
      }
    } else {
      onChange(opt)
    }
  }

  return (
    <div className="flex flex-wrap gap-2.5">
      {options.map((opt) => {
        const selected = isSelected(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-[8px] text-sm font-medium border-2 transition-all ${
              selected
                ? 'bg-[#0a7cff] border-[#0a7cff] text-white'
                : 'bg-white border-gray-200 text-[#1a1a2e] hover:border-[#0a7cff] hover:text-[#0a7cff]'
            }`}
          >
            {selected && <Check size={14} />}
            {opt}
          </button>
        )
      })}
    </div>
  )
}
