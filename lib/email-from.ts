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
