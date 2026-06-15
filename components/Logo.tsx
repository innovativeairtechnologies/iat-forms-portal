import Image from 'next/image'

// Intrinsic aspect ratio (width / height) of the IAT mark.
const ASPECT = 3020 / 3857

/**
 * The IAT logo mark, floating on a transparent background — no tile, shadow, or border.
 * Renders the full-color mark in light mode and an all-white version in dark mode.
 *
 * `size` is the rendered height in px; width scales to preserve the aspect ratio.
 */
export default function Logo({
  size = 20,
  className = '',
}: {
  size?: number
  className?: string
}) {
  return (
    <Image
      src="/iat-logo-transparent.png"
      alt="IAT"
      width={Math.round(size * ASPECT)}
      height={size}
      className={`dark:[filter:brightness(0)_invert(1)] ${className}`}
    />
  )
}
