/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        dark: {
          DEFAULT: '#0F172A',
          lighter: '#1E293B',
          card: '#1E293B',
          border: '#334155',
        },
      },
    },
  },
  plugins: [],
}
