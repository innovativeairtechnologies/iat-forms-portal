'use client'

// The reactor's heart — a shader-based plasma sun (the Doc-Ock miniature star,
// IAT edition). A displaced, domain-warped noise field roils across the sphere;
// the color ramp runs deep teal → IAT emerald → white-hot with molten gold in
// the hottest pockets; a fresnel corona wraps the rim. While Jerry reads a
// document ("FEED ME" mode) the surface boils harder, faster, and brighter, and
// an absorb flash blooms it out for a beat.
//
// Rendered with react-three-fiber (already a dependency via the SRV 3D scene).
// Import with next/dynamic ssr:false (r3f gotcha), give the wrapper an explicit
// size (Canvas fills it), and pass a WebGL fallback via <Canvas fallback>.

import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Canvas, useFrame } from '@react-three/fiber'

type SunProps = {
  /** True while a document is being read/absorbed — boils harder + brighter. */
  charging: boolean
  /** Bump this counter to trigger an absorb flash. */
  flash: number
}

// ── GLSL ─────────────────────────────────────────────────────────────────────
// Ashima/IQ simplex 3D noise (public domain) + fbm helpers, shared by both shaders.
const NOISE_GLSL = /* glsl */ `
vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v){
  const vec2 C = vec2(1.0/6.0, 1.0/3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i  = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
            i.z + vec4(0.0, i1.z, i2.z, 1.0))
          + i.y + vec4(0.0, i1.y, i2.y, 1.0))
          + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0)*2.0 + 1.0;
  vec4 s1 = floor(b1)*2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
}
float fbm(vec3 p){
  float f = 0.0; float a = 0.5;
  for (int i = 0; i < 5; i++) {
    f += a * snoise(p);
    p = p * 2.03 + vec3(11.7, 5.3, 8.1);
    a *= 0.55;
  }
  return f;
}
`

const SUN_VERT = /* glsl */ `
uniform float uTime;
uniform float uActivity;
varying vec3 vPos;        // object space — the noise field rotates WITH the sun
varying vec3 vWorldPos;   // world space — for the view-direction fresnel
varying vec3 vWorldNormal;
${NOISE_GLSL}
void main() {
  vPos = position;
  // Uniform scale only, so mat3(modelMatrix) is fine for normals.
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  // Roiling silhouette: displace along the normal by slow fbm; boils harder when fed.
  float amp = 0.05 + uActivity * 0.09;
  float d = fbm(position * 1.9 + vec3(0.0, uTime * 0.35, uTime * 0.22));
  vec3 displaced = position + normal * d * amp;
  vec4 wp = modelMatrix * vec4(displaced, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const SUN_FRAG = /* glsl */ `
uniform float uTime;
uniform float uActivity;
uniform float uFlash;
varying vec3 vPos;
varying vec3 vWorldPos;
varying vec3 vWorldNormal;
${NOISE_GLSL}
void main() {
  float t = uTime * (0.42 + uActivity * 0.75);
  // Domain-warped fbm — the "molten convection" look.
  vec3 p = vPos * 2.3;
  vec3 warp = vec3(
    fbm(p + vec3(0.0, 0.0, t * 0.55)),
    fbm(p + vec3(5.2, 1.3, -t * 0.4)),
    fbm(p + vec3(-3.1, 7.4, t * 0.3))
  );
  float n = fbm(p + warp * 1.6 + vec3(0.0, t * 0.25, 0.0));
  // Temperature 0..1 — activity shifts the whole surface hotter.
  float temp = clamp(n * 0.5 + 0.5, 0.0, 1.0);
  temp = pow(temp, 1.35 - uActivity * 0.3);
  temp = clamp(temp + uActivity * 0.10 + uFlash * 0.22, 0.0, 1.0);

  // Molten IAT ramp: deep teal → emerald → light green → white-gold at the peaks.
  vec3 cDeep  = vec3(0.012, 0.169, 0.145); // #043b2 deep teal
  vec3 cMid   = vec3(0.023, 0.478, 0.341); // #067a57 emerald
  vec3 cHot   = vec3(0.204, 0.827, 0.600); // #34d399 bright emerald
  vec3 cCore  = vec3(0.996, 0.960, 0.780); // white-gold
  vec3 col = mix(cDeep, cMid, smoothstep(0.05, 0.45, temp));
  col = mix(col, cHot,  smoothstep(0.45, 0.74, temp));
  col = mix(col, cCore, smoothstep(0.74, 0.97, temp));

  // Crackle: thin white-hot filaments where the warp field pinches.
  float crack = smoothstep(0.62, 0.98, abs(fbm(p * 1.4 - warp + vec3(t * 0.2))));
  col += vec3(1.0, 0.95, 0.75) * crack * (0.16 + uActivity * 0.28);

  // Fresnel rim — the limb glows hotter (plasma wrap). World space throughout.
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  float fres = pow(1.0 - clamp(dot(viewDir, normalize(vWorldNormal)), 0.0, 1.0), 2.2);
  col += vec3(0.35, 0.95, 0.72) * fres * (0.55 + uActivity * 0.45);

  // Overall energy: brighter while feeding; bloom-out on absorb.
  col *= 1.0 + uActivity * 0.35 + uFlash * 1.4;
  gl_FragColor = vec4(col, 1.0);
}
`

const CORONA_VERT = /* glsl */ `
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec3 vPos;
void main() {
  vWorldNormal = normalize(mat3(modelMatrix) * normal);
  vPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`

const CORONA_FRAG = /* glsl */ `
uniform float uTime;
uniform float uActivity;
uniform float uFlash;
varying vec3 vWorldNormal;
varying vec3 vWorldPos;
varying vec3 vPos;
${NOISE_GLSL}
void main() {
  vec3 viewDir = normalize(cameraPosition - vWorldPos);
  // Rendered on the BackSide shell, so take abs() — normal faces away.
  float rim = pow(1.0 - abs(dot(viewDir, normalize(vWorldNormal))), 2.6);
  // Licks of flame around the limb.
  float flick = fbm(vPos * 2.2 + vec3(0.0, uTime * 0.5, 0.0)) * 0.5 + 0.5;
  float a = rim * (0.5 + flick * 0.5) * (0.5 + uActivity * 0.55 + uFlash * 0.9);
  vec3 col = mix(vec3(0.06, 0.72, 0.5), vec3(0.99, 0.9, 0.55), rim * flick * 0.45);
  gl_FragColor = vec4(col, a);
}
`

// ── scene ────────────────────────────────────────────────────────────────────
function Sun({ charging, flash }: SunProps) {
  const sunRef = useRef<THREE.Mesh>(null)
  const reduced = useMemo(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    [],
  )

  const uniforms = useMemo(
    () => ({
      uTime: { value: Math.random() * 100 }, // random phase so every visit looks different
      uActivity: { value: 0 },
      uFlash: { value: 0 },
    }),
    [],
  )

  const sunMat = useMemo(
    () => new THREE.ShaderMaterial({ vertexShader: SUN_VERT, fragmentShader: SUN_FRAG, uniforms }),
    [uniforms],
  )
  const coronaMat = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader: CORONA_VERT,
        fragmentShader: CORONA_FRAG,
        uniforms,
        transparent: true,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
        depthWrite: false,
      }),
    [uniforms],
  )
  useEffect(() => () => { sunMat.dispose(); coronaMat.dispose() }, [sunMat, coronaMat])

  // Absorb flash — spike, then decay in useFrame.
  const lastFlash = useRef(flash)
  useEffect(() => {
    if (flash !== lastFlash.current) {
      lastFlash.current = flash
      uniforms.uFlash.value = 1
    }
  }, [flash, uniforms])

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05)
    if (!reduced) {
      uniforms.uTime.value += step
      if (sunRef.current) {
        sunRef.current.rotation.y += step * 0.05
        sunRef.current.rotation.x += step * 0.012
      }
    }
    // Ease activity toward its target; decay the flash.
    const target = charging ? 1 : 0
    uniforms.uActivity.value += (target - uniforms.uActivity.value) * Math.min(1, step * 2.2)
    uniforms.uFlash.value = Math.max(0, uniforms.uFlash.value - step * 1.4)
  })

  return (
    <>
      <mesh ref={sunRef} material={sunMat} scale={1.06}>
        <icosahedronGeometry args={[1, 48]} />
      </mesh>
      <mesh material={coronaMat} scale={1.38}>
        <icosahedronGeometry args={[1, 12]} />
      </mesh>
    </>
  )
}

// CSS fallback when WebGL isn't available — the previous gradient wheel.
function CssFallback() {
  return (
    <>
      <span className="kb-wheel" />
      <span className="kb-core" />
    </>
  )
}

export default function ReactorSun({ charging, flash }: SunProps) {
  return (
    <Canvas
      className="!absolute !inset-0"
      camera={{ position: [0, 0, 2.55], fov: 45 }}
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      fallback={<CssFallback />}
    >
      <Sun charging={charging} flash={flash} />
    </Canvas>
  )
}
