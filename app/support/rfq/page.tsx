import type { Metadata } from 'next'
import RfqWizard from '@/components/support/RfqWizard'

// The guided Request for Quote / moisture survey — the interactive replacement
// for the two Word documents ("IAT Quote Request and Moisture Survey Form",
// Room and Process) that used to be emailed as attachments.
//
// Fully client-side and anonymous: no session lookup, so this renders statically
// and a stranger with a humidity problem can reach our desk without an account.
// /support is not in the middleware matcher, so nothing here is gated.

export const metadata: Metadata = {
  title: 'Request for Quote — IAT',
  description:
    'A guided moisture survey for room and process dehumidification. Three minutes, typical values filled in as you go, and a branded PDF of the whole survey at the end.',
}

export default function RfqPage() {
  return <RfqWizard />
}
