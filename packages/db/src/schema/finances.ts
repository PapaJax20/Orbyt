import {
  pgTable,
  uuid,
  varchar,
  text,
  timestamp,
  boolean,
  numeric,
  integer,
  date,
  jsonb,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { households, profiles } from "./households";

export const bills = pgTable("bills", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: uuid("created_by")
    .references(() => profiles.id)
    .notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  dueDay: integer("due_day").notNull(),
  rrule: text("rrule").notNull(),
  autoPay: boolean("auto_pay").default(false).notNull(),
  notes: text("notes"),
  url: text("url"),
  isActive: boolean("is_active").default(true).notNull(),
  assignedTo: uuid("assigned_to").references(() => profiles.id),
  notifyOnPaid: text("notify_on_paid")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const billPayments = pgTable("bill_payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  billId: uuid("bill_id")
    .references(() => bills.id, { onDelete: "cascade" })
    .notNull(),
  paidBy: uuid("paid_by")
    .references(() => profiles.id)
    .notNull(),
  amount: numeric("amount", { precision: 10, scale: 2 }).notNull(),
  paidAt: timestamp("paid_at", { withTimezone: true }).notNull(),
  dueDate: timestamp("due_date", { withTimezone: true }).notNull(),
  status: varchar("status", { length: 20 }).default("paid").notNull(),
  notes: text("notes"),
  receiptUrl: text("receipt_url"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Accounts ---
export const accounts = pgTable("accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: uuid("created_by")
    .references(() => profiles.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  type: varchar("type", { length: 20 }).notNull(),
  balance: numeric("balance", { precision: 12, scale: 2 }).default("0").notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  institution: varchar("institution", { length: 100 }),
  accountNumber: varchar("account_number", { length: 4 }),
  isActive: boolean("is_active").default(true).notNull(),
  ownerId: uuid("owner_id").references(() => profiles.id),
  ownership: varchar("ownership", { length: 10 }).default("ours").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Transactions ---
export const transactions = pgTable("transactions", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  accountId: uuid("account_id").references(() => accounts.id, { onDelete: "set null" }),
  createdBy: uuid("created_by")
    .references(() => profiles.id)
    .notNull(),
  type: varchar("type", { length: 10 }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  currency: varchar("currency", { length: 3 }).default("USD").notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  description: varchar("description", { length: 255 }).notNull(),
  date: date("date").notNull(),
  notes: text("notes"),
  isRecurring: boolean("is_recurring").default(false).notNull(),
  recurringFrequency: varchar("recurring_frequency", { length: 20 }),
  tags: text("tags")
    .array()
    .default(sql`'{}'::text[]`),
  splitWith: jsonb("split_with"),
  ownership: varchar("ownership", { length: 10 }).default("ours").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// --- Budgets ---
export const budgets = pgTable("budgets", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  monthlyLimit: numeric("monthly_limit", { precision: 12, scale: 2 }).notNull(),
  rollover: boolean("rollover").default(false).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Savings Goals ---
export const savingsGoals = pgTable("savings_goals", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  createdBy: uuid("created_by")
    .references(() => profiles.id)
    .notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  targetAmount: numeric("target_amount", { precision: 12, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 12, scale: 2 }).default("0").notNull(),
  targetDate: date("target_date"),
  monthlyContribution: numeric("monthly_contribution", { precision: 12, scale: 2 }),
  category: varchar("category", { length: 30 }).default("savings").notNull(),
  linkedAccountId: uuid("linked_account_id").references(() => accounts.id, { onDelete: "set null" }),
  emoji: varchar("emoji", { length: 4 }),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// --- Expense Splits ---
export const expenseSplits = pgTable("expense_splits", {
  id: uuid("id").defaultRandom().primaryKey(),
  householdId: uuid("household_id")
    .references(() => households.id, { onDelete: "cascade" })
    .notNull(),
  transactionId: uuid("transaction_id")
    .references(() => transactions.id, { onDelete: "cascade" })
    .notNull(),
  owedBy: uuid("owed_by")
    .references(() => profiles.id)
    .notNull(),
  owedTo: uuid("owed_to")
    .references(() => profiles.id)
    .notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  settled: boolean("settled").default(false).notNull(),
  settledAt: timestamp("settled_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Bill = typeof bills.$inferSelect;
export type NewBill = typeof bills.$inferInsert;
export type BillPayment = typeof billPayments.$inferSelect;
export type Account = typeof accounts.$inferSelect;
export type NewAccount = typeof accounts.$inferInsert;
export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;
export type Budget = typeof budgets.$inferSelect;
export type NewBudget = typeof budgets.$inferInsert;
export type SavingsGoal = typeof savingsGoals.$inferSelect;
export type NewSavingsGoal = typeof savingsGoals.$inferInsert;
export type ExpenseSplit = typeof expenseSplits.$inferSelect;
export type NewExpenseSplit = typeof expenseSplits.$inferInsert;
