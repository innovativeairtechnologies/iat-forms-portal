'use client'

import { useEffect } from 'react'
import { markSubmissionRead } from '../actions'

export default function MarkAsRead({ submissionId, isRead }: { submissionId: string; isRead: boolean }) {
  useEffect(() => {
    if (!isRead) markSubmissionRead(submissionId)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submissionId])
  return null
}
