/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Paleta principal — tom escuro, medieval
        stone:   { DEFAULT: '#1a1814', 100: '#252219', 200: '#302c22', 300: '#3d382c' },
        parchment: { DEFAULT: '#e8dcc8', dark: '#c9b99a' },
        crimson: { DEFAULT: '#8b1a1a', light: '#b22222' },
        gold:    { DEFAULT: '#c9a227', light: '#f0c040' },
        ink:     { DEFAULT: '#2a2520' },
      },
      fontFamily: {
        display: ['"Cinzel"', 'Georgia', 'serif'],
        body:    ['"Inter"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}