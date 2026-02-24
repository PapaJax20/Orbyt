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
import { events } from "./events";

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
    // Sprint 17B: incremental sync tokens
    syncToken: text("sync_token"), // Google nextSyncToken for incremental sync
    deltaLink: text("delta_link"), // Microsoft deltaLink for incremental sync
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
    // Sprint 17B: bidirectional linking
    orbytEventId: uuid("orbyt_event_id").references(() => events.id, { onDelete: "set null" }),
    etag: text("etag"), // provider-supplied ETag for conflict detection
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueExternalEvent: unique().on(t.connectedAccountId, t.externalId),
  })
);

/**
 * Webhook subscriptions for push-based calendar change notifications.
 * One subscription per connected account per provider.
 */
export const webhookSubscriptions = pgTable(
  "webhook_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    connectedAccountId: uuid("connected_account_id")
      .references(() => connectedAccounts.id, { onDelete: "cascade" })
      .notNull(),
    provider: varchar("provider", { length: 20 }).notNull(), // "google" | "microsoft"
    subscriptionId: varchar("subscription_id", { length: 512 }).notNull(), // provider-issued subscription/channel ID
    resourceId: varchar("resource_id", { length: 512 }), // Google resource ID for channel renewal
    notificationUrl: text("notification_url").notNull(), // our webhook endpoint URL
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), // when the subscription expires
    syncToken: text("sync_token"), // incremental sync token at time of subscription
    deltaLink: text("delta_link"), // Microsoft delta link at time of subscription
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (t) => ({
    uniqueAccountProvider: unique().on(t.connectedAccountId, t.provider),
  })
);

export type ConnectedAccount = typeof connectedAccounts.$inferSelect;
export type NewConnectedAccount = typeof connectedAccounts.$inferInsert;
export type ExternalEvent = typeof externalEvents.$inferSelect;
export type NewExternalEvent = typeof externalEvents.$inferInsert;
export type WebhookSubscription = typeof webhookSubscriptions.$inferSelect;
export type NewWebhookSubscription = typeof webhookSubscriptions.$inferInsert;
