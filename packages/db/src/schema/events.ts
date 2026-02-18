import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { households } from "./households";
import { profiles } from "./households";

export const events = pgTable("events", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: uuid("created_by")
    .references(() => profiles.id)
    .notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description"),
  location: text("location"),
  category: varchar("category", { length: 20 }).default("other").notNull(),
  startAt: timestamp("start_at", { withTimezone: true }).notNull(),
  endAt: timestamp("end_at", { withTimezone: true }),
  allDay: boolean("all_day").default(false).notNull(),
  rrule: text("rrule"),
  parentEventId: uuid("parent_event_id"), // self-reference for recurrence exceptions
  color: varchar("color", { length: 7 }),
  metadata: jsonb("metadata").default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const eventAttendees = pgTable(
  "event_attendees",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    eventId: uuid("event_id")
      .references(() => events.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id").references(() => profiles.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id"),
    rsvpStatus: varchar("rsvp_status", { length: 20 }).default("pending"),
  },
  (t) => ({
    uniqueAttendee: unique().on(t.eventId, t.userId),
  })
);

export type Event = typeof events.$inferSelect;
export type NewEvent = typeof events.$inferInsert;
export type EventAttendee = typeof eventAttendees.$inferSelect;
