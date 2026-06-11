'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, ShieldCheck } from 'lucide-react'

interface Props {
  formId: string
  isActive: boolean
  approvalStatus: 'pending' | 'approved'
  isSuperAdmin: boolean
}

export default function FormsListClient({ formId, isActive, approvalStatus, isSuperAdmin }: Props) {
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

  const approve = async () => {
    setLoading(true)
    const res = await fetch(`/api/forms/${formId}/approve`, { method: 'POST' })
    setLoading(false)
    if (res.ok) router.refresh()
  }

  // Pending forms cannot be toggled live — they need super-admin approval first.
  if (approvalStatus !== 'approved') {
    if (isSuperAdmin) {
      return (
        <button
          onClick={approve}
          disabled={loading}
          title="Approve this form and publish it"
          className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white bg-[#089447] hover:bg-[#077a3c] px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} />}
          Approve
        </button>
      )
    }
    return (
      <span
        title="Awaiting super-admin approval before it can go live"
        className="inline-flex items-center text-[11px] font-semibold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-100 dark:border-amber-900/50 px-2 py-1 rounded-lg whitespace-nowrap"
      >
        Pending
      </span>
    )
  }

  // Approved → normal active/paused toggle.
  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={active ? 'Active — click to pause' : 'Paused — click to activate'}
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
