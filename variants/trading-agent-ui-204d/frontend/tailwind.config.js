/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        dark: {
          900: "#0a0e1a",
          800: "#0f1629",
          700: "#151e36",
          600: "#1c2844",
          500: "#243055",
        },
      },
    },
  },
  plugins: [],
}


