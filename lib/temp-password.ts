import { randomInt } from 'crypto'

/**
 * Readable one-time password (no ambiguous chars like 0/1/l). The customer is
 * forced to change it on first login via the /customer/welcome gate, so it's
 * only ever used once. Shared by the invite + resend-invite routes.
 */
export function genTempPassword(): string {
  const lower = 'abcdefghijkmnpqrstuvwxyz' // no 'l'
  const digits = '23456789'                // no 0/1
  const pick = (set: string, n: number) =>
    Array.from({ length: n }, () => set[randomInt(set.length)]).join('')
  return `IAT-${pick(lower, 4)}${pick(digits, 4)}`
}
