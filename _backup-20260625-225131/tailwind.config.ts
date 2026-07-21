import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: {
          50: "#eef2f9", 100: "#d7e0f0", 200: "#aebfdf", 300: "#7e97c9",
          400: "#5572b0", 500: "#3a5896", 600: "#2c4576", 700: "#243a63",
          800: "#1c2d4d", 900: "#16243d", 950: "#0d1626",
        },
        aqua: {
          50: "#ecfdfa", 100: "#cffbf1", 200: "#9ef5e4", 300: "#5fe8d2",
          400: "#2dd4bf", 500: "#16b8a6", 600: "#0d9488", 700: "#0f766e",
        },
      },
      borderRadius: {
        xl2: "1.25rem",
        "4xl": "2rem",
        card: "var(--radius-card)",
        btn: "var(--radius-button)",
        nav: "var(--radius-nav)",
      },
      fontFamily: {
        sans: [
          "Pretendard Variable", "Pretendard", "-apple-system", "BlinkMacSystemFont",
          '"Apple SD Gothic Neo"', '"Malgun Gothic"', '"Noto Sans KR"', "system-ui", "sans-serif",
        ],
      },
      boxShadow: {
        soft: "var(--shadow-soft)",
        card: "var(--shadow-card)",
        cardhover: "var(--shadow-cardhover)",
        fab: "var(--shadow-fab)",
        sheet: "var(--shadow-sheet)",
        aqua: "var(--shadow-aqua)",
      },
      keyframes: {
        fadeIn: { from: { opacity: "0", transform: "translateY(6px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        scaleIn: { from: { opacity: "0", transform: "scale(0.96)" }, to: { opacity: "1", transform: "scale(1)" } },
        shimmer: { from: { backgroundPosition: "-200% 0" }, to: { backgroundPosition: "200% 0" } },
      },
      animation: {
        fadein: "fadeIn .35s ease-out both",
        scalein: "scaleIn .2s ease-out both",
        shimmer: "shimmer 1.5s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
