import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  jsonb,
  unique,
  boolean,
} from "drizzle-orm/pg-core";

export const profiles = pgTable("profiles", {
  id: uuid("id").primaryKey(), // matches auth.users.id exactly
  email: varchar("email", { length: 255 }).notNull(),
  displayName: varchar("display_name", { length: 100 }).notNull(),
  avatarUrl: text("avatar_url"),
  avatarType: varchar("avatar_type", { length: 20 }).default("photo").notNull(),
  aiPersona: varchar("ai_persona", { length: 10 }).default("rosie").notNull(),
  theme: varchar("theme", { length: 30 }).default("cosmic").notNull(),
  timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
  financeModules: jsonb("finance_modules")
    .$type<{
      goals?: boolean;
      netWorth?: boolean;
      debtPlanner?: boolean;
    }>()
    .default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const households = pgTable("households", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  slug: varchar("slug", { length: 100 }).unique(),
  avatarUrl: text("avatar_url"),
  timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
  settings: jsonb("settings")
    .$type<{
      weekStartDay?: 0 | 1;
      dateFormat?: string;
      currency?: string;
    }>()
    .default({}),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const householdMembers = pgTable(
  "household_members",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    householdId: uuid("household_id")
      .references(() => households.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    role: varchar("role", { length: 20 }).default("member").notNull(),
    displayColor: varchar("display_color", { length: 7 }).notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueMember: unique().on(t.householdId, t.userId),
  })
);

export const invitations = pgTable("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  invitedEmail: varchar("invited_email", { length: 255 }).notNull(),
  invitedBy: uuid("invited_by")
    .references(() => profiles.id)
    .notNull(),
  token: uuid("token").defaultRandom().unique().notNull(),
  role: varchar("role", { length: 20 }).default("member").notNull(),
  status: varchar("status", { length: 20 }).default("pending").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Type exports for Drizzle inference
export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
export type Household = typeof households.$inferSelect;
export type NewHousehold = typeof households.$inferInsert;
export type HouseholdMember = typeof householdMembers.$inferSelect;
export type Invitation = typeof invitations.$inferSelect;
