// One definition of how large a photo may be, imported by every uploader that
// writes to the public `ticket-photos` bucket.
//
// That bucket is the widest-open surface we have: the support form and the
// troubleshooting checklist are unauthenticated links, so anyone who can reach
// them can write bytes into it. The admin portal sits behind an MFA login; these
// two do not. The limit here is deliberately tighter than the engineer-facing
// `post-production` bucket for that reason alone — not because the files differ.
//
// The browser never resizes what it uploads. `fileToResizedDataUrl` in
// EquipmentTicketForm shrinks a copy for the nameplate OCR scan and nothing
// else; the file that reaches storage is the original off the phone. So this is
// a real ceiling on real bytes, not a formality.
//
// Enforced in two places on purpose, and the split matters:
//   • Here, in the browser, at the moment a file is CHOSEN — instant, names the
//     file, and explains itself.
//   • On the bucket (`file_size_limit`, 20MB), which is the one that actually
//     binds, because a browser check is advisory to anyone posting directly.
// Keep the two in step. If they drift, the bucket wins and the customer sees a
// generic upload failure with nothing to act on — they will retry the same file
// forever. Raise the bucket first, then this.
export const PHOTO_MAX_BYTES = 20 * 1024 * 1024

export const PHOTO_MAX_LABEL = '20MB'

/** Split a pick into what we'll accept and a reason for anything we won't. */
export function screenPhotos(files: File[]): { accepted: File[]; rejected: string[] } {
  const accepted: File[] = []
  const rejected: string[] = []
  for (const f of files) {
    if (!f.type.startsWith('image/')) rejected.push(`${f.name} isn't an image`)
    else if (f.size > PHOTO_MAX_BYTES) rejected.push(`${f.name} is over ${PHOTO_MAX_LABEL}`)
    else accepted.push(f)
  }
  return { accepted, rejected }
}
