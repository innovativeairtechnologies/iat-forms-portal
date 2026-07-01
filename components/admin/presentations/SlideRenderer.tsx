import type { SlideData, SlideTemplate } from '@/lib/presentations'
import { backgroundOf } from '@/lib/presentations'

/* Renders a static slide block by template. Pure presentational (no hooks) so it
   works in server and client trees. It fills its parent — the parent sets the box
   size + aspect ratio (usually 16:9). The slide carries its OWN colors (from the
   background preset), independent of the app's light/dark theme. */

type Size = 'thumb' | 'card' | 'stage'

const SCALE: Record<Size, { pad: number; heading: number; sub: number; body: number; logo: number; bar: number }> = {
  thumb: { pad: 12, heading: 15, sub: 10, body: 11, logo: 22, bar: 4 },
  card:  { pad: 20, heading: 24, sub: 13, body: 16, logo: 34, bar: 6 },
  stage: { pad: 56, heading: 46, sub: 22, body: 30, logo: 64, bar: 10 },
}

export default function SlideRenderer({
  template,
  data,
  size = 'card',
}: {
  template: SlideTemplate | null
  data: SlideData
  size?: Size
}) {
  const c = backgroundOf(data.background)
  const s = SCALE[size]
  const heading = data.heading || ''
  const sub = data.subtext || ''

  const Logo = () =>
    data.logo_url ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={data.logo_url}
        alt=""
        style={{ position: 'absolute', top: s.pad, right: s.pad, height: s.logo, width: 'auto', objectFit: 'contain', opacity: 0.95 }}
      />
    ) : null

  const base: React.CSSProperties = {
    position: 'absolute',
    inset: 0,
    background: c.bg,
    color: c.fg,
    overflow: 'hidden',
    fontFamily: 'inherit',
  }

  if (template === 'divider') {
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: s.pad }}>
        <Logo />
        <div style={{ fontSize: s.heading, fontWeight: 600, lineHeight: 1.1 }}>{heading}</div>
        <div style={{ width: Math.max(28, s.heading), height: s.bar, background: c.accent, borderRadius: 999, marginTop: s.pad * 0.4 }} />
        {sub && <div style={{ fontSize: s.sub, color: c.sub, marginTop: s.pad * 0.4 }}>{sub}</div>}
      </div>
    )
  }

  if (template === 'quote') {
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: s.pad }}>
        <Logo />
        <div style={{ fontSize: s.body, lineHeight: 1.35, fontWeight: 500 }}>
          <span style={{ color: c.accent }}>“</span>
          {data.body || heading}
          <span style={{ color: c.accent }}>”</span>
        </div>
        {data.attribution && <div style={{ fontSize: s.sub, color: c.sub, marginTop: s.pad * 0.4 }}>— {data.attribution}</div>}
      </div>
    )
  }

  if (template === 'contact') {
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: s.pad }}>
        <Logo />
        <div style={{ width: s.bar, height: s.heading * 1.4, background: c.accent, borderRadius: 999, position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)' }} />
        <div style={{ fontSize: s.heading, fontWeight: 600, lineHeight: 1.1 }}>{heading || 'Get in touch'}</div>
        {sub && <div style={{ fontSize: s.sub, color: c.sub, marginTop: s.pad * 0.35, lineHeight: 1.5, whiteSpace: 'pre-line' }}>{sub}</div>}
      </div>
    )
  }

  if (template === 'blank') {
    return (
      <div style={{ ...base, display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: s.pad }}>
        <Logo />
        {heading && <div style={{ fontSize: s.heading, fontWeight: 600, lineHeight: 1.1 }}>{heading}</div>}
        {data.body && <div style={{ fontSize: s.body, color: c.sub, marginTop: s.pad * 0.35, lineHeight: 1.4, whiteSpace: 'pre-line' }}>{data.body}</div>}
      </div>
    )
  }

  // default: welcome
  return (
    <div style={{ ...base, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingLeft: s.pad + s.bar + 6, paddingRight: s.pad, paddingTop: s.pad, paddingBottom: s.pad }}>
      <Logo />
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: s.bar, background: c.accent }} />
      <div style={{ fontSize: s.heading, fontWeight: 600, lineHeight: 1.05 }}>{heading || 'Welcome'}</div>
      {sub && <div style={{ fontSize: s.sub, color: c.sub, marginTop: s.pad * 0.3 }}>{sub}</div>}
    </div>
  )
}
