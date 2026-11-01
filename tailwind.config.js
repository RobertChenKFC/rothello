/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        lichess: {
          bg: '#161512',
          surface: '#262421',
          surfaceHover: '#302e2b',
          border: '#3c3934',
          accent: '#629924',
          accentHover: '#72af29',
          textMuted: '#bababa',
          boardDark: '#19543e',
          boardLight: '#237355',
          boardBorder: '#144131',
        }
      },
      boxShadow: {
        'disc-black': 'inset 0 2px 4px rgba(255,255,255,0.25), inset 0 -4px 6px rgba(0,0,0,0.8), 0 4px 8px rgba(0,0,0,0.6)',
        'disc-white': 'inset 0 2px 4px rgba(255,255,255,0.9), inset 0 -4px 6px rgba(0,0,0,0.3), 0 4px 8px rgba(0,0,0,0.5)',
      }
    },
  },
  plugins: [],
}
