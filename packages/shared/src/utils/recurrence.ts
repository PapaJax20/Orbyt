import { RRule, RRuleSet, rrulestr } from "rrule";
import type { CalendarEvent, CalendarEventInstance } from "../types/calendar";

/**
 * Expand recurring events within a date range.
 * Returns an array of event instances, with recurring events expanded
 * into individual occurrences.
 */
export function expandRecurringEvents(
  events: CalendarEvent[],
  startDate: Date,
  endDate: Date
): CalendarEventInstance[] {
  const instances: CalendarEventInstance[] = [];

  for (const event of events) {
    if (!event.rrule) {
      // Non-recurring event — include if it overlaps with the range
      const eventEnd = event.endAt ?? event.startAt;
      if (event.startAt <= endDate && eventEnd >= startDate) {
        instances.push({
          ...event,
          instanceDate: event.startAt,
          isRecurringInstance: false,
          originalEventId: event.id,
        });
      }
      continue;
    }

    // Recurring event — expand occurrences
    try {
      const rule = rrulestr(event.rrule, { dtstart: event.startAt });
      const occurrences = rule.between(startDate, endDate, true);

      for (const occurrence of occurrences) {
        const duration =
          event.endAt ? event.endAt.getTime() - event.startAt.getTime() : 0;
        instances.push({
          ...event,
          startAt: occurrence,
          endAt: event.endAt ? new Date(occurrence.getTime() + duration) : null,
          instanceDate: occurrence,
          isRecurringInstance: true,
          originalEventId: event.id,
        });
      }
    } catch {
      // If RRULE parsing fails, include the base event
      instances.push({
        ...event,
        instanceDate: event.startAt,
        isRecurringInstance: false,
        originalEventId: event.id,
      });
    }
  }

  return instances.sort((a, b) => a.startAt.getTime() - b.startAt.getTime());
}

/**
 * Build an RRULE string for common recurrence patterns.
 */
export function buildRRule(options: {
  freq: "daily" | "weekly" | "monthly" | "yearly";
  interval?: number;
  byWeekDay?: number[]; // 0=Mon, 1=Tue, ... 6=Sun
  until?: Date;
  count?: number;
}): string {
  const freqMap = {
    daily: RRule.DAILY,
    weekly: RRule.WEEKLY,
    monthly: RRule.MONTHLY,
    yearly: RRule.YEARLY,
  };

  const rule = new RRule({
    freq: freqMap[options.freq],
    interval: options.interval ?? 1,
    byweekday: options.byWeekDay?.map((d) => d),
    until: options.until ?? null,
    count: options.count ?? null,
  });

  return rule.toString();
}

/**
 * Get a human-readable description of an RRULE.
 * e.g. "Every week on Monday and Wednesday"
 */
export function describeRRule(rruleStr: string): string {
  try {
    const rule = rrulestr(rruleStr);
    return rule.toText();
  } catch {
    return "Custom recurrence";
  }
}

/**
 * Get the next occurrence of an RRULE after a given date.
 */
export function getNextOccurrence(rruleStr: string, after: Date): Date | null {
  try {
    const rule = rrulestr(rruleStr);
    return rule.after(after, false);
  } catch {
    return null;
  }
}

export { RRule, RRuleSet };
