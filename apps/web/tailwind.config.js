/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}', '../../packages/ui/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#050610',
        panel: '#0d1020',
        line: 'rgba(150,164,220,0.14)',
        text: '#f3f5ff',
        muted: '#8990ad',
        mint: '#e8eaff',
        signal: '#775cff',
        cyan: '#32d6ff',
        amber: '#ffb84d',
        rose: '#ff5c7c',
        blue: '#6ca8ff',
        success: '#42e6a4',
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'sans-serif'],
        serif: ['var(--font-serif)', 'serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      boxShadow: {
        panel: '0 18px 55px rgba(0,0,0,0.32)',
        glow: '0 0 50px rgba(119,92,255,0.2)',
      },
    },
  },
  plugins: [],
}
