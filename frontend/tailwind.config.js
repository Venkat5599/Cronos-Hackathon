/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        primary: '#00c8ff',
        'background-light': '#f5f8f8',
        'background-dark': '#0f1f23',
        'card-dark': '#172f36',
        'border-dark': '#20424b',
        'success-green': '#00e887',
        'danger-red': '#ff4757',
      },
      fontFamily: {
        display: ['Inter', 'sans-serif'],
        mono: ['IBM Plex Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
