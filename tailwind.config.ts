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
        navy: {
          DEFAULT: '#1a1a2e',
          light: '#22223f',
          dark: '#0f0f1a',
        },
        brand: {
          DEFAULT: '#089447',
          hover: '#077a3c',
          light: '#f0faf4',
        },
        // Override Tailwind indigo with IAT green so all admin indigo-* classes cascade
        indigo: {
          50:  '#f0faf4',
          100: '#dcf5e6',
          200: '#b9ebce',
          300: '#7dd9a8',
          400: '#44c07d',
          500: '#089447',
          600: '#077a3c',
          700: '#066832',
          800: '#055229',
          900: '#04401f',
          950: '#022d12',
        },
      },
      fontFamily: {
        sans: ['Avenir Next', 'Avenir', 'system-ui', 'sans-serif'],
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
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },
  plugins: [],
}
export default config
