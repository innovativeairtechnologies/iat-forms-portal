// ─── Innovative Air Technologies — the company's own details ─────────────────
//
// ONE definition, because these appear on customer-facing paper. A second copy
// inside a PDF generator is how a document ends up printing a stale address
// nobody notices for a year — the survey PDF, proposals, SOOs and case studies
// all want the same letterhead.
//
// Source: the footer of www.dehumidifiers.com, read 2026-08-25. Printed there as
// "16200 Georgia Peach Ave, Covington, GA.  30014" — normalized here to the usual
// US postal form (no period after the state, single space before the ZIP).
// Corroborated from inside the repo: lib/ashrae.ts uses Covington, GA as its
// worked example because it is the office's own location.
//
// ⚠️ If any of this changes, change it HERE. Everything downstream reads these.

export const COMPANY = {
  /** Full legal name. The ONLY organization this codebase may name — see the
   *  anonymization rule in the root CLAUDE.md. */
  name: 'Innovative Air Technologies',
  street: '16200 Georgia Peach Ave',
  city: 'Covington',
  state: 'GA',
  zip: '30014',
  /** Display form for the web address — no scheme, it is being read not clicked. */
  website: 'dehumidifiers.com',
  phone: '770-788-6744',
  tollFree: '888-379-2477',
} as const

/** "16200 Georgia Peach Ave · Covington, GA 30014" — one line, for a header. */
export const companyAddressLine = (): string =>
  `${COMPANY.street} · ${COMPANY.city}, ${COMPANY.state} ${COMPANY.zip}`

/** "dehumidifiers.com · 770-788-6744" — the contact line under the address. */
export const companyContactLine = (): string =>
  `${COMPANY.website} · ${COMPANY.phone}`
