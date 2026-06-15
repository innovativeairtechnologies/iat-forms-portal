// Shared slug helper for Learn admin create/rename operations.
export function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80) || 'lesson'
}

// Given a desired slug and the slugs already used in the same scope, return a
// unique slug by appending -2, -3, … as needed.
export function uniqueSlug(desired: string, taken: string[]): string {
  const base = slugify(desired)
  if (!taken.includes(base)) return base
  let n = 2
  while (taken.includes(`${base}-${n}`)) n++
  return `${base}-${n}`
}
