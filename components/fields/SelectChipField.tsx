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
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const selected = isSelected(opt)
        return (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 rounded-[8px] text-[13px] font-medium border transition-all duration-150 ${
              selected
                ? 'bg-[#0a0a0b] dark:bg-white border-[#0a0a0b] dark:border-white text-white dark:text-gray-900 shadow-card-sm'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:border-gray-400 dark:hover:border-gray-500 hover:text-[#0a0a0b] dark:hover:text-gray-100'
            }`}
          >
            {selected && <Check size={13} strokeWidth={2.5} />}
            {opt}
          </button>
        )
      })}
    </div>
  )
}
