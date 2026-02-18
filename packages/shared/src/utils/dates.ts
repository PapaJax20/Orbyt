import {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isYesterday,
  addDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  parseISO,
  isSameDay,
} from "date-fns";

export {
  format,
  formatDistanceToNow,
  isToday,
  isTomorrow,
  isYesterday,
  addDays,
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  differenceInDays,
  parseISO,
  isSameDay,
};

/**
 * Format a date for display in the app.
 * Returns friendly labels like "Today", "Tomorrow", "Yesterday" when applicable.
 */
export function formatFriendlyDate(date: Date, includeTime = false): string {
  if (isToday(date)) {
    return includeTime ? `Today at ${format(date, "h:mm a")}` : "Today";
  }
  if (isTomorrow(date)) {
    return includeTime ? `Tomorrow at ${format(date, "h:mm a")}` : "Tomorrow";
  }
  if (isYesterday(date)) {
    return includeTime ? `Yesterday at ${format(date, "h:mm a")}` : "Yesterday";
  }
  const pattern = includeTime ? "MMM d 'at' h:mm a" : "MMM d, yyyy";
  return format(date, pattern);
}

/**
 * Get the next birthday occurrence from a stored birthday string (YYYY-MM-DD).
 * Returns null if no birthday is set.
 */
export function getNextBirthday(birthdayStr: string): Date | null {
  if (!birthdayStr) return null;
  const today = startOfDay(new Date());
  const birthday = parseISO(birthdayStr);
  const thisYear = new Date(today.getFullYear(), birthday.getMonth(), birthday.getDate());
  if (thisYear >= today) return thisYear;
  return new Date(today.getFullYear() + 1, birthday.getMonth(), birthday.getDate());
}

/**
 * Get days until next birthday. Returns 0 if today.
 */
export function getDaysUntilBirthday(birthdayStr: string): number | null {
  const nextBirthday = getNextBirthday(birthdayStr);
  if (!nextBirthday) return null;
  return differenceInDays(nextBirthday, startOfDay(new Date()));
}

/**
 * Format a date range for display (e.g., "Jan 5 - Jan 8" or "Jan 5, 2:00 PM - 4:00 PM")
 */
export function formatDateRange(startAt: Date, endAt: Date | null, allDay: boolean): string {
  if (!endAt || isSameDay(startAt, endAt)) {
    if (allDay) return format(startAt, "EEEE, MMMM d");
    return `${format(startAt, "EEEE, MMMM d")} · ${format(startAt, "h:mm a")} – ${endAt ? format(endAt, "h:mm a") : ""}`;
  }
  if (allDay) {
    return `${format(startAt, "MMM d")} – ${format(endAt, "MMM d")}`;
  }
  return `${format(startAt, "MMM d, h:mm a")} – ${format(endAt, "MMM d, h:mm a")}`;
}

/**
 * Get the next due date for a bill given its due day of month.
 */
export function getNextBillDueDate(dueDay: number): Date {
  const today = startOfDay(new Date());
  const currentMonthDue = new Date(today.getFullYear(), today.getMonth(), dueDay);
  if (currentMonthDue >= today) return currentMonthDue;
  return new Date(today.getFullYear(), today.getMonth() + 1, dueDay);
}
