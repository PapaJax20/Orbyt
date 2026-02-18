import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  date,
  jsonb,
  unique,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { households, profiles } from "./households";

export const contacts = pgTable("contacts", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: uuid("created_by")
    .references(() => profiles.id)
    .notNull(),
  firstName: varchar("first_name", { length: 100 }).notNull(),
  lastName: varchar("last_name", { length: 100 }),
  relationshipType: varchar("relationship_type", { length: 50 }).notNull(),
  email: varchar("email", { length: 255 }),
  phone: varchar("phone", { length: 50 }),
  address: jsonb("address")
    .$type<{
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    }>()
    .default({}),
  birthday: date("birthday"),
  anniversary: date("anniversary"),
  avatarUrl: text("avatar_url"),
  socialLinks: jsonb("social_links")
    .$type<{
      instagram?: string;
      facebook?: string;
      linkedin?: string;
      twitter?: string;
      website?: string;
    }>()
    .default({}),
  notes: text("notes"),
  tags: text("tags")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  linkedUserId: uuid("linked_user_id").references(() => profiles.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const contactRelationships = pgTable(
  "contact_relationships",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    fromContactId: uuid("from_contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    toContactId: uuid("to_contact_id")
      .references(() => contacts.id, { onDelete: "cascade" })
      .notNull(),
    relationshipLabel: varchar("relationship_label", { length: 100 }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueRelationship: unique().on(t.fromContactId, t.toContactId),
  })
);

export const contactNotes = pgTable("contact_notes", {
  id: uuid("id").defaultRandom().primaryKey(),
  contactId: uuid("contact_id")
    .references(() => contacts.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => profiles.id, { onDelete: "cascade" })
    .notNull(),
  content: text("content").notNull(),
  noteDate: timestamp("note_date").defaultNow(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Contact = typeof contacts.$inferSelect;
export type NewContact = typeof contacts.$inferInsert;
export type ContactRelationship = typeof contactRelationships.$inferSelect;
export type ContactNote = typeof contactNotes.$inferSelect;
