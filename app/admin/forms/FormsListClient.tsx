'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  formId: string
  isActive: boolean
}

export default function FormsListClient({ formId, isActive }: Props) {
  const [active, setActive] = useState(isActive)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const toggle = async () => {
    setLoading(true)
    const newVal = !active
    setActive(newVal)
    await fetch(`/api/forms/${formId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: newVal }),
    })
    setLoading(false)
    router.refresh()
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`relative w-9 h-5 rounded-full transition-colors focus:outline-none ${
        active ? 'bg-green-500' : 'bg-gray-200'
      } disabled:opacity-50`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
          active ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}
