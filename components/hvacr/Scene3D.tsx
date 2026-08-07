'use client'

/* The shared react-three-fiber stage for the HVAC/R models.
 *
 * Every 3D widget in this course renders through here so camera, lighting,
 * orbit behaviour and the no-WebGL path are decided once.
 *
 * Two things this file is load-bearing for:
 *
 *   • The Canvas gets an EXPLICIT pixel height. r3f measures its parent, and a
 *     parent with auto height measures zero — the canvas then renders nothing
 *     at all, silently. Same class of trap as the Learn week-chart bars.
 *   • `frameloop` drops to "demand" under prefers-reduced-motion, so the scene
 *     renders on interaction only instead of running a rAF loop forever.
 */

import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Suspense, useEffect, useState } from 'react'
import { usePrefersReducedMotion } from './WidgetFrame'

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas')
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl') || c.getContext('experimental-webgl'))
    )
  } catch {
    return false
  }
}

export type CameraSpec = { x: number; y: number; z: number }

export function Scene3D({
  height = 340,
  camera = { x: 7, y: 5, z: 9 },
  autoRotate = false,
  /** Name used in the no-WebGL message, e.g. "reciprocating compressor". */
  label,
  overlay,
  children,
}: {
  height?: number
  camera?: CameraSpec
  autoRotate?: boolean
  label: string
  overlay?: React.ReactNode
  children: React.ReactNode
}) {
  const reduced = usePrefersReducedMotion()
  const [webgl, setWebgl] = useState<boolean | null>(null)

  // Probed on the client only — the server has no canvas to ask.
  useEffect(() => setWebgl(hasWebGL()), [])

  if (webgl === false) {
    return (
      <div
        className="flex items-center justify-center border-y border-hairline bg-surface-soft px-6 text-center"
        style={{ height }}
      >
        <p className="max-w-sm text-[13px] leading-relaxed text-ink-muted">
          <span className="font-medium text-ink-secondary">3D preview unavailable.</span> This browser
          doesn’t support WebGL, so the {label} model can’t render. Everything else in the lesson works
          normally.
        </p>
      </div>
    )
  }

  return (
    <div className="relative border-y border-hairline bg-surface-soft" style={{ height }}>
      {webgl === null ? null : (
        <Canvas
          camera={{ position: [camera.x, camera.y, camera.z], fov: 42, near: 0.1, far: 1000 }}
          dpr={[1, 2]}
          frameloop={reduced ? 'demand' : 'always'}
          style={{ touchAction: 'none' }}
        >
          <ambientLight intensity={0.75} />
          <directionalLight position={[6, 10, 8]} intensity={0.55} />
          <directionalLight position={[-6, -4, -6]} intensity={0.25} />
          <Suspense fallback={null}>{children}</Suspense>
          <OrbitControls
            enableDamping
            dampingFactor={0.08}
            autoRotate={autoRotate && !reduced}
            autoRotateSpeed={1}
            minDistance={3}
            maxDistance={22}
            makeDefault
          />
        </Canvas>
      )}
      {overlay ? <div className="pointer-events-none absolute left-4 top-4 max-w-[15rem]">{overlay}</div> : null}
    </div>
  )
}

/** Floating explanation over a model. Deliberately not a three.js <Html> —
 *  it stays crisp, stays in the DOM for screen readers, and takes tokens. */
export function SceneLegend({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-3 py-2 text-[11px] leading-relaxed text-ink-secondary">
      {children}
    </div>
  )
}

export function SceneKey({ items }: { items: { color: string; label: string }[] }) {
  return (
    <div className="rounded-lg border border-hairline bg-surface px-3 py-2 text-[11px] leading-relaxed text-ink-secondary">
      {items.map((i) => (
        <div key={i.label} className="flex items-center gap-2">
          <span
            className="h-2 w-2 shrink-0 rounded-full"
            style={{ background: i.color }}
            aria-hidden="true"
          />
          {i.label}
        </div>
      ))}
    </div>
  )
}
