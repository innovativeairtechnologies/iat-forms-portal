'use client'

import { useCallback, useEffect, useState } from 'react'

/* Randomised order that survives hydration.
 *
 * ⚠️ The shuffle CANNOT happen during render. These widgets are `'use client'`,
 * which still server-renders the first pass — so a `Math.random()` in the render
 * body or in a `useState` initialiser produces one order on the server and a
 * different one in the browser, and React throws a hydration mismatch.
 *
 * So the first paint is the source order, and the shuffle lands in an effect
 * immediately after mount. Nobody perceives the swap, and it is correct.
 */
export function useShuffled<T>(items: readonly T[]): { order: T[]; reshuffle: () => void } {
  const [order, setOrder] = useState<T[]>(() => [...items])

  const reshuffle = useCallback(() => {
    setOrder((prev) => {
      const a = [...prev]
      for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1))
        ;[a[i], a[j]] = [a[j], a[i]]
      }
      return a
    })
  }, [])

  useEffect(() => {
    setOrder([...items])
    reshuffle()
  }, [items, reshuffle])

  return { order, reshuffle }
}
