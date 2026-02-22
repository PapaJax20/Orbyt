import type { Config } from "tailwindcss";

/**
 * Orbyt Design System — "Jetsons 2025 Reboot"
 * Color palette and design tokens shared across web and mobile.
 */
export const orbytPalette = {
  // Deep space navy — primary backgrounds
  navy: {
    950: "#030B14",
    900: "#0B1929",
    800: "#0F2238",
    700: "#152D4A",
    600: "#1C3D61",
    500: "#244F7D",
  },
  // Electric teal — primary accent (Cosmic theme)
  teal: {
    300: "#33DCFF",
    400: "#00D4FF",
    500: "#00AACC",
    600: "#007FA0",
  },
  // Warm white — primary text
  white: {
    50: "#F0F8FF",
    100: "#E1F0FF",
    200: "#C8E0F0",
  },
  // Accent gold — CTAs, highlights
  gold: {
    300: "#FFE44D",
    400: "#FFD700",
    500: "#CCA800",
    600: "#997E00",
  },
  // Chrome silver — secondary elements
  chrome: {
    200: "#E8E8E8",
    300: "#D8D8D8",
    400: "#C0C0C0",
    500: "#A0A0A0",
    600: "#808080",
  },
} as const;

/**
 * Theme-specific CSS variable mappings.
 * Each theme overrides these CSS vars via `data-theme` on <html>.
 */
export const orbytThemes = {
  cosmic: {
    // Dark — Deep space Jetsons (default)
    "--color-bg": "11 25 41", // navy-900
    "--color-bg-subtle": "15 34 56", // navy-800
    "--color-surface": "21 45 74", // navy-700 with opacity
    "--color-border": "0 212 255", // teal-400
    "--color-text": "240 248 255", // white-50
    "--color-text-muted": "192 192 192", // chrome-400
    "--color-accent": "0 212 255", // teal-400
    "--color-accent-hover": "0 170 204", // teal-500
    "--color-cta": "255 215 0", // gold-400
    "--color-cta-hover": "204 168 0", // gold-500
  },
  solar: {
    // Light — Warm, airy
    "--color-bg": "255 253 245",
    "--color-bg-subtle": "255 248 230",
    "--color-surface": "255 255 255",
    "--color-border": "204 168 0", // gold-500
    "--color-text": "11 25 41", // navy-900
    "--color-text-muted": "128 128 128",
    "--color-accent": "204 168 0", // gold-500
    "--color-accent-hover": "153 126 0", // gold-600
    "--color-cta": "0 212 255", // teal-400
    "--color-cta-hover": "0 170 204",
  },
  aurora: {
    // Dark — Soft purple/rose
    "--color-bg": "26 11 46",
    "--color-bg-subtle": "36 18 60",
    "--color-surface": "46 24 78",
    "--color-border": "192 132 252",
    "--color-text": "253 244 255",
    "--color-text-muted": "192 132 252",
    "--color-accent": "192 132 252",
    "--color-accent-hover": "168 85 247",
    "--color-cta": "255 215 0",
    "--color-cta-hover": "204 168 0",
  },
  "aurora-light": {
    // Light — Soft lavender
    "--color-bg": "253 244 255",
    "--color-bg-subtle": "250 232 255",
    "--color-surface": "255 255 255",
    "--color-border": "168 85 247",
    "--color-text": "26 11 46",
    "--color-text-muted": "128 100 160",
    "--color-accent": "168 85 247",
    "--color-accent-hover": "139 22 232",
    "--color-cta": "0 212 255",
    "--color-cta-hover": "0 170 204",
  },
  nebula: {
    // Dark — Blue/indigo
    "--color-bg": "10 15 46",
    "--color-bg-subtle": "16 24 68",
    "--color-surface": "24 34 90",
    "--color-border": "129 140 248",
    "--color-text": "238 242 255",
    "--color-text-muted": "129 140 248",
    "--color-accent": "129 140 248",
    "--color-accent-hover": "99 102 241",
    "--color-cta": "255 215 0",
    "--color-cta-hover": "204 168 0",
  },
  titanium: {
    // Dark — Neutral/minimal
    "--color-bg": "17 24 39",
    "--color-bg-subtle": "31 41 55",
    "--color-surface": "55 65 81",
    "--color-border": "156 163 175",
    "--color-text": "249 250 251",
    "--color-text-muted": "156 163 175",
    "--color-accent": "209 213 219",
    "--color-accent-hover": "156 163 175",
    "--color-cta": "0 212 255",
    "--color-cta-hover": "0 170 204",
  },
  "titanium-light": {
    // Light — Clean minimal
    "--color-bg": "249 250 251",
    "--color-bg-subtle": "243 244 246",
    "--color-surface": "255 255 255",
    "--color-border": "156 163 175",
    "--color-text": "17 24 39",
    "--color-text-muted": "107 114 128",
    "--color-accent": "75 85 99",
    "--color-accent-hover": "55 65 81",
    "--color-cta": "0 212 255",
    "--color-cta-hover": "0 170 204",
  },
  ember: {
    // Dark — Warm amber
    "--color-bg": "28 10 0",
    "--color-bg-subtle": "45 18 4",
    "--color-surface": "68 28 8",
    "--color-border": "249 115 22",
    "--color-text": "255 247 237",
    "--color-text-muted": "249 115 22",
    "--color-accent": "249 115 22",
    "--color-accent-hover": "234 88 12",
    "--color-cta": "255 215 0",
    "--color-cta-hover": "204 168 0",
  },
  "ember-light": {
    // Light — Warm cream
    "--color-bg": "255 247 237",
    "--color-bg-subtle": "255 237 213",
    "--color-surface": "255 255 255",
    "--color-border": "234 88 12",
    "--color-text": "28 10 0",
    "--color-text-muted": "154 52 18",
    "--color-accent": "234 88 12",
    "--color-accent-hover": "194 65 12",
    "--color-cta": "0 212 255",
    "--color-cta-hover": "0 170 204",
  },
} as const;

export type OrbytTheme = keyof typeof orbytThemes;

export const orbytBaseConfig: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        ...orbytPalette,
        // Semantic theme-aware colors (driven by CSS vars)
        bg: "rgb(var(--color-bg) / <alpha-value>)",
        "bg-subtle": "rgb(var(--color-bg-subtle) / <alpha-value>)",
        surface: "rgb(var(--color-surface) / <alpha-value>)",
        border: "rgb(var(--color-border) / <alpha-value>)",
        text: "rgb(var(--color-text) / <alpha-value>)",
        "text-muted": "rgb(var(--color-text-muted) / <alpha-value>)",
        accent: "rgb(var(--color-accent) / <alpha-value>)",
        "accent-hover": "rgb(var(--color-accent-hover) / <alpha-value>)",
        cta: "rgb(var(--color-cta) / <alpha-value>)",
        "cta-hover": "rgb(var(--color-cta-hover) / <alpha-value>)",
      },
      fontFamily: {
        display: ["var(--font-urbanist)", "Urbanist", "system-ui", "-apple-system", "sans-serif"],
        body: ["var(--font-urbanist)", "Urbanist", "system-ui", "-apple-system", "sans-serif"],
      },
      keyframes: {
        "orbital-spin": {
          "0%": { transform: "rotate(0deg)" },
          "100%": { transform: "rotate(360deg)" },
        },
        "glow-pulse": {
          "0%, 100%": { boxShadow: "0 0 8px rgb(var(--color-accent) / 0.3)" },
          "50%": { boxShadow: "0 0 24px rgb(var(--color-accent) / 0.7)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-right": {
          "0%": { transform: "translateX(100%)" },
          "100%": { transform: "translateX(0)" },
        },
        "fade-in": {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
      },
      animation: {
        "orbital-slow": "orbital-spin 3s linear infinite",
        "orbital-medium": "orbital-spin 2s linear infinite",
        "orbital-fast": "orbital-spin 1.2s linear infinite",
        "glow-pulse": "glow-pulse 2s ease-in-out infinite",
        float: "float 3s ease-in-out infinite",
        "slide-up": "slide-up 0.25s ease-out",
        "slide-in-right": "slide-in-right 0.3s cubic-bezier(0.22, 1, 0.36, 1)",
        "fade-in": "fade-in 0.2s ease-out",
      },
      backgroundImage: {
        "space-gradient":
          "radial-gradient(ellipse at top, rgb(21 45 74) 0%, rgb(11 25 41) 60%, rgb(3 11 20) 100%)",
        "glass-surface":
          "linear-gradient(135deg, rgb(var(--color-surface) / 0.7) 0%, rgb(var(--color-surface) / 0.4) 100%)",
      },
      backdropBlur: {
        glass: "12px",
      },
      boxShadow: {
        glass: "0 4px 24px rgb(0 0 0 / 0.4), inset 0 1px 0 rgb(255 255 255 / 0.05)",
        "glass-hover":
          "0 8px 32px rgb(0 0 0 / 0.5), 0 0 20px rgb(var(--color-accent) / 0.2), inset 0 1px 0 rgb(255 255 255 / 0.08)",
        glow: "0 0 20px rgb(var(--color-accent) / 0.4)",
        "glow-strong": "0 0 40px rgb(var(--color-accent) / 0.7)",
      },
      borderRadius: {
        "4xl": "2rem",
      },
    },
  },
};
