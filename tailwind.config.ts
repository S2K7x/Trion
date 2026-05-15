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
          bg:      '#0d1117',
          surface: '#161b22',
          surface2:'#1c2330',
          text:    '#e6edf3',
          muted:   '#7d8590',
          accent:  '#58a6ff',
          green:   '#3fb950',
          yellow:  '#d29922',
          red:     '#f85149',
          orange:  '#f0883e',
        },
      },
      fontFamily: {
        sans: ['var(--font-syne)', 'sans-serif'],
        mono: ['var(--font-dm-mono)', 'Menlo', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
export default config
