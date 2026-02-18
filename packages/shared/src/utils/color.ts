/**
 * Generate a deterministic color from a string (for member display colors).
 */
export function stringToColor(str: string): string {
  const ORBYT_COLORS = [
    "#00D4FF", // teal
    "#FFD700", // gold
    "#C084FC", // violet
    "#818CF8", // indigo
    "#F97316", // orange
    "#34D399", // emerald
    "#FB7185", // rose
    "#38BDF8", // sky
  ];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return ORBYT_COLORS[Math.abs(hash) % ORBYT_COLORS.length] ?? "#00D4FF";
}

/**
 * Determine if a hex color needs dark or light text on top of it.
 */
export function getContrastTextColor(hexColor: string): "dark" | "light" {
  const hex = hexColor.replace("#", "");
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  // Using WCAG luminance formula
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? "dark" : "light";
}

/**
 * Predefined member color palette (used in household setup).
 */
export const MEMBER_COLORS = [
  { hex: "#00D4FF", name: "Teal" },
  { hex: "#FFD700", name: "Gold" },
  { hex: "#C084FC", name: "Violet" },
  { hex: "#818CF8", name: "Indigo" },
  { hex: "#F97316", name: "Orange" },
  { hex: "#34D399", name: "Emerald" },
  { hex: "#FB7185", name: "Rose" },
  { hex: "#38BDF8", name: "Sky" },
  { hex: "#A78BFA", name: "Purple" },
  { hex: "#F472B6", name: "Pink" },
] as const;
