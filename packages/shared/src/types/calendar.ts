export type EventCategory =
  | "school"
  | "medical"
  | "work"
  | "sports"
  | "social"
  | "family"
  | "holiday"
  | "birthday"
  | "other";

export type RsvpStatus = "pending" | "accepted" | "declined";

export type RecurrenceUpdateMode = "this" | "this_and_future" | "all";

export interface CalendarEvent {
  id: string;
  householdId: string;
  createdBy: string;
  title: string;
  description: string | null;
  location: string | null;
  category: EventCategory;
  startAt: Date;
  endAt: Date | null;
  allDay: boolean;
  rrule: string | null; // RFC 5545 RRULE string
  parentEventId: string | null;
  color: string | null; // override hex color
  attendees: EventAttendee[];
  createdAt: Date;
  updatedAt: Date;
}

export interface EventAttendee {
  id: string;
  eventId: string;
  userId: string | null;
  contactId: string | null;
  rsvpStatus: RsvpStatus;
}

// Expanded recurring event instance (not stored in DB, generated client-side)
export interface CalendarEventInstance extends Omit<CalendarEvent, "rrule" | "parentEventId"> {
  instanceDate: Date; // The specific occurrence date
  isRecurringInstance: boolean;
  originalEventId: string;
}
