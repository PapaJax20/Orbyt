import type { TaskPriority } from "../types/tasks";

export const TASK_PRIORITIES: {
  value: TaskPriority;
  label: string;
  color: string;
  dotClass: string;
}[] = [
  { value: "low", label: "Low", color: "#9CA3AF", dotClass: "bg-chrome-400" },
  { value: "medium", label: "Medium", color: "#00D4FF", dotClass: "bg-teal-400" },
  { value: "high", label: "High", color: "#FFD700", dotClass: "bg-gold-400" },
  { value: "urgent", label: "Urgent", color: "#F97316", dotClass: "bg-orange-500" },
];
