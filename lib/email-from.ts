// Central "from" addresses for all Resend mail.
//
// Every sender defaults to Resend's shared sandbox address
// (onboarding@resend.dev) so the app keeps sending before the
// dehumidifiers.com domain is verified in Resend. Once the domain is verified,
// set the env vars below in Vercel to flip every sender to the real domain —
// no code deploy required.
//
//   RESEND_FROM_SUPPORT  → support / ticket / troubleshooting mail
//                          e.g. "IAT Technical Support <technicalsupport@dehumidifiers.com>"
//   RESEND_FROM_PORTAL   → portal / system mail (welcome, PTO, digest, tools, SRV)
//                          e.g. "IAT Portal <noreply@dehumidifiers.com>"
//   RESEND_FROM_FORMS    → form-builder submission notifications
//                          e.g. "IAT Forms <noreply@dehumidifiers.com>"
//
// RESEND_FROM (legacy, read by the duct-traverse tool) still works: if set it
// is used as the PORTAL fallback when RESEND_FROM_PORTAL is unset.

const SANDBOX_SUPPORT = 'IAT Support <onboarding@resend.dev>'
const SANDBOX_PORTAL = 'IAT Portal <onboarding@resend.dev>'
const SANDBOX_FORMS = 'IAT Forms <onboarding@resend.dev>'

export const EMAIL_FROM = {
  SUPPORT: process.env.RESEND_FROM_SUPPORT || SANDBOX_SUPPORT,
  PORTAL: process.env.RESEND_FROM_PORTAL || process.env.RESEND_FROM || SANDBOX_PORTAL,
  FORMS: process.env.RESEND_FROM_FORMS || SANDBOX_FORMS,
} as const

// ── Internal-only sender ──────────────────────────────────────────────────────
// Mail addressed to IAT staff takes a different path than customer mail: it
// comes back INTO our own tenant, where Proofpoint Essentials treats a message
// claiming to be from dehumidifiers.com but arriving externally as domain
// spoofing. On 2026-08-20 that path was found to strip the envelope sender to
// <>, so SPF evaluated as None and DKIM/DMARC as N/A — the message had nothing
// left to authenticate with and quarantined as spam every time. Proofpoint
// refuses to allow-list your own registered domain (that would be a real
// spoofing hole), so no allow entry or filter rule could rescue it.
//
// The fix is to stop claiming to be dehumidifiers.com on staff-bound mail:
// RESEND_FROM_INTERNAL points at a subdomain Proofpoint does not protect, which
// both removes the spoofing verdict and can be allow-listed normally — the same
// shape as the third-party senders already in that allow list.
//
// Customer-facing mail deliberately does NOT use this. It still sends from
// dehumidifiers.com, where it works fine and where the recognizable domain is
// worth more than the routing convenience.
//
// Unset, internalFrom() returns the caller's existing address, so behavior is
// byte-identical to before this existed. It is safe to deploy long before any
// DNS record exists.
export function internalFrom(fallback: string): string {
  return process.env.RESEND_FROM_INTERNAL || fallback
}
