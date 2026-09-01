import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Quiet Precision semantic tokens (DESIGN.md §2) — values live in globals.css
        // so they theme automatically. Components use these, never raw palettes.
        canvas: 'var(--canvas)',
        // Pre-multiplied alpha — see --scrim in globals.css. Never write
        // `bg-ink/40` for this; it generates no rule.
        scrim: 'var(--scrim)',
        surface: {
          DEFAULT: 'var(--surface)',
          soft: 'var(--surface-soft)',
          strong: 'var(--surface-strong)',
        },
        hairline: {
          DEFAULT: 'var(--hairline)',
          soft: 'var(--hairline-soft)',
          strong: 'var(--hairline-strong)',
        },
        ink: {
          DEFAULT: 'var(--ink)',
          secondary: 'var(--ink-secondary)',
          muted: 'var(--ink-muted)',
          faint: 'var(--ink-faint)',
        },
        brand: {
          DEFAULT: 'var(--brand)',
          hover: 'var(--brand-hover)',
          soft: 'var(--brand-soft)',
          ink: 'var(--brand-ink)',
          blue: 'var(--brand-blue)',
          'blue-hover': 'var(--brand-blue-hover)',
        },
        sidebar: {
          DEFAULT: 'var(--sidebar)',
          strong: 'var(--sidebar-strong)',
          hairline: 'var(--sidebar-hairline)',
          ink: 'var(--sidebar-ink)',
          'ink-secondary': 'var(--sidebar-ink-secondary)',
          'ink-muted': 'var(--sidebar-ink-muted)',
          'ink-faint': 'var(--sidebar-ink-faint)',
          brand: 'var(--sidebar-brand)',
          'brand-ink': 'var(--sidebar-brand-ink)',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Nunito Sans', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        DEFAULT: '8px',
        xl: '12px',
        '2xl': '16px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.04), 0 2px 8px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 16px rgba(0,0,0,0.08), 0 2px 6px rgba(0,0,0,0.04)',
        'card-sm': '0 1px 2px rgba(0,0,0,0.05)',
        'inner-sm': 'inset 0 1px 2px rgba(0,0,0,0.04)',
      },
      fontSize: {
        '2xs': ['10px', { lineHeight: '14px', letterSpacing: '0.05em' }],
      },
      letterSpacing: {
        tight: '-0.02em',
        tighter: '-0.03em',
      },
      animation: {
        'fade-up': 'fadeUp 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        // Floating right drawer (components/ui/Drawer.tsx) — 200ms ease-out per
        // DESIGN.md §7; slides in from the right edge rather than rising.
        'drawer-in': 'drawerIn 0.2s cubic-bezier(0.22, 0.61, 0.36, 1)',
        'scrim-in': 'scrimIn 0.16s ease-out',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        drawerIn: {
          '0%': { opacity: '0', transform: 'translateX(calc(100% + 1.5rem))' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        scrimIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
export default config
