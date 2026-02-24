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
import { profiles } from "./households";

/**
 * Connected external calendar accounts (Google, Microsoft).
 * Stores OAuth tokens (encrypted refresh token) for syncing.
 */
export const connectedAccounts = pgTable(
  "connected_accounts",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: uuid("user_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    provider: varchar("provider", { length: 20 }).notNull(), // "google" | "microsoft"
    providerAccountId: varchar("provider_account_id", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    accessToken: text("access_token"), // encrypted
    refreshToken: text("refresh_token"), // encrypted
    tokenExpiresAt: timestamp("token_expires_at", { withTimezone: true }),
    scopes: text("scopes"), // space-separated OAuth scopes granted
    calendarId: varchar("calendar_id", { length: 255 }), // primary calendar ID to sync
    lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
    syncError: text("sync_error"), // last sync error message if any
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueProviderAccount: unique().on(t.userId, t.provider, t.providerAccountId),
  })
);

/**
 * External calendar events imported from connected accounts.
 * Read-only mirror of Google/Microsoft events. Not editable in Orbyt.
 */
export const externalEvents = pgTable(
  "external_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectedAccountId: uuid("connected_account_id")
      .references(() => connectedAccounts.id, { onDelete: "cascade" })
      .notNull(),
    userId: uuid("user_id")
      .references(() => profiles.id, { onDelete: "cascade" })
      .notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(), // Google/Microsoft event ID
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    location: text("location"),
    startAt: timestamp("start_at", { withTimezone: true }).notNull(),
    endAt: timestamp("end_at", { withTimezone: true }),
    allDay: boolean("all_day").default(false).notNull(),
    status: varchar("status", { length: 20 }).default("confirmed"), // "confirmed" | "tentative" | "cancelled"
    metadata: jsonb("metadata").default({}), // provider-specific extra data
    lastUpdatedExternal: timestamp("last_updated_external", { withTimezone: true }), // when the external event was last modified
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueExternalEvent: unique().on(t.connectedAccountId, t.externalId),
  })
);

export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type NewConnectedAccount = typeof connectedAccounts.$inferInsert;
export type ExternalEvent = typeof externalEvents.$inferSelect;
export type NewExternalEvent = typeof externalEvents.$inferInsert;
