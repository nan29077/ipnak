import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        // ── "navy" remapped to a dark-neutral INK scale ──
        // Light theme used navy as both dark surfaces and primary text.
        // For the dark "입낚" look we invert it: 50 = subtle dark surface,
        // 900 = near-white text. Disjoint background roles (buttons/panels)
        // are routed to `orange`/explicit darks at the class level.
        navy: {
          50: "#222428", 100: "#2b2e33", 200: "#3a3e45", 300: "#6a6f79",
          400: "#868c97", 500: "#9ca2ad", 600: "#babfc7", 700: "#d9dce1",
          800: "#edeff2", 900: "#ffffff", 950: "#0a0a0a",
        },
        // ── Aqua (secondary accent / status) — unchanged ──
        aqua: {
          50: "#ecfdfa", 100: "#cffbf1", 200: "#9ef5e4", 300: "#5fe8d2",
          400: "#2dd4bf", 500: "#16b8a6", 600: "#0d9488", 700: "#0f766e",
        },
        // ── Orange brand accent (primary) — from the design system ──
        orange: {
          50: "#fff4ec", 100: "#ffe6d5", 200: "#feccaa", 300: "#fdac74",
          400: "#fb8b3c", 500: "#f97316", 600: "#ea580c", 700: "#c2410c",
          800: "#9a3412", 900: "#7c2d12",
        },
        // ── Dark surface scale (explicit elevation) ──
        surface: {
          DEFAULT: "#161616", 100: "#1a1a1a", 200: "#1e1e1e",
          300: "#242424", 400: "#272727", 500: "#2e2e2e",
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
