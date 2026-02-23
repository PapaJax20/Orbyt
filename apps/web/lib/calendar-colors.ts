// ── Shared calendar category colors ──────────────────────────────────────────
// Single source of truth used by calendar-content, event-drawer, event-popover.

export const CATEGORY_COLORS: Record<string, string> = {
  family: "#06B6D4",   // cyan
  work: "#3B82F6",     // blue
  medical: "#10B981",  // emerald
  health: "#10B981",   // backward compat with seed data
  school: "#8B5CF6",   // purple
  social: "#F59E0B",   // amber
  sports: "#EF4444",   // red
  holiday: "#EC4899",  // pink
  birthday: "#F97316", // orange
  other: "#6B7280",    // gray
};

export function getCategoryColor(category: string): string {
  return CATEGORY_COLORS[category] ?? CATEGORY_COLORS["other"] ?? "#6366f1";
}
