import { redirect } from 'next/navigation'

// ─── /clock — the QR target ───────────────────────────────────────────────────
//
// A deliberately short path, because it is encoded into a printed QR by the door:
// fewer characters means fewer modules, which means a bigger, blacker pattern
// that a phone locks onto in a fraction of a second rather than after a hunt.
// '/clock' is 27 characters with the origin; '/admin/me/time-clock' would be 41
// and pushes the code up a QR version.
//
// ⚠️ It is in the middleware matcher (see middleware.ts). The matcher is a PREFIX
// WHITELIST — a top-level route that is not listed renders with no session check
// at all. This one carries no data of its own, but an unlisted /clock would send
// signed-out scanners into an unauthenticated bounce instead of the login page
// with the right redirect on it.
export default function ClockShortLink() {
  redirect('/admin/me/time-clock')
}
