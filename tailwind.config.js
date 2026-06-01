/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#0B1F4B',
          800: '#0d2257',
          700: '#102a68',
          600: '#143278',
          500: '#1a3e8f',
        },
        accent: {
          DEFAULT: '#1B6CA8',
          light: '#2585cc',
          dark: '#135180',
        },
      },
      fontFamily: {
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
      },
    },
  },
  plugins: [],
}
