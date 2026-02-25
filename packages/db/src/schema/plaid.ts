import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
} from "drizzle-orm/pg-core";
import { households, profiles } from "./households";
import { accounts } from "./finances";

/**
 * Plaid connected bank items (one per institution connection).
 * Stores encrypted access tokens and sync state for each linked bank.
 */
export const plaidItems = pgTable("plaid_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  userId: uuid("user_id")
    .references(() => profiles.id)
    .notNull(),
  plaidItemId: varchar("plaid_item_id", { length: 100 }).unique().notNull(), // Plaid's item_id
  accessToken: text("access_token").notNull(), // AES-256-GCM encrypted
  institutionId: varchar("institution_id", { length: 50 }), // Plaid institution ID
  institutionName: varchar("institution_name", { length: 200 }), // Display name
  transactionsCursor: text("transactions_cursor"), // For incremental sync
  consentExpiresAt: timestamp("consent_expires_at", { withTimezone: true }), // Plaid consent expiry
  lastSyncAt: timestamp("last_sync_at", { withTimezone: true }),
  syncError: text("sync_error"),
  status: varchar("status", { length: 20 }).default("active").notNull(), // "active" | "login_required" | "error" | "disconnected"
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

/**
 * Individual bank accounts within a Plaid item.
 * May be linked to an existing Orbyt account for balance sync.
 */
export const plaidAccounts = pgTable("plaid_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  plaidItemId: uuid("plaid_item_id")
    .references(() => plaidItems.id, { onDelete: "cascade" })
    .notNull(),
  orbytAccountId: uuid("orbyt_account_id").references(() => accounts.id, {
    onDelete: "set null",
  }), // nullable, links to existing Orbyt account
  plaidAccountId: varchar("plaid_account_id", { length: 100 }).unique().notNull(), // Plaid's account_id
  name: varchar("name", { length: 200 }).notNull(),
  officialName: varchar("official_name", { length: 200 }),
  type: varchar("type", { length: 20 }).notNull(), // "depository" | "credit" | "loan" | "investment"
  subtype: varchar("subtype", { length: 50 }),
  mask: varchar("mask", { length: 4 }), // Last 4 digits
  currentBalance: numeric("current_balance", { precision: 12, scale: 2 }),
  availableBalance: numeric("available_balance", { precision: 12, scale: 2 }),
  isoCurrencyCode: varchar("iso_currency_code", { length: 3 }).default("USD").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export type PlaidItem = typeof plaidItems.$inferSelect;
export type NewPlaidItem = typeof plaidItems.$inferInsert;
export type PlaidAccount = typeof plaidAccounts.$inferSelect;
export type NewPlaidAccount = typeof plaidAccounts.$inferInsert;
