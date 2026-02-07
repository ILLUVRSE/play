/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './lib/**/*.{js,ts,jsx,tsx}'
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'SFMono-Regular']
      },
      colors: {
        brand: {
          primary: '#1C8174',
          primaryLight: '#49B2A2',
          primaryDark: '#0C7D44',
          gold: '#E2B443',
          goldDark: '#C89C2E',
          bg: '#0A1A1A',
          glow: '#7FFFD4'
        }
      },
      boxShadow: {
        glow: '0 0 40px rgba(127,255,212,0.25)',
        gold: '0 0 40px rgba(226,180,67,0.3)'
      }
    }
  },
  plugins: []
};
