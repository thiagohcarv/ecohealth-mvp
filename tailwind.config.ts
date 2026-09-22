import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#2260FF",
          50: "#EBF0FF",
          100: "#CAD6FF",
          500: "#2260FF",
          600: "#1D61E7",
        },
        secondary: {
          100: "#EDF1F3",
          300: "#ACB5BB",
          400: "#6C7278",
          500: "#1A1C1E",
        },
        neutral: {
          black: "#021433",
        },
        info: "#4D81E7",
      },
      fontFamily: {
        inter: ["var(--font-inter)", "sans-serif"],
        jakarta: ["var(--font-jakarta)", "sans-serif"],
      },
      keyframes: {
        ripple: {
          "0%": { transform: "scale(1)", opacity: "0.6" },
          "100%": { transform: "scale(1.6)", opacity: "0" },
        },
        wave: {
          "0%, 100%": { transform: "scaleY(0.4)" },
          "50%": { transform: "scaleY(1)" },
        },
        "fade-in": {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        ripple: "ripple 1.5s ease-out infinite",
        "ripple-delay": "ripple 1.5s ease-out 0.5s infinite",
        "ripple-delay-2": "ripple 1.5s ease-out 1s infinite",
        wave: "wave 1.2s ease-in-out infinite",
        "fade-in": "fade-in 0.3s ease-out",
      },
    },
  },
  plugins: [],
};
export default config;
