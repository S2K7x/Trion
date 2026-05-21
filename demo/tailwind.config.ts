import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        trion: {
          bg:         '#0d1117',
          surface:    '#161b22',
          surface2:   '#1c2330',
          border:     'rgba(255,255,255,0.06)',
          border2:    'rgba(255,255,255,0.10)',
          text:       '#e6edf3',
          muted:      '#7d8590',
          dim:        '#4a525f',
          accent:     '#58a6ff',
          'accent-dim': 'rgba(88,166,255,0.12)',
          green:      '#3fb950',
          'green-dim': 'rgba(63,185,80,0.12)',
          yellow:     '#d29922',
          'yellow-dim': 'rgba(210,153,34,0.12)',
          red:        '#f85149',
          'red-dim':  'rgba(248,81,73,0.12)',
          orange:     '#f0883e',
          'orange-dim':'rgba(240,136,62,0.10)',
        },
      },
      fontFamily: {
        sans:    ['var(--font-syne)', 'system-ui', 'sans-serif'],
        display: ['var(--font-syne)', 'system-ui', 'sans-serif'],
        mono:    ['var(--font-dm-mono)', 'Menlo', 'Consolas', 'monospace'],
      },
      spacing: {
        '1.5': '6px',
        '2.5': '10px',
        '4.5': '18px',
        '5.5': '22px',
        '7':   '28px',
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        lg: '12px',
      },
      fontSize: {
        '10': ['10px', { lineHeight: '14px' }],
        '11': ['11px', { lineHeight: '16px' }],
      },
      letterSpacing: {
        tighter: '-0.03em',
        tight:   '-0.02em',
        wide:    '0.04em',
        wider:   '0.06em',
        widest:  '0.08em',
      },
    },
  },
  plugins: [],
}
export default config
