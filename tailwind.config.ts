import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: "#1a2744",
          deep: "#0f1419",
          light: "#1e3055",
          800: "#162038",
          900: "#0d1520",
        },
        gold: {
          DEFAULT: "#d4a847",
          light: "#e8c876",
          dark: "#b8922e",
          50: "#fdf8ed",
          100: "#f9edcc",
          200: "#f2d999",
          300: "#e8c876",
          400: "#d4a847",
          500: "#c49a2f",
          600: "#b8922e",
          700: "#8a6d22",
          800: "#5c4917",
          900: "#2e240b",
        },
        cream: {
          DEFAULT: "#f5f0e8",
          light: "#faf8f4",
          dark: "#e8dfd3",
        },
      },
      fontFamily: {
        display: ["var(--font-playfair)", "Georgia", "serif"],
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
      },
      backgroundImage: {
        "gold-gradient": "linear-gradient(135deg, #e8c876, #d4a847, #b8922e)",
        "navy-gradient": "linear-gradient(180deg, #1a2744, #0f1419)",
        "card-gradient": "linear-gradient(145deg, rgba(30, 48, 85, 0.5), rgba(15, 20, 25, 0.8))",
      },
      boxShadow: {
        gold: "0 0 20px rgba(212, 168, 71, 0.15)",
        "gold-lg": "0 8px 32px rgba(212, 168, 71, 0.12)",
        premium: "0 4px 24px rgba(0, 0, 0, 0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.6s ease-out",
        "slide-up": "slideUp 0.6s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(20px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
