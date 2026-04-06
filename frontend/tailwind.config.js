/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        'bg-primary': '#0a0a0f',
        'bg-secondary': '#111118',
        'bg-card': '#16161f',
        'bg-hover': '#1c1c28',
        'border-dim': '#1f2937',
        // Pro UI panel borders (slightly lighter, more visible dividers)
        'border-panel': '#252535',
        'bg-panel': '#0d0d14',
        'text-muted': '#6b7280',
        'text-dim': '#9ca3af',
        green: {
          DEFAULT: '#22c55e',
          dim: '#16a34a',
          bg: '#052e16',
        },
        red: {
          DEFAULT: '#ef4444',
          dim: '#dc2626',
          bg: '#450a0a',
        },
        accent: {
          DEFAULT: '#6366f1',
          hover: '#818cf8',
        },
        gold: '#f59e0b',
        purple: '#8b5cf6',
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
