import type { OrbytTheme } from "../types/household";

export interface ThemeOption {
  id: OrbytTheme;
  name: string;
  description: string;
  isDark: boolean;
  previewColors: {
    bg: string;
    accent: string;
    text: string;
  };
}

export const THEME_OPTIONS: ThemeOption[] = [
  {
    id: "cosmic",
    name: "Cosmic",
    description: "Deep space Jetsons — the Orbyt signature look",
    isDark: true,
    previewColors: { bg: "#0B1929", accent: "#00D4FF", text: "#F0F8FF" },
  },
  {
    id: "solar",
    name: "Solar",
    description: "Warm, bright, and airy",
    isDark: false,
    previewColors: { bg: "#FFFDF5", accent: "#CCA800", text: "#0B1929" },
  },
  {
    id: "aurora",
    name: "Aurora Dark",
    description: "Soft purple and rose — cosmic and romantic",
    isDark: true,
    previewColors: { bg: "#1A0B2E", accent: "#C084FC", text: "#FDF4FF" },
  },
  {
    id: "aurora-light",
    name: "Aurora Light",
    description: "Soft lavender on white",
    isDark: false,
    previewColors: { bg: "#FDF4FF", accent: "#A855F7", text: "#1A0B2E" },
  },
  {
    id: "nebula",
    name: "Nebula",
    description: "Deep blue and indigo — focused and calm",
    isDark: true,
    previewColors: { bg: "#0A0F2E", accent: "#818CF8", text: "#EEF2FF" },
  },
  {
    id: "titanium",
    name: "Titanium Dark",
    description: "Neutral and minimal — all business",
    isDark: true,
    previewColors: { bg: "#111827", accent: "#D1D5DB", text: "#F9FAFB" },
  },
  {
    id: "titanium-light",
    name: "Titanium Light",
    description: "Clean white — classic and crisp",
    isDark: false,
    previewColors: { bg: "#F9FAFB", accent: "#6B7280", text: "#111827" },
  },
  {
    id: "ember",
    name: "Ember Dark",
    description: "Warm amber — cozy and energetic",
    isDark: true,
    previewColors: { bg: "#1C0A00", accent: "#F97316", text: "#FFF7ED" },
  },
  {
    id: "ember-light",
    name: "Ember Light",
    description: "Warm cream — inviting and earthy",
    isDark: false,
    previewColors: { bg: "#FFF7ED", accent: "#EA580C", text: "#1C0A00" },
  },
];

export const DEFAULT_THEME: OrbytTheme = "cosmic";
