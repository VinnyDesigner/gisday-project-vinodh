/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        midnight: {
          950: '#050811',
          900: '#080D1A',
          850: '#0C1324',
          800: '#111A2E',
          700: '#1B2742',
        },
        cyanAccent: {
          400: '#22D3EE',
          500: '#06B6D4',
        },
        amberAccent: {
          400: '#FBBF24',
          500: '#F59E0B',
        },
      },
      fontFamily: {
        serif: ['"Instrument Serif"', '"Playfair Display"', 'Georgia', 'serif'],
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
    },
  },
  plugins: [],
};
